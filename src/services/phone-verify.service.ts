import crypto from 'crypto';
import twilio from 'twilio';
import prisma from '../utils/prisma';
import config from '../config';
import logger from '../utils/logger';
import { smsFrom } from '../utils/sms';
import { BadRequestError } from '../utils/errors';

const TTL_MS = 5 * 60 * 1000;    // 5 minutes
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  // crypto-grade 6-digit code
  return String(crypto.randomInt(100000, 1000000));
}

function hashCode(code: string): string {
  return crypto.createHash('sha256').update(code.trim()).digest('hex');
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

    // One pending verification per user — upsert resets code/attempts/expiry.
    // DB-backed (not in-memory) so a verify request can be served by any API
    // instance once the app scales beyond a single machine.
    await prisma.phoneVerification.upsert({
      where: { userId },
      create: { userId, codeHash: hashCode(code), newPhone, expiresAt, attempts: 0 },
      update: { codeHash: hashCode(code), newPhone, expiresAt, attempts: 0 },
    });

    const client = this.getClient();
    if (!client) {
      // Dev / test — log code instead of sending
      logger.warn(`[phone-verify] Twilio not configured. OTP for ${userId}: ${code}`);
      return;
    }

    // US numbers get the code by VOICE, not SMS.
    //
    // A2P 10DLC is unregistered, so US carriers drop unregistered long-code
    // traffic — usually silently, and Twilio reports the message as accepted
    // before the carrier discards it. Since this OTP gates onboarding
    // (markUserAsOnboarded requires a verified phone), an undeliverable text
    // does not degrade the US experience, it BLOCKS US signup entirely: no
    // code, no onboarding, no Day-Zero, dead app.
    //
    // Voice is not subject to A2P and the US number is already voice-capable,
    // so this is the same verification strength over a channel that works
    // today. Revisit once the 10DLC brand + campaign are approved.
    const useVoice = newPhone.startsWith('+1');

    try {
      if (useVoice) {
        // <Say> would read "123456" as "one hundred twenty-three thousand…",
        // so the digits are spaced, and the code is repeated for anyone
        // reaching for a pen.
        const spoken = code.split('').join(', ');
        await client.calls.create({
          to: newPhone,
          from: smsFrom(newPhone),
          twiml:
            `<Response><Pause length="1"/>` +
            `<Say voice="alice">Hello, this is Ivy with your verification code.</Say>` +
            `<Pause length="1"/>` +
            `<Say voice="alice">Your code is ${spoken}.</Say>` +
            `<Pause length="1"/>` +
            `<Say voice="alice">Once more. ${spoken}.</Say>` +
            `<Pause length="1"/>` +
            `<Say voice="alice">It expires in five minutes. Goodbye.</Say>` +
            `</Response>`,
        });
      } else {
        await client.messages.create({
          to: newPhone,
          from: smsFrom(newPhone),
          body: `Your Ivy verification code is ${code}. It expires in 5 minutes. If you didn't request this, ignore it.`,
        });
      }
    } catch (err: any) {
      // Surface a human message instead of a bare 500 — Twilio being down or
      // misconfigured (e.g. rotated auth token) is an operational fault, not
      // the user's. Keep the full error in logs for diagnosis.
      logger.error(`Phone OTP send failed for user ${userId} (Twilio ${err?.status ?? ''} ${err?.code ?? ''}): ${err?.message}`);
      throw new BadRequestError(
        useVoice
          ? "We couldn't call you with your code just now — please try again in a few minutes."
          : "We couldn't send the text message just now — please try again in a few minutes."
      );
    }

    logger.info(`Phone OTP ${useVoice ? 'called' : 'texted'} to ${newPhone} for user ${userId}`);
  }

  async verifyOtp(userId: string, code: string): Promise<string> {
    const entry = await prisma.phoneVerification.findUnique({ where: { userId } });

    if (!entry) {
      throw new BadRequestError('No verification in progress. Request a new code.');
    }
    if (entry.expiresAt < new Date()) {
      await prisma.phoneVerification.delete({ where: { userId } }).catch(() => {});
      throw new BadRequestError('Code expired. Request a new one.');
    }
    if (entry.attempts >= MAX_ATTEMPTS) {
      await prisma.phoneVerification.delete({ where: { userId } }).catch(() => {});
      throw new BadRequestError('Too many attempts. Request a new code.');
    }

    if (entry.codeHash !== hashCode(code)) {
      const updated = await prisma.phoneVerification.update({
        where: { userId },
        data: { attempts: { increment: 1 } },
        select: { attempts: true },
      });
      const remaining = MAX_ATTEMPTS - updated.attempts;
      throw new BadRequestError(`Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`);
    }

    // Code is correct — claim the new phone, then clear the pending row. The
    // unique constraint is the final guard if the number was taken since the
    // request (race between two accounts verifying the same number).
    const newPhone = entry.newPhone;
    try {
      await prisma.user.update({ where: { id: userId }, data: { phone: newPhone } });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        throw new BadRequestError('That number was just claimed by another account. Try a different one.');
      }
      throw err;
    }
    await prisma.phoneVerification.delete({ where: { userId } }).catch(() => {});

    logger.info(`Phone updated for user ${userId} → ${newPhone}`);
    return newPhone;
  }
}

export const phoneVerifyService = new PhoneVerifyService();
export default phoneVerifyService;
