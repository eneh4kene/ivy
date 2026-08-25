import client from './client'
import type {
  User,
  Workout,
  Donation,
  Charity,
  Stats,
  Streak,
  ImpactWallet,
  WeeklySummary,
  MonthlySummary,
  TransformationScore,
  LifeMarker,
  LoginInput,
  CreateWorkoutInput,
  CompleteWorkoutInput,
  UpdateProfileInput,
  CreateTransformationScoreInput,
  CreateLifeMarkerInput,
  ApiResponse,
  Call,
  Season,
  Sprint,
  ImpactStory,
  CreateSeasonInput,
  AccountabilityBuddy,
  ChatMessage,
  ChatActionKind,
} from '../types'

// Auth API
export const authApi = {
  sendMagicLink: async (data: LoginInput & { promoCode?: string; plan?: string }) => {
    const response = await client.post<ApiResponse>('/api/auth/magic-link', data)
    return response.data
  },

  verifyMagicLink: async (token: string) => {
    const response = await client.post<ApiResponse<{ accessToken: string; user: User }>>('/api/auth/verify', { token })
    return response.data.data!
  },

  googleAuth: async (data: { idToken: string; region?: 'GB' | 'US'; tcpaConsent?: boolean; role?: 'coach' }) => {
    const response = await client.post<ApiResponse<{ accessToken: string; user: User; isNewUser: boolean }>>('/api/auth/google', data)
    return response.data.data!
  },

  getCurrentUser: async () => {
    const response = await client.get<ApiResponse<User>>('/api/auth/me')
    return response.data.data!
  },
}

// Users API
export const usersApi = {
  createUser: async (data: {
    email: string
    firstName: string
    lastName: string
    phone?: string
    timezone?: string
    track: string
    goal: string
    subscriptionTier?: string
    region?: string
    currency?: string
    tcpaConsent?: boolean
    role?: 'user' | 'coach'
  }) => {
    const response = await client.post<ApiResponse<User>>('/api/users', data)
    return response.data.data!
  },

  getCurrentProfile: async () => {
    const response = await client.get<ApiResponse<User>>('/api/users/me')
    return response.data.data!
  },

  updateProfile: async (data: UpdateProfileInput) => {
    const response = await client.patch<ApiResponse<User>>('/api/users/me', data)
    return response.data.data!
  },

  markAsOnboarded: async () => {
    const response = await client.post<ApiResponse>('/api/users/me/onboard')
    return response.data
  },

  acceptCoachInvite: async () => {
    const response = await client.post<ApiResponse<User>>('/api/users/me/coach/accept')
    return response.data.data!
  },

  leaveCoach: async () => {
    const response = await client.delete<ApiResponse>('/api/users/me/coach')
    return response.data
  },

  disconnectTelegram: async () => {
    const response = await client.delete<ApiResponse>('/api/users/me/telegram')
    return response.data
  },

  deleteAccount: async () => {
    const response = await client.delete<ApiResponse>('/api/users/me')
    return response.data
  },

  requestPhoneOtp: async (phone: string) => {
    const response = await client.post<ApiResponse>('/api/users/phone/request-otp', { phone })
    return response.data
  },

  verifyPhoneOtp: async (code: string): Promise<string> => {
    const response = await client.post<ApiResponse<{ phone: string }>>('/api/users/phone/verify', { code })
    return response.data.data!.phone
  },

  /** What Ivy remembers about me — the long-term memory store, newest first. */
  getMemories: async (): Promise<IvyMemory[]> => {
    const response = await client.get<ApiResponse<IvyMemory[]>>('/api/users/me/memories')
    return response.data.data!
  },

  /** "Forget this" — permanently removes one memory. */
  forgetMemory: async (memoryId: string) => {
    const response = await client.delete<ApiResponse<{ deleted: boolean }>>(`/api/users/me/memories/${memoryId}`)
    return response.data
  },
}

export interface IvyMemory {
  id: string
  content: string
  category: 'motivation' | 'life_event' | 'personal_detail' | 'struggle' | 'breakthrough' | string
  source: 'call' | 'chat' | string
  createdAt: string
}

