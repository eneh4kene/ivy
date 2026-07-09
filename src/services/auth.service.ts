import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { OAuth2Client } from 'google-auth-library';
import { config } from '../config';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';
import { logUsage } from './usage.service';

// Fields returned on the authenticated user object — kept in sync with
// verifyMagicLink so magic-link and SSO logins return an identical user shape.
const AUTH_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  firstName: true,
  lastName: true,
  timezone: true,
  region: true,
  currency: true,
  subscriptionTier: true,
  subscriptionStatus: true,
  isActive: true,
  isOnboarded: true,
  track: true,
  goal: true,
  minimumMode: true,
  giftFrame: true,
  commStyle: true,
  circleOptIn: true,
  preferredCharityId: true,
  morningCallTime: true,
  eveningCallTime: true,
  callFrequency: true,
  telegramChatId: true,
  pendingCoachId: true,
  // postLoginDestination on the client routes coach-intent signups
  // (role='coach', tier still FREE) to /coach/join — it needs this field.
  role: true,
} as const;

class AuthService {
  private transporter: nodemailer.Transporter;
  private googleClient: OAuth2Client;

  constructor() {
    // Initialize email transporter
    this.transporter = nodemailer.createTransport({
      host: config.email.smtp.host,
      port: config.email.smtp.port,
      secure: config.email.smtp.secure,
      auth: config.email.smtp.auth.user && config.email.smtp.auth.pass
        ? {
            user: config.email.smtp.auth.user,
            pass: config.email.smtp.auth.pass,
          }
        : undefined,
    });

    // Shares the Google OAuth web client with the Calendar integration —
    // a Google ID token minted for that client verifies here too.
    this.googleClient = new OAuth2Client(config.calendar.google.clientId);
  }

  /**
   * Verify a Google ID token (from Google Identity Services on the frontend),
   * find-or-create the matching user by verified email, and issue an app JWT.
   *
   * Returns the same `{ accessToken, user }` shape as verifyMagicLink, plus an
   * `isNewUser` flag so the client can route new accounts into onboarding.
   */
  async googleSignIn(
    idToken: string,
    opts: { region?: 'GB' | 'US'; tcpaConsent?: boolean; role?: string } = {},
  ): Promise<{ accessToken: string; user: any; isNewUser: boolean }> {
    const clientId = config.calendar.google.clientId;
    if (!clientId) {
      throw new BadRequestError('Google sign-in is not configured');
    }

    // ── Verify the ID token signature + audience against our client ──────────
    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      logger.warn('Google ID token verification failed', err);
      throw new UnauthorizedError('Invalid Google credential');
    }

    if (!payload || !payload.email) {
      throw new UnauthorizedError('Google credential missing email');
    }
    if (payload.email_verified === false) {
      throw new UnauthorizedError('Google email is not verified');
    }

    const email = payload.email.toLowerCase();

    // ── Find-or-create by verified email ─────────────────────────────────────
    let user = await prisma.user.findUnique({
      where: { email },
      select: AUTH_USER_SELECT,
    });
    let isNewUser = false;

    if (!user) {
      const region = opts.region ?? 'GB';
      const currency = region === 'US' ? 'USD' : 'GBP';
      try {
        user = await prisma.user.create({
          data: {
            email,
            firstName: payload.given_name ?? '',
            lastName: payload.family_name ?? '',
            region,
            currency,
            track: 'fitness',
            goal: '',
            subscriptionTier: 'FREE',
            isActive: true,
            isOnboarded: false,
            // Coach-intent SSO signup (from /signup?as=coach). Whitelisted to
            // exactly 'coach' — clients must never mint admin roles.
            ...(opts.role === 'coach' && { role: 'coach' }),
            ...(opts.tcpaConsent !== undefined && {
              tcpaConsent: opts.tcpaConsent,
              tcpaConsentAt: opts.tcpaConsent ? new Date() : null,
            }),
          },
          select: AUTH_USER_SELECT,
        });
        isNewUser = true;
        logger.info(`User created via Google SSO: ${user.id} (${email})`);
      } catch (err: any) {
        // Concurrent first sign-in (double-click): the email @unique constraint
        // rejects the second create. Re-fetch the row the winner created rather
        // than erroring — converges on one account, no duplicate.
        if (err?.code === 'P2002') {
          user = await prisma.user.findUnique({
            where: { email },
            select: AUTH_USER_SELECT,
          });
          if (!user) throw err;
        } else {
          throw err;
        }
      }
    }

    if (!user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    const accessToken = this.generateAccessToken(user.id, user.email);
    return { accessToken, user, isNewUser };
  }

