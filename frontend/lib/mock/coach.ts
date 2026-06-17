/**
 * Mock data for coach surfaces — marketplace (consumer) and coach dashboard (coach side).
 *
 * All shapes mirror the backend API contracts implied by src/services/coach.service.ts
 * and the CoachProfile / CoachClient types in src/types/.
 *
 * TODO(api): Replace every MOCK_* export with real API calls once endpoints are wired.
 */

// ─── Shared enums ─────────────────────────────────────────────────────────────

export type Specialty =
  | 'strength'
  | 'fat-loss'
  | 'endurance'
  | 'mindset'
  | 'nutrition'
  | 'business'
  | 'career'
  | 'wellbeing'
  | 'sleep'

export type CoachStatus = 'active' | 'pending' | 'inactive'

// ─── Consumer-facing coach types ──────────────────────────────────────────────

/** Full coach profile as seen by a consumer browsing the marketplace. */
export interface MarketplaceCoach {
  id: string
  firstName: string
  lastName: string
  /** Coach-set display name; may differ from real name */
  displayName: string
  photoUrl: string           // MOCK: unsplash placeholder
  tagline: string            // 1-line hook
  bio: string
  specialties: Specialty[]
  /** Coach-set hourly rate. Ivy takes 0% — §5f of product-pricing-rework.md */
  hourlyRate: number
  currency: 'GBP' | 'USD'
  /** 0–5 */
  rating: number
  reviewCount: number
  /** Active client count (shown to inspire trust) */
  activeClients: number
  /** Years of coaching */
  yearsCoaching: number
  /** Accreditations, e.g. "UKSCA Accredited", "NASM-CPT" */
  credentials: string[]
  /** Ivy-vetted = passed basic screening */
  ivyVetted: boolean
  /** Whether coach has any availability right now */
  available: boolean
  /** Typical response time in hours */
  responseHours: number
  /** A few headline testimonials */
  testimonials: { quote: string; author: string; result: string }[]
  /** Programme areas they typically work on */
  programmes: string[]
  /** Billing note: always "direct" at launch per §5f */
  billingNote: string
}

/** A review left on a coach profile */
export interface CoachReview {
  id: string
  clientName: string
  rating: number
  comment: string
  date: string
  result?: string
}

// ─── Coach-side types (dashboard) ─────────────────────────────────────────────

/** A coach's view of one of their clients — mirrors src/types/coach.types.ts CoachClient */
export interface MockCoachClient {
  id: string
  firstName: string
  lastName: string
  avatarHue: number           // deterministic colour from name hash
  track: string
  goal: string
  /** Today's arm status */
  armedToday: boolean
  /** Streak in days */
  currentStreak: number
  recentMissedCount: number
  needsAttention: boolean
  isActive: boolean
  isOnboarded: boolean
  subscriptionStatus: 'active' | 'past_due' | 'cancelled' | 'paused'
  telegramChatId: string | null
  /** ISO date of last activity */
  lastActiveAt: string | null
  calls: MockCall[]
  callMemories: MockMemory[]
  coachNotes: string
  programmeAreas: MockProgrammeArea[]
}

export interface MockCall {
  id: string
  callType: 'MORNING_PLANNING' | 'EVENING_REVIEW' | 'RESCUE' | 'WEEKLY_PLANNING' | 'SEASON_CLOSE' | 'MONTHLY_CHECKIN' | 'ONBOARDING'
  status: 'COMPLETED' | 'NO_ANSWER' | 'IN_PROGRESS' | 'SCHEDULED'
  sentiment: 'positive' | 'neutral' | 'negative' | null
  scheduledAt: string
  durationSec?: number
  callSummary?: string
  callInsights?: {
    key_insight?: string
    follow_up?: string
    red_flag?: string
  }
}

export interface MockMemory {
  id: string
  content: string
  createdAt: string
}

export interface MockProgrammeArea {
  id: string
  area: string
  instruction: string
}