// Workouts API
export const workoutsApi = {
  getAll: async (params?: any) => {
    const response = await client.get<ApiResponse<Workout[]>>('/api/workouts', { params })
    return response.data.data!
  },

  getById: async (id: string) => {
    const response = await client.get<ApiResponse<Workout>>(`/api/workouts/${id}`)
    return response.data.data!
  },

  create: async (data: CreateWorkoutInput) => {
    const response = await client.post<ApiResponse<Workout>>('/api/workouts', data)
    return response.data.data!
  },

  update: async (id: string, data: Partial<CreateWorkoutInput>) => {
    const response = await client.patch<ApiResponse<Workout>>(`/api/workouts/${id}`, data)
    return response.data.data!
  },

  complete: async (id: string, data: CompleteWorkoutInput) => {
    const response = await client.post<ApiResponse<Workout>>(`/api/workouts/${id}/complete`, data)
    return response.data.data!
  },

  delete: async (id: string) => {
    const response = await client.delete<ApiResponse>(`/api/workouts/${id}`)
    return response.data
  },
}

// Donations API
export const donationsApi = {
  getCharities: async (params?: { region?: string; track?: string }) => {
    const response = await client.get<ApiResponse<Charity[]>>('/api/donations/charities', { params })
    return response.data.data!
  },

  searchCharities: async (q: string) => {
    const response = await client.get<ApiResponse<any[]>>('/api/donations/charities/search', { params: { q } })
    return response.data.data ?? []
  },

  importCharity: async (data: { slug: string; name: string; description?: string; logoUrl?: string; websiteUrl?: string }) => {
    const response = await client.post<ApiResponse<Charity>>('/api/donations/charities/import', data)
    return response.data.data!
  },

  setUserCharities: async (charityIds: string[]) => {
    const response = await client.post<ApiResponse>('/api/donations/user-charities', { charityIds })
    return response.data
  },

  getUserCharities: async () => {
    const response = await client.get<ApiResponse<any[]>>('/api/donations/user-charities')
    return response.data.data ?? []
  },

  getAll: async (params?: any) => {
    const response = await client.get<ApiResponse<Donation[]>>('/api/donations', { params })
    return response.data.data!
  },

  getImpactWallet: async () => {
    const response = await client.get<ApiResponse<ImpactWallet>>('/api/donations/impact-wallet')
    return response.data.data!
  },

  getStats: async () => {
    const response = await client.get<ApiResponse>('/api/donations/stats')
    return response.data.data!
  },
}

// Stats API
export const statsApi = {
  getOverview: async () => {
    const response = await client.get<ApiResponse<Stats>>('/api/stats')
    return response.data.data!
  },

  getStreak: async () => {
    const response = await client.get<ApiResponse<Streak>>('/api/stats/streak')
    return response.data.data!
  },

  getWeekly: async () => {
    const response = await client.get<ApiResponse<WeeklySummary>>('/api/stats/weekly')
    return response.data.data!
  },

  getMonthly: async () => {
    const response = await client.get<ApiResponse<MonthlySummary>>('/api/stats/monthly')
    return response.data.data!
  },

  createTransformationScore: async (data: CreateTransformationScoreInput) => {
    const response = await client.post<ApiResponse<TransformationScore>>('/api/stats/transformation', data)
    return response.data.data!
  },

  getTransformationScores: async (params?: any) => {
    const response = await client.get<ApiResponse<{ scores: TransformationScore[]; trends: any }>>('/api/stats/transformation', { params })
    return response.data.data!
  },

  getLatestTransformationScore: async () => {
    const response = await client.get<ApiResponse<TransformationScore>>('/api/stats/transformation/latest')
    return response.data.data!
  },

  createLifeMarker: async (data: CreateLifeMarkerInput) => {
    const response = await client.post<ApiResponse<LifeMarker>>('/api/stats/life-markers', data)
    return response.data.data!
  },

  getLifeMarkers: async (params?: any) => {
    const response = await client.get<ApiResponse<LifeMarker[]>>('/api/stats/life-markers', { params })
    return response.data.data!
  },
}

// Payments API
export const paymentsApi = {
  createCheckoutSession: async (tier: string, promoCode?: string) => {
    const response = await client.post<ApiResponse<{ sessionId: string | null; url: string | null; alreadySubscribed?: boolean }>>('/api/payments/checkout', { tier, promoCode })
    return response.data.data!
  },

  createPortalSession: async () => {
    const response = await client.post<ApiResponse<{ url: string }>>('/api/payments/portal')
    return response.data.data!
  },

  getSubscription: async () => {
    const response = await client.get<ApiResponse>('/api/payments/subscription')
    return response.data.data!
  },

  cancelSubscription: async () => {
    const response = await client.post<ApiResponse>('/api/payments/cancel')
    return response.data
  },

  createCoachCheckoutSession: async (currency: string = 'GBP') => {
    const response = await client.post<ApiResponse<{ sessionId: string; url: string }>>('/api/payments/coach-checkout', { currency })
    return response.data.data!
  },
}

