import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../services/api'
import { discardOperation, offlineDb } from './db'
import { cacheProductCatalog, queueOperation, readCachedProducts, readSyncSnapshot, syncQueuedOperations } from './sync'
import { OfflineSyncContext, useOfflineSync } from './OfflineSyncContext'

function randomReconnectDelay() {
  return 1500 + Math.floor(Math.random() * 13500)
}

export function OfflineSyncProvider({ user, reauthenticate, children }) {
  const userId = user?._id || user?.id
  const [snapshot, setSnapshot] = useState({ operations: [], history: [], pending: 0, conflicts: 0, errors: 0, lastSyncAt: null })
  const [products, setProducts] = useState([])
  const [online, setOnline] = useState(navigator.onLine)
  const [syncing, setSyncing] = useState(false)
  const [syncError, setSyncError] = useState('')
  const [storagePersisted, setStoragePersisted] = useState(false)
  const [needsOnlineAuth, setNeedsOnlineAuth] = useState(false)
  const runRef = useRef(false)
  const refreshRef = useRef(null)
  const retryRef = useRef(null)

  const refreshSnapshot = useCallback(async () => {
    if (!userId) {
      setSnapshot({ operations: [], history: [], pending: 0, conflicts: 0, errors: 0, lastSyncAt: null })
      setProducts([])
      return
    }
    const [next, cached] = await Promise.all([readSyncSnapshot(userId), readCachedProducts(userId)])
    setSnapshot(next)
    setProducts(cached)
  }, [userId])

  const syncNow = useCallback(async (pin) => {
    if (!userId || !navigator.onLine || runRef.current) return { status: 'offline' }
    runRef.current = true
    setSyncing(true)
    setSyncError('')
    try {
      if (!sessionStorage.getItem('shop_report_token')) {
        const authenticated = await reauthenticate?.(pin)
        if (!authenticated) {
          setNeedsOnlineAuth(true)
          return { status: 'needs-auth' }
        }
      }
      setNeedsOnlineAuth(false)
      const result = await syncQueuedOperations(userId)
      if (result.status === 'retry') {
        retryRef.current = window.setTimeout(() => { syncNow() }, Math.max(1500, result.delay))
      } else if (result.status === 'error') {
        setSyncError(result.error?.response?.data?.message || result.error?.message || 'Sync failed. Your offline records are still saved.')
      } else if (result.status === 'complete') {
        const left = await offlineDb.operations.where('userId').equals(String(userId)).and((operation) => operation.status === 'pending').count()
        if (left) retryRef.current = window.setTimeout(() => { syncNow() }, 1500 + Math.floor(Math.random() * 1500))
      }
      await refreshSnapshot()
      return result
    } catch (error) {
      setSyncError(error.message || 'Sync failed. Your offline records are still saved.')
      return { status: 'error', error }
    } finally {
      runRef.current = false
      setSyncing(false)
      await refreshSnapshot()
    }
  }, [userId, reauthenticate, refreshSnapshot])

  const enqueue = useCallback(async (operation) => {
    if (!userId) throw new Error('Sign in before saving offline records.')
    const saved = await queueOperation(userId, operation)
    await refreshSnapshot()
    return saved
  }, [userId, refreshSnapshot])

  const discard = useCallback(async (operationId) => {
    await discardOperation(operationId)
    await refreshSnapshot()
  }, [refreshSnapshot])

  const retry = useCallback(async (operationId) => {
    const operation = await offlineDb.operations.get(operationId)
    if (operation) {
      operation.status = 'pending'
      operation.lastError = ''
      await offlineDb.transaction('rw', offlineDb.operations, offlineDb.salesHistory, async () => {
        await offlineDb.operations.put(operation)
        await offlineDb.salesHistory.where('operationId').equals(operation.operationId).modify({ status: 'pending' })
      })
      await refreshSnapshot()
      return syncNow()
    }
    return { status: 'missing' }
  }, [refreshSnapshot, syncNow])

  useEffect(() => {
    let alive = true
    if (!userId) return undefined
    refreshSnapshot()
    if (navigator.storage?.persist) navigator.storage.persist().then((granted) => alive && setStoragePersisted(granted)).catch(() => {})
    const token = sessionStorage.getItem('shop_report_token')
    if (token) {
      api.get('/products', { params: { status: 'ACTIVE' } })
        .then(({ data }) => cacheProductCatalog(userId, data.data || []))
        .then((rows) => alive && setProducts(rows))
        .catch(() => {})
    }
    const timer = window.setTimeout(() => syncNow(), token ? 400 + Math.floor(Math.random() * 1600) : randomReconnectDelay())
    refreshRef.current = timer
    const refreshTimer = window.setInterval(() => refreshSnapshot(), 2000)
    const queuedRetry = window.setInterval(async () => {
      if (!navigator.onLine) return
      const pending = await offlineDb.operations.where('userId').equals(String(userId)).and((operation) => operation.status === 'pending').count()
      const retry = await offlineDb.meta.get('syncRetry')
      if (pending && (!retry?.nextAttemptAt || retry.nextAttemptAt <= Date.now())) syncNow()
    }, 20000)
    return () => {
      alive = false
      window.clearTimeout(refreshRef.current)
      window.clearInterval(refreshTimer)
      window.clearInterval(queuedRetry)
    }
  }, [userId, refreshSnapshot, syncNow])

  useEffect(() => {
    const handleOnline = () => {
      setOnline(true)
      window.clearTimeout(refreshRef.current)
      refreshRef.current = window.setTimeout(() => syncNow(), randomReconnectDelay())
      if (sessionStorage.getItem('shop_report_token')) {
        api.get('/products', { params: { status: 'ACTIVE' } })
          .then(({ data }) => cacheProductCatalog(userId, data.data || []))
          .then((rows) => setProducts(rows))
          .catch(() => {})
      }
    }
    const handleOffline = () => { setOnline(false); window.clearTimeout(refreshRef.current) }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      window.clearTimeout(retryRef.current)
    }
  }, [syncNow, userId])

  const value = useMemo(() => ({
    userId, snapshot, products, online, syncing, syncError, storagePersisted, needsOnlineAuth,
    syncNow, enqueue, discard, retry, refreshSnapshot,
  }), [userId, snapshot, products, online, syncing, syncError, storagePersisted, needsOnlineAuth, syncNow, enqueue, discard, retry, refreshSnapshot])

  return <OfflineSyncContext.Provider value={value}>{children}</OfflineSyncContext.Provider>
}

