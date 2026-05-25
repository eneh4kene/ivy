import { Job } from 'bull';
import { messageQueue } from '../config/queues';
import prisma from '../utils/prisma';
import axios from 'axios';
import twilio from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';
import { logUsage } from '../services/usage.service';

interface TelegramJobData {
  messageId: string;
  userId: string;
  chatId: string;
  content: string;
}

interface SMSJobData {
  messageId: string;
  userId: string;
  phone: string;
  content: string;
}

messageQueue.process('send-telegram', async (job: Job<TelegramJobData>) => {
  const { messageId, chatId, content, userId } = job.data;

  if (!config.telegram.botToken) {
    logger.warn(`Telegram not configured — message ${messageId} not sent`);
    await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } });
    return { skipped: true };
  }

  try {
    await axios.post(`https://api.telegram.org/bot${config.telegram.botToken}/sendMessage`, {
      chat_id: chatId,
      text: content,
    });

    await prisma.message.update({ where: { id: messageId }, data: { status: 'SENT' } });
    await logUsage('telegram', 'telegram_message', 1, userId, { messageId, chatId });
    logger.info(`Telegram message sent to chat ${chatId}`);
    return { success: true };
  } catch (err: any) {
    logger.error(`Telegram failed for chat ${chatId}:`, err?.response?.data ?? err);
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

    await prisma.message.update({ where: { id: messageId }, data: { status: 'SENT' } });
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