/** The coach's own profile as surfaced on their dashboard */
export interface MockCoachProfile {
  id: string
  firstName: string
  lastName: string
  programmeName: string
  coachingStyle: string
  programmeNotes: string
  whitelabelEnabled: boolean
  brandName: string
  activeClientCount: number
  inviteUrl: string
}

// ─── MOCK: Marketplace coaches ────────────────────────────────────────────────
// TODO(api): GET /api/coach/marketplace

export const MOCK_MARKETPLACE_COACHES: MarketplaceCoach[] = [
  {
    id: 'coach-001',
    firstName: 'Priya',
    lastName: 'Sharma',
    displayName: 'Priya Sharma',
    photoUrl: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=400&fit=crop&crop=faces',
    tagline: 'Turn discipline into identity',
    bio: "I've spent 8 years helping high-performers build sustainable habits when willpower isn't enough. My approach is direct, evidence-based, and radically honest — I won't celebrate mediocre effort, and clients say that's exactly why it works.",
    specialties: ['strength', 'mindset', 'fat-loss'],
    hourlyRate: 95,
    currency: 'GBP',
    rating: 4.9,
    reviewCount: 47,
    activeClients: 14,
    yearsCoaching: 8,
    credentials: ['UKSCA Accredited', 'Precision Nutrition L2'],
    ivyVetted: true,
    available: true,
    responseHours: 4,
    billingNote: 'Priya bills you directly. Ivy takes 0% — you pay exactly what she charges.',
    testimonials: [
      { quote: "Priya caught things in week 2 that I'd been avoiding for years.", author: 'Marcus T.', result: '-18kg in 6 months' },
      { quote: 'She doesn\'t let you hide behind excuses. That\'s the whole point.', author: 'Lena K.', result: 'Sub-3hr marathon' },
    ],
    programmes: ['12-Week Strength Foundation', 'Fat Loss Accelerator', 'Athletic Mindset'],
  },
  {
    id: 'coach-002',
    firstName: 'James',
    lastName: 'Okafor',
    displayName: 'James Okafor',
    photoUrl: 'https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?w=400&h=400&fit=crop&crop=faces',
    tagline: 'Run further. Live better.',
    bio: 'Former GB age-group triathlete, now helping busy professionals find their athletic edge without sacrificing everything else. Specialise in endurance, sleep quality, and the science of recovery that most coaches ignore.',
    specialties: ['endurance', 'sleep', 'wellbeing'],
    hourlyRate: 80,
    currency: 'GBP',
    rating: 4.8,
    reviewCount: 31,
    activeClients: 9,
    yearsCoaching: 5,
    credentials: ['IRONMAN Certified Coach', 'Sleep Science Certificate'],
    ivyVetted: true,
    available: true,
    responseHours: 8,
    billingNote: 'James bills you directly. Ivy takes 0% — you pay exactly what he charges.',
    testimonials: [
      { quote: 'James redesigned my sleep first. Everything else followed.', author: 'Ravi M.', result: 'First Ironman finish' },
    ],
    programmes: ['Marathon Build', 'Triathlon Foundations', 'Recovery & Sleep Reset'],
  },
  {
    id: 'coach-003',
    firstName: 'Sophie',
    lastName: 'Laurent',
    displayName: 'Sophie Laurent',
    photoUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop&crop=faces',
    tagline: 'Business performance starts with your body',
    bio: 'I coach entrepreneurs and executives who know their body is their most critical business asset. Hybrid nutrition + mindset coaching, built around real constraints: travel, stress, non-negotiable demands.',
    specialties: ['nutrition', 'mindset', 'business'],
    hourlyRate: 120,
    currency: 'GBP',
    rating: 5.0,
    reviewCount: 22,
    activeClients: 8,
    yearsCoaching: 6,
    credentials: ['ANutr', 'AACSM Health Coach'],
    ivyVetted: true,
    available: false,
    responseHours: 24,
    billingNote: 'Sophie bills you directly. Ivy takes 0% — you pay exactly what she charges.',
    testimonials: [
      { quote: 'Sophie gets that "just eat less" doesn\'t work when you\'re running a company.', author: 'Daniel C.', result: 'Lost 12kg, energy up' },
      { quote: 'She is the most prepared coach I\'ve ever worked with.', author: 'Aisha B.', result: 'Completed first half-marathon' },
    ],
    programmes: ['Executive Performance', '90-Day Nutrition Reset', 'Mindset for High Performers'],
  },
  {
    id: 'coach-004',
    firstName: 'Tom',
    lastName: 'Reynolds',
    displayName: 'Tom Reynolds',
    photoUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop&crop=faces',
    tagline: "Strength is a skill. I'll teach it.",
    bio: 'Powerlifting coach and movement specialist. I work with people who\'ve been "working out" for years but not actually getting stronger. Zero bullshit, maximal specificity.',
    specialties: ['strength'],
    hourlyRate: 70,
    currency: 'GBP',
    rating: 4.7,
    reviewCount: 58,
    activeClients: 18,
    yearsCoaching: 10,
    credentials: ['British Powerlifting Coach L3'],
    ivyVetted: true,
    available: true,
    responseHours: 12,
    billingNote: 'Tom bills you directly. Ivy takes 0% — you pay exactly what he charges.',
    testimonials: [
      { quote: 'He spotted my squat form issue in 30 seconds. Fixed in two weeks.', author: 'Nina P.', result: '40kg squat PB' },
    ],
    programmes: ['Powerlifting Foundation', 'Strength for Life', 'Movement Correction'],
  },
  {
    id: 'coach-005',
    firstName: 'Amara',
    lastName: 'Nwosu',
    displayName: 'Amara Nwosu',
    photoUrl: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&h=400&fit=crop&crop=faces',
    tagline: 'Career momentum you can feel',
    bio: 'Executive career coach and former tech lead. I help ambitious professionals cut through the noise and make the moves that actually matter — promotions, pivots, negotiation, visibility.',
    specialties: ['career', 'mindset'],
    hourlyRate: 150,
    currency: 'GBP',
    rating: 4.9,
    reviewCount: 19,
    activeClients: 6,
    yearsCoaching: 7,
    credentials: ['ICF PCC', 'Oxford Said Executive Ed.'],
    ivyVetted: true,
    available: true,
    responseHours: 6,
    billingNote: 'Amara bills you directly. Ivy takes 0% — you pay exactly what she charges.',
    testimonials: [
      { quote: 'I got promoted 6 months in. She told me it was coming before I could see it.', author: 'Michael O.', result: '£28k salary increase' },
    ],
    programmes: ['6-Month Career Accelerator', 'Senior Transition', 'Negotiation Intensive'],
  },
]

