import Dexie from 'dexie'

export const SALES_HISTORY_DAYS = 90
const HISTORY_RETENTION_MS = SALES_HISTORY_DAYS * 24 * 60 * 60 * 1000

export const offlineDb = new Dexie('manageyourstock_offline')
offlineDb.version(1).stores({
  products: '&[userId+id], userId, branchId, name, sku',
  operations: '&operationId, userId, status, createdAt, [userId+status+createdAt]',
  salesHistory: '&id, userId, operationId, date, status, branchId',
  meta: '&key',
})

const bytesToBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)))
const base64ToBytes = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0))

async function pinDigest(pin, salt) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, material, 256)
}

export async function rememberOfflineAccount(user, phoneNumber, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const verifier = await pinDigest(pin, salt)
  await offlineDb.meta.put({
    key: 'offlineAccount',
    userId: String(user._id || user.id),
    user,
    phoneNumber,
    salt: bytesToBase64(salt),
    verifier: bytesToBase64(verifier),
  })
  await offlineDb.meta.put({ key: 'pinAttempts', failures: 0, lockedUntil: 0 })
}

export const getOfflineAccount = () => offlineDb.meta.get('offlineAccount')

export async function verifyOfflinePin(pin) {
  const account = await getOfflineAccount()
  if (!account || !pin) return null
  const attempts = await offlineDb.meta.get('pinAttempts')
  if (attempts?.lockedUntil > Date.now()) return null
  const result = await pinDigest(pin, base64ToBytes(account.salt))
  const candidate = new Uint8Array(result)
  const expected = base64ToBytes(account.verifier)
  let difference = candidate.length ^ expected.length
  for (let index = 0; index < Math.min(candidate.length, expected.length); index += 1) difference |= candidate[index] ^ expected[index]
  if (difference === 0) {
    await offlineDb.meta.put({ key: 'pinAttempts', failures: 0, lockedUntil: 0 })
    return account
  }
  const failures = Number(attempts?.failures || 0) + 1
  await offlineDb.meta.put({ key: 'pinAttempts', failures: failures >= 5 ? 0 : failures, lockedUntil: failures >= 5 ? Date.now() + 60 * 1000 : 0 })
  return null
}

export async function rememberProducts(userId, products) {
  const normalized = products.map((product) => ({
    ...product,
    id: String(product._id || product.id),
    userId: String(userId),
    branchId: String(product.branchId?._id || product.branchId || ''),
    cachedAt: Date.now(),
  }))
  await offlineDb.transaction('rw', offlineDb.products, async () => {
    await offlineDb.products.where('userId').equals(String(userId)).delete()
    if (normalized.length) await offlineDb.products.bulkPut(normalized)
  })
  return normalized
}

export const getCachedProducts = (userId) => offlineDb.products.where('userId').equals(String(userId)).toArray()

export async function cacheSalesHistory(userId, rows) {
  const now = Date.now()
  await offlineDb.salesHistory.bulkPut(rows.map((row) => {
    const product = row.productId && typeof row.productId === 'object' ? {
      _id: String(row.productId._id),
      name: row.productId.name,
      sku: row.productId.sku,
      category: row.productId.category,
      costPrice: row.productId.costPrice,
    } : row.productId
    return {
      id: String(row._id),
      userId: String(userId),
      transactionDate: row.transactionDate,
      saleDate: row.saleDate,
      date: new Date(row.transactionDate || row.saleDate || row.createdAt || now).toISOString(),
      customerName: row.customerName,
      productId: product,
      serviceOrProduct: row.serviceOrProduct || row.productOrService,
      quantity: row.quantity,
      unitPrice: row.unitPrice,
      unitCost: row.unitCost,
      totalAmount: row.totalAmount,
      paymentMethod: row.paymentMethod,
      status: 'synced',
    }
  }))
  await pruneSalesHistory(userId)
}

export async function enqueueOperation(userId, operation) {
  const createdAt = Date.now()
  const row = { ...operation, userId: String(userId), status: 'pending', createdAt, retryCount: 0, optimisticApplied: true }
  await offlineDb.transaction('rw', offlineDb.operations, offlineDb.salesHistory, offlineDb.products, async () => {
    await offlineDb.operations.add(row)
    if (row.kind === 'sale') {
      const items = row.payload.items || []
      for (let index = 0; index < items.length; index += 1) {
        const item = items[index]
        const product = await offlineDb.products.get([String(userId), String(item.productId)])
        if (product) {
          product.quantity = Math.max(0, Number(product.quantity || 0) - Number(item.quantity || 0))
          await offlineDb.products.put(product)
        }
        await offlineDb.salesHistory.put({
          id: `${row.operationId}:${index}`,
          userId: String(userId),
          operationId: row.operationId,
          date: new Date(row.payload.transactionDate || createdAt).toISOString(),
          customerName: row.payload.customerName,
          paymentMethod: row.payload.paymentMethod,
          productId: { _id: item.productId, name: item.productName, sku: item.sku, category: item.category, costPrice: item.unitCost },
          serviceOrProduct: item.productName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          unitCost: item.unitCost,
          totalAmount: Number(item.quantity) * Number(item.unitPrice),
          status: 'pending',
        })
      }
      await pruneSalesHistory(userId)
    } else {
      const product = await offlineDb.products.get([String(userId), String(row.payload.productId)])
      if (product) {
        product.quantity = Number(product.quantity || 0) + Number(row.payload.stockQuantity || 0)
        await offlineDb.products.put(product)
      }
    }
  })
  return row
}

