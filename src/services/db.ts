// IndexedDB 封装
const DB_NAME = 'moonaigc_db'
const DB_VERSION = 1
const KV_STORE = 'kv_store'
const HISTORY_STORE = 'history'

let db: IDBDatabase | null = null

const openDB = (): Promise<IDBDatabase> => {
  if (db) return Promise.resolve(db)
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const database = (e.target as IDBOpenDBRequest).result
      if (!database.objectStoreNames.contains(KV_STORE)) {
        database.createObjectStore(KV_STORE, { keyPath: 'key' })
      }
      if (!database.objectStoreNames.contains(HISTORY_STORE)) {
        const store = database.createObjectStore(HISTORY_STORE, { keyPath: 'id', autoIncrement: true })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
    req.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

export const kvGet = async <T>(key: string): Promise<T | null> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(KV_STORE, 'readonly')
    const req = tx.objectStore(KV_STORE).get(key)
    req.onsuccess = () => resolve(req.result?.value ?? null)
    req.onerror = () => reject(req.error)
  })
}

export const kvSet = async (key: string, value: unknown): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(KV_STORE, 'readwrite')
    const req = tx.objectStore(KV_STORE).put({ key, value })
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export const historyAdd = async <T extends object>(record: T): Promise<number> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, 'readwrite')
    const req = tx.objectStore(HISTORY_STORE).add(record)
    req.onsuccess = () => resolve(req.result as number)
    req.onerror = () => reject(req.error)
  })
}

export const historyGetAll = async <T>(): Promise<T[]> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, 'readonly')
    const req = tx.objectStore(HISTORY_STORE).index('createdAt').getAll()
    req.onsuccess = () => resolve((req.result as T[]).reverse())
    req.onerror = () => reject(req.error)
  })
}

export const historyDelete = async (id: number): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, 'readwrite')
    const req = tx.objectStore(HISTORY_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export const historyClear = async (): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(HISTORY_STORE, 'readwrite')
    const req = tx.objectStore(HISTORY_STORE).clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
