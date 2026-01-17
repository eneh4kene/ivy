import axios, { AxiosError, AxiosResponse } from 'axios'
import type { ApiResponse } from '../types'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'

// Create axios instance
const client = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
})

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
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor - handle errors
client.interceptors.response.use(
  (response: AxiosResponse<ApiResponse>) => {
    // Extract data from ApiResponse wrapper
    return response
  },
  (error: AxiosError<ApiResponse>) => {
    // Handle 401 - redirect to login
    if (error.response?.status === 401) {
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