// Calls API
export const callsApi = {
  getAll: async (params?: { limit?: number; offset?: number }) => {
    const response = await client.get<ApiResponse<Call[]>>('/api/calls', { params })
    return response.data.data!
  },

  getUpcoming: async () => {
    const response = await client.get<ApiResponse<Call[]>>('/api/calls/upcoming')
    return response.data.data!
  },

  requestRescueCall: async () => {
    const response = await client.post<ApiResponse<Call>>('/api/calls/rescue')
    return response.data.data!
  },
}

// Seasons API
export const seasonsApi = {
  getAll: async () => {
    const response = await client.get<ApiResponse<Season[]>>('/api/seasons')
    return response.data.data!
  },

  getActive: async () => {
    const response = await client.get<ApiResponse<Season>>('/api/seasons/active')
    return response.data.data!
  },

  getCurrentSprint: async () => {
    const response = await client.get<ApiResponse<Sprint>>('/api/seasons/current-sprint')
    return response.data.data!
  },

  create: async (data: CreateSeasonInput) => {
    const response = await client.post<ApiResponse<Season>>('/api/seasons', data)
    return response.data.data!
  },

  closeSeason: async (id: string) => {
    const response = await client.post<ApiResponse<Season>>(`/api/seasons/${id}/close`)
    return response.data.data!
  },
}

// Accountability Buddy API
export const buddyApi = {
  get: async () => {
    const response = await client.get<ApiResponse<AccountabilityBuddy>>('/api/buddy')
    return response.data.data
  },

  set: async (data: { buddyName: string; buddyEmail?: string; buddyPhone?: string }) => {
    const response = await client.post<ApiResponse<AccountabilityBuddy>>('/api/buddy', data)
    return response.data.data!
  },

  remove: async () => {
    const response = await client.delete<ApiResponse>('/api/buddy')
    return response.data
  },
}

interface CircleMember { id: string; firstName: string }
interface Circle {
  id: string; name: string; track: string; tier: string
  seasonTheme?: string; size: number; maxSize: number; isActive: boolean
  members: { userId: string; role: string; user: CircleMember }[]
}
interface SprintGoal { circleId: string; sprintNumber: number; pledge: string; theme?: string; targetMetric?: string }
interface ConsistencyResult { rate: number; topPerformers: string[]; memberCount: number }
export interface CircleCurrentSession {
  id: string
  status: 'scheduled' | 'open' | 'completed'
  opensAt: string
  closesAt: string
  sprintNumber: number | null
  memberCount: number
  sharedCount: number
  myShare: { win: string; struggle: string } | null
  room: Array<{ firstName: string; isYou: boolean; win: string; struggle: string }> | null
}

