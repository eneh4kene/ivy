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
  sendMagicLink: async (data: LoginInput) => {
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
  createUser: async (data: any) => {
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
  createCheckoutSession: async (tier: string) => {
    const response = await client.post<ApiResponse<{ sessionId: string; url: string }>>('/api/payments/checkout', { tier })
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

// Circles API
export const circlesApi = {
  getMy: async () => {
    const response = await client.get<ApiResponse<any[]>>('/api/circles/my')
    return response.data.data ?? []
  },
  get: async (id: string) => {
    const response = await client.get<ApiResponse<any>>(`/api/circles/${id}`)
    return response.data.data!
  },
  create: async (data: { name: string; track: string; tier?: string; seasonTheme?: string }) => {
    const response = await client.post<ApiResponse<any>>('/api/circles', data)
    return response.data.data!
  },
  update: async (id: string, data: { name?: string; seasonTheme?: string; track?: string }) => {
    const response = await client.patch<ApiResponse<any>>(`/api/circles/${id}`, data)
    return response.data.data!
  },
  join: async (circleId: string) => {
    const response = await client.post<ApiResponse<any>>(`/api/circles/${circleId}/members`, {})
    return response.data.data!
  },
  setSprintGoal: async (circleId: string, data: { sprintNumber: number; pledge: string; theme?: string; targetMetric?: string }) => {
    const response = await client.post<ApiResponse<any>>(`/api/circles/${circleId}/sprint-goals`, data)
    return response.data.data!
  },
  getSprintGoal: async (circleId: string, sprintNumber: number) => {
    const response = await client.get<ApiResponse<any>>(`/api/circles/${circleId}/sprint-goals/${sprintNumber}`)
    return response.data.data
  },
  getConsistency: async (circleId: string) => {
    const response = await client.get<ApiResponse<any>>(`/api/circles/${circleId}/consistency`)
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
}

export default api
