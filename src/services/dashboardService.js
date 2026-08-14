import api from './api'

export const dashboardService = {
  getSummary: (fromDate, toDate) => api.get('/dashboard/summary', { params: { fromDate, toDate } }),
  getTransactions: (fromDate, toDate) => api.get('/transactions', { params: { fromDate, toDate, limit: 5 } }),
}