export const circlesApi = {
  getMy: async (): Promise<Circle[]> => {
    // The backend (/api/circles/my → getCirclesForUser) returns IvyCircleMember
    // rows with the actual circle nested under `.circle` — NOT flat Circle objects.
    // Unwrap to the flat Circle shape the UI consumes (name/size/maxSize/members).
    // Tolerate either shape so we don't break if the endpoint is ever flattened.
    const response = await client.get<ApiResponse<Array<Circle | { circle: Circle }>>>(
      '/api/circles/my',
    )
    const rows = response.data.data ?? []
    return rows
      .map((row) => ('circle' in row && row.circle ? row.circle : (row as Circle)))
      .filter(Boolean)
  },
  get: async (id: string): Promise<Circle> => {
    const response = await client.get<ApiResponse<Circle>>(`/api/circles/${id}`)
    return response.data.data!
  },
  create: async (data: { name: string; track: string; tier?: string; seasonTheme?: string }): Promise<Circle> => {
    const response = await client.post<ApiResponse<Circle>>('/api/circles', data)
    return response.data.data!
  },
  update: async (id: string, data: { name?: string; seasonTheme?: string; track?: string }): Promise<Circle> => {
    const response = await client.patch<ApiResponse<Circle>>(`/api/circles/${id}`, data)
    return response.data.data!
  },
  join: async (circleId: string) => {
    const response = await client.post<ApiResponse<{ circleId: string; userId: string }>>(`/api/circles/${circleId}/members`, {})
    return response.data.data!
  },
  setSprintGoal: async (circleId: string, data: { sprintNumber: number; pledge: string; theme?: string; targetMetric?: string }): Promise<SprintGoal> => {
    const response = await client.post<ApiResponse<SprintGoal>>(`/api/circles/${circleId}/sprint-goals`, data)
    return response.data.data!
  },
  getSprintGoal: async (circleId: string, sprintNumber: number): Promise<SprintGoal | null> => {
    const response = await client.get<ApiResponse<SprintGoal>>(`/api/circles/${circleId}/sprint-goals/${sprintNumber}`)
    return response.data.data ?? null
  },
  getConsistency: async (circleId: string): Promise<ConsistencyResult> => {
    const response = await client.get<ApiResponse<ConsistencyResult>>(`/api/circles/${circleId}/consistency`)
    return response.data.data!
  },
  getCurrentSession: async (): Promise<CircleCurrentSession | null> => {
    const response = await client.get<ApiResponse<CircleCurrentSession | null>>('/api/circles/session/current')
    return response.data.data ?? null
  },
  submitSessionShare: async (win: string, struggle: string): Promise<CircleCurrentSession | null> => {
    const response = await client.post<ApiResponse<CircleCurrentSession | null>>('/api/circles/session/share', { win, struggle })
    return response.data.data ?? null
  },
  getSessionNudge: async (): Promise<{ win: string; struggle: string }> => {
    const response = await client.post<ApiResponse<{ win: string; struggle: string }>>('/api/circles/session/nudge', {})
    return response.data.data!
  },
  getSessions: async (circleId: string): Promise<CircleSession[]> => {
    const response = await client.get<ApiResponse<CircleSession[]>>(`/api/circles/${circleId}/sessions`)
    return response.data.data ?? []
  },
  completeSession: async (sessionId: string, data: {
    collectivePledge: string
    highlights?: string
    participantUserIds: string[]
  }): Promise<CircleSession> => {
    const response = await client.patch<ApiResponse<CircleSession>>(`/api/circles/sessions/${sessionId}/complete`, data)
    return response.data.data!
  },

  /** Witnessed stakes: every active member's today-status; non-opted-in = 'private'. */
  getStakeStatuses: async (circleId: string): Promise<WitnessedStakeStatus[]> => {
    const response = await client.get<ApiResponse<WitnessedStakeStatus[]>>(`/api/circles/${circleId}/stake-statuses`)
    return response.data.data ?? []
  },

  /** Opt in/out of my own stake visibility in this circle. */
  setShareStake: async (circleId: string, share: boolean) => {
    const response = await client.post<ApiResponse<{ share: boolean }>>(`/api/circles/${circleId}/share-stake`, { share })
    return response.data.data!
  },
}

export interface WitnessedStakeStatus {
  userId: string
  firstName: string
  shareStakeWithCircle: boolean
  stakeStatus: 'armed' | 'completed' | 'forfeited' | 'unarmed' | 'no_stake' | 'private'
  sliceAmount: number | null
  cycleId: string | null
}

interface CircleSession {
  id: string
  circleId: string
  sprintNumber: number | null
  sprintId: string | null
  scheduledAt: string
  conductedAt: string | null
  status: string
  facilitatorType: string
  collectivePledge: string | null
  highlights: string | null
  participantUserIds: string
}

// Circle Games API
interface GameTemplate {
  type: string; name: string; description: string
  defaultRules: Record<string, any>; defaultInstruction: string
}
interface CircleGame {
  id: string; circleId: string; sprintId?: string
  name: string; description?: string
  templateType: string; rules: Record<string, any>
  ivyInstruction: string; state: Record<string, any>
  status: string; startedAt: string; completedAt?: string
  events: { id: string; eventType: string; note?: string; createdAt: string }[]
}

// Game Suggestions API (public read + superadmin write)
export interface GameSuggestion {
  id: string; title: string; description: string; templateType: string
  ivyInstruction: string; tracks: string[]; tags: string[]
  published: boolean; usageCount: number; createdByEmail?: string
  createdAt: string; updatedAt: string
}

export const gameSuggestionsApi = {
  // Public — for circles browsing inspiration
  listPublished: async (track?: string, tag?: string): Promise<GameSuggestion[]> => {
    const params: Record<string, string> = {};
    if (track) params.track = track;
    if (tag) params.tag = tag;
    const response = await client.get<ApiResponse<GameSuggestion[]>>('/api/circles/games/suggestions', { params });
    return response.data.data ?? [];
  },
  // Superadmin CRUD
  listAll: async (): Promise<GameSuggestion[]> => {
    const response = await client.get<ApiResponse<GameSuggestion[]>>('/api/admin/game-suggestions');
    return response.data.data ?? [];
  },
  create: async (data: Omit<GameSuggestion, 'id' | 'usageCount' | 'createdAt' | 'updatedAt'>): Promise<GameSuggestion> => {
    const response = await client.post<ApiResponse<GameSuggestion>>('/api/admin/game-suggestions', data);
    return response.data.data!;
  },
  update: async (id: string, data: Partial<GameSuggestion>): Promise<GameSuggestion> => {
    const response = await client.patch<ApiResponse<GameSuggestion>>(`/api/admin/game-suggestions/${id}`, data);
    return response.data.data!;
  },
  delete: async (id: string): Promise<void> => {
    await client.delete(`/api/admin/game-suggestions/${id}`);
  },
}

