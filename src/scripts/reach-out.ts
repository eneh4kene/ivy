/**
 * Two one-off contacts that had no home, and will be needed again.
 *
 *   app-link <email>     Text someone where the app is. Nothing in the product
 *                        has ever done this: there is no install link in any
 *                        SMS or email, and the install banner only appears once
 *                        you are already inside the web app. For a
 *                        text-preferred member that is not a gap but a dead
 *                        end — their whole daily loop lives in an app nobody
 *                        told them to open.
 *
 *   resend-invite <email> Re-send a coach's client invite after a first attempt
 *                        went nowhere, with the apology first. Uses the branded
 *                        client email so it arrives looking like their coach's
 *                        programme, not a cold system mail.
 *
 * DRY RUN BY DEFAULT — prints exactly what would be sent. --send to do it.
 *
 *   node dist/scripts/reach-out.js app-link them@example.com --send
 *   node dist/scripts/reach-out.js resend-invite them@example.com --send
 */
import prisma from '../utils/prisma';

const arg = (name: string): string | null => {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] ?? null : null;
};

const GSM7 = "@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà\n\r^{}\\[~]|€";
function describe(sms: string) {
  const offenders = [...new Set([...sms].filter((c) => !GSM7.includes(c)))];
  const per = offenders.length ? 67 : 153;
  return `${sms.length} chars · ${Math.ceil(sms.length / per)} segment(s) · ${offenders.length ? `UCS-2 (${offenders.join(' ')})` : 'GSM-7'}`;
}

async function appLink(email: string, send: boolean) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, phone: true, commStyle: true, coachId: true },
  });
  if (!user) { console.error(`No account for ${email}`); process.exit(1); }
  if (!user.phone) { console.error(`${email} has no phone — nothing to text.`); process.exit(1); }

  const host = (process.env.FRONTEND_URL ?? '').replace(/^https?:\/\//, '');
  if (!host) { console.error('FRONTEND_URL is not set'); process.exit(1); }

  const name = user.firstName && user.firstName !== 'Friend' ? ` ${user.firstName}` : '';
  // Plain ASCII, and no magic link: those expire in 15 minutes, so texting one
  // ahead of an evening call would hand someone a dead link by the time they
  // opened it. Their existing session (7 day JWT) should carry them straight in.
  const sms =
    `Hi${name} - Ivy again. Your app is at ${host}. ` +
    `Open it on your phone and add it to your home screen, and everything lives there: ` +
    `your morning voice note, your ivy, and my evening check-in.`;

  console.log(`\n${send ? 'SENDING' : 'DRY RUN —'} app link to ${email}`);
  console.log(`  comms:  ${user.commStyle ?? '—'}${user.commStyle === 'TEXTS' ? '  (text-preferred: the app IS their only channel)' : ''}`);
  console.log(`  sms:    "${sms}"`);
  console.log(`  ${describe(sms)}`);
  if (!send) { console.log(`\nNothing sent. --send to do it.\n`); return; }

  const messagingService = (await import('../services/messaging.service')).default;
  await messagingService.sendMessage(user.id, sms, 'nudge');
  console.log(`  ✔ sent\n`);
}

async function resendInvite(email: string, send: boolean) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, coachId: true, pendingCoachId: true, isOnboarded: true },
  });
  if (!user) { console.error(`No account for ${email}`); process.exit(1); }

  const coachId = user.coachId ?? user.pendingCoachId;
  if (!coachId) { console.error(`${email} is not attached to a coach — nothing to resend.`); process.exit(1); }

  const [coach, profile] = await Promise.all([
    prisma.user.findUnique({ where: { id: coachId }, select: { firstName: true } }),
    prisma.coachProfile.findUnique({
      where: { userId: coachId },
      select: { brandName: true, brandLogoUrl: true, whitelabelEnabled: true },
    }),
  ]);
  const brand = profile?.whitelabelEnabled && profile.brandName
    ? { name: profile.brandName, logoUrl: profile.brandLogoUrl ?? null }
    : undefined;

  console.log(`\n${send ? 'SENDING' : 'DRY RUN —'} invite resend to ${email}`);
  console.log(`  coach:     ${coach?.firstName ?? coachId}${brand ? ` (brand: ${brand.name})` : ''}`);
  console.log(`  onboarded: ${user.isOnboarded}`);
  // 48h, from createMagicLinkUrl's default — NOT the 15m MAGIC_LINK_EXPIRES_IN,
  // which governs the separate plain-login path. Worth stating precisely: a
  // link that expires before someone reads their email is a plausible reason a
  // first invite goes nowhere, and it is the first thing you would suspect.
  console.log(`  sends:     branded client magic link, valid 48 hours`);
  if (!send) { console.log(`\nNothing sent. --send to do it.\n`); return; }

  const authService = (await import('../services/auth.service')).default;
  const { emailService } = await import('../services/email.service');
  const magicUrl = await authService.createMagicLinkUrl(email);
  await emailService.sendClientMagicLink({
    clientEmail: email, magicUrl, brand, coachName: brand ? undefined : coach?.firstName,
  });
  console.log(`  ✔ sent\n`);
}

/**
 * Put a member on calls at a chosen weekly cadence.
 *
 * Someone can pick "just text" at signup before they have any idea what a call
 * with Ivy is, and be stuck with that choice because nothing revisits it. This
 * moves them onto calls deliberately; the onboarding flow asks them again once
 * they have actually spoken to her.
 */
async function setCadence(email: string, freq: number, send: boolean) {
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, commStyle: true, callFrequency: true, eveningCallTime: true, timezone: true },
  });
  if (!user) { console.error(`No account for ${email}`); process.exit(1); }

  const DAYS: Record<number, string> = {
    1: 'Sunday', 2: 'Wed, Sun', 3: 'Tue, Thu, Sun',
    4: 'Mon, Wed, Fri, Sun', 5: 'Mon, Tue, Wed, Fri, Sun', 6: 'Mon-Fri, Sun', 7: 'every day',
  };

  console.log(`\n${send ? 'APPLYING' : 'DRY RUN —'} cadence for ${email}`);
  console.log(`  from: ${user.commStyle ?? '—'} · ${user.callFrequency}/week · evening ${user.eveningCallTime ?? 'NONE'}`);
  console.log(`  to:   CALLS · ${freq}/week (${DAYS[freq] ?? '?'}) · evening ${user.eveningCallTime ?? '20:00'} ${user.timezone ?? 'Europe/London'}`);
  if (!send) { console.log(`\nNothing changed. --send to apply.\n`); return; }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      commStyle: 'CALLS',
      callFrequency: freq,
      ...(user.eveningCallTime ? {} : { eveningCallTime: '20:00' }),
      // Cleared so the frequency map drives the days rather than a stale
      // explicit list overriding it.
      preferredDays: null,
    },
  });
  console.log(`  ✔ applied — next scheduler run picks it up\n`);
}

async function main() {
  const [cmd, rawEmail] = process.argv.slice(2);
  const send = process.argv.includes('--send');
  const email = rawEmail?.toLowerCase().trim();

  if (!email || !['app-link', 'resend-invite', 'cadence'].includes(cmd)) {
    console.error('Usage: node dist/scripts/reach-out.js <app-link|resend-invite|cadence> <email> [--freq N] [--send]');
    process.exit(1);
  }

  if (cmd === 'app-link') await appLink(email, send);
  else if (cmd === 'cadence') await setCadence(email, Number(arg('freq') ?? 3), send);
  else await resendInvite(email, send);
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err) => { console.error('reach-out failed:', err); await prisma.$disconnect(); process.exit(1); });
