import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import api from '../api'
import { useCurrencyStore } from './currency.store'

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
  loginWithGoogle: (idToken: string, opts?: { region?: 'GB' | 'US'; tcpaConsent?: boolean }) => Promise<{ isNewUser: boolean; user: User }>
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

      setUser: (user) => {
        useCurrencyStore.getState().setFromUser(user)
        set({ user, isAuthenticated: true })
      },

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

          useCurrencyStore.getState().setFromUser(user)
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

      loginWithGoogle: async (idToken, opts) => {
        set({ isLoading: true })
        try {
          const { accessToken, user, isNewUser } = await api.auth.googleAuth({ idToken, ...opts })

          if (typeof window !== 'undefined') {
            localStorage.setItem('ivy_token', accessToken)
            localStorage.setItem('ivy_user', JSON.stringify(user))
          }

          useCurrencyStore.getState().setFromUser(user)
          set({
            token: accessToken,
            user,
            isAuthenticated: true,
            isLoading: false,
          })
          return { isNewUser, user }
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
          // Use users.getCurrentProfile to get full user data including phone
          const user = await api.users.getCurrentProfile()
          useCurrencyStore.getState().setFromUser(user)
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
      // Self-heal the token/isAuthenticated desync: if a token survived but the
      // flag rehydrated stale-false, a logged-in user would otherwise be treated
      // as logged-out. A token is the source of truth for auth.
      onRehydrateStorage: () => (state) => {
        if (state && state.token && !state.isAuthenticated) {
          state.isAuthenticated = true
        }
      },
    }
  )
)