export async function applyOperationResult(userId, operation, result) {
  await offlineDb.transaction('rw', offlineDb.operations, offlineDb.salesHistory, offlineDb.products, async () => {
    if (result.status === 'success') {
      await offlineDb.operations.delete(operation.operationId)
      if (operation.kind === 'sale') {
        await offlineDb.salesHistory.where('operationId').equals(operation.operationId).delete()
        const records = Array.isArray(result.data) ? result.data : [result.data]
        for (const [index, record] of records.filter(Boolean).entries()) {
          const queuedItem = operation.payload.items[index]
          await offlineDb.salesHistory.put({
            ...record,
            id: String(record._id),
            userId: String(userId),
            operationId: operation.operationId,
            productId: { _id: String(record.productId), name: queuedItem?.productName || record.serviceOrProduct, sku: queuedItem?.sku || '', category: queuedItem?.category || '', costPrice: record.unitCost },
            date: new Date(record.transactionDate || record.createdAt || Date.now()).toISOString(),
            status: 'synced',
          })
        }
        await pruneSalesHistory(userId)
      }
      for (const stock of result.currentStock || []) {
        const product = await offlineDb.products.get([String(userId), String(stock.productId)])
        if (product) {
          product.quantity = Number(stock.quantity)
          await offlineDb.products.put(product)
        }
      }
      return
    }

    if (result.status === 'conflict') {
      await reverseOptimisticStock(userId, operation)
      await applyServerStock(userId, result.currentStock)
      operation.optimisticApplied = false
      operation.status = 'conflict'
      operation.lastError = result.message || 'Stock changed on the server.'
      await offlineDb.operations.put(operation)
      await offlineDb.salesHistory.where('operationId').equals(operation.operationId).modify({ status: 'conflict' })
      return
    }

    if (!result.retryable) {
      await reverseOptimisticStock(userId, operation)
      await applyServerStock(userId, result.currentStock)
      operation.optimisticApplied = false
    }
    operation.status = result.retryable ? 'pending' : 'error'
    operation.retryCount = Number(operation.retryCount || 0) + 1
    operation.lastError = result.message || 'The server could not process this operation.'
    await offlineDb.operations.put(operation)
    if (!result.retryable && operation.kind === 'sale') await offlineDb.salesHistory.where('operationId').equals(operation.operationId).modify({ status: 'error' })
  })
}

async function reverseOptimisticStock(userId, operation) {
  if (!operation.optimisticApplied) return
  const adjustment = operation.kind === 'sale' ? 1 : -1
  const stockLines = operation.kind === 'sale'
    ? operation.payload.items
    : [{ productId: operation.payload.productId, quantity: operation.payload.stockQuantity }]
  for (const item of stockLines || []) {
    const product = await offlineDb.products.get([String(userId), String(item.productId)])
    if (product) {
      product.quantity = Math.max(0, Number(product.quantity || 0) + adjustment * Number(item.quantity || 0))
      await offlineDb.products.put(product)
    }
  }
}

async function applyServerStock(userId, stocks = []) {
  for (const stock of stocks || []) {
    const product = await offlineDb.products.get([String(userId), String(stock.productId)])
    if (product && Number.isFinite(Number(stock.quantity))) {
      product.quantity = Number(stock.quantity)
      await offlineDb.products.put(product)
    }
  }
}

export async function discardOperation(operationId) {
  await offlineDb.transaction('rw', offlineDb.operations, offlineDb.salesHistory, offlineDb.products, async () => {
    const operation = await offlineDb.operations.get(operationId)
    if (!operation) return
    const userId = String(operation.userId)
    await reverseOptimisticStock(userId, operation)
    await offlineDb.operations.delete(operationId)
    await offlineDb.salesHistory.where('operationId').equals(operationId).delete()
  })
}

export async function pruneSalesHistory(userId) {
  const cutoff = Date.now() - HISTORY_RETENTION_MS
  const entries = await offlineDb.salesHistory.where('userId').equals(String(userId)).toArray()
  const expired = entries.filter((entry) => new Date(entry.date).getTime() < cutoff)
  if (expired.length) await offlineDb.salesHistory.bulkDelete(expired.map((entry) => entry.id))
}

export async function clearPrivateData() {
  const [device, lock] = await Promise.all([offlineDb.meta.get('deviceId'), offlineDb.meta.get('syncLock')])
  await offlineDb.transaction('rw', offlineDb.products, offlineDb.operations, offlineDb.salesHistory, offlineDb.meta, async () => {
    await Promise.all([offlineDb.products.clear(), offlineDb.operations.clear(), offlineDb.salesHistory.clear(), offlineDb.meta.clear()])
    if (device) await offlineDb.meta.put(device)
    if (lock?.expiresAt > Date.now()) await offlineDb.meta.put(lock)
  })
}

export async function localSyncSnapshot(userId) {
  const retentionCheck = await offlineDb.meta.get('salesHistoryPrunedAt')
  if (!retentionCheck || Date.now() - retentionCheck.value > 24 * 60 * 60 * 1000) {
    await pruneSalesHistory(userId)
    await offlineDb.meta.put({ key: 'salesHistoryPrunedAt', value: Date.now() })
  }
  const [operations, history, lastSync] = await Promise.all([
    offlineDb.operations.where('userId').equals(String(userId)).toArray(),
    offlineDb.salesHistory.where('userId').equals(String(userId)).toArray(),
    offlineDb.meta.get('lastSuccessfulSync'),
  ])
  return {
    operations,
    history: history.sort((left, right) => new Date(right.date) - new Date(left.date)),
    pending: operations.filter((operation) => operation.status === 'pending').length,
    conflicts: operations.filter((operation) => operation.status === 'conflict').length,
    errors: operations.filter((operation) => operation.status === 'error').length,
    lastSyncAt: lastSync?.value || null,
  }
}
