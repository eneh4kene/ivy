export interface TrackConfig {
  verification: 'self_report' | 'recall_probe' | 'reflection' | 'numbers_audit';
  unit: string;
  commitment_format: string;
  evening_probe: string;
  avoidance_signals: string[];
  avoid: string[];
  lean_into: string[];
}

export const TRACK_CONFIG: Record<string, TrackConfig> = {
  fitness: {
    verification: 'self_report',
    unit: 'session',
    commitment_format: 'what + when + where',
    evening_probe: 'How did it feel physically? Where did it get hard?',
    avoidance_signals: [
      'retroactive "rest day" reframe after the fact',
      'flat yes with no effort or physical detail',
      'talking about the next session instead of reporting the last',
    ],
    avoid: ['over-intellectualising', 'long reflection'],
    lean_into: ['physical specifics', 'the streak', 'effort level', 'what the body felt like'],
  },

  focus: {
    verification: 'recall_probe',
    unit: 'block',
    commitment_format: 'activity + time window + specific output target (e.g. "2hr block, finish the proposal draft")',
    evening_probe: 'What did you actually produce in that block? What would you show someone?',
    avoidance_signals: [
      'activity language without output ("I was working on it", "I spent time on it")',
      'pivoting to planning the next block instead of reporting the last',
      'meta-commentary about focus instead of reporting actual work done',
    ],
    avoid: ['treating time-in-seat as success', 'emotional processing of why it was hard'],
    lean_into: ['the output', 'what got done or decided', 'what is now different because of that block'],
  },

  sleep: {
    verification: 'reflection',
    unit: 'night',
    commitment_format: 'target bedtime + one wind-down action (e.g. "in bed by 10:30, no phone from 10")',
    evening_probe: 'What time did you actually get into bed vs. what we planned? How did you feel waking up?',
    avoidance_signals: [
      'estimate vs. actual bedtime gap ("around 11" meaning midnight)',
      'screen time denial',
      'conflating tired with sleepy',
    ],
    avoid: ['performance pressure about sleep — it backfires', 'hard numerical targets for hours'],
    lean_into: ['how they felt waking up', 'what made tonight easier or harder', 'pattern across the week'],
  },

  balance: {
    verification: 'reflection',
    unit: 'practice',
    commitment_format: 'specific practice + time + what aspect of balance it targets',
    evening_probe: 'How did you actually feel by end of day? What shifted vs. yesterday?',
    avoidance_signals: [
      'vague "I tried to be more balanced" without a specific action',
      'talking about awareness of imbalance instead of reporting action taken',
    ],
    avoid: ['over-scheduling', 'treating balance as a checklist'],
    lean_into: ['felt sense', 'specific moments of ease or tension', 'what they noticed about themselves'],
  },
};

export function getTrackConfig(track?: string): TrackConfig {
  return TRACK_CONFIG[track ?? 'fitness'] ?? TRACK_CONFIG.fitness;
}
