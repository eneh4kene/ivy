// User types
export type SubscriptionTier = 'FREE' | 'PRO' | 'ELITE' | 'CONCIERGE' | 'B2B'

export interface User {
  id: string
  email: string
  phone?: string
  firstName: string
  lastName: string
  timezone: string
  profileImage?: string
  subscriptionTier: SubscriptionTier
  subscriptionStatus: string
  track: string
  goal: string
  minimumMode?: string
  giftFrame?: string
  morningCallTime?: string
  eveningCallTime?: string
  callFrequency: number
  preferredDays?: string
  googleCalendarConnected: boolean
  outlookCalendarConnected: boolean
  isActive: boolean
  isOnboarded: boolean
  onboardedAt?: string
  lastCallAt?: string
  role?: UserRole
  createdAt: string
  updatedAt: string
  preferredCharity?: Charity
  company?: Company
  companyId?: string
}

// Charity types
export interface Charity {
  id: string
  name: string
  description: string
  category: string
  impactMetric: string
  impactPerPound: string
  logoUrl?: string
  website?: string
  isActive: boolean
}

// Company types
export interface Company {
  id: string
  name: string
}

// User roles for access control
export type UserRole = 'user' | 'admin' | 'superadmin'

// Workout types
export type WorkoutStatus = 'PLANNED' | 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'MISSED'

export interface Workout {
  id: string
  userId: string
  plannedDate: string
  plannedTime?: string
  activity: string
  duration?: number
  status: WorkoutStatus
  completedAt?: string
  skippedReason?: string
  isMinimum: boolean
  createdAt: string
  updatedAt: string
}

// Donation types
export type DonationType = 'COMPLETION' | 'STREAK_7_DAY' | 'STREAK_30_DAY' | 'STREAK_90_DAY' | 'MANUAL'

export interface Donation {
  id: string
  userId: string
  charityId: string
  amount: number
  currency: string
  donationType: DonationType
  workoutId?: string
  streakDays?: number
  createdAt: string
  charity: Charity
}

// Impact Wallet types
export interface ImpactWallet {
  wallet: {
    monthlyLimit: number
    dailyCap: number
    currentMonthSpent: number
    lifetimeDonated: number
    monthStartDate: string
  }
  currentMonth: {
    totalDonated: number
    donationCount: number
    remaining: number
  }
  today: {
    totalDonated: number
    donationCount: number
    remaining: number
  }
}

// Streak types
export interface Streak {
  currentStreak: number
  currentStreakStart?: string
  longestStreak: number
  longestStreakStart?: string
  longestStreakEnd?: string
  lastWorkoutDate?: string
  bonuses: {
    sevenDayClaimed: boolean
    thirtyDayClaimed: boolean
    ninetyDayClaimed: boolean
  }
}

// Transformation types
export interface TransformationScore {
  id: string
  userId: string
  energyScore?: number
  moodScore?: number
  healthConfidence?: number
  weekNumber: number
  notes?: string
  createdAt: string
}

export interface LifeMarker {
  id: string
  userId: string
  marker: string
  category: 'physical' | 'mental' | 'social' | 'professional'
  significance: 'small' | 'medium' | 'major'
  createdAt: string
}

// Stats types
export interface Stats {
  user: {
    id: string
    name: string
    track: string
    goal: string
    tier: SubscriptionTier
    daysSinceJoined: number
  }
  streak: {
    current: number
    longest: number
    lastWorkout?: string
  }
  workouts: {
    total: number
    thisWeek: number
    thisMonth: number
    completionRate: number
    byStatus: Array<{
      status: WorkoutStatus
      count: number
    }>
  }
  donations: {
    lifetimeTotal: number
    currentMonth: number
    count: number
  }
  impact: {
    monthlyLimit: number
    dailyCap: number
    remaining: number
  }
}

export interface WeeklySummary {
  week: {
    start: string
    end: string
  }
  workouts: {
    planned: number
    completed: number
    rate: number
  }
  donations: {
    total: number
    count: number
  }
  transformation?: {
    energy?: number
    mood?: number
    healthConfidence?: number
  }
}

export interface MonthlySummary {
  month: {
    start: string
    end: string
  }
  workouts: {
    planned: number
    completed: number
    rate: number
  }
  donations: {
    total: number
    count: number
  }
  streak: {
    current: number
    longest: number
  }
  lifeMarkers: {
    count: number
  }
}

// API Response types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    message: string
    code?: string
  }
  meta?: {
    page?: number
    limit?: number
    total?: number
    totalPages?: number
  }
}

// Form input types
export interface LoginInput {
  email: string
}

export interface CreateWorkoutInput {
  plannedDate: string
  plannedTime?: string
  activity: string
  duration?: number
  isMinimum?: boolean
}

export interface CompleteWorkoutInput {
  status: 'COMPLETED' | 'PARTIAL' | 'SKIPPED'
  skippedReason?: string
}

export interface UpdateProfileInput {
  firstName?: string
  lastName?: string
  phone?: string
  timezone?: string
  track?: string
  goal?: string
  minimumMode?: string
  giftFrame?: string
  morningCallTime?: string
  eveningCallTime?: string
  callFrequency?: number
  preferredDays?: string
}

export interface CreateTransformationScoreInput {
  energyScore?: number
  moodScore?: number
  healthConfidence?: number
  notes?: string
}

export interface CreateLifeMarkerInput {
  marker: string
  category: 'physical' | 'mental' | 'social' | 'professional'
  significance: 'small' | 'medium' | 'major'
}
