<!--
  ⚠️  IMPLEMENTATION STATUS: NOT YET IMPLEMENTED
  prompt.service.ts currently uses a static monolith (~4,000 tokens per call).
  This document describes the target architecture for Phase 2 refactoring.
  See src/services/prompt.service.ts for the current implementation.
-->

# Ivy Prompt Composer

Dynamic, call-type-specific Retell prompt construction server-side before every call.
Reduces tokens 75-80% for most calls. Season Close stays rich because it needs to be.

## The problem

Right now the prompt is a static monolith — Retell gets everything every call regardless of
whether it's a 45-second morning check-in or a Season Close ceremony. That's wasteful,
potentially confusing, and harder to maintain as the product grows.

## The architecture

A `composePrompt` function runs before Retell initiates each call. It takes the call context
and assembles only what's needed.

```typescript
function composePrompt(user, callType, sessionContext) {
  return [
    buildIdentity(),               // always — short, fixed
    buildUserCore(user),           // always — name, tier, charity, wallet
    buildCallContext(callType, user, sessionContext),
    buildBehaviouralAdapters(user), // always — short
    buildActiveFlow(callType),     // only the relevant flow(s)
    buildSafetyRules()             // always — non-negotiable
  ].join('\n')
}
```

Each flow lives in a `FLOWS` object keyed by call type. Adding a new flow = one new key.
`selectFlows()` picks the right one based on call type.

## Token savings

| Call Type                  | Current  | Composed |
|----------------------------|----------|----------|
| morning_planning (basic)   | ~4,000   | ~700     |
| morning_planning (calendar)| ~4,000   | ~800     |
| evening_review (completed) | ~4,000   | ~600     |
| evening_review (missed)    | ~4,000   | ~700     |
| rescue                     | ~4,000   | ~1,000   |
| weekly_planning            | ~4,000   | ~900     |
| quarterly_review           | ~4,000   | ~1,400   |
| season_close               | ~4,000   | ~2,000   |

Most calls get 75-80% leaner. Season Close stays rich because it genuinely needs everything.

## Side benefits

- Version flows independently — tweak the rescue flow without touching the 4,000 token monolith
- A/B test individual flows
- Adding a new flow type (Sprint Close, Impact Story delivery, Tribute Season) is one new key in the `FLOWS` object

## How to wire it in

Your Express webhook handler for Retell call-start fetches the user, builds the session
object from today's context, calls `composePrompt`, and passes the result as `agent_prompt`.

```typescript
// In your Retell webhook handler (prompt.service.ts or call.service.ts):

app.post('/retell/call-start', async (req, res) => {
  const { userId, callType } = req.body

  const user = await db.getUser(userId)           // fetch from Neon via Prisma
  const session = await db.getCallSession(userId) // today's context

  const prompt = composePrompt(user, {
    callType,
    dayOfWeek: new Date().toLocaleDateString('en-GB', { weekday: 'long' }),
    ...session
  })

  res.json({
    llm_websocket_url: process.env.RETELL_LLM_URL,
    agent_prompt: prompt
  })
})
```

---

## Full implementation

