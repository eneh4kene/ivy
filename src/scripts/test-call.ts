/**
 * Place ONE real call, through the real code path, to prove the phone pipeline
 * works end to end: Retell registration → SIP URI → Twilio dial → bridge.
 *
 * It deliberately calls outboundCallService.placeCall rather than reimplementing
 * the Retell/Twilio handshake — a standalone reimplementation would prove that
 * the script works, not that the product does.
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/test-call.js +447xxxxxxxxx"
 *
 * Costs real money and rings a real phone. Caller ID is chosen by destination
 * prefix, matching the routing in the live call path (+1 → US number).
 */
import outboundCallService from '../services/outbound-call.service';
import config from '../config';
import prisma from '../utils/prisma';

async function main() {
  const to = process.argv[2];
  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    console.error('Usage: node dist/scripts/test-call.js +<E164 number>');
    console.error('  e.g. node dist/scripts/test-call.js +447700900123');
    process.exit(1);
  }

  // Same rule as the live path: route by destination prefix, not billing currency.
  const isUS = to.startsWith('+1');
  const from = isUS ? config.twilio.phoneNumberUs : config.twilio.phoneNumber;
  if (!from) {
    console.error(`No caller ID configured for ${isUS ? 'US' : 'UK'} destinations`);
    process.exit(1);
  }

  const agentId = config.retell.agentIds.b2c;
  if (!agentId) {
    console.error('RETELL_AGENT_ID_B2C not set');
    process.exit(1);
  }

  // A DB Call row is what makes this a real end-to-end test. The webhook
  // resolves its record from metadata.callId; without one, dbCallId is null and
  // the handler skips every write BY DESIGN — so the call can succeed while
  // proving nothing about whether transcripts, insights or memory ever persist.
  const user = await prisma.user.findFirst({
    where: { phone: to },
    select: { id: true, firstName: true },
  });
  if (!user) {
    console.error(`\nNo user in the DB with phone .`);
    console.error('Persistence cannot be tested without one — the webhook has');
    console.error('nothing to attach the transcript to. Sign up with this number');
    console.error('first, or pass a number that already belongs to a user.\n');
    process.exit(1);
  }

  const callRow = await prisma.call.create({
    data: {
      userId: user.id,
      callType: 'EVENING_REVIEW',
      scheduledAt: new Date(),
      status: 'SCHEDULED',
    },
    select: { id: true },
  });

  console.log(`\nPlacing test call`);
  console.log(`  to    ${to}`);
  console.log(`  from  ${from} (${isUS ? 'US' : 'UK'})`);
  console.log(`  agent ${agentId}`);
  console.log(`  user  ${user.firstName} (${user.id})`);
  console.log(`  call  ${callRow.id}\n`);

  try {
    const result = await outboundCallService.placeCall({
      toNumber: to,
      fromNumber: from,
      agentId,
      variables: { user_name: user.firstName },
      // metadata.callId/userId is exactly what handleRetellWebhook reads to
      // resolve the record — this is the link that makes persistence testable.
      metadata: { source: 'preflight-test-call', callId: callRow.id, userId: user.id },
      systemPrompt:
        'You are Ivy, running a one-minute line check before launch. Say: ' +
        '"Hey — it\'s Ivy. This is just a test call to check the line works. ' +
        'Can you hear me clearly?" Listen to their answer, say thanks and that ' +
        'everything is working, then end the call. Keep it under a minute and ' +
        'do not discuss commitments, streaks, stakes or money.',
    });

    // Bind the Retell id so the webhook can also resolve by retellCallId.
    await prisma.call.update({
      where: { id: callRow.id },
      data: { retellCallId: result.retellCallId, status: 'IN_PROGRESS', startedAt: new Date() },
    });

    console.log('PLACED');
    console.log(`  retellCallId ${result.retellCallId}`);
    console.log(`  twilioSid    ${result.twilioSid}`);
    console.log(`  sipUri       ${result.sipUri}`);
    console.log('\nThe phone should ring within a few seconds.');
    console.log('If it rings but nobody speaks, the Twilio leg works and the');
    console.log('Retell SIP bridge is the broken half.');
    console.log('\nAfter the call ends, check persistence with:');
    console.log(`  node dist/scripts/check-call.js ${callRow.id}\n`);
    await prisma.$disconnect();
    process.exit(0);
  } catch (err: any) {
    console.error('\nFAILED to place call');
    console.error(`  ${err?.message ?? err}`);
    if (err?.code) console.error(`  code ${err.code}`);
    if (err?.status) console.error(`  status ${err.status}`);
    if (err?.response?.data) console.error(`  body ${JSON.stringify(err.response.data).slice(0, 400)}`);
    process.exit(1);
  }
}

main();
