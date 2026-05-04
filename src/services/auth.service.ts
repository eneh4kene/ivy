import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { config } from '../config';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { BadRequestError, UnauthorizedError } from '../utils/errors';

class AuthService {
  private transporter: nodemailer.Transporter;

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
   * Send magic link email
   */
  async sendMagicLink(email: string): Promise<void> {
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

    // Create magic link URL
    const magicLinkUrl = `${config.frontend.url}/auth/verify?token=${token}`;

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
      select: {
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
      },
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
