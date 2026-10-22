import { createContext, useContext } from 'react'

export const OfflineSyncContext = createContext(null)
export const useOfflineSync = () => useContext(OfflineSyncContext)
