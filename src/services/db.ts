import type { Project, Episode } from '../types'

// IndexedDB 封装
const DB_NAME = 'moonaigc_db'
const DB_VERSION = 2
const KV_STORE = 'kv_store'
const HISTORY_STORE = 'history'
const PROJECTS_STORE = 'projects'
const EPISODES_STORE = 'episodes'

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
      if (!database.objectStoreNames.contains(PROJECTS_STORE)) {
        const store = database.createObjectStore(PROJECTS_STORE, { keyPath: 'id' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
      if (!database.objectStoreNames.contains(EPISODES_STORE)) {
        const store = database.createObjectStore(EPISODES_STORE, { keyPath: 'id' })
        store.createIndex('projectId', 'projectId', { unique: false })
        store.createIndex('projectId_episodeNumber', ['projectId', 'episodeNumber'], { unique: false })
      }
    }
    req.onsuccess = (e) => {
      db = (e.target as IDBOpenDBRequest).result
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
}

// ===== KV Store =====

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

export const kvDelete = async (key: string): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(KV_STORE, 'readwrite')
    const req = tx.objectStore(KV_STORE).delete(key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ===== History Store =====

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

// ===== Projects Store =====

export const projectAdd = async (p: Project): Promise<string> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite')
    const req = tx.objectStore(PROJECTS_STORE).put(p)
    req.onsuccess = () => resolve(p.id)
    req.onerror = () => reject(req.error)
  })
}

export const projectUpdate = async (id: string, data: Partial<Project>): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite')
    const store = tx.objectStore(PROJECTS_STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const current = getReq.result as Project | undefined
      if (!current) { reject(new Error('Project not found')); return }
      const putReq = store.put({ ...current, ...data, id, updatedAt: Date.now() })
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export const projectGetAll = async (): Promise<Project[]> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readonly')
    const req = tx.objectStore(PROJECTS_STORE).index('createdAt').getAll()
    req.onsuccess = () => resolve((req.result as Project[]).reverse())
    req.onerror = () => reject(req.error)
  })
}

export const projectDelete = async (id: string): Promise<void> => {
  const database = await openDB()
  // 级联删除：1. 删除项目下所有剧集  2. 删除项目素材数据  3. 删除项目本身
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readwrite')
    const index = tx.objectStore(EPISODES_STORE).index('projectId')
    const req = index.getAllKeys(id)
    req.onsuccess = () => {
      const keys = req.result as string[]
      let pending = keys.length
      if (pending === 0) { resolve(); return }
      for (const key of keys) {
        const delReq = tx.objectStore(EPISODES_STORE).delete(key)
        delReq.onsuccess = () => { pending--; if (pending === 0) resolve() }
        delReq.onerror = () => reject(delReq.error)
      }
    }
    req.onerror = () => reject(req.error)
  })
  await kvDelete(`materials_project_${id}`)
  return new Promise((resolve, reject) => {
    const tx = database.transaction(PROJECTS_STORE, 'readwrite')
    const req = tx.objectStore(PROJECTS_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

// ===== Episodes Store =====

export const episodeAdd = async (ep: Episode): Promise<string> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readwrite')
    const req = tx.objectStore(EPISODES_STORE).put(ep)
    req.onsuccess = () => resolve(ep.id)
    req.onerror = () => reject(req.error)
  })
}

export const episodeBatchAdd = async (eps: Episode[]): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readwrite')
    const store = tx.objectStore(EPISODES_STORE)
    let pending = eps.length
    if (pending === 0) { resolve(); return }
    for (const ep of eps) {
      const req = store.put(ep)
      req.onsuccess = () => { pending--; if (pending === 0) resolve() }
      req.onerror = () => reject(req.error)
    }
  })
}

export const episodeUpdate = async (id: string, data: Partial<Episode>): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readwrite')
    const store = tx.objectStore(EPISODES_STORE)
    const getReq = store.get(id)
    getReq.onsuccess = () => {
      const current = getReq.result as Episode | undefined
      if (!current) { reject(new Error('Episode not found')); return }
      const putReq = store.put({ ...current, ...data, id })
      putReq.onsuccess = () => resolve()
      putReq.onerror = () => reject(putReq.error)
    }
    getReq.onerror = () => reject(getReq.error)
  })
}

export const episodesByProject = async (projectId: string): Promise<Episode[]> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readonly')
    const req = tx.objectStore(EPISODES_STORE).index('projectId').getAll(projectId)
    req.onsuccess = () => {
      const episodes = (req.result as Episode[]).sort((a, b) => a.episodeNumber - b.episodeNumber)
      resolve(episodes)
    }
    req.onerror = () => reject(req.error)
  })
}

export const episodeDelete = async (id: string): Promise<void> => {
  const database = await openDB()
  return new Promise((resolve, reject) => {
    const tx = database.transaction(EPISODES_STORE, 'readwrite')
    const req = tx.objectStore(EPISODES_STORE).delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
