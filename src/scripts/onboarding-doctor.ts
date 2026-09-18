/**
 * Where is this person stuck?
 *
 * Onboarding is a chain of gates and a failure at any one of them looks
 * identical from the outside ("the link didn't work"). This walks the chain for
 * a given email — or for everyone who signed up recently — and says which gate
 * they are behind, in the order they hit them:
 *
 *   1. ACCOUNT      — did the invite actually create/find a user?
 *   2. COACH BOND   — is coachId set, or only pendingCoachId (magic link unread)?
 *   3. MAGIC LINK   — did they ever verify their email and log in?
 *   4. PROFILE      — goal / track / timezone / call time filled in?
 *   5. PHONE        — markUserAsOnboarded REFUSES without one. US numbers get
 *                     the code by voice call (A2P 10DLC unregistered), everyone
 *                     else by SMS, so "no code arrived" means different things.
 *   6. ONBOARDED    — onboardedAt set → startDayZeroExperience fired
 *   7. DAY ZERO     — circle assignment + welcome call actually created
 *
 * Read-only. Prints no full phone numbers and no email bodies.
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/onboarding-doctor.js"
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/onboarding-doctor.js someone@example.com"
 */
import prisma from '../utils/prisma';

const mask = (s: string | null | undefined) => (s ? `…${s.slice(-4)}` : '—');
const when = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

async function report(userId: string) {
  const u = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true, email: true, firstName: true, lastName: true, createdAt: true,
      role: true, subscriptionTier: true, subscriptionStatus: true, isActive: true,
      coachId: true, pendingCoachId: true,
      goal: true, track: true, timezone: true, eveningCallTime: true, commStyle: true,
      phone: true, isOnboarded: true, onboardedAt: true,
      stripeCustomerId: true, stripeSubscriptionId: true,
    },
  });
  if (!u) return;

  const [pending, calls, circles, cycles, coach, links] = await Promise.all([
    prisma.phoneVerification.findUnique({
      where: { userId },
      select: { newPhone: true, attempts: true, expiresAt: true, createdAt: true },
    }),
    prisma.call.count({ where: { userId } }),
    prisma.ivyCircleMember.count({ where: { userId, isActive: true } }),
    prisma.stakeCycle.count({ where: { userId } }),
    u.coachId || u.pendingCoachId
      ? prisma.user.findUnique({
          where: { id: (u.coachId ?? u.pendingCoachId)! },
          select: { firstName: true, lastName: true },
        })
      : null,
    // There is no emailVerified flag — whether they ever got INTO the app is
    // recorded as a used magic link, which is the more useful signal anyway:
    // it separates "the email never arrived" from "it arrived and they never
    // clicked" from "they clicked and stalled inside".
    prisma.magicLink.findMany({
      where: { email: u.email },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { createdAt: true, usedAt: true, expiresAt: true },
    }),
  ]);

  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || '(no name)';
  const coachName = coach ? [coach.firstName, coach.lastName].filter(Boolean).join(' ') : null;

  console.log(`\n${'─'.repeat(64)}`);
  console.log(`${name}   <${u.email}>`);
  console.log(`  id ${u.id}`);
  console.log(`  created ${when(u.createdAt)} · ${u.role ?? 'user'} · ${u.subscriptionTier}/${u.subscriptionStatus ?? '—'} · active:${u.isActive}`);

  // Walk the gates in order and stop at the first one that is shut.
  const gates: Array<[string, boolean, string]> = [
    ['ACCOUNT',    true, `exists`],
    ['COACH BOND', !!u.coachId,
      u.coachId ? `bound to ${coachName ?? u.coachId}`
        : u.pendingCoachId ? `PENDING — invited by ${coachName ?? u.pendingCoachId} but has not opened the magic link yet`
        : `no coach — they did not arrive through an invite link`],
    ['MAGIC LINK', links.some((l) => l.usedAt),
      links.length === 0
        ? `NONE EVER SENT — they never submitted the invite form, or the send failed`
        : links.some((l) => l.usedAt)
          ? `opened (${links.filter((l) => l.usedAt).length} of ${links.length} used, latest sent ${when(links[0].createdAt)})`
          : `${links.length} sent, NONE opened — latest ${when(links[0].createdAt)}${new Date() > links[0].expiresAt ? ' (now expired)' : ''}. Check spam, or the address is wrong.`],
    ['PROFILE',    !!(u.goal && u.timezone && u.eveningCallTime),
      `goal:${u.goal ? 'yes' : 'NO'} track:${u.track ?? '—'} tz:${u.timezone ?? 'NO'} evening:${u.eveningCallTime ?? 'NO'} comms:${u.commStyle ?? '—'}`],
    ['PHONE',      !!u.phone,
      u.phone ? `set ${mask(u.phone)}`
        : pending
          ? `NOT set — code sent to ${mask(pending.newPhone)} by ${pending.newPhone.startsWith('+1') ? 'VOICE CALL' : 'SMS'}, ${pending.attempts} attempt(s), ${new Date() > pending.expiresAt ? 'EXPIRED' : 'still valid'} (sent ${when(pending.createdAt)})`
          : `NOT set — and no verification was ever requested`],
    ['ONBOARDED',  !!u.onboardedAt, u.onboardedAt ? `at ${when(u.onboardedAt)}` : `NEVER — day zero has not fired`],
    ['DAY ZERO',   circles > 0 || calls > 0, `${circles} circle(s) · ${calls} call(s) · ${cycles} stake cycle(s)`],
  ];

  let blockedAt: string | null = null;
  for (const [label, ok, detail] of gates) {
    const mark = ok ? '✔' : blockedAt ? '·' : '✖';
    if (!ok && !blockedAt) blockedAt = label;
    console.log(`  ${mark} ${label.padEnd(11)} ${detail}`);
  }

  console.log(`  billing: customer:${u.stripeCustomerId ? 'yes' : 'no'} subscription:${u.stripeSubscriptionId ? 'yes' : 'no'}`);
  console.log(`\n  → ${blockedAt ? `STUCK AT: ${blockedAt}` : 'Fully onboarded.'}`);
}

async function main() {
  const email = process.argv[2];

  if (email) {
    const u = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() }, select: { id: true } });
    if (!u) {
      console.log(`\nNo account with that email. The invite link creates a stub the moment they submit it,`);
      console.log(`so no row means they never got as far as submitting the form.\n`);
      return;
    }
    await report(u.id);
    console.log('');
    return;
  }

  const recent = await prisma.user.findMany({
    where: { createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
    orderBy: { createdAt: 'desc' },
    take: 15,
    select: { id: true },
  });
  console.log(`\n=== ONBOARDING DOCTOR — ${recent.length} signup(s) in the last 30 days ===`);
  for (const u of recent) await report(u.id);
  console.log('');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err) => { console.error('onboarding-doctor failed:', err); await prisma.$disconnect(); process.exit(1); });
