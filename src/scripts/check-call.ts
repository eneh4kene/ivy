/**
 * Did the call actually persist? Reads back the row the webhook should have
 * written — transcript, outcome, insights, summary, and derived memories.
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/check-call.js <callId>"
 *
 * This is the half that a placed call cannot prove on its own: Retell captures
 * transcripts regardless, so the only evidence that OUR pipeline works is a
 * populated row on our side.
 */
import prisma from '../utils/prisma';

async function main() {
  const id = process.argv[2];
  if (!id) {
    console.error('Usage: node dist/scripts/check-call.js <callId>');
    process.exit(1);
  }

  const call = await prisma.call.findUnique({
    where: { id },
    include: { memories: true, user: { select: { firstName: true, phone: true } } },
  });

  if (!call) {
    console.error(`No call row ${id}`);
    process.exit(1);
  }

  const yes = (v: unknown) => (v ? 'YES' : 'no');
  console.log('\n=== CALL PERSISTENCE ===');
  console.log(`user        : ${call.user?.firstName ?? '(unknown)'} ${call.user?.phone ?? ''}`);
  console.log(`status      : ${call.status}`);
  console.log(`outcome     : ${call.outcome ?? '(none)'}`);
  console.log(`duration    : ${call.duration ?? '(none)'}`);
  console.log(`retellCallId: ${call.retellCallId ?? '(none)'}`);
  console.log('');
  console.log(`transcript  : ${yes(call.transcript)}${call.transcript ? ` (${call.transcript.length} chars)` : ''}`);
  console.log(`summary     : ${yes(call.callSummary)}`);
  console.log(`insights    : ${yes(call.callInsights)}`);
  console.log(`sentiment   : ${call.sentiment ?? '(none)'}`);
  console.log(`memories    : ${call.memories.length}`);

  if (call.transcript) {
    console.log('\n--- transcript (first 600 chars) ---');
    console.log(call.transcript.slice(0, 600));
  }
  if (call.callSummary) {
    console.log('\n--- summary ---');
    console.log(call.callSummary);
  }

  // The webhook writes status+transcript on call_ended and insights on
  // call_analyzed, so a transcript with no insights means analysis never landed.
  const ok = !!call.transcript && call.status === 'COMPLETED';
  console.log(`\n${ok ? 'PERSISTENCE PROVEN' : 'INCOMPLETE — see fields above'}\n`);
  await prisma.$disconnect();
  process.exit(ok ? 0 : 1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