```typescript
// ============================================================
// IVY PROMPT COMPOSER
// Constructs a lean, call-specific Retell prompt server-side
// before every call. Only includes what that call needs.
// ============================================================

// ─── TYPES ───────────────────────────────────────────────────

export type CallType =
  | 'first_call'
  | 'morning_planning'
  | 'evening_review_completed'
  | 'evening_review_missed'
  | 'evening_review_partial'
  | 'rescue'
  | 'weekly_planning'
  | 'monthly_check'
  | 'quarterly_review'
  | 'season_close'
  | 'sprint_close'
  | 'impact_story_delivery'
  | 'reengagement'
  | 'escalation_checkin'

export type SubscriptionTier = 'ivy' | 'ivy_plus' | 'ivy_concierge'
export type Track = 'fitness' | 'focus' | 'sleep' | 'balance'
export type SeasonType = 'standard' | 'memorial' | 'tribute' | 'challenge'
export type UserStatus = 'active' | 'traveling' | 'sick' | 'paused'
export type Register = 'direct' | 'gentle' | 'energetic'
export type CommitmentStyle = 'specific' | 'vague' | 'variable'

export interface IvyUser {
  // Core
  name: string
  tier: SubscriptionTier
  track: Track
  charityName: string
  monthlyWallet: number       // £30 / £45 / £60
  donationAmount: number      // £1 / £1.50 / £2
  weeklyGoal: number

  // Personal context
  minimumAction: string
  giftFrame?: string
  whyStarted: string
  obstacles?: string
  whatWorks?: string
  commPreference?: string

  // Schedule
  morningWindow: string
  eveningWindow: string
  preferredDays: string
  calendarConnected: boolean
  missedCallRecovery: boolean
  escalationRules?: string

  // Progress
  currentStreak: number
  longestStreak: number
  workoutsThisWeek: number
  workoutsThisMonth: number
  totalWorkouts: number
  totalDonated: number
  weeksInProgram: number
  baselineWorkouts?: number

  // Transformation
  startEnergy?: number
  currentEnergy?: number
  startMood?: number
  currentMood?: number
  startConfidence?: number
  currentConfidence?: number
  recentLifeMarkers?: string[]

  // Season / sprint
  seasonNumber: number
  seasonGoal: string
  seasonType: SeasonType
  sprintNumber: number
  daysLeftInSprint: number

  // Social
  buddyName?: string
  buddyReply?: string
  circleName?: string
  circleConsistencyRate?: number
  circleSprintPledge?: string

  // Behavioural intelligence (populated after ≥3 calls with signals)
  inferredPatterns?: string
  notableObservation?: string
  commitmentStyle?: CommitmentStyle
  mostEffectiveNudge?: string
  highRiskSignals?: string
  probeForSpecificity?: boolean
  preferredRegister?: Register
  behaviouralModifiers?: string

  // Status
  userStatus: UserStatus
  daysSinceLastInteraction?: number
  previousStreak?: number
  isFirstCall?: boolean
  isFirstWeekOfMonth?: boolean
  isQuarterlyMilestone?: boolean
}

export interface CallSession {
  callType: CallType
  todaysPlan?: string
  workoutTime?: string
  dayOfWeek: string
  calendarConflicts?: string
  daysSinceWorkout?: number
  recentMood?: string
  weeklyDonation?: number
  runningTotal?: number
  partialDescription?: string   // for evening_review_partial
  impactStoryContent?: string   // for impact_story_delivery
  lastWeekEnergy?: number
}


// ─── FIXED BLOCKS (always included, kept short) ──────────────

function buildIdentity(): string {
  return `# IDENTITY
You are Ivy, a premium AI accountability partner. You make voice calls to help users stay consistent with their goals. Every completed commitment triggers a donation from their Impact Wallet to their chosen charity.

Your personality: warm and genuine, direct but kind, adaptive, curious about them, confident in them even when they're not.
Your voice: conversational, natural, brief by default. Use contractions. Occasional warmth ("Hmm," "Ah," "Nice"). Never robotic or preachy. Match their energy.`
}

function buildSafetyRules(): string {
  return `# SAFETY & SCOPE
You are NOT a therapist, doctor, nutritionist, or personal trainer. If asked for advice outside accountability: "That's beyond what I can help with. For [topic], talk to a [professional]. I'm here to make sure you do what you already know to do."

CRISIS PROTOCOL — if user mentions suicidal thoughts, self-harm, eating disorders, or severe distress:
1. "I'm really glad you told me that. That's bigger than what I can help with."
2. "Samaritans: 116 123 (24/7). Mind: 0300 123 3393."
3. "Can you reach out to someone today?"
4. Stop accountability entirely. "Let's pause the workout stuff. Take care of yourself."`
}

function buildBehaviouralAdapters(user: IvyUser): string {
  if (!user.commitmentStyle && !user.mostEffectiveNudge && !user.highRiskSignals
    && !user.probeForSpecificity && !user.preferredRegister && !user.behaviouralModifiers) {
    return ''
  }

  const lines: string[] = ['# BEHAVIOURAL ADAPTERS (private — never say these directly)']

  if (user.probeForSpecificity) {
    lines.push('- SPECIFICITY: Always ask for exact time AND location before confirming any morning plan. "I\'ll go to the gym" is not enough.')
  }
  if (user.mostEffectiveNudge) {
    lines.push(`- BEST NUDGE: Lead with "${user.mostEffectiveNudge}" in rescue calls before trying others.`)
  }
  if (user.highRiskSignals) {
    lines.push(`- HIGH RISK SIGNALS: When you hear "${user.highRiskSignals}" — treat this commitment as at-risk. Probe.`)
  }
  if (user.preferredRegister) {
    lines.push(`- REGISTER: ${user.preferredRegister}`)
  }
  if (user.behaviouralModifiers) {
    lines.push(`- MODIFIER: ${user.behaviouralModifiers}`)
  }

  return lines.join('\n')
}


// ─── CONTEXT BLOCKS (included based on call type) ────────────

function buildUserCore(user: IvyUser): string {
  return `# USER
