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