export const circleGamesApi = {
  getTemplates: async (): Promise<GameTemplate[]> => {
    const response = await client.get<ApiResponse<GameTemplate[]>>('/api/circles/games/templates')
    return response.data.data ?? []
  },
  getActiveGame: async (): Promise<{ game: CircleGame; stateSummary: string } | null> => {
    const response = await client.get<ApiResponse<{ game: CircleGame; stateSummary: string } | null>>('/api/circles/games/active')
    return response.data.data ?? null
  },
  listGames: async (circleId: string): Promise<CircleGame[]> => {
    const response = await client.get<ApiResponse<CircleGame[]>>(`/api/circles/${circleId}/games`)
    return response.data.data ?? []
  },
  createGame: async (circleId: string, data: {
    name: string; description?: string; templateType: string
    rules?: Record<string, any>; ivyInstruction: string; sprintId?: string; suggestionId?: string
  }): Promise<CircleGame> => {
    const response = await client.post<ApiResponse<CircleGame>>(`/api/circles/${circleId}/games`, data)
    return response.data.data!
  },
  getGame: async (gameId: string): Promise<CircleGame> => {
    const response = await client.get<ApiResponse<CircleGame>>(`/api/circles/games/${gameId}`)
    return response.data.data!
  },
  pauseGame: async (gameId: string): Promise<CircleGame> => {
    const response = await client.patch<ApiResponse<CircleGame>>(`/api/circles/games/${gameId}/pause`)
    return response.data.data!
  },
  endGame: async (gameId: string): Promise<CircleGame> => {
    const response = await client.patch<ApiResponse<CircleGame>>(`/api/circles/games/${gameId}/end`)
    return response.data.data!
  },
}

// Admin API (B2B company admins)
interface AdminStats {
  season: { name: string; startDate: string | null; endDate: string | null; daysRemaining: number | null }
  enrollment: { total: number; active: number; pending: number }
  participation: { rate: number }
  consistency: { rate: number }
  donations: { total: number }
  tracks: { track: string; count: number; percentage: number }[]
  weeklyParticipation: { week: number; rate: number }[]
}
interface AdminEmployee { id: string; name: string; email: string; status: 'active' | 'pending' | 'inactive'; track: string; joinedAt: string }

export const adminApi = {
  getStats: async (): Promise<AdminStats> => {
    const response = await client.get<ApiResponse<AdminStats>>('/api/admin/stats')
    return response.data.data!
  },
  getEmployees: async (): Promise<AdminEmployee[]> => {
    const response = await client.get<ApiResponse<AdminEmployee[]>>('/api/admin/employees')
    return response.data.data!
  },
  inviteEmployees: async (emails: string[]) => {
    const response = await client.post<ApiResponse<{ results: { email: string; status: string; error?: string }[] }>>('/api/admin/employees/invite', { emails })
    return response.data.data!
  },
  getReportData: async (type?: string) => {
    const response = await client.get<ApiResponse<unknown>>('/api/admin/reports', { params: { type } })
    return response.data.data
  },
  getCalls: async (params?: { limit?: number; offset?: number; callType?: string; sentiment?: string; userId?: string }) => {
    const response = await client.get<ApiResponse<{
      id: string
      callType: string
      scheduledAt: string
      duration: number | null
      outcome: string | null
      sentiment: string | null
      transcript: string | null
      user: { id: string; firstName: string; lastName: string; email: string; track: string; goal: string }
      workoutFollowed: { activity: string; status: string } | null
    }[]>>('/api/admin/calls', { params })
    return response.data
  },
  getUsage: async (days = 30) => {
    const response = await client.get<ApiResponse<{
      periodDays: number
      totalCostGbp: number
      byService: { service: string; operation: string; totalCostGbp: number; totalUnits: number; count: number }[]
      byUser: { userId: string; name: string; email: string; totalCostGbp: number }[]
    }>>('/api/admin/usage', { params: { days } })
    return response.data.data!
  },
  getPlatformCosts: async (days = 30) => {
    const response = await client.get<ApiResponse<{
      periodDays: number
      totalCostGbp: number
      alertThresholdGbp: number
      byService: { service: string; operation: string; totalCostGbp: number; totalUnits: number; count: number }[]
      byDay: { date: string; totalCostGbp: number; byService: Record<string, number> }[]
      topUsers: { userId: string; name: string; email: string; tier: string; totalCostGbp: number }[]
    }>>('/api/admin/platform-costs', { params: { days } })
    return response.data.data!
  },
}

