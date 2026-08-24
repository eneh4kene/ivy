/**
 * Remove the demo coach + client created by demo-call.
 *
 *   node dist/scripts/demo-teardown.js
 *
 * Prints the transcript and any derived insights BEFORE deleting, because the
 * delete destroys them — and the transcript is the only durable record of how
 * the call actually went. Retell keeps its own copy, but ours is the one that
 * proves the pipeline persisted anything.
 *
 * Cascades handle calls/memories/messages (Call.user has onDelete: Cascade);
 * this just removes the two users and reports what went with them.
 */
import prisma from '../utils/prisma';

const COACH_EMAIL = 'demo-coach-joe@ivy-demo.invalid';
const CLIENT_EMAIL = 'demo-client-joseph@ivy-demo.invalid';

async function main() {
  const client = await prisma.user.findUnique({
    where: { email: CLIENT_EMAIL },
    include: {
      calls: { include: { memories: true }, orderBy: { createdAt: 'desc' } },
    },
  });

  if (!client) {
    console.log('\nNo demo client found — nothing to tear down.\n');
    await prisma.$disconnect();
    return;
  }

  console.log('\n=== DEMO CALL RECORD (saved before delete) ===');
  for (const c of client.calls) {
    console.log(`\ncall ${c.id}  type=${c.callType}  status=${c.status}  outcome=${c.outcome ?? '(none)'}`);
    console.log(`duration=${c.duration ?? '(none)'}  retellCallId=${c.retellCallId ?? '(none)'}`);
    console.log(`sentiment=${c.sentiment ?? '(none)'}  memories=${c.memories.length}`);
    if (c.callSummary) console.log(`\n--- summary ---\n${c.callSummary}`);
    if (c.callInsights) console.log(`\n--- insights ---\n${JSON.stringify(c.callInsights, null, 2).slice(0, 1200)}`);
    if (c.transcript) console.log(`\n--- transcript ---\n${c.transcript}`);
    else console.log('\n(no transcript persisted)');
  }

  const confirm = process.argv.includes('--yes');
  if (!confirm) {
    console.log('\n\nRe-run with --yes to delete the demo coach and client.\n');
    await prisma.$disconnect();
    return;
  }

  const deletedClient = await prisma.user.delete({ where: { email: CLIENT_EMAIL } });
  const coach = await prisma.user.findUnique({ where: { email: COACH_EMAIL } });
  if (coach) await prisma.user.delete({ where: { email: COACH_EMAIL } });

  console.log(`\nDeleted client ${deletedClient.firstName} and coach ${coach?.firstName ?? '(none)'}.`);
  console.log('Demo records removed.\n');
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('teardown failed:', err?.message ?? err);
  await prisma.$disconnect();
  process.exit(1);
});
