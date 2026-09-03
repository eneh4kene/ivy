/**
 * Retell agent-level turn-taking config — the settings that no prompt can override.
 *
 *   npx tsx src/scripts/retell-agent-config.ts          # show current values
 *   npx tsx src/scripts/retell-agent-config.ts --apply  # write the values below
 *
 * This file exists because agent config is INVISIBLE FROM THE CODEBASE and has
 * twice silently beaten the prompt:
 *   - voicemail_option, set in the dashboard, overrode what she said to a machine.
 *   - reminder_trigger_ms (below) overrode the pacing rule on her very first
 *     call after it shipped.
 *
 * Anything set here must be reproducible and reviewable, so it lives in the
 * repo. The dashboard is not the source of truth; this is.
 */
import logger from '../utils/logger';

const API = 'https://api.retellai.com';

/**
 * Observed on the 2 Sep evening call (call_d2e91988385652999d8c59179a3):
 *
 *   39.91s  agent  "That's a 'probably.' What would it take to make that a yes?"
 *   50.68s  agent  "Just checking in—are you still with me?"      <- auto-reminder
 *   55.43s  user   "Yes."
 *
 * She asked a genuinely hard question, waited 10.8 seconds, and talked over the
 * answer forming. Her own prompt says "Silence after a question is them
 * thinking, not them gone. Let it breathe" — and the platform fired anyway,
 * because Retell's default reminder is 10s and the model never sees it.
 *
 * The ladder now is: ask -> 18s to think -> ONE nudge -> 17s more -> hang up.
 */
const TURN_TAKING = {
  reminder_trigger_ms: 18000,
  reminder_max_count: 1,
  // Must stay comfortably above reminder_trigger_ms or the nudge and the
  // hang-up race each other and she drops the call mid-thought.
  end_call_after_silence_ms: 35000,
};

const READ_ONLY_FYI = [
  'interruption_sensitivity',
  'responsiveness',
  'enable_backchannel',
  'voice_speed',
] as const;

async function main() {
  const apiKey = process.env.RETELL_API_KEY;
  const agents = [
    ['B2C', process.env.RETELL_AGENT_ID_B2C],
    ['B2B', process.env.RETELL_AGENT_ID_B2B],
  ].filter(([, id]) => !!id) as Array<[string, string]>;

  if (!apiKey || !agents.length) {
    logger.error('RETELL_API_KEY or agent ids missing');
    process.exit(1);
  }

  const apply = process.argv.includes('--apply');

  for (const [label, agentId] of agents) {
    const res = await fetch(`${API}/get-agent/${agentId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (!res.ok) {
      logger.error(`${label}: get-agent failed ${res.status}`);
      continue;
    }
    const agent = (await res.json()) as Record<string, unknown>;
    console.log(`\n=== ${label} · ${agent.agent_name} (${agentId}) ===`);
    for (const [k, want] of Object.entries(TURN_TAKING)) {
      const have = agent[k] ?? '(unset → Retell default)';
      const mark = have === want ? ' ' : '≠';
      console.log(`  ${mark} ${k}: ${have}${have === want ? '' : `  → ${want}`}`);
    }
    for (const k of READ_ONLY_FYI) {
      console.log(`    ${k}: ${agent[k] ?? '(unset → Retell default)'}   [not managed here]`);
    }

    if (!apply) continue;

    const patch = await fetch(`${API}/update-agent/${agentId}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(TURN_TAKING),
    });
    if (!patch.ok) {
      logger.error(`${label}: update-agent failed ${patch.status} ${await patch.text()}`);
      continue;
    }
    console.log(`  ✓ applied`);
  }

  if (!apply) console.log('\n(dry run — pass --apply to write)\n');
}

main().catch((err) => {
  logger.error('retell-agent-config failed', err);
  process.exit(1);
});
