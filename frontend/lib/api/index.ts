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
    track: string
    goal: string
    subscriptionTier?: string
    region?: string
    currency?: string
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
    const response = await client.post<ApiResponse<{ sessionId: string; url: string }>>('/api/payments/checkout', { tier, promoCode })
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

export const circlesApi = {
  getMy: async (): Promise<Circle[]> => {
    const response = await client.get<ApiResponse<Circle[]>>('/api/circles/my')
    return response.data.data ?? []
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
  circles: circlesApi,
  circleGames: circleGamesApi,
  gameSuggestions: gameSuggestionsApi,
  admin: adminApi,
}

export default api