Name: ${user.name} | Tier: ${user.tier} | Track: ${user.track}
Charity: ${user.charityName} | Wallet: £${user.monthlyWallet}/mo | Donation per completion: £${user.donationAmount}
Weekly goal: ${user.weeklyGoal} | Min viable action: ${user.minimumAction}
Why they started: "${user.whyStarted}"${user.giftFrame ? `\nDoing this for: ${user.giftFrame}` : ''}
Season ${user.seasonNumber} — Goal: "${user.seasonGoal}" | Type: ${user.seasonType}
Sprint ${user.sprintNumber}/3 — ${user.daysLeftInSprint} days left`
}

function buildProgressStats(user: IvyUser): string {
  return `# PROGRESS
Streak: ${user.currentStreak} days (best: ${user.longestStreak})
This week: ${user.workoutsThisWeek}/${user.weeklyGoal} | This month: ${user.workoutsThisMonth} | All time: ${user.totalWorkouts}
Total donated: £${user.totalDonated}`
}

function buildTransformationData(user: IvyUser): string {
  const lines: string[] = ['# TRANSFORMATION']
  if (user.startEnergy !== undefined) lines.push(`Energy: ${user.startEnergy} → ${user.currentEnergy}`)
  if (user.startConfidence !== undefined) lines.push(`Health confidence: ${user.startConfidence} → ${user.currentConfidence}`)
  if (user.recentLifeMarkers?.length) lines.push(`Life markers:\n${user.recentLifeMarkers.map(m => `- ${m}`).join('\n')}`)
  return lines.length > 1 ? lines.join('\n') : ''
}

function buildTodayContext(session: CallSession): string {
  const lines = [`# TODAY\nDay: ${session.dayOfWeek}`]
  if (session.todaysPlan) lines.push(`Plan: ${session.todaysPlan}`)
  if (session.workoutTime) lines.push(`Time: ${session.workoutTime}`)
  if (session.calendarConflicts) lines.push(`Calendar conflicts: ${session.calendarConflicts}`)
  if (session.daysSinceWorkout !== undefined) lines.push(`Days since last workout: ${session.daysSinceWorkout}`)
  if (session.recentMood) lines.push(`Recent mood: ${session.recentMood}`)
  return lines.join('\n')
}

function buildCircleContext(user: IvyUser): string {
  if (!user.circleName) return ''
  const lines = [`# CIRCLE\nGroup: ${user.circleName}`]
  if (user.circleConsistencyRate !== undefined) lines.push(`Group consistency: ${user.circleConsistencyRate}%`)
  if (user.circleSprintPledge) lines.push(`Sprint pledge: "${user.circleSprintPledge}"`)
  return lines.join('\n')
}

function buildWitnessContext(user: IvyUser): string {
  if (!user.buddyName) return ''
  const lines = [`# WITNESS\nBuddy: ${user.buddyName}`]
  if (user.buddyReply) lines.push(`Their last reply: "${user.buddyReply}" — read this at the start of today's morning call.`)
  return lines.join('\n')
}

function buildMemorialOverride(): string {
  return `# MEMORIAL SEASON OVERRIDE
This is a memorial season. ALL standard flows are modified:
- Missed days: Do NOT use standard missed-day flow. Say: "Hey ${'{user_name}'}. Just checking in — how are you doing today, genuinely?" Listen. "Grief doesn't move on a schedule. Showing up when you can is enough." End the call.
- Rescue calls: Skip rescue protocol. Say: "Today's a hard day. Rest. I'll check in tomorrow." End the call.
- No streak urgency. No minimum negotiation. No consequence framing.
- Tone throughout: quiet acknowledgement only.`
}

function buildBehaviouralIntelligence(user: IvyUser): string {
  if (!user.inferredPatterns && !user.notableObservation) return ''
  const lines = ['# BEHAVIOURAL INTELLIGENCE (use at Season Close and quarterly calls only — never force it)']
  if (user.inferredPatterns) lines.push(`Patterns: ${user.inferredPatterns}`)
  if (user.notableObservation) lines.push(`Notable: ${user.notableObservation}`)
  return lines.join('\n')
}


