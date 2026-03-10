import { create } from 'zustand'
import type { Materials, AssetType, AssetTagMode, AssetMapEntry } from '../types'
import { kvGet, kvSet } from '../services/db'

const SLOT_COUNT = 10

const emptySlots = () => Array.from({ length: SLOT_COUNT }, () => ({ name: '', desc: '', file: null, url: null }))

interface MaterialState {
  materials: Materials
  tagMode: AssetTagMode
  setSlot: (type: AssetType, index: number, data: Partial<Materials['character'][0]>) => void
  clearSlot: (type: AssetType, index: number) => void
  setTagMode: (type: AssetType, val: boolean) => void
  bulkFill: (type: AssetType, items: { name: string; desc: string }[]) => void
  load: () => Promise<void>
  persist: () => Promise<void>
  buildAssetMap: () => AssetMapEntry[]
  buildSystemPromptInfo: () => { assetLibraryInfo: string; assetCallRule: string; subjectTagHint: string; nameMappingInstruction: string; hasAnyTagAsset: boolean }
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  materials: {
    character: emptySlots(),
    image: emptySlots(),
    props: emptySlots(),
    video: [],
    audio: [],
  },
  tagMode: { character: false, image: false, props: false },

  setSlot: (type, index, data) => {
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      arr[index] = { ...arr[index], ...data }
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  clearSlot: (type, index) => {
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      arr[index] = { name: '', desc: '', file: null, url: null }
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  setTagMode: (type, val) => {
    set(state => ({ tagMode: { ...state.tagMode, [type]: val } }))
    get().persist()
  },

  bulkFill: (type, items) => {
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      items.slice(0, SLOT_COUNT).forEach((item, i) => {
        if (item.name || item.desc) {
          arr[i] = { ...arr[i], name: item.name, desc: item.desc }
        }
      })
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  load: async () => {
    try {
      const saved = await kvGet<{ materials?: Materials; tagMode?: AssetTagMode }>('materials')
      if (saved?.materials) {
        set({ materials: saved.materials, tagMode: saved.tagMode ?? { character: false, image: false, props: false } })
      }
    } catch {
      // ignore
    }
  },

  persist: async () => {
    const { materials, tagMode } = get()
    // Serialize without File objects
    const serializeable = {
      character: materials.character.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url })),
      image: materials.image.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url })),
      props: materials.props.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url })),
      video: materials.video,
      audio: materials.audio,
    }
    await kvSet('materials', { materials: serializeable, tagMode })
  },

  buildAssetMap: () => {
    const { materials, tagMode } = get()
    const entries: AssetMapEntry[] = []
    const types: AssetType[] = ['character', 'image', 'props']
    for (const type of types) {
      if (!tagMode[type]) continue
      for (const slot of materials[type]) {
        if (slot.name) {
          entries.push({ tag: slot.name, desc: slot.desc, type })
        }
      }
    }
    return entries
  },

  buildSystemPromptInfo: () => {
    const { materials, tagMode } = get()
    const hasChar = tagMode.character && materials.character.some(m => m.name)
    const hasImg = tagMode.image && materials.image.some(m => m.name)
    const hasProps = tagMode.props && materials.props.some(m => m.name)
    const hasAnyTagAsset = hasChar || hasImg || hasProps

    if (!hasAnyTagAsset) {
      return { assetLibraryInfo: '', assetCallRule: '', subjectTagHint: '', nameMappingInstruction: '', hasAnyTagAsset: false }
    }

    const lines: string[] = []
    if (hasChar) {
      lines.push('### 角色资产')
      materials.character.filter(m => m.name).forEach(m => {
        lines.push(`- @${m.name}：${m.desc || '（无描述）'}`)
      })
    }
    if (hasImg) {
      lines.push('### 场景资产')
      materials.image.filter(m => m.name).forEach(m => {
        lines.push(`- @${m.name}：${m.desc || '（无描述）'}`)
      })
    }
    if (hasProps) {
      lines.push('### 道具资产')
      materials.props.filter(m => m.name).forEach(m => {
        lines.push(`- @${m.name}：${m.desc || '（无描述）'}`)
      })
    }

    const assetCallRule = `在AI提示词中，当需要引用资产库中的素材时，使用@标签格式：@[标签名]
例如：A cinematic shot of @韩立 standing in @灵脉山谷, holding @飞剑
注意：
1. @标签必须与资产库中的名称完全一致
2. @标签放在提示词的主体位置
3. 如果场景中不需要某个资产，不要强行引用`

    const subjectTagHint = hasChar
      ? `当描述角色时，使用对应的@标签来标识，例如：@${materials.character.find(m => m.name)?.name ?? '角色名'}`
      : ''

    const nameMappingInstruction = hasChar
      ? materials.character.filter(m => m.name).map(m => `"${m.name}" → @${m.name}`).join('、') + '（人物姓名统一转换为对应的@标签）'
      : ''

    return {
      assetLibraryInfo: lines.join('\n'),
      assetCallRule,
      subjectTagHint,
      nameMappingInstruction,
      hasAnyTagAsset,
    }
  },
}))
