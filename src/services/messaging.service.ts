import axios from 'axios';
import prisma from '../utils/prisma';
import { messageQueue } from '../config/queues';
import { config } from '../config';
import logger from '../utils/logger';
import { NotFoundError } from '../utils/errors';

export type MessageChannel = 'SMS' | 'WHATSAPP' | 'EMAIL';
export type MessageType = 'reminder' | 'nudge' | 'rescue_response' | 'celebration' | 'quick_reply';

class MessagingService {
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

    return this.sendWhatsAppMessage(userId, content, 'reminder');
  }

  /**
   * Send motivational nudge
   */
  async sendMotivationalNudge(userId: string, currentStreak: number) {
    const nudges = [
      `You're on a ${currentStreak}-day streak! Keep the momentum going 🔥`,
      `${currentStreak} days strong! That's commitment 💪`,
      `Your ${currentStreak}-day streak is inspiring. Let's make it ${currentStreak + 1}!`,
    ];

    const content = nudges[Math.floor(Math.random() * nudges.length)];

    return this.sendWhatsAppMessage(userId, content, 'nudge');
  }

  /**
   * Send celebration message
   */
  async sendCelebration(userId: string, achievement: string) {
    const content = `🎉 Amazing! ${achievement}. You're making real progress!`;

    return this.sendWhatsAppMessage(userId, content, 'celebration');
  }

  /**
   * Send rescue support message
   */
  async sendRescueSupport(userId: string, minimumAction: string) {
    const content = `I hear you. Days like this happen. How about just ${minimumAction}? Even that counts. What do you think?`;

    return this.sendWhatsAppMessage(userId, content, 'rescue_response');
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
   * Process incoming message for quick replies
   */
  private async processIncomingMessage(userId: string, content: string, messageId: string) {
    const lowerContent = content.toLowerCase().trim();

    // Check for rescue trigger words
    if (
      lowerContent.includes('skip') ||
      lowerContent.includes('can\'t') ||
      lowerContent.includes('tired') ||
      lowerContent.includes('help')
    ) {
      logger.info(`Rescue trigger detected for user ${userId}`);
      // Could trigger a rescue call here
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { minimumMode: true },
      });

      if (user?.minimumMode) {
        await this.sendRescueSupport(userId, user.minimumMode);
      }
    }

    // Check for completion confirmation
    if (
      lowerContent.includes('done') ||
      lowerContent.includes('completed') ||
      lowerContent.includes('finished')
    ) {
      await this.sendCelebration(userId, 'You completed your workout');
    }

    return messageId;
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

  /**
   * Actual WhatsApp API integration (placeholder)
   * In production, this would call WhatsApp Business API
   */
  private async sendWhatsAppAPI(phone: string, content: string): Promise<string> {
    if (!config.whatsapp.accessToken) {
      logger.warn('WhatsApp not configured, simulating send');
      return `sim_${Date.now()}`;
    }

    try {
      const response = await axios.post(
        `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
        {
          messaging_product: 'whatsapp',
          to: phone,
          type: 'text',
          text: { body: content },
        },
        {
          headers: {
            Authorization: `Bearer ${config.whatsapp.accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return response.data.messages[0].id;
    } catch (error) {
      logger.error('WhatsApp API error:', error);
      throw error;
    }
  }

  /**
   * Actual SMS API integration via Twilio (placeholder)
   */
  private async sendSMSAPI(phone: string, content: string): Promise<string> {
    if (!config.twilio.accountSid) {
      logger.warn('Twilio not configured, simulating send');
      return `sim_${Date.now()}`;
    }

    // TODO: Implement Twilio SMS sending
    // const twilio = require('twilio');
    // const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    // const message = await client.messages.create({
    //   body: content,
    //   from: config.twilio.phoneNumber,
    //   to: phone,
    // });
    // return message.sid;

    logger.info(`[SIMULATED] Sending SMS to ${phone}: ${content}`);
    return `sim_sms_${Date.now()}`;
  }
}

export default new MessagingService();
