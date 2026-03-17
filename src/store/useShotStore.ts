import { create } from 'zustand'
import type { ShotData } from '../types'
import { parseTableRows } from '../utils/parseTable'

interface ShotImageInfo {
  url: string
  prompt: string
  mediaFileId?: number
}

interface ShotStoreState {
  shots: ShotData[]
  shotImages: Record<number, ShotImageInfo>
  // rowIndex -> shotId (DB id)
  shotIds: Record<number, number>
  // 持久化每个镜头的已编辑提示词（AI精炼或手动修改后），切页面不丢失
  editedPrompts: Record<number, string>
  parseFromMarkdown: (md: string) => ShotData[]
  loadShotsFromDB: (historyId: number) => Promise<void>
  saveShotsToDB: (historyId: number, shots: ShotData[]) => Promise<void>
  setShotImage: (rowIndex: number, info: ShotImageInfo) => void
  clearShotImage: (rowIndex: number) => void
  setEditedPrompt: (rowIndex: number, prompt: string) => void
  clearEditedPrompts: () => void
}

function mapRowToShot(headers: string[], row: string[]): ShotData {
  const get = (key: string) => {
    const i = headers.findIndex(h => h.includes(key))
    return i >= 0 ? (row[i] ?? '') : ''
  }
  return {
    time: get('时间'),
    shotType: get('景别'),
    camera: get('运镜'),
    scene: get('画面'),
    lighting: get('光影'),
    drama: get('戏剧'),
    prompt: row[row.length - 1] ?? '',
  }
}

export const useShotStore = create<ShotStoreState>((set) => ({
  shots: [],
  shotImages: {},
  shotIds: {},
  editedPrompts: {},

  parseFromMarkdown: (md) => {
    const { headers, rows } = parseTableRows(md)
    const shots = rows.map(row => mapRowToShot(headers, row))
    set({ shots })
    return shots
  },

  loadShotsFromDB: async (historyId) => {
    try {
      const resp = await fetch(`/api/shots?historyId=${historyId}`)
      if (resp.ok) {
        const raw = await resp.json() as Array<Record<string, unknown>>
        const shots: ShotData[] = raw.map(s => ({
          time: s.timeRange as string ?? '',
          shotType: s.shotType as string ?? '',
          camera: s.camera as string ?? '',
          scene: s.scene as string ?? '',
          lighting: s.lighting as string ?? '',
          drama: s.drama as string ?? '',
          prompt: s.prompt as string ?? '',
        }))
        // 构建 shotIds (rowIndex -> DB id) 和 shotImages (从 imageFile 恢复)
        const shotIds: Record<number, number> = {}
        const shotImages: Record<number, ShotImageInfo> = {}
        raw.forEach((s, idx) => {
          if (typeof s.id === 'number') shotIds[idx] = s.id
          const imgFile = s.imageFile as Record<string, unknown> | null | undefined
          if (imgFile && imgFile.id) {
            shotImages[idx] = {
              url: `/api/media/${imgFile.id}/file`,
              prompt: s.prompt as string ?? '',
              mediaFileId: imgFile.id as number,
            }
          }
        })
        set({ shots, shotIds, shotImages })
      }
    } catch {
      // ignore
    }
  },

  saveShotsToDB: async (historyId, shots) => {
    try {
      await fetch('/api/shots/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ historyId, shots }),
      })
    } catch {
      // ignore
    }
  },

  setShotImage: (rowIndex, info) => {
    set(state => ({ shotImages: { ...state.shotImages, [rowIndex]: info } }))
  },

  clearShotImage: (rowIndex) => {
    set(state => {
      const next = { ...state.shotImages }
      delete next[rowIndex]
      return { shotImages: next }
    })
  },

  setEditedPrompt: (rowIndex, prompt) => {
    set(state => ({ editedPrompts: { ...state.editedPrompts, [rowIndex]: prompt } }))
  },

  clearEditedPrompts: () => {
    set({ editedPrompts: {} })
  },
}))
