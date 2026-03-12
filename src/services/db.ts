import type { Project, Episode } from '../types'

const API = '/api'

// ===== Settings =====

export const settingsGet = async <T>(): Promise<T | null> => {
  const res = await fetch(`${API}/settings`)
  if (!res.ok) return null
  return res.json() as Promise<T>
}

export const settingsSave = async (data: unknown): Promise<void> => {
  await fetch(`${API}/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

// ===== Materials =====

export const materialsGet = async <T>(projectId?: string | null): Promise<T | null> => {
  const url = projectId ? `${API}/materials?projectId=${projectId}` : `${API}/materials`
  const res = await fetch(url)
  if (!res.ok) return null
  return res.json() as Promise<T>
}

export const materialsSave = async (projectId: string | null, data: unknown): Promise<void> => {
  await fetch(`${API}/materials`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ projectId, data }),
  })
}

// ===== History =====

export const historyAdd = async <T extends object>(record: T): Promise<number> => {
  const res = await fetch(`${API}/history`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(record),
  })
  const json = await res.json() as { id: number }
  return json.id
}

export const historyGetAll = async <T>(): Promise<T[]> => {
  const res = await fetch(`${API}/history`)
  if (!res.ok) return []
  return res.json() as Promise<T[]>
}

export const historyDelete = async (id: number): Promise<void> => {
  await fetch(`${API}/history/${id}`, { method: 'DELETE' })
}

export const historyClear = async (): Promise<void> => {
  await fetch(`${API}/history`, { method: 'DELETE' })
}

// ===== Projects =====

export const projectAdd = async (p: Project): Promise<string> => {
  await fetch(`${API}/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(p),
  })
  return p.id
}

export const projectUpdate = async (id: string, data: Partial<Project>): Promise<void> => {
  await fetch(`${API}/projects/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export const projectGetAll = async (): Promise<Project[]> => {
  const res = await fetch(`${API}/projects`)
  if (!res.ok) return []
  return res.json() as Promise<Project[]>
}

export const projectDelete = async (id: string): Promise<void> => {
  await fetch(`${API}/projects/${id}`, { method: 'DELETE' })
  // Backend Prisma cascade handles episodes + materials deletion
}

// ===== Episodes =====

export const episodeAdd = async (ep: Episode): Promise<string> => {
  await fetch(`${API}/projects/${ep.projectId}/episodes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(ep),
  })
  return ep.id
}

export const episodeBatchAdd = async (eps: Episode[]): Promise<void> => {
  if (eps.length === 0) return
  const projectId = eps[0].projectId
  await fetch(`${API}/projects/${projectId}/episodes`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(eps),
  })
}

export const episodeUpdate = async (id: string, data: Partial<Episode>): Promise<void> => {
  await fetch(`${API}/episodes/${id}`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(data),
  })
}

export const episodesByProject = async (projectId: string): Promise<Episode[]> => {
  const res = await fetch(`${API}/projects/${projectId}/episodes`)
  if (!res.ok) return []
  return res.json() as Promise<Episode[]>
}

export const episodeDelete = async (id: string): Promise<void> => {
  await fetch(`${API}/episodes/${id}`, { method: 'DELETE' })
}