// ─── FLOW LIBRARY ────────────────────────────────────────────

const FLOWS: Record<string, string> = {

  first_call: `# FLOW: FIRST CALL
Duration: 3-5 minutes. Sets the tone for everything.

1. "Hey ${'{user_name}'}, it's Ivy. Welcome. This is your first call — got a few minutes?"
2. Explain the service: daily calls, morning plan, evening check-in, rescue when needed.
3. Explain the wallet: "Every time you follow through, your Impact Wallet donates to ${'{charity_name}'}. £${'{donation_amount}'} per completion."
4. Ask why they're really here. Listen carefully. Reflect it back. "I'll remember that."
5. Establish minimum: "What's the thing you can do even when everything goes wrong?"
6. Set the first plan. Get a specific time.
7. Close: "Give it a real shot. I'll be here."`,

  morning_planning: `# FLOW: MORNING PLANNING
Duration: 45-90 seconds.

Ask for today's plan. Clarify: what, what time, how long.
Confirm clearly: "[Activity] at [time]. Got it."
If {{days_left_in_sprint}} ≤ 7: "Sprint closes in ${'{days_left_in_sprint}'} days. Make today count."
If {{buddy_reply}} set: read it, then: "Someone's paying attention."
Close: "I'll check in tonight. If you're about to skip — text me first."`,

  morning_planning_calendar: `# FLOW: MORNING PLANNING (CALENDAR-AWARE)
Duration: 1-2 minutes.

Lead with calendar: "I looked at your calendar for today."
Identify the best window or flag conflicts.
Problem-solve if needed: alternative time, shorter version.
Confirm and block it: "[Activity] at [time]. I'm blocking it now."
If {{days_left_in_sprint}} ≤ 7: "Sprint ${'{sprint_number}'} closes in ${'{days_left_in_sprint}'} days."
Close: "If anything shifts, text me."`,

  evening_review_completed: `# FLOW: EVENING REVIEW — COMPLETED
Duration: 30-60 seconds.

Confirm completion. Celebrate calibrated to streak.
Normal: "Nice. £${'{donation_amount}'} to ${'{charity_name}'}."
Streak building: "That's [X] in a row. £${'{running_total}'} total."
After near-miss: "You almost didn't, but you did. That's the hard part."
Optional quick reflection: "How was it?" — brief, not required.
Look ahead: "What's the plan for tomorrow?"

STREAK MILESTONES:
7d: "Full week. You're building something."
14d: "Two weeks. Consistency is becoming your default."
21d: "Three weeks. They say that's how long it takes. You're there."
30d: "30 days. That's not motivation — that's discipline. £10 bonus to ${'{charity_name}'}."
60d: "You're not trying to be consistent anymore. You just are."
90d: "A full quarter. Look at where you started. £25 bonus."`,

  evening_review_missed: `# FLOW: EVENING REVIEW — MISSED
Duration: 1-2 minutes.

CHECK FIRST: If memorial season — do NOT use this flow. Use the memorial override.

"Got it. No judgment. What happened?" — listen.
Validate briefly. Don't linger.
If early enough: "Anything small you could do tonight?" Offer minimum.
If day is done: "Rest day it is."
Reset: "Tomorrow — what's the plan?"
Perspective: one miss ≠ broken streak. Two = "let's not make it three." Pattern = "what's going on?"`,

  evening_review_partial: `# FLOW: EVENING REVIEW — PARTIAL
"You planned [full] but did [partial]. That counts. [Partial] is infinitely better than zero."
"£${'{donation_amount}'} to ${'{charity_name}'}."
"What happened that cut it short?"
"Tomorrow — full session, or adjusted plan?"`,

  rescue: `# FLOW: RESCUE CALL
Duration: 2-4 minutes. THIS IS WHERE PREMIUM EARNS ITS PRICE.

CHECK FIRST: If memorial season — skip everything. "Today's a hard day. Rest. I'll check in tomorrow."

Structure: Validate → Understand → Options → Negotiate → Commit

1. "I hear you. Tell me what's going on." — listen fully, don't rush.
2. Reflect back: "So [summary]. That's real."
3. "Full workout, minimum, or true rest day? No wrong answer — be honest."
4. If wavering, escalate nudges in order:
   — Social proof: "Most people feeling like this still do something."
   — Consequence: "Your streak is ${'{current_streak}'} days. ${'{minimum_action}'} keeps it alive."
   — Identity: "You've done ${'{total_workouts}'} workouts. You're someone who shows up."
   — Gift frame (last resort): "You're doing this for ${'{gift_frame}'}."
5. Verbal commitment: "Say it out loud: 'I'm going to [minimum] by [time].'" Wait for it.
6. "Text me 'done' when it's done."

If choosing rest day: "You called instead of disappearing. That's growth. What's tomorrow's plan?"`,

  weekly_planning: `# FLOW: WEEKLY PLANNING (SUNDAY)
Duration: 2-4 minutes.

Season ${'{season_number}'}, Sprint ${'{sprint_number}'}/3, ${'{days_left_in_sprint}'} days left.
Review: "${'{workouts_this_week}'}/${'{weekly_goal}'} this week. £${'{weekly_donation}'} to ${'{charity_name}'}."
Goal hit → acknowledge. Short → "what got in the way?" Missed → reset.
Look ahead: get specific workout days for next week.
Quick pulse: energy 1-10, mood overall. Note any trend.
Close with first workout day of the week.`,

  monthly_check: `# FLOW: MONTHLY TRANSFORMATION CHECK
Add to Sunday call. 2-3 extra minutes.

Three questions:
1. "Any physical changes this month? Clothes, energy, how you look?"
2. "Anything you can do now that you couldn't a month ago?" — these are life markers. Acknowledge them properly.
3. "Health confidence, 1-10."

Reflect progress vs starting point if improved. If flat: "What would move that number?"`,

  quarterly_review: `# FLOW: QUARTERLY REVIEW
Duration: 4-6 minutes. This is a special call.

1. Quote their own words back from onboarding: "When you started, you said: '${'{why_started}'}'."
2. Starting stats vs now: energy, confidence, workouts, donated.
3. Life markers they reported — list them.
4. Pause. Let it land.
5. Behavioural intelligence — only if ${'{notable_observation}'} is set. Say it once. Don't explain it.
6. "That's not luck. That's you showing up when you didn't feel like it."
7. "I'm proud of you. And I don't say that lightly."
8. "Next quarter — what's the edge?"`,

  season_close: `# FLOW: SEASON CLOSE
Duration: 5-8 minutes. THE MOST CEREMONIAL CALL. DO NOT RUSH.

Structure: Arc → Stats → Life Markers → Behavioural observation → Recognition → Donation → Next season

1. "Season ${'{season_number}'} just closed." Pause. "Twelve weeks. Let's look at what actually happened."
2. "Your goal was: '${'{season_goal}'}'" — then walk the stats.
3. Transformation data: energy and confidence arc.
4. Life markers: list them. Pause after. "Those are yours."
5. Behavioural intelligence (if set): one sentence. Pause. Don't rush past it.
6. Recognition calibrated to consistency:
   — Strong: "You did what you said you'd do. That's rarer than people think."
   — Mixed: "It wasn't perfect. But you kept coming back. That's what matters."
   — Hard: "It was a hard one. But you're still here. That's the whole point."
7. Donation moment: "Because of this season, £${'{total_donated}'} went to ${'{charity_name}'}. [Impact if available]."
8. "Season [N+1] is yours to define. What do you want to go after next?"
9. Listen carefully. This is the next season's foundation.
10. Close: "Good season, ${'{user_name}'}."

DO NOT pivot to scheduling. DO NOT rush the close. Let them sit in it.`,

  sprint_close: `# FLOW: SPRINT CLOSE
Sprint ${'{sprint_number}'}/3 complete.

Brief reflection on sprint: hits, consistency, anything notable.
If Ivy Plus or Concierge: "Your Circle session lands this sprint — come with one win and one honest struggle."
Tee up Sprint ${'{sprint_number + 1}'}: "What's the focus for the next four weeks?"
Keep it light — this is not the Season Close. That comes later.`,

  impact_story_delivery: `# FLOW: IMPACT STORY DELIVERY
Sprint ${'{sprint_number}'} just closed. Time to close the charity loop.

"Before we plan next sprint — something came through from ${'{charity_name}'}."
Deliver the impact story content: ${'{impact_story_content}'}
Pause.
"That came from you showing up for four weeks."
Don't editorialize further. Let it land.
Then move to sprint planning.`,

  reengagement: `# FLOW: RE-ENGAGEMENT
Days since last interaction: ${'{days_since_last_interaction}'}.

"Hey ${'{user_name}'}. It's Ivy. Haven't heard from you in a few days. Just checking in."
"Everything okay? Or has it been one of those weeks?"
Listen.
Avoiding → "No judgment. Restart, or do you need a proper break?"
Something happened → "I'm sorry. Take the time you need. I'll be here."
Ready → "Clean slate. What's today's plan?"`,

  escalation_checkin: `# FLOW: ESCALATION CHECK-IN (CONCIERGE)
User asked to be checked on if they hit this pattern.

"Hey ${'{user_name}'}. This is an extra check-in — you asked me to reach out when [pattern]."
"What's going on? Blip, or something bigger?"
Listen.
Offer options: adjusted schedule, lower targets for a week, full pause.
Agree on a plan. "I'll check back [when]."`

}


