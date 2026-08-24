import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User } from '../types'
import api from '../api'
import { useCurrencyStore } from './currency.store'
import { DEFAULT_TIMEZONE, detectTimezone } from '../timezones'

/**
 * Adopt the browser's timezone for users who never set one.
 *
 * Why it matters: /signup now sends a timezone, but coach-invited clients are
 * created server-side (coach.service.joinViaInviteToken) where no browser
 * exists, so they ALWAYS land on the Europe/London default. For a US client that
 * means the evening call fires at 2pm their time — the ritual not happening.
 *
 * Called from ALL FOUR places that establish a user, because there is no single
 * funnel: setUser (the magic-link verify page calls this directly),
 * verifyMagicLink, loginWithGoogle and fetchUser each set state independently.
 * An earlier version hooked only fetchUser and silently never ran for invited
 * users — the exact case it existed to fix — because /settings never calls it.
 *
 * Only fires when the stored value is still the untouched default, so it can
 * never overwrite a deliberate choice. The one imperfect case is a London user
 * who first signs in while abroad: they would adopt the local zone and have to
 * correct it in Settings. That is a fair trade against every US client silently
 * being called at the wrong time — and it self-heals, because after this runs
 * once the stored value is no longer the default.
 *
 * Fire-and-forget: a failure here must never block sign-in.
 */
async function reconcileTimezone(user: User, onUpdated: (u: User) => void) {
  if (user.timezone !== DEFAULT_TIMEZONE) return
  const detected = detectTimezone()
  if (!detected || detected === DEFAULT_TIMEZONE) return
  try {
    await api.users.updateProfile({ timezone: detected })
    onUpdated({ ...user, timezone: detected })
  } catch {
    // Non-fatal: the user can still set it in Settings.
  }
}

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
  loginWithGoogle: (idToken: string, opts?: { region?: 'GB' | 'US'; tcpaConsent?: boolean; role?: 'coach' }) => Promise<{ isNewUser: boolean; user: User }>
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
        void reconcileTimezone(user, (u) => set({ user: u }))
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
          void reconcileTimezone(user, (u) => set({ user: u }))
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
          void reconcileTimezone(user, (u) => set({ user: u }))
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
          void reconcileTimezone(user, (u) => set({ user: u }))
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
