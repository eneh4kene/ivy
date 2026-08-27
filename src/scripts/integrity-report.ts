/**
 * Integrity report — the number you can quote a sponsor, and who to look at.
 *
 *   fly ssh console -a ivykeeps-api -C "node dist/scripts/integrity-report.js"
 *   ...optionally with a window: "node dist/scripts/integrity-report.js 90"
 *
 * Prints the defensible headline (accounted days, not "verified workouts") and
 * any members whose pattern is worth a human look. Signals are prompts to look,
 * never verdicts — real people do have clean months.
 */
import prisma from '../utils/prisma';
import integrityService from '../services/integrity.service';

async function main() {
  const windowDays = Number(process.argv[2] ?? 30) || 30;

  const total = await integrityService.getAccountedDaysTotal(windowDays);
  console.log(`\n=== ACCOUNTED DAYS — last ${windowDays} days ===`);
  console.log(`  ${total.accountedDays} days across ${total.members} member(s)`);
  console.log(`  Defensible phrasing: "${total.accountedDays} days a member spoke to a coach`);
  console.log(`  and accounted for their commitment" — each backed by a timestamped transcript.`);
  console.log(`  NOT "verified workouts": nothing here proves the activity happened.`);

  const users = await prisma.user.findMany({
    where: { isActive: true, isOnboarded: true },
    select: { id: true, firstName: true, email: true },
  });

  console.log(`\n=== PER MEMBER ===`);
  let flagged = 0;
  for (const u of users) {
    const r = await integrityService.getReport(u.id, windowDays);
    if (r.claimedKeptDays === 0 && r.accountedDays === 0) continue;
    const mark = r.signals.length ? '⚠' : ' ';
    console.log(
      `${mark} ${u.firstName.padEnd(12)} accounted=${String(r.accountedDays).padStart(3)}  ` +
      `claimed=${String(r.claimedKeptDays).padStart(3)}  ` +
      `medCall=${r.medianCallSeconds ?? '-'}s  obstacles=${r.obstaclesMentioned}`
    );
    for (const s of r.signals) {
      flagged++;
      console.log(`      [${s.weight}] ${s.code}: ${s.detail}`);
    }
  }
  if (!flagged) console.log('  (no integrity signals raised)');

  console.log(`\nSignals are prompts to look, not verdicts. Nothing acts on them automatically.\n`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error('integrity report failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
