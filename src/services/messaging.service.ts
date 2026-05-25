import prisma from '../utils/prisma';
import { messageQueue } from '../config/queues';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { config } from '../config';

export type MessageChannel = 'SMS' | 'WHATSAPP' | 'TELEGRAM' | 'EMAIL';
export type MessageType = 'reminder' | 'nudge' | 'rescue_response' | 'celebration' | 'quick_reply';

class MessagingService {
  /**
   * Send a message — Telegram if the user has connected their account, SMS fallback otherwise.
   */
  async sendMessage(userId: string, content: string, messageType: MessageType = 'nudge') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, phone: true },
    });

    if (user?.telegramChatId && config.telegram.botToken) {
      return this.sendTelegramMessage(userId, content, messageType);
    }
    return this.sendSMSMessage(userId, content, messageType);
  }

  async sendTelegramMessage(userId: string, content: string, messageType: MessageType = 'nudge') {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { telegramChatId: true, firstName: true },
    });

    if (!user?.telegramChatId) {
      logger.warn(`User ${userId} has no Telegram chat ID — falling back to SMS`);
      return this.sendSMSMessage(userId, content, messageType);
    }

    const message = await prisma.message.create({
      data: { userId, channel: 'TELEGRAM', direction: 'OUTBOUND', content, messageType, status: 'SENT' },
    });

    await messageQueue.add('send-telegram', {
      messageId: message.id,
      userId,
      chatId: user.telegramChatId,
      content,
    });

    logger.info(`Telegram message queued for user ${userId}`);
    return message;
  }

  async sendSMSMessage(userId: string, content: string, messageType: MessageType = 'nudge') {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });

    if (!user?.phone) throw new NotFoundError('User not found or has no phone number');

    const message = await prisma.message.create({
      data: { userId, channel: 'SMS', direction: 'OUTBOUND', content, messageType, status: 'SENT' },
    });

    await messageQueue.add('send-sms', { messageId: message.id, userId, phone: user.phone, content });
    logger.info(`SMS message queued for user ${userId}`);
    return message;
  }

  /**
   * Called from the Telegram webhook when a user sends a message to the bot.
   */
  async handleTelegramUpdate(chatId: string, text: string, _telegramUserId?: number) {
    // Deep-link onboarding: /start <userId> — links their Ivy account to this chat
    if (text.startsWith('/start')) {
      const parts = text.split(' ');
      const ivyUserId = parts[1];
      if (ivyUserId) {
        await prisma.user.update({
          where: { id: ivyUserId },
          data: { telegramChatId: chatId },
        });
        logger.info(`Telegram linked for Ivy user ${ivyUserId} → chat ${chatId}`);
        await this.sendTelegramRaw(chatId, "You're connected! I'll reach out here after every call. You can reply any time.");
        return;
      }
      // /start with no payload — unknown user
      await this.sendTelegramRaw(chatId, "Hey! Sign up at ivykeeps.life to connect your account.");
      return;
    }

    // Regular message — look up user by chatId and process
    const user = await prisma.user.findUnique({ where: { telegramChatId: chatId } });
    if (!user) {
      await this.sendTelegramRaw(chatId, "I don't recognise this account. Sign up at ivykeeps.life.");
      return;
    }

    await prisma.message.create({
      data: { userId: user.id, channel: 'TELEGRAM', direction: 'INBOUND', content: text, status: 'DELIVERED' },
    });

    await this.processIncomingMessage(user.id, text, chatId);
  }

  /** Send a raw Telegram message directly (no DB record — used for bot responses during onboarding). */
  async sendTelegramRaw(chatId: string, text: string) {
    const token = config.telegram.botToken;
    if (!token) return;
    const axios = (await import('axios')).default;
    await axios.post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text }).catch((err) => {
      logger.error('Telegram raw send failed:', err?.response?.data ?? err);
    });
  }

  async handleIncomingMessage(phone: string, content: string, _channel: string) {
    const user = await prisma.user.findFirst({ where: { phone } });
    if (!user) {
      logger.warn(`Inbound SMS from unknown number ${phone} — ignored`);
      return;
    }
    await prisma.message.create({
      data: { userId: user.id, channel: 'SMS', direction: 'INBOUND', content, status: 'DELIVERED' },
    });
    await this.processIncomingMessage(user.id, content, '');
  }

  private async processIncomingMessage(userId: string, content: string, chatId: string) {
    const lowerContent = content.toLowerCase().trim();

    if (['call', 'call me', 'call me back'].includes(lowerContent) || lowerContent.includes('call me now') || lowerContent.includes('try again')) {
      logger.info(`Call-back request from user ${userId}`);
      await this.scheduleCallbackCall(userId, chatId);
      return;
    }

    if (['text', 'texts', 'just text'].includes(lowerContent) || lowerContent.includes('prefer text') || lowerContent.includes('keep it here')) {
      await prisma.user.update({ where: { id: userId }, data: { commStyle: 'TEXTS' } });
      await this.cancelUpcomingCallsForUser(userId);
      await this.sendTelegramRaw(chatId, "Got it — I'll keep it here from now on. Just say \"call me\" if something big comes up.");
      return;
    }

    if (lowerContent.includes('skip') || lowerContent.includes("can't") || lowerContent.includes('tired') || lowerContent.includes('help')) {
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { minimumMode: true } });
      if (user?.minimumMode) await this.sendTelegramRaw(chatId, `I hear you. How about just ${user.minimumMode}? Even that counts.`);
    }

    if (lowerContent.includes('done') || lowerContent.includes('completed') || lowerContent.includes('finished')) {
      await this.sendTelegramRaw(chatId, '🎉 You completed your session! Keep that momentum going.');
    }
  }

  private async scheduleCallbackCall(userId: string, chatId: string) {
    try {
      const { default: callService } = await import('./call.service');
      const user = await prisma.user.findUnique({ where: { id: userId }, select: { isActive: true } });
      if (!user?.isActive) return;
      await this.cancelUpcomingCallsForUser(userId);
      const lastMissed = await prisma.call.findFirst({ where: { userId, status: 'NO_ANSWER' }, orderBy: { scheduledAt: 'desc' }, select: { callType: true } });
      const callType = (lastMissed?.callType ?? 'MORNING_PLANNING') as any;
      await callService.scheduleCall(userId, callType, new Date(Date.now() + 2 * 60 * 1000));
      await this.sendTelegramRaw(chatId, "On my way — I'll call you in 2 minutes.");
    } catch (err) {
      logger.error(`Failed to schedule callback call for user ${userId}:`, err);
    }
  }

  private async cancelUpcomingCallsForUser(userId: string) {
    try {
      const { default: callService } = await import('./call.service');
      const upcoming = await callService.getUpcomingCallsForUser(userId);
      await Promise.all(upcoming.map((c) => callService.cancelCall(c.id).catch(() => {})));
    } catch (err) {
      logger.warn(`Failed to cancel upcoming calls for user ${userId}:`, err);
    }
  }

  async getUserMessages(userId: string, limit = 50) {
    return prisma.message.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, take: limit });
  }

  async updateMessageStatus(messageId: string, status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED') {
    return prisma.message.update({ where: { id: messageId }, data: { status } });
  }

  // Legacy helpers kept so existing callers don't break
  async sendWorkoutReminder(userId: string, workoutDetails: string) {
    return this.sendMessage(userId, `Hey! Just a reminder about your workout today: ${workoutDetails}. You've got this!`, 'reminder');
  }
  async sendMotivationalNudge(userId: string, currentStreak: number) {
    const msgs = [`You're on a ${currentStreak}-day streak! Keep the momentum going 🔥`, `${currentStreak} days strong! That's commitment 💪`, `Your ${currentStreak}-day streak is inspiring. Let's make it ${currentStreak + 1}!`];
    return this.sendMessage(userId, msgs[Math.floor(Math.random() * msgs.length)], 'nudge');
  }
  async sendCelebration(userId: string, achievement: string) {
    return this.sendMessage(userId, `🎉 Amazing! ${achievement}. You're making real progress!`, 'celebration');
  }
  async sendRescueSupport(userId: string, minimumAction: string) {
    return this.sendMessage(userId, `I hear you. Days like this happen. How about just ${minimumAction}? Even that counts. What do you think?`, 'rescue_response');
  }
}

export default new MessagingService();