// Coach API
export interface CoachProfile {
  discipline?: string
  id: string; userId: string
  programmeName: string; coachingStyle?: string; programmeNotes?: string
  whitelabelEnabled: boolean; brandName?: string; brandLogoUrl?: string
  alertOnMissedCalls: number; weeklyDigestEnabled: boolean
  ponderCallEnabled: boolean
  ponderCallDay?: number
  ponderCallTime?: string
  ponderCallFrequency?: string
}
export interface CoachPulse {
  rate: number | null
  prevRate: number | null
  activeClients: number
  topPerformers: string[]
  circle: { id: string; name: string; size: number } | null
}
export interface CoachClient {
  id: string; firstName: string; lastName: string; email: string
  track: string; goal: string; coachNotes?: string
  isOnboarded: boolean; isActive: boolean
  subscriptionStatus: string; subscriptionTier: string
  lastCallAt?: string; telegramChatId?: string | null
  currentStreak: number; lastCallSentiment?: string
  recentMissedCount: number; needsAttention: boolean
  calls: { callType: string; status: string; sentiment?: string; scheduledAt: string; callSummary?: string }[]
}

export const inviteApi = {
  getInfo: async (token: string) => {
    const response = await client.get<ApiResponse<{
      coachId: string; coachName: string; programmeName: string;
      displayName: string | null; logoUrl: string | null;
    }>>(`/api/invite/${token}`)
    return response.data.data!
  },
  join: async (token: string, email: string) => {
    const response = await client.post<ApiResponse>(`/api/invite/${token}/join`, { email })
    return response.data
  },
}

// Coach Marketplace API (consumer-facing)
export interface MarketplaceCoachSummary {
  id: string
  firstName: string
  lastName: string
  displayName: string
  photoUrl: string | null
  programmeName: string | null
  coachingStyle: string | null
  /** MOCKED — not in schema yet: requires hourlyRate field on CoachProfile */
  hourlyRate: number | null
  /** MOCKED — not in schema yet: requires CoachReview model */
  rating: number | null
  reviewCount: number | null
  ivyVetted: boolean
}

export interface MarketplaceCoachDetail extends MarketplaceCoachSummary {
  programmeNotes: string | null
  /** MOCKED — not in schema yet */
  credentials: string[] | null
  specialties: string[] | null
}

export const coachMarketplaceApi = {
  list: async (): Promise<MarketplaceCoachSummary[]> => {
    const response = await client.get<ApiResponse<MarketplaceCoachSummary[]>>('/api/coach/marketplace')
    return response.data.data ?? []
  },
  get: async (id: string): Promise<MarketplaceCoachDetail> => {
    const response = await client.get<ApiResponse<MarketplaceCoachDetail>>(`/api/coach/marketplace/${id}`)
    return response.data.data!
  },
}

