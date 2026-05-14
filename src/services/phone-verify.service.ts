import twilio from 'twilio';
import prisma from '../utils/prisma';
import config from '../config';
import logger from '../utils/logger';
import { BadRequestError } from '../utils/errors';

interface PendingVerification {
  code: string;
  newPhone: string;
  expiresAt: Date;
  attempts: number;
}

// In-memory store — keyed by userId. Single-process; appropriate for Railway.
const pending = new Map<string, PendingVerification>();

const TTL_MS = 5 * 60 * 1000;    // 5 minutes
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function normalisePhone(phone: string): string {
  // Strip spaces and dashes; ensure it has a leading +
  const stripped = phone.replace(/[\s\-()]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

class PhoneVerifyService {
  private getClient() {
    if (!config.twilio.accountSid || !config.twilio.authToken) return null;
    return twilio(config.twilio.accountSid, config.twilio.authToken);
  }

  async requestOtp(userId: string, rawPhone: string): Promise<void> {
    const newPhone = normalisePhone(rawPhone);

    // Validate format — must be E.164
    if (!/^\+[1-9]\d{6,14}$/.test(newPhone)) {
      throw new BadRequestError('Invalid phone number. Include your country code, e.g. +447911123456');
    }

    // Ensure not already taken by another user
    const existing = await prisma.user.findUnique({
      where: { phone: newPhone },
      select: { id: true },
    });
    if (existing && existing.id !== userId) {
      throw new BadRequestError('That number is already associated with another account');
    }

    // Same number as current — nothing to verify
    const current = await prisma.user.findUnique({ where: { id: userId }, select: { phone: true } });
    if (current?.phone === newPhone) {
      throw new BadRequestError('That is already your current number');
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + TTL_MS);

    pending.set(userId, { code, newPhone, expiresAt, attempts: 0 });

    // Auto-clean after TTL
    setTimeout(() => {
      const entry = pending.get(userId);
      if (entry && entry.expiresAt <= new Date()) pending.delete(userId);
    }, TTL_MS + 1000);

    const client = this.getClient();
    if (!client) {
      // Dev / test — log code instead of sending
      logger.warn(`[phone-verify] Twilio not configured. OTP for ${userId}: ${code}`);
      return;
    }

    await client.messages.create({
      to: newPhone,
      from: config.twilio.phoneNumber!,
      body: `Your Ivy verification code is ${code}. It expires in 5 minutes. If you didn't request this, ignore it.`,
    });

    logger.info(`Phone OTP sent to ${newPhone} for user ${userId}`);
  }

  async verifyOtp(userId: string, code: string): Promise<string> {
    const entry = pending.get(userId);

    if (!entry) {
      throw new BadRequestError('No verification in progress. Request a new code.');
    }
    if (entry.expiresAt < new Date()) {
      pending.delete(userId);
      throw new BadRequestError('Code expired. Request a new one.');
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      pending.delete(userId);
      throw new BadRequestError('Too many attempts. Request a new code.');
    }

    entry.attempts += 1;

    if (entry.code !== code.trim()) {
      throw new BadRequestError(`Incorrect code. ${MAX_ATTEMPTS - entry.attempts} attempt${MAX_ATTEMPTS - entry.attempts === 1 ? '' : 's'} remaining.`);
    }

    // Code is correct — update phone in DB
    const newPhone = entry.newPhone;
    pending.delete(userId);

    await prisma.user.update({
      where: { id: userId },
      data: { phone: newPhone },
    });

    logger.info(`Phone updated for user ${userId} → ${newPhone}`);
    return newPhone;
  }
}

export const phoneVerifyService = new PhoneVerifyService();
export default phoneVerifyService;
