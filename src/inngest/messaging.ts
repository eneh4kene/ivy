/**
 * Inngest messaging functions (Phase 2) — replaces the Bull `messages` queue.
 *
 * Faithful ports of src/workers/message.processor.ts (`send-telegram` /
 * `send-sms`). Bodies — Twilio/Telegram send, prisma status update, logUsage —
 * are unchanged; only the transport moved from Redis-backed Bull to Inngest
 * events. retries:3 mirrors the old Bull attempts:3.
 */
import { inngest } from './client';
import prisma from '../utils/prisma';
import axios from 'axios';
import twilio from 'twilio';
import { config } from '../config';
import logger from '../utils/logger';
import { logUsage } from '../services/usage.service';

type StepLike = { run: <T>(id: string, fn: () => Promise<T> | T) => Promise<T> };

/** event: `message/telegram.requested` — data: { messageId, userId, chatId, content }. Exported for tests. */
export async function sendTelegramHandler({ event, step }: { event: any; step: StepLike }) {
    const { messageId, chatId, content, userId } = event.data as {
      messageId: string;
      userId: string;
      chatId: string;
      content: string;
    };

    return step.run('send-telegram', async () => {
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
}

export const sendTelegram = inngest.createFunction(
  { id: 'send-telegram', name: 'Send Telegram message', retries: 3, triggers: { event: 'message/telegram.requested' } },
  sendTelegramHandler
);

/** event: `message/sms.requested` — data: { messageId, userId, phone, content }. Exported for tests. */
export async function sendSmsHandler({ event, step }: { event: any; step: StepLike }) {
    const { messageId, phone, content, userId } = event.data as {
      messageId: string;
      userId: string;
      phone: string;
      content: string;
    };

    return step.run('send-sms', async () => {
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
        await logUsage('twilio', 'sms', 1, userId, { messageId, sid: message.sid });
        logger.info(`SMS sent to ${phone}: ${message.sid}`);
        return { success: true, sid: message.sid };
      } catch (err: any) {
        logger.error(`SMS failed for ${phone}:`, err);
        await prisma.message.update({ where: { id: messageId }, data: { status: 'FAILED' } });
        throw err;
      }
    });
}

export const sendSms = inngest.createFunction(
  { id: 'send-sms', name: 'Send SMS message', retries: 3, triggers: { event: 'message/sms.requested' } },
  sendSmsHandler
);

export const messagingFunctions = [sendTelegram, sendSms];
