import axios from 'axios';
import logger from './logger';

/**
 * Send a message to the admin Telegram chat.
 * Requires TELEGRAM_BOT_TOKEN and ADMIN_TELEGRAM_CHAT_ID env vars.
 * Silently no-ops if either is missing — never throws.
 */
export async function sendTelegramAdmin(text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.ADMIN_TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  await axios
    .post(`https://api.telegram.org/bot${token}/sendMessage`, { chat_id: chatId, text })
    .catch((err) => logger.warn('Admin Telegram alert failed:', err?.response?.data ?? err.message));
}
