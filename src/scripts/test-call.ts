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

  console.log(`\nPlacing test call`);
  console.log(`  to    ${to}`);
  console.log(`  from  ${from} (${isUS ? 'US' : 'UK'})`);
  console.log(`  agent ${agentId}\n`);

  try {
    const result = await outboundCallService.placeCall({
      toNumber: to,
      fromNumber: from,
      agentId,
      variables: { user_name: 'there' },
      metadata: { source: 'preflight-test-call' },
      systemPrompt:
        'You are Ivy, running a one-minute line check before launch. Say: ' +
        '"Hey — it\'s Ivy. This is just a test call to check the line works. ' +
        'Can you hear me clearly?" Listen to their answer, say thanks and that ' +
        'everything is working, then end the call. Keep it under a minute and ' +
        'do not discuss commitments, streaks, stakes or money.',
    });

    console.log('PLACED');
    console.log(`  retellCallId ${result.retellCallId}`);
    console.log(`  twilioSid    ${result.twilioSid}`);
    console.log(`  sipUri       ${result.sipUri}`);
    console.log('\nThe phone should ring within a few seconds.');
    console.log('If it rings but nobody speaks, the Twilio leg works and the');
    console.log('Retell SIP bridge is the broken half.\n');
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
