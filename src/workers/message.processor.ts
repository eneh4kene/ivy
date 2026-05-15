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

async function fallbackToSms(job: Job<WhatsAppJobData>, reason: string) {
  logger.warn(`WhatsApp ${reason} for message ${job.data.messageId} — falling back to SMS`);
  await prisma.message.update({
    where: { id: job.data.messageId },
    data: { channel: 'SMS' },
  });
  await messageQueue.add('send-sms', {
    messageId: job.data.messageId,
    userId: job.data.userId,
    phone: job.data.phone,
    content: job.data.content,
  });
}

messageQueue.process('send-whatsapp', async (job: Job<WhatsAppJobData>) => {
  const { messageId, phone, content } = job.data;

  if (!config.whatsapp.accessToken || !config.whatsapp.phoneNumberId) {
    await fallbackToSms(job, 'not configured');
    return { fallback: 'sms' };
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
      { messaging_product: 'whatsapp', to: phone, type: 'text', text: { body: content } },
      { headers: { Authorization: `Bearer ${config.whatsapp.accessToken}`, 'Content-Type': 'application/json' } }
    );

    const waId = response.data.messages?.[0]?.id;
    await prisma.message.update({
      where: { id: messageId },
      data: { status: 'SENT', whatsappId: waId },
    });

    await logUsage('whatsapp', 'whatsapp_message', 1, job.data.userId, { messageId, waId });
    logger.info(`WhatsApp sent to ${phone}: ${waId}`);
    return { success: true, waId };
  } catch (err: any) {
    logger.error(`WhatsApp failed for ${phone}:`, err?.response?.data ?? err);
    // Fall back to SMS on delivery failure rather than leaving the user in silence
    await fallbackToSms(job, 'delivery failed');
    return { fallback: 'sms' };
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
