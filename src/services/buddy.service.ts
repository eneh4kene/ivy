import prisma from '../utils/prisma';
import logger from '../utils/logger';
import nodemailer from 'nodemailer';
import { config } from '../config';

class BuddyService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      if (!config.email.smtp.host) {
        logger.warn('SMTP not configured — email sending will be skipped');
      }
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host || 'localhost',
        port: config.email.smtp.port || 587,
        secure: config.email.smtp.secure || false,
        auth: config.email.smtp.auth.user
          ? {
              user: config.email.smtp.auth.user,
              pass: config.email.smtp.auth.pass,
            }
          : undefined,
      });
    }
    return this.transporter;
  }

  async setBuddy(
    userId: string,
    data: { buddyName: string; buddyEmail?: string; buddyPhone?: string }
  ) {
    return prisma.accountabilityBuddy.upsert({
      where: { userId },
      create: { userId, ...data },
      update: { ...data, isActive: true },
    });
  }

  async getBuddy(userId: string) {
    return prisma.accountabilityBuddy.findUnique({ where: { userId } });
  }

  async removeBuddy(userId: string) {
    return prisma.accountabilityBuddy.update({
      where: { userId },
      data: { isActive: false },
    });
  }

  async sendWeeklyDigests() {
    const buddies = await prisma.accountabilityBuddy.findMany({
      where: { isActive: true },
      include: {
        user: {
          include: {
            streaks: true,
            workouts: {
              where: {
                plannedDate: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            },
            donations: {
              where: {
                createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
              },
            },
            lifeMarkers: {
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    logger.info(`Sending weekly digests to ${buddies.length} buddies`);

    for (const buddy of buddies) {
      try {
        await this.sendDigest(buddy);
        await prisma.accountabilityBuddy.update({
          where: { id: buddy.id },
          data: { lastDigestAt: new Date() },
        });
      } catch (err) {
        logger.error(`Failed to send digest for user ${buddy.userId}:`, err);
      }
    }
  }

  private async sendDigest(buddy: any) {
    const user = buddy.user;
    const streak = user.streaks;
    const completedThisWeek = user.workouts.filter((w: any) => w.status === 'COMPLETED').length;
    const totalThisWeek = user.workouts.length;
    const weeklyDonations = user.donations.reduce(
      (sum: number, d: any) => sum + Number(d.amount),
      0
    );
    const latestMarker = user.lifeMarkers[0];
    const currency = user.currency === 'USD' ? '$' : '£';

    const subject = `${user.firstName} is on a ${streak?.currentStreak ?? 0}-day streak 🔥`;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; background: #0a0a0a; color: #f5f5f5; border-radius: 12px; overflow: hidden;">
        <div style="background: linear-gradient(135deg, #16a34a20, #0a0a0a); padding: 32px; text-align: center; border-bottom: 1px solid #1f1f1f;">
          <div style="font-size: 28px; margin-bottom: 8px;">🌿</div>
          <h1 style="margin: 0; font-size: 20px; color: #f5f5f5;">Your Ivy Weekly Update</h1>
          <p style="margin: 8px 0 0; color: #888; font-size: 14px;">How ${user.firstName} is doing this week</p>
        </div>

        <div style="padding: 28px;">
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
            <div style="background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #16a34a;">${streak?.currentStreak ?? 0}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">day streak 🔥</div>
            </div>
            <div style="background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #f5f5f5;">${completedThisWeek}/${totalThisWeek}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">workouts done</div>
            </div>
            <div style="background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px; text-align: center;">
              <div style="font-size: 28px; font-weight: bold; color: #34d399;">${currency}${weeklyDonations.toFixed(0)}</div>
              <div style="font-size: 11px; color: #888; margin-top: 4px;">donated 💚</div>
            </div>
          </div>

          ${
            latestMarker
              ? `
          <div style="background: #161616; border: 1px solid #222; border-radius: 10px; padding: 16px; margin-bottom: 24px;">
            <div style="font-size: 11px; color: #888; margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em;">✨ This week's highlight</div>
            <p style="margin: 0; font-size: 15px; color: #f5f5f5; font-style: italic;">"${latestMarker.marker}"</p>
          </div>
          `
              : ''
          }

          <p style="font-size: 13px; color: #888; text-align: center; margin: 0;">
            Send ${user.firstName} some encouragement — they'll appreciate it.<br>
            <span style="font-size: 11px;">You're receiving this because ${user.firstName} nominated you as their accountability buddy.</span>
          </p>
        </div>
      </div>
    `;

    // Send email if available
    if (buddy.buddyEmail) {
      if (!config.email.smtp.host) {
        logger.warn(`SMTP not configured — skipping email digest to ${buddy.buddyEmail}`);
      } else {
        try {
          await this.getTransporter().sendMail({
            from: config.email.from,
            to: buddy.buddyEmail,
            subject,
            html,
          });
          logger.info(
            `Weekly digest sent to ${buddy.buddyEmail} for user ${user.firstName}`
          );
        } catch (err) {
          logger.error('Failed to send buddy email:', err);
        }
      }
    }

    // Send WhatsApp text if phone provided
    // Uses direct WhatsApp API — messaging service requires a userId and persists to DB,
    // which is not appropriate for a third-party buddy number.
    if (buddy.buddyPhone) {
      if (!config.whatsapp.accessToken) {
        logger.warn(
          `WhatsApp not configured — skipping WhatsApp digest to ${buddy.buddyPhone}`
        );
      } else {
        const text = `🌿 *Ivy Weekly Update for ${user.firstName}*\n\n🔥 ${streak?.currentStreak ?? 0}-day streak\n✅ ${completedThisWeek}/${totalThisWeek} workouts this week\n💚 ${currency}${weeklyDonations.toFixed(0)} donated${latestMarker ? `\n\n✨ _"${latestMarker.marker}"_` : ''}\n\nSend them some encouragement — they'll love it.`;

        try {
          const fetch = (await import('node-fetch')).default as any;
          await fetch(
            `https://graph.facebook.com/v18.0/${config.whatsapp.phoneNumberId}/messages`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${config.whatsapp.accessToken}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                messaging_product: 'whatsapp',
                to: buddy.buddyPhone,
                type: 'text',
                text: { body: text },
              }),
            }
          );
          logger.info(`WhatsApp digest sent to ${buddy.buddyPhone}`);
        } catch (err) {
          logger.error('Failed to send buddy WhatsApp:', err);
        }
      }
    }
  }
}

export default new BuddyService();