// MOCK: Reviews for coach-001
// TODO(api): GET /api/coach/marketplace/:id/reviews
export const MOCK_COACH_REVIEWS: Record<string, CoachReview[]> = {
  'coach-001': [
    { id: 'r1', clientName: 'Marcus T.', rating: 5, comment: "Priya caught things in week 2 that I'd been avoiding for years. She's direct without being cruel, which is a rare skill.", date: '2026-04-12', result: '-18kg in 6 months' },
    { id: 'r2', clientName: 'Lena K.', rating: 5, comment: "She doesn't let you hide behind excuses. Every call is demanding and every call is worth it.", date: '2026-03-28', result: 'Sub-3hr marathon' },
    { id: 'r3', clientName: 'Yusuf A.', rating: 5, comment: 'The mindset reframe she did on week 3 is the reason I\'m still going. Simple, true, permanent.', date: '2026-02-15', result: 'Consistent 4x/week for 4 months' },
    { id: 'r4', clientName: 'Chloe W.', rating: 4, comment: 'Very intense. If you want someone to be nice, look elsewhere. If you want results, come here.', date: '2026-01-30' },
  ],
}

// ─── MOCK: Coach dashboard data ───────────────────────────────────────────────
// TODO(api): GET /api/coach/profile + GET /api/coach/clients

