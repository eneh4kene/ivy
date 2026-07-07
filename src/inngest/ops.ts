import { inngest } from './client';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { sendTelegramAdmin } from '../utils/telegram-admin';
import { config } from '../config';
import { logUsage } from '../services/usage.service';

/**
 * Ops pulse — bootstrapper's mission control, delivered to the admin Telegram.
 *
 *  • opsDailyGuard (07:00 daily): yesterday's spend by service + Twilio balance,
 *    with 🚨 alerts when the daily burn or the Twilio balance crosses thresholds.
 *    One message a day; the experience must never break mid-beta because a
 *    balance quietly hit zero.
 *  • opsWeeklyPulse (Mon 07:30): the product-discovery digest — activation,
 *    arming rate, settlements, call outcomes, chat volume, 7-day burn. The
 *    numbers that answer "is the beta working?" without opening a dashboard.
 *
 * Thresholds via env: OPS_DAILY_ALERT_GBP (default 8), OPS_TWILIO_MIN_USD
 * (default 8). Alerts no-op silently if Telegram admin env is missing.
 */

const DAILY_ALERT_GBP = Number(process.env.OPS_DAILY_ALERT_GBP || 8);
const TWILIO_MIN_USD = Number(process.env.OPS_TWILIO_MIN_USD || 8);

async function spendByService(since: Date): Promise<{ lines: string[]; total: number }> {
  const rows = await prisma.apiUsageLog.groupBy({
    by: ['service'],
    where: { createdAt: { gte: since } },
    _sum: { costGbp: true, units: true },
  });
  const lines = rows
    .sort((a, b) => (b._sum.costGbp ?? 0) - (a._sum.costGbp ?? 0))
    .map((r) => `  ${r.service}: £${(r._sum.costGbp ?? 0).toFixed(2)}`);
  const total = rows.reduce((s, r) => s + (r._sum.costGbp ?? 0), 0);
  return { lines, total };
}

/**
 * The discovery half of the weekly pulse: Haiku reads the week's call
 * transcripts + user chat messages and surfaces what a founder doing manual
 * user research would find — the moments, the friction, one suggested
 * iteration. Every transcript is a user interview; this is the synthesis.
 */
async function discoveryDigest(since: Date): Promise<string | null> {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  const [calls, userMsgs] = await Promise.all([
    prisma.call.findMany({
      where: { status: 'COMPLETED', transcript: { not: null }, scheduledAt: { gte: since } },
      orderBy: { scheduledAt: 'desc' },
      take: 20,
      select: { callType: true, transcript: true, sentiment: true },
    }),
    prisma.message.findMany({
      where: { channel: 'IN_APP', direction: 'INBOUND', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 40,
      select: { content: true },
    }),
  ]);
  if (calls.length === 0 && userMsgs.length === 0) return null;

  const NL = '\n';
  const corpus = [
    ...calls.map((c) => `[${c.callType} call, sentiment ${c.sentiment ?? '?'}]${NL}${(c.transcript ?? '').slice(0, 1500)}`),
    userMsgs.length
      ? `[USER CHAT MESSAGES]${NL}${userMsgs.map((m) => `- ${m.content.slice(0, 200)}`).join(NL)}`
      : '',
  ].filter(Boolean).join(`${NL}${NL}---${NL}${NL}`).slice(0, 60_000);

  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const res = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `You are synthesising a week of beta-user conversations with an AI accountability coach for the founder. From the transcripts and messages below, produce EXACTLY this, tersely:

MOMENTS (up to 3): the most revealing user quotes or exchanges — verbatim fragments, with why each matters.
FRICTION (up to 2): where users hesitated, pushed back, misunderstood, or the product failed them.
ITERATE: the single highest-leverage change to make this week, one sentence.

If the data is too thin to say something real, say "Too quiet to synthesise" and nothing else. Never invent.

${corpus}`,
      }],
    });
    logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), undefined, { op: 'discovery_digest' }).catch(() => {});
    const text = res.content[0]?.type === 'text' ? res.content[0].text.trim() : null;
    return text || null;
  } catch (err) {
    logger.warn('Discovery digest synthesis failed:', err);
    return null;
  }
}