  /**
   * Generate JWT access token for authenticated user
   */
  generateAccessToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      config.auth.jwtSecret,
      { expiresIn: config.auth.jwtExpiresIn } as any
    );
  }

  /**
   * Generate a magic link token
   */
  generateMagicLinkToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Generate magic link for development (without sending email)
   * ONLY USE IN DEVELOPMENT
   */
  async getDevMagicLink(email: string): Promise<string> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestError('No account found with this email');
    }

    // Generate magic link token
    const token = this.generateMagicLinkToken();

    // Store in database
    await prisma.magicLink.create({
      data: { token, email: email.toLowerCase(), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    // Return the magic link URL
    const magicLinkUrl = `${config.frontend.url}/auth/verify?token=${token}`;

    logger.info(`🔗 DEV MAGIC LINK for ${email}: ${magicLinkUrl}`);

    return magicLinkUrl;
  }

  /**
   * Create a magic link token and return the URL without sending an email.
   * Used by coach invite flow to get the URL for a branded email.
   */
  async createMagicLinkUrl(email: string, ttlMs: number = 48 * 60 * 60 * 1000): Promise<string> {
    const token = this.generateMagicLinkToken();
    await prisma.magicLink.create({
      data: { token, email: email.toLowerCase(), expiresAt: new Date(Date.now() + ttlMs) },
    });
    return `${config.frontend.url}/auth/verify?token=${token}`;
  }

  /**
   * Send magic link email
   */
  async sendMagicLink(email: string, promoCode?: string, plan?: string): Promise<void> {
    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      throw new BadRequestError('No account found with this email');
    }

    // Generate magic link token
    const token = this.generateMagicLinkToken();

    // Store in database
    await prisma.magicLink.create({
      data: { token, email: email.toLowerCase(), expiresAt: new Date(Date.now() + 15 * 60 * 1000) }
    });

    const promoParam = promoCode ? `&promo=${encodeURIComponent(promoCode)}` : ''
    const planParam = plan ? `&plan=${encodeURIComponent(plan)}` : ''
    const magicLinkUrl = `${config.frontend.url}/auth/verify?token=${token}${promoParam}${planParam}`;

    // In development, log the magic link and skip email if SMTP fails
    if (process.env.NODE_ENV === 'development') {
      logger.info(`🔗 MAGIC LINK for ${email}: ${magicLinkUrl}`);
    }

    // Send email
    try {
      await this.transporter.sendMail({
        from: config.email.from,
        to: email,
        subject: 'Your Ivy Login Link',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Welcome back to Ivy</h2>
            <p>Click the link below to log in to your account. This link will expire in 15 minutes.</p>
            <p style="margin: 30px 0;">
              <a href="${magicLinkUrl}"
                 style="background-color: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                Log in to Ivy
              </a>
            </p>
            <p style="color: #6B7280; font-size: 14px;">
              Or copy and paste this URL into your browser:<br>
              <a href="${magicLinkUrl}">${magicLinkUrl}</a>
            </p>
            <p style="color: #6B7280; font-size: 12px; margin-top: 40px;">
              If you didn't request this email, you can safely ignore it.
            </p>
          </div>
        `,
      });

      await logUsage('postmark', 'email', 1, user.id, { type: 'magic_link', email });
      logger.info(`Magic link sent to ${email}`);
    } catch (error) {
      logger.error('Failed to send magic link email:', error);
      // In development, don't fail the request — the link was already logged above
      if (process.env.NODE_ENV !== 'development') {
        throw new Error('Failed to send magic link email');
      }
    }
  }

  /**
   * Verify magic link token and return access token
   */
  async verifyMagicLink(token: string): Promise<{ accessToken: string; user: any }> {
    // Get token from database
    const magicLink = await prisma.magicLink.findUnique({ where: { token } });

    if (!magicLink || magicLink.usedAt || magicLink.expiresAt < new Date()) {
      throw new UnauthorizedError('Invalid or expired magic link');
    }

    // Mark as used
    await prisma.magicLink.update({ where: { token }, data: { usedAt: new Date() } });

    // Fire-and-forget cleanup of expired links
    prisma.magicLink.deleteMany({ where: { expiresAt: { lt: new Date() } } }).catch(() => {});

    // Get user
    const user = await prisma.user.findUnique({
      where: { email: magicLink.email },
      select: AUTH_USER_SELECT,
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Generate access token
    const accessToken = this.generateAccessToken(user.id, user.email);

    return {
      accessToken,
      user,
    };
  }

  /**
   * Verify JWT token
   */
  verifyToken(token: string): { userId: string; email: string } {
    try {
      const decoded = jwt.verify(token, config.auth.jwtSecret) as {
        userId: string;
        email: string;
      };
      return decoded;
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }
}

export default new AuthService();
