/**
 * One-off demo call for a coach who wants to feel what his clients get.
 *
 *   node dist/scripts/demo-call.js            # create records + place the call
 *   node dist/scripts/demo-teardown.js        # save transcript, then delete everything
 *
 * Deliberately an ONBOARDING call. Every other call type reads from a history —
 * streak, kept days, an armed commitment — that a brand-new record does not
 * have, so it would have to be invented. Day one is both the honest option and
 * exactly what a real client meets first, which is the thing being evaluated.
 *
 * It goes through the SAME path as a scheduled call (src/inngest/calls.ts):
 * real context → real Haiku brief → real composed prompt. A hand-written prompt
 * would demo the script, not the product.
 *
 * The records are real rows and must survive the call, because the webhook
 * attaches the transcript to them. demo-teardown removes them afterwards.
 */
import prisma from '../utils/prisma';
import callService from '../services/call.service';
import outboundCallService from '../services/outbound-call.service';
import promptService from '../services/prompt.service';
import briefService from '../services/brief.service';
import { getTrackConfig } from '../config/tracks';
import { flattenContext } from '../utils/retell';
import { config } from '../config';
import logger from '../utils/logger';

// Tagged so teardown can find them, and so nothing here is mistaken for a real user.
export const DEMO_TAG = 'demo-grant-call';
const COACH_EMAIL = 'demo-coach-joe@ivy-demo.invalid';
const CLIENT_EMAIL = 'demo-client-joseph@ivy-demo.invalid';
const CLIENT_PHONE = '+447432846353';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  // ── Coach ────────────────────────────────────────────────────────────────
  const coach = await prisma.user.upsert({
    where: { email: COACH_EMAIL },
    update: {},
    create: {
      email: COACH_EMAIL,
      firstName: 'Joe',
      lastName: 'Demo',
      role: 'coach',
      subscriptionTier: 'COACH',
      track: 'fitness',
      goal: 'Run a fitness coaching programme',
      timezone: 'Europe/London',
      isOnboarded: true,
      isActive: true,
    },
  });

  // ── Client ───────────────────────────────────────────────────────────────
  // A real client of Joe's on day one: goal and minimum set (they came through
  // the coach, so the programme is known), but no streak and no history —
  // because there genuinely isn't one.
  const client = await prisma.user.upsert({
    where: { email: CLIENT_EMAIL },
    update: { phone: CLIENT_PHONE },
    create: {
      email: CLIENT_EMAIL,
      phone: CLIENT_PHONE,
      firstName: 'Joseph',
      lastName: 'Demo',
      timezone: 'Europe/London',
      region: 'GB',
      currency: 'GBP',
      subscriptionTier: 'PRO',
      commStyle: 'CALLS',
      track: 'fitness',
      trackDetail: 'strength training',
      goal: 'Train three times a week and stop letting the week slide',
      minimumMode: 'Twenty minutes of something, even on the worst day',
      giftFrame: 'His own consistency — he coaches this, he wants to live it',
      eveningCallTime: '20:00',
      callFrequency: 3,
      circleOptIn: true,
      forfeitMode: 'MIDDLE',
      // No stake armed: the teeth ladder starts stake-less, so Ivy must hold him
      // to his word rather than invent money that isn't on the line.
      coachId: coach.id,
      coachLinkedAt: new Date(),
      coachNotes:
        'Joseph is himself a coach, trialling the client experience first-hand before ' +
        'citing this programme in a funding interview. Treat him as a normal new client — ' +
        'he wants the real thing, not a demo.',
      isOnboarded: true,
      isActive: true,
    },
  });

  const callRow = await prisma.call.create({
    data: {
      userId: client.id,
      callType: 'ONBOARDING',
      scheduledAt: new Date(),
      status: 'SCHEDULED',
    },
  });

  // ── Same pipeline as a scheduled call ────────────────────────────────────
  const ctx = await callService.getUserContext(client.id, 'ONBOARDING');
  const trackConfig = getTrackConfig(ctx.track);
  const brief = await briefService.generateCallBrief('ONBOARDING', ctx, trackConfig!);
  const systemPrompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false, brief ?? undefined);

  const agentId = config.retell.agentIds.b2c || '';
  const fromNumber = CLIENT_PHONE.startsWith('+1')
    ? config.twilio.phoneNumberUs
    : config.twilio.phoneNumber;

  console.log('\n=== DEMO CALL ===');
  console.log(`coach   : ${coach.firstName} (${coach.id})`);
  console.log(`client  : ${client.firstName} → ${CLIENT_PHONE} (${client.id})`);
  console.log(`call    : ${callRow.id}  type=ONBOARDING`);
  console.log(`from    : ${fromNumber}`);
  console.log(`brief   : ${brief ? 'generated' : 'none (static flow)'}`);
  console.log(`prompt  : ${systemPrompt.length} chars`);
  console.log(`\n--- prompt opening ---\n${systemPrompt.slice(0, 700)}\n`);

  if (dryRun) {
    console.log('DRY RUN — records created, no call placed.');
    console.log(`Place it with: node dist/scripts/demo-call.js`);
    await prisma.$disconnect();
    return;
  }

  if (!fromNumber) throw new Error('No Twilio from-number configured');

  const placed = await outboundCallService.placeCall({
    toNumber: CLIENT_PHONE,
    fromNumber,
    agentId,
    variables: flattenContext({ ...ctx, call_type: 'onboarding' }),
    metadata: { callId: callRow.id, userId: client.id, callType: 'ONBOARDING', tag: DEMO_TAG },
    systemPrompt,
  });

  await callService.updateCallStatus(callRow.id, 'IN_PROGRESS', {
    retellCallId: placed.retellCallId,
  });

  console.log('PLACED');
  console.log(`  retellCallId ${placed.retellCallId}`);
  console.log(`  twilioSid    ${placed.twilioSid}`);
  console.log(`\nAfter the call:  node dist/scripts/demo-teardown.js\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  logger.error('demo-call failed', err);
  console.error('\nFAILED:', err?.message ?? err);
  if (err?.response?.data) console.error(JSON.stringify(err.response.data).slice(0, 400));
  await prisma.$disconnect();
  process.exit(1);
});