export function OfflineSyncStatus({ t = (value) => value }) {
  const sync = useOfflineSync()
  const [expanded, setExpanded] = useState(false)
  const [pin, setPin] = useState('')
  if (!sync || !sync.userId) return null
  const timestamp = sync.snapshot.lastSyncAt
    ? new Date(sync.snapshot.lastSyncAt).toLocaleString()
    : t('Not synced yet')

  return <section className="offline-sync-status" aria-live="polite">
    <div className="offline-sync-summary">
      <span className={sync.online ? 'sync-connection online' : 'sync-connection offline'}>{sync.online ? t('Online') : t('Offline')}</span>
      <span>{t('Last sync')}: {timestamp}</span>
      <span>{sync.snapshot.pending} {t('pending')}</span>
      <span className={sync.snapshot.conflicts ? 'sync-conflicts' : ''}>{sync.snapshot.conflicts} {t('conflicts')}</span>
      {!sync.storagePersisted && <span title={t('The browser may clear locally stored records')}>{t('Local storage not persistent')}</span>}
      <button type="button" className="button secondary" onClick={() => sync.syncNow()} disabled={!sync.online || sync.syncing || !sync.snapshot.pending}>
        {sync.syncing ? t('Syncing…') : t('Sync now')}
      </button>
      {(sync.snapshot.pending || sync.snapshot.conflicts || sync.snapshot.errors) > 0 && <button type="button" className="sync-issues-toggle" onClick={() => setExpanded((value) => !value)}>{expanded ? t('Hide queue') : t('View queue')}</button>}
    </div>
    {sync.needsOnlineAuth && <form className="sync-reauth-form" onSubmit={(event) => { event.preventDefault(); sync.syncNow(pin).then((result) => { if (result.status !== 'needs-auth') setPin('') }) }}><label>{t('Enter your PIN to sign in and sync')}<input type="password" inputMode="numeric" maxLength="4" value={pin} onChange={(event) => setPin(event.target.value.replace(/\D/g, '').slice(0, 4))} /></label><button type="submit" className="button" disabled={pin.length !== 4 || sync.syncing}>{t('Sign in and sync')}</button></form>}
    {sync.syncError && <p className="sync-message">{sync.syncError}</p>}
    {expanded && <div className="offline-sync-issues">{sync.snapshot.operations.map((operation) => <div className="offline-sync-issue" key={operation.operationId}>
      <span><strong>{t(operation.kind === 'sale' ? 'Sale' : 'Stock import')}</strong> · {operation.status === 'pending' ? t('Waiting to sync') : operation.lastError || t('Needs attention')}</span>
      <div>{operation.status === 'error' && <button type="button" onClick={() => sync.retry(operation.operationId)}>{t('Retry')}</button>}{operation.status !== 'pending' && <button type="button" onClick={() => sync.discard(operation.operationId)}>{t('Discard')}</button>}</div>
    </div>)}</div>}
  </section>
}