export const coachApi = {
  /** "Try it first" — Ivy rings the coach and runs a real client-style call. */
  trialCall: async (phone: string): Promise<{ callId: string; retellCallId: string }> => {
    const response = await client.post<ApiResponse<{ callId: string; retellCallId: string }>>(
      '/api/coach/trial-call', { phone },
    )
    return response.data.data!
  },

  getProfile: async (): Promise<CoachProfile | null> => {
    const response = await client.get<ApiResponse<CoachProfile | null>>('/api/coach/profile')
    return response.data.data ?? null
  },
  updateProfile: async (data: Partial<CoachProfile>): Promise<CoachProfile> => {
    const response = await client.patch<ApiResponse<CoachProfile>>('/api/coach/profile', data)
    return response.data.data!
  },
  getInviteLink: async (): Promise<{ token: string; url: string }> => {
    const response = await client.get<ApiResponse<{ token: string; url: string }>>('/api/coach/invite-link')
    return response.data.data!
  },
  getPulse: async (): Promise<CoachPulse> => {
    const response = await client.get<ApiResponse<CoachPulse>>('/api/coach/pulse')
    return response.data.data!
  },
  resetInviteLink: async (): Promise<{ token: string; url: string }> => {
    const response = await client.post<ApiResponse<{ token: string; url: string }>>('/api/coach/invite-link/reset')
    return response.data.data!
  },
  getClients: async (): Promise<CoachClient[]> => {
    const response = await client.get<ApiResponse<CoachClient[]>>('/api/coach/clients')
    return response.data.data ?? []
  },
  getClient: async (id: string): Promise<any> => {
    const response = await client.get<ApiResponse<any>>(`/api/coach/clients/${id}`)
    return response.data.data!
  },
  updateClientNotes: async (id: string, coachNotes: string): Promise<void> => {
    await client.patch(`/api/coach/clients/${id}/notes`, { coachNotes })
  },
  draftClientNotes: async (id: string): Promise<{ notes: string }> => {
    const response = await client.post<ApiResponse<{ notes: string }>>(`/api/coach/clients/${id}/draft-notes`, {})
    return response.data.data!
  },
  inviteClient: async (email: string): Promise<{ status: string; email: string }> => {
    const response = await client.post<ApiResponse<{ status: string; email: string }>>('/api/coach/clients/invite', { email })
    return response.data.data!
  },
  removeClient: async (id: string): Promise<void> => {
    await client.delete(`/api/coach/clients/${id}`)
  },
  updateProgrammeAreas: async (id: string, areas: Array<{ id: string; area: string; instruction: string }>): Promise<void> => {
    await client.patch(`/api/coach/clients/${id}/programme-areas`, { areas })
  },
  /** The proof artifact: 28-day kept-days % for the book + per-client breakdown. */
  getKeepRate: async (): Promise<CoachKeepRate> => {
    const response = await client.get<ApiResponse<CoachKeepRate>>('/api/coach/keep-rate')
    return response.data.data!
  },
}

export interface CoachKeepRate {
  windowDays: number
  bookRate: number | null
  keptDays: number
  totalDays: number
  clients: Array<{ id: string; firstName: string; keptDays: number; totalDays: number; rate: number | null }>
}

// Stake Config API
export interface StakeConfig {
  stakeWeeklyAmount: number | null
  forfeitMode: 'MIDDLE' | 'SAVAGE'
  dislikedCharityId: string | null
  preferredCharityId: string | null
  armingWindowStart: string | null
  armingWindowEnd: string | null
  currency: string
  minWeeklyStake: number
  defaultWeeklyStake: number
}

// Composed daily/home read model — GET /api/stake/state
export type StakeDayStatus = 'armed' | 'complete' | 'forfeited' | 'grace' | 'upcoming'
export interface StakeState {
  cycle: {
    id: string
    status: 'AUTHORIZED' | 'SETTLED' | 'VOIDED' | 'FAILED'
    /** True when this is the user's flat-rate first cycle (Foundation Run). */
    isFoundation: boolean
    /** Forfeitable days this cycle spans (foundation runs are often <7). */
    daysInCycle: number
    weeklyAmount: number
    dailySlice: number
    currency: 'GBP' | 'USD'
    periodStart: string
    periodEnd: string
    daysArmed: number
    daysCompleted: number
    daysForfeited: number
    graceUsed: number
    graceTotal: number
    amountSafe: number
    amountAtRisk: number
  } | null
  /** Set when the latest hold attempt failed and no cycle is open — the week has no teeth. */
  holdFailure: {
    amount: number
    currency: 'GBP' | 'USD'
    failedAt: string
  } | null
  config: {
    hasConfig: boolean
    weeklyAmount: number | null
    currency: 'GBP' | 'USD'
    forfeitMode: 'MIDDLE' | 'SAVAGE'
    armingWindowStart: string | null
    armingWindowEnd: string | null
    forfeitDestination: string | null
    successDestination: string | null
  }
  today: {
    date: string
    isArmed: boolean
    armedAt: string | null
    sliceOutcome: 'RELEASED' | 'FORFEITED' | 'PENDING' | null
    workoutId: string | null
    voiceNote: { id: string; transcript: string | null; recordedAt: string; durationSec: number | null } | null
    armingWindowStart: string | null
    armingWindowEnd: string | null
    withinArmingWindow: boolean
    /** Next-day commitment captured on the most recent call — shown as the morning VN hint. */
    suggestedIntention: { text: string; capturedAt: string } | null
  }
  week: { label: string; date: string; status: StakeDayStatus; isToday: boolean }[]
}

