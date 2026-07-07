import axios, { AxiosError, AxiosResponse } from 'axios'
import type { ApiResponse } from '../types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Create axios instance
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

// ── GET micro-cache ──────────────────────────────────────────────────────────
// Every screen refetches its whole world on mount, so tab-switching felt like
// loading spinners all the way down. Fresh-enough GETs (<20s) are served from
// memory instantly; ANY mutation clears the whole cache so an arm/checkout/
// send never shows stale state on the next screen.
const GET_CACHE_TTL_MS = 20_000
const getCache = new Map<string, { at: number; response: AxiosResponse }>()

function cacheKey(config: any): string {
  return `${config.url}?${config.params ? JSON.stringify(config.params) : ''}`
}

// Request interceptor - add auth token
client.interceptors.request.use(
  (config) => {
    // Get token from localStorage (browser only)
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('ivy_token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
    }
    if (config.method === 'get') {
      const hit = getCache.get(cacheKey(config))
      if (hit && Date.now() - hit.at < GET_CACHE_TTL_MS) {
        // Serve from memory without a network round-trip.
        config.adapter = async () => ({ ...hit.response, config })
      }
    } else {
      // Mutations invalidate everything — correctness beats cleverness here.
      getCache.clear()
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
client.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    if (response.config.method === 'get' && response.status === 200) {
      getCache.set(cacheKey(response.config), { at: Date.now(), response })
    }
    // Extract data from ApiResponse wrapper
    return response
  },
  (error: AxiosError<ApiResponse>) => {
    // Handle 401 - redirect to login
    if (error.response?.status === 401) {
      getCache.clear()
      if (typeof window !== 'undefined') {
        localStorage.removeItem('ivy_token')
        localStorage.removeItem('ivy_user')
        window.location.href = '/login'
      }
    }

    // Extract error message
    const message = error.response?.data?.error?.message || error.message || 'Something went wrong'

    return Promise.reject(new Error(message))
  }
)

export default client