async function twilioBalanceUsd(): Promise<number | null> {
  const sid = config.twilio.accountSid;
  const tok = config.twilio.authToken;
  if (!sid || !tok) return null;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Balance.json`, {
      headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${tok}`).toString('base64') },
    });
    const j: any = await res.json();
    return j?.balance != null ? Number(j.balance) : null;
  } catch {
    return null;
  }
}

export const opsDailyGuard = inngest.createFunction(
  { id: 'ops-daily-guard', name: 'Ops daily cost guard', triggers: { cron: '0 7 * * *' } },
  async () => {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const { lines, total } = await spendByService(since);
    const balance = await twilioBalanceUsd();

    const alerts: string[] = [];
    if (total > DAILY_ALERT_GBP) alerts.push(`daily burn £${total.toFixed(2)} > £${DAILY_ALERT_GBP} threshold`);
    if (balance != null && balance < TWILIO_MIN_USD) alerts.push(`Twilio balance $${balance.toFixed(2)} — TOP UP`);

    const msg = [
      alerts.length ? `🚨 IVY OPS ALERT\n${alerts.map((a) => `• ${a}`).join('\n')}\n` : '🌿 Ivy ops — daily',
      `Spend last 24h: £${total.toFixed(2)}`,
      ...lines,
      balance != null ? `Twilio balance: $${balance.toFixed(2)}` : 'Twilio balance: (unavailable)',
    ].join('\n');

    await sendTelegramAdmin(msg);
    logger.info(`Ops daily guard sent (total £${total.toFixed(2)}, alerts: ${alerts.length})`);
    return { total, alerts: alerts.length };
  },
);

export const opsWeeklyPulse = inngest.createFunction(
  { id: 'ops-weekly-pulse', name: 'Ops weekly product pulse', triggers: { cron: '30 7 * * 1' } },
  async () => {
    const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [newUsers, onboarded, armed, cyclesSettled, forfeits, callsDone, callsMissed, chatMsgs, { total }] =
      await Promise.all([
        prisma.user.count({ where: { createdAt: { gte: since } } }),
        prisma.user.count({ where: { isOnboarded: true } }),
        prisma.workout.count({ where: { armedAt: { gte: since } } }),
        prisma.stakeCycle.findMany({
          where: { status: 'SETTLED', updatedAt: { gte: since } },
          select: { stakeAmount: true, capturedAmount: true, daysForfeited: true, daysInCycle: true },
        }),
        prisma.donation.aggregate({ where: { createdAt: { gte: since }, donationType: 'STAKE_FORFEIT' }, _sum: { amount: true } }),
        prisma.call.count({ where: { status: 'COMPLETED', scheduledAt: { gte: since } } }),
        prisma.call.count({ where: { status: 'NO_ANSWER', scheduledAt: { gte: since } } }),
        prisma.message.count({ where: { channel: 'IN_APP', createdAt: { gte: since } } }),
        spendByService(since),
      ]);

    const kept = cyclesSettled.reduce((s, c) => s + (Number(c.stakeAmount) - Number(c.capturedAmount ?? 0)), 0);
    const forfeited = Number(forfeits._sum.amount ?? 0);
    const keptDays = cyclesSettled.reduce((s, c) => s + (c.daysInCycle - c.daysForfeited), 0);
    const totalDays = cyclesSettled.reduce((s, c) => s + c.daysInCycle, 0);

    const digest = await discoveryDigest(since);

    const msg = [
      '🌿 Ivy weekly pulse',
      `Users: ${onboarded} onboarded (+${newUsers} new this week)`,
      `Arming: ${armed} days armed this week`,
      `Settlement: ${cyclesSettled.length} cycles · ${keptDays}/${totalDays || '—'} days kept · £${kept.toFixed(2)} returned · £${forfeited.toFixed(2)} forfeited`,
      `Calls: ${callsDone} completed · ${callsMissed} missed`,
      `Chat: ${chatMsgs} messages`,
      `Burn (7d): £${total.toFixed(2)}`,
      digest ? `\n— DISCOVERY —\n${digest}` : '',
    ].filter(Boolean).join('\n');

    await sendTelegramAdmin(msg);
    logger.info('Ops weekly pulse sent');
    return { onboarded, newUsers, cycles: cyclesSettled.length };
  },
);