export const stakeApi = {
  /** Composed daily/home state: active cycle, config (charity names), today, week grid. */
  getState: async (): Promise<StakeState> => {
    const response = await client.get<ApiResponse<StakeState>>('/api/stake/state')
    return response.data.data!
  },

  /** "I actually did this" — flag a forfeited day for human review. Never moves money. */
  dispute: async (workoutId: string): Promise<{ disputed: boolean; graceCovers: boolean }> => {
    const response = await client.post<ApiResponse<{ disputed: boolean; graceCovers: boolean }>>('/api/stake/dispute', { workoutId })
    return response.data.data!
  },

  /**
   * Persist the user's stake configuration.
   * weeklyAmount must be >= STAKE_CONFIG.minWeeklyStake for the user's currency.
   * dislikedCharityId is required when forfeitMode is 'SAVAGE'.
   */
  saveConfig: async (data: {
    stakeWeeklyAmount: number
    forfeitMode: 'MIDDLE' | 'SAVAGE'
    dislikedCharityId?: string | null
    preferredCharityId?: string | null
    armingWindowStart: string
    armingWindowEnd: string
  }): Promise<StakeConfig> => {
    const response = await client.post<ApiResponse<StakeConfig>>('/api/stake/config', data)
    return response.data.data!
  },

  /** Fetch the current user's stake configuration. */
  getConfig: async (): Promise<StakeConfig> => {
    const response = await client.get<ApiResponse<StakeConfig>>('/api/stake/config')
    return response.data.data!
  },
}

// Ivy in-app chat API
export const chatApi = {
  /** Full IN_APP thread, oldest → newest. Marks Ivy messages read server-side. */
  getThread: async (): Promise<ChatMessage[]> => {
    const r = await client.get<ApiResponse<ChatMessage[]>>('/api/chat')
    return r.data.data ?? []
  },

  /** Send a user message; resolves to Ivy's reply. */
  send: async (content: string): Promise<ChatMessage> => {
    const r = await client.post<ApiResponse<ChatMessage>>('/api/chat', { content })
    return r.data.data!
  },

  /** Tap an Ivy action card (onboarding handoff). Returns Ivy's confirmation message. */
  action: async (action: ChatActionKind, at?: string): Promise<ChatMessage> => {
    const r = await client.post<ApiResponse<ChatMessage>>('/api/chat/action', { action, at })
    return r.data.data!
  },

  /** Unread Ivy-message count for the nav badge. */
  getUnreadCount: async (): Promise<number> => {
    const r = await client.get<ApiResponse<{ count: number }>>('/api/chat/unread')
    return r.data.data?.count ?? 0
  },
}

// Push notifications API
export const pushApi = {
  subscribe: async (subscription: any) => {
    const response = await client.post<ApiResponse>('/api/push/subscribe', { subscription })
    return response.data
  },

  unsubscribe: async (data: { endpoint: string }) => {
    const response = await client.post<ApiResponse>('/api/push/unsubscribe', data)
    return response.data
  },

  resubscribe: async (data: { oldEndpoint: string; newSubscription: any }) => {
    const response = await client.post<ApiResponse>('/api/push/resubscribe', data)
    return response.data
  },

  getVapidPublicKey: async (): Promise<string | null> => {
    const response = await client.get<ApiResponse<{ publicKey: string }>>('/api/push/vapid-public-key')
    return response.data.data?.publicKey ?? null
  },
}

// Voice Notes API
export const voiceNotesApi = {
  /**
   * Upload audio blob to arm today's workout.
   * Accepts multipart/form-data with fields: audio (Blob), durationSec (optional), workoutId (optional).
   */
  submit: async (audio: Blob, durationSec?: number, workoutId?: string): Promise<{
    voiceNote: { id: string; transcript: string | null; recordedAt: string; durationSec: number | null }
    workoutId: string | null
    armed: boolean
  }> => {
    const form = new FormData()
    form.append('audio', audio, 'voice-note.webm')
    if (durationSec !== undefined) form.append('durationSec', String(durationSec))
    if (workoutId) form.append('workoutId', workoutId)

    const token = typeof window !== 'undefined' ? localStorage.getItem('ivy_token') : null
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/voice-notes`,
      {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: form,
      }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err?.error?.message ?? `Voice note upload failed: ${res.status}`)
    }
    const json = await res.json()
    return json.data
  },
}

// Export all APIs
export const api = {
  auth: authApi,
  users: usersApi,
  workouts: workoutsApi,
  donations: donationsApi,
  stats: statsApi,
  payments: paymentsApi,
  calls: callsApi,
  seasons: seasonsApi,
  buddy: buddyApi,
  push: pushApi,
  voiceNotes: voiceNotesApi,
  circles: circlesApi,
  circleGames: circleGamesApi,
  gameSuggestions: gameSuggestionsApi,
  admin: adminApi,
  coach: coachApi,
  coachMarketplace: coachMarketplaceApi,
  stake: stakeApi,
  chat: chatApi,
}

export default api
