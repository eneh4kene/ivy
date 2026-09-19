/**
 * Did the call actually work? Not "was it dialled" — did the whole chain land.
 *
 * A call can look fine and still have failed silently at any of four points,
 * and every one of them has happened in this product before:
 *
 *   DIALLED    the Inngest job fired and Retell placed it
 *   ANSWERED   a human picked up, rather than voicemail
 *   TRANSCRIPT the webhook came back and stored it (the webhook was dead for
 *              weeks once, and nothing downstream complained)
 *   INSIGHTS   extraction parsed (model fences broke JSON.parse on EVERY call
 *              ever, until July — summaries and memories silently never wrote)
 *   APPLIED    memories, next intention, day-zero follow-through
 *
 * Read-only.
 *
 *   node dist/scripts/call-watch.js them@example.com
 */
import prisma from '../utils/prisma';

const when = (d: Date | null | undefined) => (d ? d.toISOString().slice(0, 16).replace('T', ' ') : '—');

async function main() {
  const email = process.argv[2]?.toLowerCase().trim();
  if (!email) { console.error('Usage: node dist/scripts/call-watch.js <email> [--transcript] [--messages]'); process.exit(1); }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, firstName: true, goal: true, commStyle: true, eveningCallTime: true },
  });
  if (!user) { console.error(`No account for ${email}`); process.exit(1); }

  const calls = await prisma.call.findMany({
    where: { userId: user.id },
    orderBy: { scheduledAt: 'desc' },
    take: 5,
    select: {
      id: true, callType: true, status: true, scheduledAt: true, startedAt: true, endedAt: true,
      duration: true, sentiment: true, transcript: true, callSummary: true, callInsights: true, shape: true,
    },
  });

  console.log(`\n=== ${user.firstName ?? email} — last ${calls.length} call(s) ===`);
  console.log(`profile: goal ${user.goal ? `"${user.goal}"` : 'STILL EMPTY'} · comms ${user.commStyle ?? '—'} · evening ${user.eveningCallTime ?? 'NONE'}\n`);

  for (const c of calls) {
    const insights = c.callInsights as Record<string, unknown> | null;
    const memories = await prisma.callMemory.count({ where: { callId: c.id } });

    console.log(`${'─'.repeat(60)}`);
    console.log(`${c.callType} · ${c.status} · scheduled ${when(c.scheduledAt)}${c.shape ? ` · shape ${c.shape}` : ''}`);
    console.log(`  DIALLED     ${c.startedAt ? `yes, ${when(c.startedAt)}` : c.status === 'SCHEDULED' ? 'not yet — still ahead' : 'NO'}`);
    console.log(`  ANSWERED    ${c.duration ? `${c.duration}s${c.duration < 20 ? '  ⚠ very short — voicemail or immediate hang-up?' : ''}` : c.startedAt ? 'NO DURATION' : '—'}`);
    console.log(`  TRANSCRIPT  ${c.transcript ? `${c.transcript.length} chars` : c.endedAt ? 'MISSING — webhook did not land' : '—'}`);
    console.log(`  INSIGHTS    ${insights ? `parsed (${Object.keys(insights).length} fields)` : c.transcript ? 'NOT EXTRACTED — parse or job failure' : '—'}`);
    console.log(`  SUMMARY     ${c.callSummary ? `"${c.callSummary.slice(0, 110)}…"` : '—'}`);
    console.log(`  MEMORIES    ${memories} written`);
    if (insights?.next_intention) console.log(`  COMMITTED   "${String(insights.next_intention).slice(0, 90)}"`);
    if (c.sentiment) console.log(`  SENTIMENT   ${c.sentiment}`);

    // A call can pass every stage and still have gone wrong in the room — too
    // short, a question never asked, an early goodbye. --transcript is how you
    // see that, and it is the only thing that answers "why".
    if (process.argv.includes('--transcript') && c.transcript) {
      console.log(`\n  ── transcript ──\n${c.transcript.split('\n').map((l) => `  ${l}`).join('\n')}`);
    }
  }
  // --messages answers the question a screenshot cannot: did the backend
  // actually reply, or did the client just fail to receive it? A missing reply
  // row means the server failed; a present one means it succeeded and the app
  // showed its fallback anyway, which is a completely different bug.
  if (process.argv.includes('--messages')) {
    const msgs = await prisma.message.findMany({
      where: { userId: user.id, channel: 'IN_APP' },
      orderBy: { createdAt: 'desc' },
      take: 12,
      select: { createdAt: true, direction: true, messageType: true, content: true },
    });
    console.log(`${'─'.repeat(60)}\nlast ${msgs.length} in-app message(s), newest first:\n`);
    for (const m of msgs) {
      const who = m.direction === 'INBOUND' ? 'THEM' : 'IVY ';
      console.log(`  ${when(m.createdAt)}  ${who}  [${m.messageType ?? '-'}]  ${m.content.replace(/\n/g, ' ').slice(0, 150)}`);
    }
  }

  console.log('');
}

main()
  .then(async () => { await prisma.$disconnect(); process.exit(0); })
  .catch(async (err) => { console.error('call-watch failed:', err); await prisma.$disconnect(); process.exit(1); });
