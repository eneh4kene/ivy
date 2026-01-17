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
  getCharities: async () => {
    const response = await client.get<ApiResponse<Charity[]>>('/api/donations/charities')
    return response.data.data!
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

// Export all APIs
export const api = {
  auth: authApi,
  users: usersApi,
  workouts: workoutsApi,
  donations: donationsApi,
  stats: statsApi,
}

export default api
