import prisma from '../utils/prisma';
import { messageQueue } from '../config/queues';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';
import { config } from '../config';

export type MessageChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';
export type MessageType = 'reminder' | 'nudge' | 'rescue_response' | 'celebration' | 'quick_reply';

class MessagingService {
  /**
   * Send a message via WhatsApp — auto-falls back to SMS if WhatsApp not configured
   * or if the processor encounters a delivery failure. Use this for all user-facing messages.
   */
  async sendMessage(userId: string, content: string, messageType: MessageType = 'nudge') {
    const whatsappReady = !!(config.whatsapp.accessToken && config.whatsapp.phoneNumberId);
    return whatsappReady
      ? this.sendWhatsAppMessage(userId, content, messageType)
      : this.sendSMSMessage(userId, content, messageType);
  }

  /**
   * Send a WhatsApp message
   */
  async sendWhatsAppMessage(
    userId: string,
    content: string,
    messageType: MessageType = 'nudge'
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true, firstName: true },
    });

    if (!user || !user.phone) {
      throw new NotFoundError('User not found or has no phone number');
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        userId,
        channel: 'WHATSAPP',
        direction: 'OUTBOUND',
        content,
        messageType,
        status: 'SENT',
      },
    });

    // Add to queue for processing
    await messageQueue.add('send-whatsapp', {
      messageId: message.id,
      userId,
      phone: user.phone,
      content,
      userName: user.firstName,
    });

    logger.info(`WhatsApp message queued for user ${userId}`);

    return message;
  }

  /**
   * Send SMS message (fallback for WhatsApp)
   */
  async sendSMSMessage(
    userId: string,
    content: string,
    messageType: MessageType = 'nudge'
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { phone: true },
    });

    if (!user || !user.phone) {
      throw new NotFoundError('User not found or has no phone number');
    }

    const message = await prisma.message.create({
      data: {
        userId,
        channel: 'SMS',
        direction: 'OUTBOUND',
        content,
        messageType,
        status: 'SENT',
      },
    });

    await messageQueue.add('send-sms', {
      messageId: message.id,
      userId,
      phone: user.phone,
      content,
    });

    logger.info(`SMS message queued for user ${userId}`);

    return message;
  }

  /**
   * Send workout reminder
   */
  async sendWorkoutReminder(userId: string, workoutDetails: string) {
    const content = `Hey! Just a reminder about your workout today: ${workoutDetails}. You've got this! 💪`;
    return this.sendMessage(userId, content, 'reminder');
  }

  async sendMotivationalNudge(userId: string, currentStreak: number) {
    const nudges = [
      `You're on a ${currentStreak}-day streak! Keep the momentum going 🔥`,
      `${currentStreak} days strong! That's commitment 💪`,
      `Your ${currentStreak}-day streak is inspiring. Let's make it ${currentStreak + 1}!`,
    ];
    return this.sendMessage(userId, nudges[Math.floor(Math.random() * nudges.length)], 'nudge');
  }

  async sendCelebration(userId: string, achievement: string) {
    return this.sendMessage(userId, `🎉 Amazing! ${achievement}. You're making real progress!`, 'celebration');
  }

  async sendRescueSupport(userId: string, minimumAction: string) {
    return this.sendMessage(userId, `I hear you. Days like this happen. How about just ${minimumAction}? Even that counts. What do you think?`, 'rescue_response');
  }

  /**
   * Process incoming WhatsApp message
   */
  async handleIncomingMessage(phone: string, content: string) {
    // Find user by phone
    const user = await prisma.user.findUnique({
      where: { phone },
    });

    if (!user) {
      logger.warn(`Received message from unknown number: ${phone}`);
      return null;
    }

    // Create message record
    const message = await prisma.message.create({
      data: {
        userId: user.id,
        channel: 'WHATSAPP',
        direction: 'INBOUND',
        content,
        status: 'DELIVERED',
      },
    });

    // Process message for quick replies or triggers
    await this.processIncomingMessage(user.id, content, message.id);

    return message;
  }

  /**
   * Process incoming message for quick replies and preference signals.
   * Handles: CALL/TEXT preference replies, rescue triggers, completion confirmations.
   */
  private async processIncomingMessage(userId: string, content: string, messageId: string) {
    const lowerContent = content.toLowerCase().trim();

    // ── Communication preference signals ─────────────────────────────────────
    // User explicitly asked to be called back
    if (
      lowerContent === 'call' ||
      lowerContent === 'call me' ||
      lowerContent === 'call me back' ||
      lowerContent.includes('try again') ||
      lowerContent.includes('call me now')
    ) {
      logger.info(`Call-back request from user ${userId}`);
      await this.scheduleCallbackCall(userId);
      return messageId;
    }

    // User explicitly prefers text going forward
    if (
      lowerContent === 'text' ||
      lowerContent === 'texts' ||
      lowerContent === 'just text' ||
      lowerContent.includes('prefer text') ||
      lowerContent.includes('prefer texts') ||
      lowerContent.includes('text me') ||
      lowerContent.includes('keep it here')
    ) {
      logger.info(`Text preference confirmed by user ${userId}`);
      // Cancel any queued retry calls so they don't ring anyway
      await this.cancelUpcomingCallsForUser(userId);
      await prisma.user.update({
        where: { id: userId },
        data: { commStyle: 'TEXTS' },
      });
      await this.sendWhatsAppMessage(
        userId,
        "Got it — I'll keep it in writing from now on. You can always say \"call me\" if something big comes up.",
        'nudge',
      );
      return messageId;
    }

    // ── Rescue trigger words ──────────────────────────────────────────────────
    if (
      lowerContent.includes('skip') ||
      lowerContent.includes("can't") ||
      lowerContent.includes('tired') ||
      lowerContent.includes('help')
    ) {
      logger.info(`Rescue trigger detected for user ${userId}`);
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { minimumMode: true },
      });
      if (user?.minimumMode) {
        await this.sendRescueSupport(userId, user.minimumMode);
      }
    }

    // ── Completion confirmation ───────────────────────────────────────────────
    if (
      lowerContent.includes('done') ||
      lowerContent.includes('completed') ||
      lowerContent.includes('finished')
    ) {
      await this.sendCelebration(userId, 'You completed your session');
    }

    return messageId;
  }

  /**
   * Schedule a callback call in ~2 minutes when user explicitly requests one via text.
   * Cancels any queued auto-retry first so calls don't stack.
   * Uses the same call type as the most recent missed call.
   */
  private async scheduleCallbackCall(userId: string): Promise<void> {
    try {
      const { default: callService } = await import('./call.service');
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { isActive: true },
      });
      if (!user?.isActive) return;

      // Cancel the auto-retry that's already queued
      await this.cancelUpcomingCallsForUser(userId);

      // Match the call type of the most recent missed call
      const lastMissed = await prisma.call.findFirst({
        where: { userId, status: 'NO_ANSWER' },
        orderBy: { scheduledAt: 'desc' },
        select: { callType: true },
      });
      const callType = (lastMissed?.callType ?? 'MORNING_PLANNING') as any;

      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000);
      await callService.scheduleCall(userId, callType, scheduledAt);
      await this.sendWhatsAppMessage(userId, "On my way — I'll call you in 2 minutes.", 'nudge');
    } catch (err) {
      logger.error(`Failed to schedule callback call for user ${userId}:`, err);
    }
  }

  /**
   * Cancel all upcoming (SCHEDULED) calls for a user — used when the user
   * explicitly changes communication preference via text.
   */
  private async cancelUpcomingCallsForUser(userId: string): Promise<void> {
    try {
      const { default: callService } = await import('./call.service');
      const upcoming = await callService.getUpcomingCallsForUser(userId);
      await Promise.all(upcoming.map((c) => callService.cancelCall(c.id).catch(() => {})));
    } catch (err) {
      logger.warn(`Failed to cancel upcoming calls for user ${userId}:`, err);
    }
  }

  /**
   * Get user's message history
   */
  async getUserMessages(userId: string, limit = 50) {
    return prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  /**
   * Update message status (e.g., when delivery confirmation received)
   */
  async updateMessageStatus(
    messageId: string,
    status: 'SENT' | 'DELIVERED' | 'READ' | 'FAILED',
    externalId?: string
  ) {
    return prisma.message.update({
      where: { id: messageId },
      data: {
        status,
        ...(externalId && { whatsappId: externalId }),
      },
    });
  }

}
// Actual API calls are handled by src/workers/message.processor.ts

export default new MessagingService();
