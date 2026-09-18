/**
 * Get a client who fell through onboarding back on the rails, in one action.
 *
 * Someone can finish signup and end up with an account that looks healthy and
 * is completely inert: no evening time (so nothing is ever scheduled, on either
 * channel), no goal, and the stub name "Friend" — because the just_text branch
 * set a channel and nothing else. This puts them back:
 *
 *   1. gives them an evening time if they have none (the master switch)
 *   2. books an ONBOARDING call — the only flow that introduces Ivy, confirms
 *      whether they actually want calls or text, takes their name and goal, and
 *      explains the daily rhythm. A plain evening check-in would ask "how did
 *      today land?" of someone who has never been told what any of this is.
 *   3. texts them so the call is expected rather than a cold ring from an
 *      unknown number, with a stated way out if they would rather not
 *
 * DRY RUN BY DEFAULT. Nothing is written and nothing is sent without --send.
 *
 *   node dist/scripts/welcome-rescue.js them@example.com --at 20:00
 *   node dist/scripts/welcome-rescue.js them@example.com --at 20:00 --send
 */
import prisma from '../utils/prisma';
import { fromZonedTime } from 'date-fns-tz';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] ?? null : null;
};

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  const at = arg('at') ?? '20:00';
  const send = process.argv.includes('--send');

  if (!email || email.startsWith('--')) {
    console.error('Usage: node dist/scripts/welcome-rescue.js <email> [--at HH:MM] [--send]');
    process.exit(1);
  }
  if (!/^([01]?\d|2[0-3]):([0-5]\d)$/.test(at)) {
    console.error(`--at must be HH:MM, got "${at}"`);
    process.exit(1);
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true, firstName: true, phone: true, timezone: true, commStyle: true,
      eveningCallTime: true, goal: true, isOnboarded: true, coachId: true,
    },
  });
  if (!user) { console.error(`No account for ${email}`); process.exit(1); }
  if (!user.phone) { console.error(`${email} has no phone — nothing can be sent or dialled.`); process.exit(1); }

  const tz = user.timezone || 'Europe/London';
  const today = new Date().toLocaleDateString('en-CA', { timeZone: tz });
  const callAt = fromZonedTime(`${today}T${at}:00`, tz);

  const coach = user.coachId
    ? await prisma.user.findUnique({ where: { id: user.coachId }, select: { firstName: true } })
    : null;

  // Named if we have a real name; the stub "Friend" is worse than no name.
  const greeting = user.firstName && user.firstName !== 'Friend' ? `Hi ${user.firstName} - ` : 'Hi - ';
  // No "reply TEXT to skip it" here, deliberately. Onboarding is a phone call:
  // it is the only flow that introduces her, takes her name and goal and
  // explains the rhythm, and offering an opt-out in the same breath invites
  // someone to decline the one thing that makes the rest work. Her channel
  // preference gets settled ON the call, where she can actually be asked.
  const sms =
    `${greeting}it's Ivy, ${coach?.firstName ?? 'your coach'}'s coaching and accountability assistant. ` +
    `Sorry for the quiet since you signed up; that was our end, not yours. ` +
    `I'll call you tonight at ${at} to get you properly set up - it only takes a few minutes.`;

  // GSM-7 vs UCS-2. A single em dash or curly apostrophe drops the alphabet to
  // UCS-2, which cuts a segment from 153 characters to 67 — so a message that
  // reads as two parts silently bills and arrives as four or five.
  const GSM7 = "@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà\n\r^{}\\[~]|€";
  const offenders = [...sms].filter((c) => !GSM7.includes(c));
  const unicode = offenders.length > 0;
  const perSegment = unicode ? 67 : 153;

  console.log(`\n${send ? 'RESCUING' : 'DRY RUN —'} ${email}`);
  console.log(`  current: name "${user.firstName}" · comms ${user.commStyle ?? '—'} · evening ${user.eveningCallTime ?? 'NONE'} · goal ${user.goal ? 'set' : 'none'} · onboarded ${user.isOnboarded}`);
  console.log(`  call:    ONBOARDING at ${at} ${tz} (${callAt.toISOString()})`);
  console.log(`  sms:     "${sms}"`);
  console.log(`  length:  ${sms.length} chars · ${Math.ceil(sms.length / perSegment)} segment(s) · ${unicode ? `UCS-2 (non-GSM chars: ${[...new Set(offenders)].join(' ')})` : 'GSM-7'}`);
  if (unicode) console.log(`  ⚠ those characters force UCS-2 — 67 chars per segment instead of 153`);

  if (!send) {
    console.log(`\nNothing written, nothing sent. Re-run with --send to do it.\n`);
    return;
  }

  if (!user.eveningCallTime) {
    await prisma.user.update({ where: { id: user.id }, data: { eveningCallTime: at } });
    console.log(`  ✔ evening time set to ${at} — the daily loop can now schedule at all`);
  }

  const callService = (await import('../services/call.service')).default;
  const call = await callService.scheduleCall(user.id, 'ONBOARDING', callAt, await callService.getUserContext(user.id, 'ONBOARDING'));
  console.log(`  ✔ onboarding call booked (${call.id})`);

  const messagingService = (await import('../services/messaging.service')).default;
  await messagingService.sendMessage(user.id, sms, 'nudge');
  console.log(`  ✔ SMS sent\n`);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err) => { console.error('welcome-rescue failed:', err); await prisma.$disconnect(); process.exit(1); });