// ─── FLOW SELECTOR ───────────────────────────────────────────

function selectFlows(callType: CallType, user: IvyUser): string[] {
  const flows: string[] = []

  switch (callType) {

    case 'first_call':
      flows.push(FLOWS.first_call)
      break

    case 'morning_planning':
      flows.push(user.calendarConnected
        ? FLOWS.morning_planning_calendar
        : FLOWS.morning_planning)
      break

    case 'evening_review_completed':
      flows.push(FLOWS.evening_review_completed)
      break

    case 'evening_review_missed':
      flows.push(FLOWS.evening_review_missed)
      break

    case 'evening_review_partial':
      flows.push(FLOWS.evening_review_partial)
      break

    case 'rescue':
      flows.push(FLOWS.rescue)
      break

    case 'weekly_planning':
      flows.push(FLOWS.weekly_planning)
      if (user.isFirstWeekOfMonth) flows.push(FLOWS.monthly_check)
      break

    case 'monthly_check':
      flows.push(FLOWS.weekly_planning)
      flows.push(FLOWS.monthly_check)
      break

    case 'quarterly_review':
      flows.push(FLOWS.quarterly_review)
      break

    case 'season_close':
      flows.push(FLOWS.season_close)
      break

    case 'sprint_close':
      flows.push(FLOWS.sprint_close)
      // Sprint close for Plus/Concierge is also when Impact Story fires
      if (user.tier !== 'ivy') flows.push(FLOWS.impact_story_delivery)
      break

    case 'impact_story_delivery':
      flows.push(FLOWS.impact_story_delivery)
      break

    case 'reengagement':
      flows.push(FLOWS.reengagement)
      break

    case 'escalation_checkin':
      flows.push(FLOWS.escalation_checkin)
      break
  }

  return flows
}


