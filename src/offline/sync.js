import api from '../services/api'
import { applyOperationResult, enqueueOperation, getCachedProducts, localSyncSnapshot, offlineDb, rememberProducts } from './db'

export const SYNC_BATCH_SIZE = 30
const MAX_BATCHES_PER_RUN = 5
const MAX_BACKOFF_MS = 5 * 60 * 1000
const LOCK_MS = 2 * 60 * 1000
const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds))

async function deviceId() {
  return offlineDb.transaction('rw', offlineDb.meta, async () => {
    let row = await offlineDb.meta.get('deviceId')
    if (!row) {
      row = { key: 'deviceId', value: crypto.randomUUID() }
      await offlineDb.meta.put(row)
    }
    return row.value
  })
}

async function acquireLock(owner) {
  return offlineDb.transaction('rw', offlineDb.meta, async () => {
    const current = await offlineDb.meta.get('syncLock')
    if (current && current.expiresAt > Date.now()) return false
    await offlineDb.meta.put({ key: 'syncLock', owner, expiresAt: Date.now() + LOCK_MS })
    return true
  })
}

async function renewLock(owner) {
  await offlineDb.transaction('rw', offlineDb.meta, async () => {
    const current = await offlineDb.meta.get('syncLock')
    if (current?.owner === owner) await offlineDb.meta.put({ ...current, expiresAt: Date.now() + LOCK_MS })
  })
}

async function releaseLock(owner) {
  await offlineDb.transaction('rw', offlineDb.meta, async () => {
    const current = await offlineDb.meta.get('syncLock')
    if (current?.owner === owner) await offlineDb.meta.delete('syncLock')
  })
}

function retryDelay(failures) {
  const ceiling = Math.min(MAX_BACKOFF_MS, 2000 * (2 ** Math.min(failures, 8)))
  return Math.floor(Math.random() * ceiling)
}

export async function queueOperation(userId, operation) {
  return enqueueOperation(userId, {
    ...operation,
    operationId: operation.operationId || crypto.randomUUID(),
    deviceId: await deviceId(),
  })
}

export async function cacheProductCatalog(userId, products) {
  return rememberProducts(userId, products)
}

export async function readCachedProducts(userId) {
  return getCachedProducts(userId)
}

export async function readSyncSnapshot(userId) {
  return localSyncSnapshot(userId)
}

export async function syncQueuedOperations(userId) {
  if (!navigator.onLine || !sessionStorage.getItem('shop_report_token')) return { status: 'offline' }
  const retryState = await offlineDb.meta.get('syncRetry')
  if (retryState?.nextAttemptAt > Date.now()) return { status: 'retry', delay: retryState.nextAttemptAt - Date.now() }
  const owner = crypto.randomUUID()
  if (!await acquireLock(owner)) return { status: 'locked' }
  const heartbeat = window.setInterval(() => renewLock(owner), 30000)

  let sentBatches = 0
  try {
    const device = await deviceId()
    while (sentBatches < MAX_BATCHES_PER_RUN) {
      const operations = (await offlineDb.operations
        .where('userId').equals(String(userId))
        .and((operation) => operation.status === 'pending')
        .sortBy('createdAt')).slice(0, SYNC_BATCH_SIZE)
      if (!operations.length) break

      let response
      try {
        ;({ data: response } = await api.post('/sync/batch', { deviceId: device, operations: operations.map(({ userId: _userId, status: _status, createdAt: _createdAt, retryCount: _retryCount, lastError: _lastError, ...operation }) => operation) }))
      } catch (error) {
        if (error.response?.status === 429 || !error.response || error.response.status >= 500) {
          const state = await offlineDb.meta.get('syncRetry')
          const failures = Number(state?.failures || 0) + 1
          const delay = retryDelay(failures)
          await offlineDb.meta.put({ key: 'syncRetry', failures, nextAttemptAt: Date.now() + delay })
          return { status: 'retry', delay, error }
        }
        return { status: 'error', error }
      }

      const results = Array.isArray(response?.data) ? response.data : []
      const byId = new Map(results.map((result) => [result.operationId, result]))
      for (const operation of operations) {
        const result = byId.get(operation.operationId)
        if (result) await applyOperationResult(userId, operation, result)
        else await applyOperationResult(userId, operation, { status: 'error', retryable: true, message: 'The server omitted this operation result. It will be retried safely.' })
      }

      if (results.some((result) => result.retryable)) {
        const state = await offlineDb.meta.get('syncRetry')
        const failures = Number(state?.failures || 0) + 1
        const delay = retryDelay(failures)
        await offlineDb.meta.put({ key: 'syncRetry', failures, nextAttemptAt: Date.now() + delay })
        return { status: 'retry', delay }
      }

      await offlineDb.meta.put({ key: 'lastSuccessfulSync', value: new Date().toISOString() })
      await offlineDb.meta.delete('syncRetry')
      await renewLock(owner)
      sentBatches += 1
      if (operations.length < SYNC_BATCH_SIZE) break
      await wait(350 + Math.floor(Math.random() * 350))
    }
    return { status: 'complete', batches: sentBatches }
  } finally {
    window.clearInterval(heartbeat)
    await releaseLock(owner)
  }
}

