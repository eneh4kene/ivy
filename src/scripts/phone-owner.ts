/**
 * Who holds this phone number, and — on request — release it.
 *
 * `User.phone` is @unique and phone-verify refuses a number that belongs to
 * another account ("That number is already associated with another account").
 * That is the correct rule, but it has no operator escape hatch: in beta, one
 * abandoned or duplicate signup can permanently block a real person from
 * onboarding with their own number, and there is no admin UI for it — no
 * user-management route exists, and no account in production even holds the
 * `superadmin` role that would reach one.
 *
 * So this follows the preflight.ts pattern: a script run inside the prod
 * machine, where SSH access IS the authorisation.
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/phone-owner.js --suffix 63"
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/phone-owner.js +447700900063"
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/phone-owner.js +447700900063 --release"
 *
 * INSPECT-ONLY BY DEFAULT. Without --release nothing is written, so the
 * question "who has my number" can never accidentally answer itself by
 * destroying an account's ability to be called.
 *
 * Releasing only ever nulls `phone`. It does not delete, deactivate, or
 * otherwise touch the account: the holder keeps their history, their stake
 * cycles and their coach, and can re-verify a different number. Reversible by
 * re-verifying, and recorded in OpsEvent either way.
 */
import prisma from '../utils/prisma';

/** Same normalisation phone-verify applies, so lookups match what was stored. */
function normalisePhone(phone: string): string {
  const stripped = phone.replace(/[\s\-()]/g, '');
  return stripped.startsWith('+') ? stripped : `+${stripped}`;
}

const mask = (s: string | null) => (s ? `…${s.slice(-4)}` : 'none');

/**
 * Find held numbers by their last digits.
 *
 * Support arrives as "his number ending in 63 is taken" — nobody reads out a
 * full number to report a bug. Searching by suffix answers that directly,
 * where the alternative is dumping every phone in the users table into a
 * terminal to eyeball the match.
 */
async function findBySuffix(suffix: string): Promise<void> {
  const holders = await prisma.user.findMany({
    where: { phone: { endsWith: suffix } },
    select: { id: true, firstName: true, role: true, subscriptionTier: true,
              onboardedAt: true, isActive: true, createdAt: true, phone: true },
    orderBy: { createdAt: 'asc' },
  });

  if (holders.length === 0) {
    console.log(`\nNo account holds a number ending ${suffix}.\n`);
    return;
  }

  console.log(`\n${holders.length} account(s) hold a number ending ${suffix}:\n`);
  for (const h of holders) {
    console.log(`  ${h.firstName ?? '(no name)'} · ${h.role ?? 'user'} · ${h.subscriptionTier} · created ${h.createdAt.toISOString().slice(0, 10)} · onboarded ${h.onboardedAt ? 'yes' : 'NEVER'} · active ${h.isActive}`);
    console.log(`    id ${h.id}`);
    console.log(`    inspect: node dist/scripts/phone-owner.js ${h.phone}`);
  }
  console.log('');
}

async function main() {
  const [rawPhone, ...flags] = process.argv.slice(2);
  const release = flags.includes('--release');

  if (rawPhone === '--suffix') {
    const suffix = flags[0];
    if (!suffix) {
      console.error('Usage: node dist/scripts/phone-owner.js --suffix <last digits>');
      process.exit(1);
    }
    await findBySuffix(suffix);
    return;
  }

  if (!rawPhone) {
    console.error('Usage: node dist/scripts/phone-owner.js <phone> [--release]');
    console.error('       node dist/scripts/phone-owner.js --suffix <last digits>');
    process.exit(1);
  }

  const phone = normalisePhone(rawPhone);
  if (!/^\+[1-9]\d{6,14}$/.test(phone)) {
    console.error(`Not an E.164 number: ${phone} — include the country code, e.g. +447911123456`);
    process.exit(1);
  }

  const owner = await prisma.user.findUnique({
    where: { phone },
    select: {
      id: true, firstName: true, lastName: true, role: true, subscriptionTier: true,
      onboardedAt: true, isActive: true, createdAt: true, coachId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!owner) {
    console.log(`\n${mask(phone)} is FREE — no account holds it.`);
    console.log('If onboarding still refuses it, the number being typed differs from the one stored');
    console.log('(country code, or a different number entirely).\n');
    return;
  }

  // Enough signal to tell an abandoned signup from someone's live account,
  // without dumping personal data into a terminal log.
  const [calls, workouts, cycles, messages, circles] = await Promise.all([
    prisma.call.count({ where: { userId: owner.id } }),
    prisma.workout.count({ where: { userId: owner.id } }),
    prisma.stakeCycle.count({ where: { userId: owner.id } }),
    prisma.message.count({ where: { userId: owner.id } }),
    prisma.ivyCircleMember.count({ where: { userId: owner.id, isActive: true } }),
  ]);

  const name = [owner.firstName, owner.lastName].filter(Boolean).join(' ') || '(no name)';
  console.log(`\n${mask(phone)} is held by:\n`);
  console.log(`  ${name}   id ${owner.id}`);
  console.log(`  role ${owner.role ?? 'user'} · tier ${owner.subscriptionTier} · created ${owner.createdAt.toISOString().slice(0, 10)}`);
  console.log(`  onboarded ${owner.onboardedAt ? owner.onboardedAt.toISOString().slice(0, 10) : 'NEVER'} · active ${owner.isActive} · coach ${owner.coachId ? 'yes' : 'no'} · subscription ${owner.stripeSubscriptionId ? 'yes' : 'no'}`);
  console.log(`  activity: ${calls} calls · ${workouts} workouts · ${cycles} stake cycles · ${messages} messages · ${circles} circles`);

  const looksAbandoned = !owner.onboardedAt && cycles === 0 && workouts === 0;
  console.log(`\n  → ${looksAbandoned ? 'Looks like an abandoned signup.' : 'This account has real history — releasing costs it the ability to be CALLED until it verifies a new number.'}`);

  if (!release) {
    console.log(`\nNothing was changed. To free the number for someone else:`);
    console.log(`  node dist/scripts/phone-owner.js ${phone} --release\n`);
    return;
  }

  await prisma.user.update({ where: { id: owner.id }, data: { phone: null } });
  // Any half-finished verification on the releasing account would otherwise
  // sit pointing at a number they no longer hold.
  await prisma.phoneVerification.deleteMany({ where: { userId: owner.id } });

  await prisma.opsEvent.create({
    data: {
      severity: 'warn',
      source: 'ops:phone-owner',
      title: 'phone_released',
      userId: owner.id,
      entityType: 'user',
      entityId: owner.id,
      detail: `Released ${mask(phone)} from ${name} (${owner.role ?? 'user'}, onboarded ${owner.onboardedAt ? 'yes' : 'never'}, ${calls} calls / ${cycles} cycles) so another account can verify it.`,
    },
  }).catch(() => {});

  console.log(`\n✔ Released. ${name} no longer holds ${mask(phone)} and can verify a different one.`);
  console.log(`  The number is now free for someone else to verify.\n`);
}

// Exit explicitly, as preflight does. Letting the event loop drain leaves the
// Prisma pool holding it open, which hangs the ssh session that invoked this
// and makes a script that already finished look like one that is stuck.
main()
  .then(async () => {
    await prisma.$disconnect();
    process.exit(0);
  })
  .catch(async (err) => {
    console.error('phone-owner failed:', err);
    await prisma.$disconnect();
    process.exit(1);
  });
