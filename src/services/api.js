import axios from 'axios'

const configuredApiUrl = import.meta.env.VITE_API_URL
  || (window.location.hostname === 'localhost' ? 'http://localhost:5000/api' : 'https://reportsystembackend.onrender.com/api')

export const API_BASE_URL = configuredApiUrl.replace(/\/+$/, '').endsWith('/api')
  ? configuredApiUrl.replace(/\/+$/, '')
  : `${configuredApiUrl.replace(/\/+$/, '')}/api`

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
