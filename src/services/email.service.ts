import nodemailer from 'nodemailer';
import { config } from '../config';
import logger from '../utils/logger';
import { logUsage } from './usage.service';

interface Brand { name?: string | null; logoUrl?: string | null }

function shell(body: string, brand?: Brand): string {
  const displayName = brand?.name ?? 'Ivy';
  const logoBlock = brand?.logoUrl
    ? `<img src="${brand.logoUrl}" alt="${displayName}" style="height:36px;display:block;" />`
    : `<table cellpadding="0" cellspacing="0"><tr>
        <td style="width:36px;height:36px;background:rgba(52,211,153,0.15);border:1px solid rgba(52,211,153,0.3);border-radius:10px;text-align:center;vertical-align:middle;">
          <span style="font-size:18px;line-height:36px;">🌿</span>
        </td>
        <td style="padding-left:10px;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">${displayName}</td>
      </tr></table>`;
  const poweredBy = brand?.name
    ? `<span style="color:#374151;font-size:11px;">Powered by Ivy</span> &nbsp;·&nbsp; `
    : 'Ivy AI Ltd &nbsp;·&nbsp; ';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${displayName}</title>
</head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:48px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:560px;">
        <tr><td style="padding-bottom:32px;">${logoBlock}</td></tr>
        <tr><td style="background:#141414;border:1px solid #1f1f1f;border-radius:16px;padding:40px;">
          ${body}
        </td></tr>
        <tr><td style="padding-top:24px;text-align:center;font-size:12px;color:#4b5563;">
          ${poweredBy}<a href="${config.frontend.url}/privacy" style="color:#4b5563;">Privacy</a> &nbsp;·&nbsp; <a href="${config.frontend.url}/terms" style="color:#4b5563;">Terms</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

const TIER_NAMES: Record<string, string> = {
  // Phase 5: PRO is the single paid B2C tier, display name "Ivy".
  // ELITE/CONCIERGE kept as fallback display names for grandfathered webhook events during migration.
  PRO: 'Ivy', ELITE: 'Ivy', CONCIERGE: 'Ivy',
  B2B: 'Ivy for Teams', COACH: 'Ivy Coach',
};

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter(): nodemailer.Transporter | null {
    if (!config.email.smtp.host) {
      logger.warn('SMTP not configured — transactional email skipped');
      return null;
    }
    if (!this.transporter) {
      this.transporter = nodemailer.createTransport({
        host: config.email.smtp.host,
        port: config.email.smtp.port || 587,
        secure: config.email.smtp.secure || false,
        auth: config.email.smtp.auth.user
          ? { user: config.email.smtp.auth.user, pass: config.email.smtp.auth.pass }
          : undefined,
      });
    }
    return this.transporter;
  }

  private async send(to: string, subject: string, html: string, userId?: string, type?: string) {
    const transport = this.getTransporter();
    if (!transport) return;
    try {
      await transport.sendMail({ from: config.email.from, to, subject, html });
      if (userId && type) await logUsage('postmark', 'email', 1, userId, { type, to });
      logger.info(`Email sent: ${type ?? subject} → ${to}`);
    } catch (err) {
      logger.error(`Email failed: ${type ?? subject} → ${to}`, err);
    }
  }

  // ── Subscription confirmation ───────────────────────────────────────────────

  async sendSubscriptionConfirmation(user: {
    id: string; firstName: string; email: string; subscriptionTier: string; currency: string;
  }) {
    const tierName = TIER_NAMES[user.subscriptionTier] ?? user.subscriptionTier;
    const symbol = user.currency === 'USD' ? '$' : '£';
    const dashboardUrl = user.subscriptionTier === 'COACH'
      ? `${config.frontend.url}/coach`
      : `${config.frontend.url}/dashboard`;

    const isCoach = user.subscriptionTier === 'COACH';

    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        You're in, ${user.firstName}.
      </h1>
      <p style="margin:0 0 28px;font-size:15px;color:#9ca3af;line-height:1.6;">
        Your <strong style="color:#ffffff;">${tierName}</strong> account is active.
        ${isCoach
          ? 'Set up your profile and start inviting clients — Ivy will handle their daily accountability.'
          : 'Ivy will call you tomorrow morning to get your first commitment locked in.'}
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:20px;margin-bottom:28px;">
        <tr><td style="font-size:13px;color:#6b7280;padding-bottom:12px;border-bottom:1px solid #1f1f1f;">What's set up</td></tr>
        <tr><td style="padding-top:14px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            ${isCoach ? `
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Client accountability calls</td><td style="font-size:13px;color:#34d399;text-align:right;">✓ Active</td></tr>
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Coach dashboard</td><td style="font-size:13px;color:#34d399;text-align:right;">✓ Ready</td></tr>
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Client invite links</td><td style="font-size:13px;color:#34d399;text-align:right;">✓ Available</td></tr>
            ` : `
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Daily accountability calls</td><td style="font-size:13px;color:#34d399;text-align:right;">✓ Active</td></tr>
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Impact Wallet</td><td style="font-size:13px;color:#34d399;text-align:right;">${symbol}1 per follow-through</td></tr>
            <tr><td style="font-size:13px;color:#9ca3af;padding:5px 0;">Streak tracking</td><td style="font-size:13px;color:#34d399;text-align:right;">✓ Active</td></tr>
            `}
          </table>
        </td></tr>
      </table>
      <a href="${dashboardUrl}"
         style="display:inline-block;background:#34d399;color:#0a0a0a;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        ${isCoach ? 'Set up your profile →' : 'Go to your dashboard →'}
      </a>
      <p style="margin:28px 0 0;font-size:13px;color:#4b5563;line-height:1.6;">
        Questions? Reply to this email — a real person reads it.
      </p>
    `;

    await this.send(
      user.email,
      `You're in — ${tierName} is active`,
      shell(body),
      user.id,
      'subscription_confirmation',
    );
  }

  // ── Payment failed ──────────────────────────────────────────────────────────

  async sendPaymentFailed(user: { id: string; firstName: string; email: string }) {
    const billingUrl = `${config.frontend.url}/settings#billing`;
    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        Payment didn't go through
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">
        Hey ${user.firstName}, we couldn't process your latest Ivy payment.
        Your calls and wallet are paused until the payment clears — but nothing has been lost.
      </p>
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#1a0a0a;border:1px solid #3b1515;border-radius:12px;padding:20px;margin-bottom:28px;">
        <tr><td style="font-size:13px;color:#f87171;">
          <strong style="display:block;margin-bottom:6px;">What to do</strong>
          Update your payment method in Settings and your subscription will resume automatically.
        </td></tr>
      </table>
      <a href="${billingUrl}"
         style="display:inline-block;background:#ffffff;color:#0a0a0a;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        Update payment method →
      </a>
      <p style="margin:28px 0 0;font-size:13px;color:#4b5563;line-height:1.6;">
        If you think this is a mistake or need help, reply to this email.
      </p>
    `;
    await this.send(user.email, 'Action needed — your Ivy payment failed', shell(body), user.id, 'payment_failed');
  }

  // ── Client magic link (white-label aware) ──────────────────────────────────

  async sendClientMagicLink(params: {
    clientEmail: string;
    magicUrl: string;
    brand?: Brand;
    coachName?: string;
  }) {
    const displayName = params.brand?.name ?? 'Ivy';
    const greeting = params.coachName
      ? `${params.coachName} has invited you to join their accountability programme, powered by ${displayName}.`
      : `You've been invited to start your accountability programme with ${displayName}.`;

    const body = `
      <h1 style="margin:0 0 8px;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">
        You're invited
      </h1>
      <p style="margin:0 0 24px;font-size:15px;color:#9ca3af;line-height:1.6;">${greeting}</p>
      <p style="margin:0 0 8px;font-size:14px;color:#9ca3af;">Click below to set up your account. The link expires in 48 hours.</p>
      <a href="${params.magicUrl}"
         style="display:inline-block;background:#34d399;color:#0a0a0a;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;margin-bottom:20px;">
        Get started →
      </a>
      <p style="font-size:12px;color:#4b5563;margin:0;">Or paste into your browser:<br/><a href="${params.magicUrl}" style="color:#4b5563;">${params.magicUrl}</a></p>
    `;
    await this.send(
      params.clientEmail,
      `You've been invited to ${displayName}`,
      shell(body, params.brand),
      undefined,
      'client_invite',
    );
  }

  // ── Coach weekly digest ─────────────────────────────────────────────────────

  async sendCoachWeeklyDigest(
    coach: { id: string; firstName: string; email: string; coachProfile: any },
    clients: any[],
  ) {
    const needsAttention = clients.filter((c) => c.needsAttention);
    const onTrack = clients.filter((c) => !c.needsAttention);

    const clientRow = (c: any) => `
      <tr style="border-top:1px solid #1f1f1f;">
        <td style="padding:10px 0;font-size:13px;color:#ffffff;">${c.firstName} ${c.lastName}</td>
        <td style="padding:10px 0;font-size:13px;color:#9ca3af;text-align:center;">${c.currentStreak} days</td>
        <td style="padding:10px 0;font-size:13px;text-align:center;color:${c.needsAttention ? '#f87171' : '#34d399'};">
          ${c.needsAttention ? `⚠ ${c.recentMissedCount} missed` : '✓ On track'}
        </td>
      </tr>`;

    const body = `
      <h1 style="margin:0 0 4px;font-size:20px;font-weight:700;color:#ffffff;">Weekly client digest</h1>
      <p style="margin:0 0 24px;font-size:14px;color:#9ca3af;">Hi ${coach.firstName} — here's how your clients got on this week.</p>

      ${needsAttention.length > 0 ? `
      <div style="background:#1a0a0a;border:1px solid #3b1515;border-radius:12px;padding:16px;margin-bottom:20px;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:600;color:#f87171;text-transform:uppercase;letter-spacing:0.5px;">Needs attention (${needsAttention.length})</p>
        <table width="100%" cellpadding="0" cellspacing="0">
          ${needsAttention.map(clientRow).join('')}
        </table>
      </div>` : ''}

      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0d0d0d;border:1px solid #1f1f1f;border-radius:12px;padding:16px;margin-bottom:24px;">
        <tr>
          <td style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding-bottom:8px;">Client</td>
          <td style="font-size:12px;color:#6b7280;text-align:center;padding-bottom:8px;">Streak</td>
          <td style="font-size:12px;color:#6b7280;text-align:center;padding-bottom:8px;">Status</td>
        </tr>
        ${onTrack.map(clientRow).join('')}
      </table>

      <a href="${config.frontend.url}/coach"
         style="display:inline-block;background:#34d399;color:#0a0a0a;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View full dashboard →
      </a>
    `;

    const brand = (coach.coachProfile?.whitelabelEnabled && coach.coachProfile?.brandName)
      ? { name: coach.coachProfile.brandName, logoUrl: coach.coachProfile.brandLogoUrl }
      : undefined;

    await this.send(coach.email, 'Your weekly client digest', shell(body, brand), coach.id, 'coach_digest');
  }

  // ── Coach alert: client missing calls ──────────────────────────────────────

  async sendCoachClientAlert(
    coach: { id: string; firstName: string; email: string },
    client: { id: string; firstName: string },
  ) {
    const clientUrl = `${config.frontend.url}/coach/clients/${client.id}`;
    const body = `
      <h1 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#ffffff;">Heads up, ${coach.firstName}</h1>
      <p style="margin:0 0 20px;font-size:15px;color:#9ca3af;line-height:1.6;">
        <strong style="color:#ffffff;">${client.firstName}</strong> has missed several consecutive calls.
        It might be worth a direct check-in.
      </p>
      <a href="${clientUrl}"
         style="display:inline-block;background:#ffffff;color:#0a0a0a;font-size:14px;font-weight:600;padding:12px 24px;border-radius:10px;text-decoration:none;">
        View ${client.firstName}'s profile →
      </a>
    `;
    await this.send(coach.email, `${client.firstName} may need a check-in`, shell(body), coach.id, 'coach_client_alert');
  }
}

export const emailService = new EmailService();
export default emailService;
