import type { GridPanelRecord, GridReferenceImageRecord, GridResultRecord } from '../types'

const API = '/api/grid-results'

export interface CreateGridResultPayload {
  projectId?: string
  episodeId?: string
  historyId?: number
  mediaFileId?: number
  layout?: string
  aspectRatio?: string
  sourceShotRefs?: string[]
  usedReferenceImages?: GridReferenceImageRecord[]
  rawModelOutput?: string
  validationPassed?: boolean
  panels?: Array<{
    panelOrder: number
    timeRange?: string
    seedancePrompt?: string
    sourceSeedancePrompts?: Array<{
      sourceShotRef: string
      prompt: string
    }>
    imagePromptText?: string
    sourceShotRefs?: string[]
  }>
}

export const createGridResult = async (payload: CreateGridResultPayload): Promise<GridResultRecord> => {
  const res = await fetch(API, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<GridResultRecord>
}

export const listGridResults = async (projectId?: string, episodeId?: string): Promise<GridResultRecord[]> => {
  const params = new URLSearchParams()
  if (projectId) params.set('projectId', projectId)
  if (episodeId) params.set('episodeId', episodeId)
  const res = await fetch(params.toString() ? `${API}?${params.toString()}` : API)
  if (!res.ok) return []
  return res.json() as Promise<GridResultRecord[]>
}

export const getGridResult = async (id: number): Promise<GridResultRecord | null> => {
  const res = await fetch(`${API}/${id}`)
  if (!res.ok) return null
  return res.json() as Promise<GridResultRecord>
}

export const updateGridResultMedia = async (id: number, mediaFileId: number): Promise<GridResultRecord> => {
  const res = await fetch(`${API}/${id}/media`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mediaFileId }),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<GridResultRecord>
}

export const deleteGridResult = async (id: number): Promise<void> => {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE' })
  if (!res.ok) throw new Error(await res.text())
}

export const normalizeGridPanels = (panels: GridPanelRecord[] | undefined): GridPanelRecord[] => {
  return (panels ?? []).map(panel => ({
    ...panel,
    sourceShotRefs: Array.isArray(panel.sourceShotRefs) ? panel.sourceShotRefs : [],
    sourceSeedancePrompts: Array.isArray(panel.sourceSeedancePrompts)
      ? panel.sourceSeedancePrompts
        .map(item => {
          if (!item || typeof item !== 'object') return null
          const record = item as Record<string, unknown>
          const sourceShotRef = String(record.sourceShotRef ?? '').trim()
          const prompt = String(record.prompt ?? '').trim()
          if (!sourceShotRef || !prompt) return null
          return { sourceShotRef, prompt }
        })
        .filter((item): item is { sourceShotRef: string; prompt: string } => item !== null)
      : [],
  }))
}

export const normalizeGridReferenceImages = (refs: GridReferenceImageRecord[] | undefined): GridReferenceImageRecord[] => {
  return (refs ?? []).map(ref => ({
    ...ref,
    sourceShotRefs: Array.isArray(ref.sourceShotRefs) ? ref.sourceShotRefs : [],
  }))
}