export const MOCK_COACH_PROFILE: MockCoachProfile = {
  id: 'coach-self-001',
  firstName: 'Marcus',
  lastName: 'Obi',
  programmeName: 'Athlete Foundation 12-Week',
  coachingStyle: 'direct and data-driven',
  programmeNotes: 'All clients are working on building habits around structured training. Celebrate consistency over performance.',
  whitelabelEnabled: false,
  brandName: '',
  activeClientCount: 7,
  inviteUrl: 'https://app.ivy.so/invite/coach/abc123xyz',
}

export const MOCK_COACH_CLIENTS: MockCoachClient[] = [
  {
    id: 'client-001',
    firstName: 'Emma',
    lastName: 'Clarke',
    avatarHue: 198,
    track: 'strength',
    goal: 'Deadlift 100kg by August',
    armedToday: true,
    currentStreak: 14,
    recentMissedCount: 0,
    needsAttention: false,
    isActive: true,
    isOnboarded: true,
    subscriptionStatus: 'active',
    telegramChatId: 'tg-emma',
    lastActiveAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    coachNotes: "Emma has a knee injury — never suggest running. Responds well to data framing ('you were 80% consistent last month'). Working toward her first 100kg deadlift in August.",
    programmeAreas: [
      { id: 'pa-1', area: 'Nutrition', instruction: 'Client is in a caloric surplus — 3,000 kcal, 180g protein. Ask about adherence weekly.' },
      { id: 'pa-2', area: 'Sleep', instruction: 'Emma reports 5–6 hours sleep. Gently probe — this is limiting recovery.' },
    ],
    callMemories: [
      { id: 'm1', content: 'Knee injury (right patella) — avoid impact loading. Cleared for leg press and deadlift.', createdAt: '2026-05-01' },
      { id: 'm2', content: 'Responds better to data ("you hit 78% this month") than praise ("you\'re doing great").', createdAt: '2026-05-12' },
      { id: 'm3', content: 'Half-marathon in October is a personal stretch goal — not the main programme focus.', createdAt: '2026-05-20' },
    ],
    calls: [
      { id: 'c1', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'positive', scheduledAt: new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString(), durationSec: 420, callSummary: 'Strong session — hit all three lifts, nutrition on track. Said she feels like a different person to 3 months ago.', callInsights: { key_insight: 'Emma connects effort to identity now, not just outcomes — this is the sticking point most clients never reach.', follow_up: 'Ask about sleep next session — it\'s the ceiling on her progress.' } },
      { id: 'c2', callType: 'MORNING_PLANNING', status: 'COMPLETED', sentiment: 'positive', scheduledAt: new Date(Date.now() - 42 * 60 * 60 * 1000).toISOString(), durationSec: 180, callSummary: 'Committed to deadlift session and prepping meals in the evening.' },
      { id: 'c3', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'neutral', scheduledAt: new Date(Date.now() - 66 * 60 * 60 * 1000).toISOString(), durationSec: 360, callSummary: 'Session done but nutrition slipped — had a work lunch. No self-criticism, adjusted plan for rest of week.' },
      { id: 'c4', callType: 'EVENING_REVIEW', status: 'NO_ANSWER', sentiment: null, scheduledAt: new Date(Date.now() - 90 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'client-002',
    firstName: 'Ravi',
    lastName: 'Mehta',
    avatarHue: 32,
    track: 'endurance',
    goal: 'First Ironman 70.3, September',
    armedToday: true,
    currentStreak: 6,
    recentMissedCount: 1,
    needsAttention: false,
    isActive: true,
    isOnboarded: true,
    subscriptionStatus: 'active',
    telegramChatId: null,
    lastActiveAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    coachNotes: 'Ravi is juggling a demanding job — morning sessions only realistic before 7am. Very analytical, likes to know the why.',
    programmeAreas: [
      { id: 'pa-3', area: 'Training volume', instruction: 'Building aerobic base — no intensity spikes. Check he\'s in Zone 2 for long runs.' },
    ],
    callMemories: [
      { id: 'm4', content: 'Works in finance — very time-constrained. Training window is 05:30–06:45 weekdays only.', createdAt: '2026-05-10' },
      { id: 'm5', content: 'Responds well to data-heavy feedback. Dislikes vague encouragement.', createdAt: '2026-05-18' },
    ],
    calls: [
      { id: 'c5', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'positive', scheduledAt: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString(), durationSec: 390, callSummary: 'Nailed his brick session — 2hr bike + 30min run. Reported fatigue in the last 10 mins of the run, which is on track for this training block.', callInsights: { key_insight: 'Ravi is ahead of schedule for aerobic adaptation. Risk is overreaching — reinforce recovery week importance.' } },
      { id: 'c6', callType: 'EVENING_REVIEW', status: 'NO_ANSWER', sentiment: null, scheduledAt: new Date(Date.now() - 44 * 60 * 60 * 1000).toISOString() },
    ],
  },
  {
    id: 'client-003',
    firstName: 'Zara',
    lastName: 'Ahmed',
    avatarHue: 290,
    track: 'fat-loss',
    goal: 'Lose 12kg before wedding in Oct',
    armedToday: false,
    currentStreak: 2,
    recentMissedCount: 3,
    needsAttention: true,
    isActive: true,
    isOnboarded: true,
    subscriptionStatus: 'active',
    telegramChatId: 'tg-zara',
    lastActiveAt: new Date(Date.now() - 50 * 60 * 60 * 1000).toISOString(),
    coachNotes: 'Zara is highly motivated emotionally (wedding) but prone to all-or-nothing thinking. Three misses this week — check in directly. Stress at work is the likely culprit.',
    programmeAreas: [
      { id: 'pa-4', area: 'Stress management', instruction: 'Zara under work pressure tends to skip training. Ask about stress levels each call before training compliance.' },
      { id: 'pa-5', area: 'Nutrition', instruction: 'Moderate deficit — 1,600 kcal. No strict macro counting (causes anxiety). Focus on protein and whole foods.' },
    ],
    callMemories: [
      { id: 'm6', content: 'Wedding is October 12th — fixed, high-stakes deadline. This drives urgency and also anxiety.', createdAt: '2026-04-28' },
      { id: 'm7', content: 'All-or-nothing thinker. When she misses once she often writes off the whole week. Reframe: partial is not a miss.', createdAt: '2026-05-15' },
    ],
    calls: [
      { id: 'c7', callType: 'EVENING_REVIEW', status: 'NO_ANSWER', sentiment: null, scheduledAt: new Date(Date.now() - 22 * 60 * 60 * 1000).toISOString() },
      { id: 'c8', callType: 'EVENING_REVIEW', status: 'NO_ANSWER', sentiment: null, scheduledAt: new Date(Date.now() - 46 * 60 * 60 * 1000).toISOString() },
      { id: 'c9', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'negative', scheduledAt: new Date(Date.now() - 70 * 60 * 60 * 1000).toISOString(), durationSec: 280, callSummary: 'Said she\'s exhausted and nothing is working. Clearly stressed about work. Skipped three sessions. Agreed to one session this week — minimum viable.', callInsights: { key_insight: 'Stress is the root, not motivation. Until work pressures ease, volume targets are aspirational.', red_flag: 'Three consecutive misses + negative sentiment. Consider direct message from coach.', follow_up: 'Ask about work situation before discussing training.' } },
    ],
  },
  {
    id: 'client-004',
    firstName: 'Daniel',
    lastName: 'Fernández',
    avatarHue: 145,
    track: 'strength',
    goal: 'Build consistent gym habit',
    armedToday: true,
    currentStreak: 21,
    recentMissedCount: 0,
    needsAttention: false,
    isActive: true,
    isOnboarded: true,
    subscriptionStatus: 'active',
    telegramChatId: null,
    lastActiveAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    coachNotes: 'Daniel is on a streak — 21 days. Likely to hit a plateau soon. Start introducing progressive overload conversation.',
    programmeAreas: [
      { id: 'pa-6', area: 'Programme progression', instruction: 'Daniel is still on the same weights as week 1. Start progressive overload conversation — add 2.5kg per session where possible.' },
    ],
    callMemories: [
      { id: 'm8', content: 'Ex-smoker — fitness is tied to his recovery identity. Very meaningful to him.', createdAt: '2026-05-05' },
    ],
    calls: [
      { id: 'c10', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'positive', scheduledAt: new Date(Date.now() - 19 * 60 * 60 * 1000).toISOString(), durationSec: 310, callSummary: '21-day streak hit today. Clearly proud. Pushed harder in the session than before — energy visibly up.', callInsights: { key_insight: 'Daniel is transitioning from "someone who goes to the gym" to "an athlete". The identity shift is happening.', follow_up: 'Introduce progressive overload — he\'s ready for more challenge.' } },
    ],
  },
  {
    id: 'client-005',
    firstName: 'Yuki',
    lastName: 'Tanaka',
    avatarHue: 58,
    track: 'wellbeing',
    goal: 'Reduce burnout, build sustainable energy',
    armedToday: false,
    currentStreak: 0,
    recentMissedCount: 1,
    needsAttention: false,
    isActive: true,
    isOnboarded: true,
    subscriptionStatus: 'active',
    telegramChatId: 'tg-yuki',
    lastActiveAt: new Date(Date.now() - 28 * 60 * 60 * 1000).toISOString(),
    coachNotes: 'Yuki is in recovery from burnout. Slow and sustainable is the priority. Never push harder unless she volunteers it.',
    programmeAreas: [
      { id: 'pa-7', area: 'Energy management', instruction: 'Ask about daily energy on a 1–10 scale. Track the trend. Don\'t suggest more activity if below 5.' },
    ],
    callMemories: [
      { id: 'm9', content: 'Burnout from 18 months in a high-pressure PM role. Resigned March 2026. Rebuilding from the ground up.', createdAt: '2026-05-08' },
    ],
    calls: [
      { id: 'c11', callType: 'EVENING_REVIEW', status: 'COMPLETED', sentiment: 'neutral', scheduledAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), durationSec: 350, callSummary: 'Gentle session — 20min walk and journaling. Energy at 6/10 which is an improvement from last week.' },
    ],
  },
  {
    id: 'client-006',
    firstName: 'Ollie',
    lastName: 'Grant',
    avatarHue: 14,
    track: 'strength',
    goal: 'Get strong for ski season',
    armedToday: false,
    currentStreak: 0,
    recentMissedCount: 0,
    needsAttention: false,
    isActive: false,
    isOnboarded: true,
    subscriptionStatus: 'past_due',
    telegramChatId: null,
    lastActiveAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    coachNotes: 'Payment lapsed — Ivy can no longer reach Ollie.',
    programmeAreas: [],
    callMemories: [],
    calls: [],
  },
  {
    id: 'client-007',
    firstName: 'Fatima',
    lastName: 'Al-Rashid',
    avatarHue: 248,
    track: 'nutrition',
    goal: 'Sort out energy and gut health',
    armedToday: false,
    currentStreak: 0,
    recentMissedCount: 0,
    needsAttention: false,
    isActive: false,
    isOnboarded: false,
    subscriptionStatus: 'active',
    telegramChatId: null,
    lastActiveAt: null,
    coachNotes: '',
    programmeAreas: [],
    callMemories: [],
    calls: [],
  },
]