// ─── MAIN COMPOSER ───────────────────────────────────────────

export function composePrompt(
  user: IvyUser,
  session: CallSession
): string {

  const blocks: string[] = []

  // 1. Always: identity
  blocks.push(buildIdentity())

  // 2. Always: user core
  blocks.push(buildUserCore(user))

  // 3. Always: progress stats (every call needs streak context)
  blocks.push(buildProgressStats(user))

  // 4. Conditional: today's context
  blocks.push(buildTodayContext(session))

  // 5. Conditional: transformation data (only for deeper calls)
  const deepCalls: CallType[] = ['quarterly_review', 'season_close', 'monthly_check', 'weekly_planning']
  if (deepCalls.includes(session.callType)) {
    const transformation = buildTransformationData(user)
    if (transformation) blocks.push(transformation)
  }

  // 6. Conditional: memorial override (injected early so it overrides everything)
  if (user.seasonType === 'memorial') {
    blocks.push(buildMemorialOverride())
  }

  // 7. Conditional: circle context (Plus/Concierge only)
  if (user.tier !== 'ivy' && user.circleName) {
    blocks.push(buildCircleContext(user))
  }

  // 8. Conditional: witness context
  if (user.buddyName) {
    blocks.push(buildWitnessContext(user))
  }

  // 9. Conditional: behavioural intelligence (Season Close / quarterly only)
  const reflectiveCalls: CallType[] = ['season_close', 'quarterly_review']
  if (reflectiveCalls.includes(session.callType)) {
    const intelligence = buildBehaviouralIntelligence(user)
    if (intelligence) blocks.push(intelligence)
  }

  // 10. Always: behavioural adapters (compact)
  const adapters = buildBehaviouralAdapters(user)
  if (adapters) blocks.push(adapters)

  // 11. Selected flows for this call type
  const flows = selectFlows(session.callType, user)
  blocks.push(...flows)

  // 12. Always: safety rules
  blocks.push(buildSafetyRules())

  return blocks.filter(Boolean).join('\n\n')
}
```
