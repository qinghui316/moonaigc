import { create } from 'zustand'
import type { AssetType, ShotData } from '../types'
import { parseTableRows } from '../utils/parseTable'

interface ShotImageInfo {
  url: string
  prompt: string
  mediaFileId?: number
}

interface ShotMaterialRefSelection {
  name: string
  type: AssetType
  desc: string
  imageUrl: string
  imageFileId: number
}

interface ShotLocalRefSelection {
  id: string
  base64: string
  mimeType: string
  name: string
}

interface ShotStoreState {
  shots: ShotData[]
  shotImages: Record<number, ShotImageInfo>
  shotIds: Record<number, number>
  editedPrompts: Record<number, string>
  selectedMaterialRefs: Record<number, ShotMaterialRefSelection[]>
  selectedLocalRefs: Record<number, ShotLocalRefSelection[]>
  parseFromMarkdown: (md: string) => ShotData[]
  loadShotsFromDB: (historyId: number) => Promise<void>
  saveShotsToDB: (historyId: number, shots: ShotData[]) => Promise<void>
  setShotImage: (rowIndex: number, info: ShotImageInfo) => void
  clearShotImage: (rowIndex: number) => void
  setEditedPrompt: (rowIndex: number, prompt: string) => void
  setSelectedMaterialRefs: (rowIndex: number, refs: ShotMaterialRefSelection[]) => void
  setSelectedLocalRefs: (rowIndex: number, refs: ShotLocalRefSelection[]) => void
  clearEditedPrompts: () => void
  clearSelectedRefs: () => void
}

function mapRowToShot(headers: string[], row: string[]): ShotData {
  const get = (key: string) => {
    const columnIndex = headers.findIndex(header => header.includes(key))
    return columnIndex >= 0 ? (row[columnIndex] ?? '') : ''
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
  selectedMaterialRefs: {},
  selectedLocalRefs: {},

  parseFromMarkdown: (md) => {
    const { headers, rows } = parseTableRows(md)
    const shots = rows.map(row => mapRowToShot(headers, row))
    set({ shots })
    return shots
  },

  loadShotsFromDB: async (historyId) => {
    try {
      const resp = await fetch(`/api/shots?historyId=${historyId}`)
      if (!resp.ok) return

      const raw = await resp.json() as Array<Record<string, unknown>>
      const shots: ShotData[] = raw.map(item => ({
        time: item.timeRange as string ?? '',
        shotType: item.shotType as string ?? '',
        camera: item.camera as string ?? '',
        scene: item.scene as string ?? '',
        lighting: item.lighting as string ?? '',
        drama: item.drama as string ?? '',
        prompt: item.prompt as string ?? '',
      }))

      const shotIds: Record<number, number> = {}
      const shotImages: Record<number, ShotImageInfo> = {}
      const editedPrompts: Record<number, string> = {}
      raw.forEach((item, index) => {
        if (typeof item.id === 'number') shotIds[index] = item.id
        // 恢复已保存的精炼提示词
        if (typeof item.prompt === 'string' && item.prompt) {
          editedPrompts[index] = item.prompt
        }
        const imageFile = item.imageFile as Record<string, unknown> | null | undefined
        if (imageFile?.id) {
          shotImages[index] = {
            url: `/api/media/${imageFile.id}/file`,
            prompt: item.prompt as string ?? '',
            mediaFileId: imageFile.id as number,
          }
        }
      })

      set({ shots, shotIds, shotImages, editedPrompts })
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

  setSelectedMaterialRefs: (rowIndex, refs) => {
    set(state => ({ selectedMaterialRefs: { ...state.selectedMaterialRefs, [rowIndex]: refs } }))
  },

  setSelectedLocalRefs: (rowIndex, refs) => {
    set(state => ({ selectedLocalRefs: { ...state.selectedLocalRefs, [rowIndex]: refs } }))
  },

  clearEditedPrompts: () => {
    set({ editedPrompts: {} })
  },

  clearSelectedRefs: () => {
    set({ selectedMaterialRefs: {}, selectedLocalRefs: {} })
  },
}))
