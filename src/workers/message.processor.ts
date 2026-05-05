import { Job } from 'bull';
import { messageQueue } from '../config/queues';
import prisma from '../utils/prisma';
import axios from 'axios';
import twilio from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';
import { logUsage } from '../services/usage.service';

interface WhatsAppJobData {
  messageId: string;
  userId: string;
  phone: string;
  content: string;
  userName: string;
}

interface SMSJobData {
  messageId: string;
  userId: string;
  phone: string;
  content: string;
}

messageQueue.process('send-whatsapp', async (job: Job<WhatsAppJobData>) => {
  const { messageId, phone, content } = job.data;

  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    logger.warn(`WhatsApp not configured — message ${messageId} not sent`);
    return { skipped: true };
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: content } },
      { headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, 'Content-Type': 'application/json' } }
    );

    const waId = response.data.messages?.[0]?.id;
    // Status moves from SENT → DELIVERED via the WhatsApp delivery webhook
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', whatsappId: waId },
    });

    await logUsage('whatsapp', 'whatsapp_message', 1, job.data.userId, { messageId, waId });
    logger.info(`WhatsApp sent to ${phone}: ${waId}`);
    return { success: true, waId };
  } catch (err: any) {
    logger.error(`WhatsApp failed for ${phone}:`, err?.response?.data ?? err);
    await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } });
    throw err;
  }
});

messageQueue.process('send-sms', async (job: Job<SMSJobData>) => {
  const { messageId, phone, content } = job.data;

  if (!config.twilio.accountSid || !config.twilio.authToken) {
    logger.warn(`Twilio not configured — SMS ${messageId} not sent`);
    return { skipped: true };
  }

  try {
    const client = twilio(config.twilio.accountSid, config.twilio.authToken);
    const message = await client.messages.create({
      body: content,
      from: config.twilio.phoneNumber,
      to: phone,
    });

    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT' },
    });

    await logUsage('twilio', 'sms', 1, job.data.userId, { messageId, sid: message.sid });
    logger.info(`SMS sent to ${phone}: ${message.sid}`);
    return { success: true, sid: message.sid };
  } catch (err: any) {
    logger.error(`SMS failed for ${phone}:`, err);
    await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } });
    throw err;
  }
});

logger.info('Message processor worker started');

export default messageQueue;
