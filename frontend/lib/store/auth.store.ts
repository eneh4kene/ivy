import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import api from '../api'

interface AuthState {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean

  // Actions
  setUser: (user: User) => void
  setToken: (token: string) => void
  login: (email: string) => Promise<void>
  verifyMagicLink: (token: string) => Promise<void>
  logout: () => void
  fetchUser: () => Promise<void>
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      setUser: (user) => set({ user, isAuthenticated: true }),

      setToken: (token) => {
        if (typeof window !== 'undefined') {
          localStorage.setItem('ivy_token', token)
        }
        set({ token, isAuthenticated: true })
      },

      login: async (email) => {
        set({ isLoading: true })
        try {
          await api.auth.sendMagicLink({ email })
        } catch (error) {
          throw error
        } finally {
          set({ isLoading: false })
        }
      },

      verifyMagicLink: async (token) => {
        set({ isLoading: true })
        try {
          const { accessToken, user } = await api.auth.verifyMagicLink(token)

          // Store token
          if (typeof window !== 'undefined') {
            localStorage.setItem('ivy_token', accessToken)
            localStorage.setItem('ivy_user', JSON.stringify(user))
          }

          set({
            token: accessToken,
            user,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },

      logout: () => {
        if (typeof window !== 'undefined') {
          localStorage.removeItem('ivy_token')
          localStorage.removeItem('ivy_user')
        }
        set({
          user: null,
          token: null,
          isAuthenticated: false
        })
      },

      fetchUser: async () => {
        const token = get().token
        if (!token) return

        set({ isLoading: true })
        try {
          const user = await api.auth.getCurrentUser()
          set({ user, isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
    }),
    {
      name: 'ivy-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
        isAuthenticated: state.isAuthenticated
      }),
    }
  )
)
