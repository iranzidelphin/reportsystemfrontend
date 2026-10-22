import axios from 'axios'

const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname)
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim()
  || (isLocalHost ? 'http://localhost:5000/api' : 'https://reportsystembackend.onrender.com/api')

const normalizedApiUrl = configuredApiUrl.replace(/\/+$/, '')
export const API_BASE_URL = normalizedApiUrl.endsWith('/api')
  ? normalizedApiUrl
  : `${normalizedApiUrl}/api`

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const method = String(config.method || 'get').toLowerCase()
  const isSyncRequest = String(config.url || '').startsWith('/sync/batch')
  const isLoginRequest = String(config.url || '').startsWith('/auth/login')
  if (method !== 'get' && localStorage.getItem('shop_report_preferences')) {
    try {
      const { mode } = JSON.parse(localStorage.getItem('shop_report_preferences'))
      if (mode === 'offline' && !isSyncRequest && !isLoginRequest) {
        return Promise.reject(Object.assign(new Error('Offline mode is read-only for this action. Sales and stock imports can still be queued.'), { code: 'OFFLINE_READ_ONLY' }))
      }
    } catch (error) {
      if (error?.code === 'OFFLINE_READ_ONLY') throw error
    }
  }
  const token = sessionStorage.getItem('shop_report_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) sessionStorage.removeItem('shop_report_token')
    return Promise.reject(error)
  },
)

export default api
