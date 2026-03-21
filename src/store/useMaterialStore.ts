import { create } from 'zustand'
import type { Materials, AssetType, AssetTagMode, AssetMapEntry } from '../types'
import { materialsGet, materialsSave } from '../services/db'

const SLOT_COUNT = 10

const emptySlots = () => Array.from({ length: SLOT_COUNT }, () => ({ name: '', desc: '', file: null, url: null, imageFileId: undefined as number | undefined, imageUrl: undefined as string | undefined }))

export const DEFAULT_TAG_MODE: AssetTagMode = { character: true, image: true, props: true }

export const createEmptyMaterials = (): Materials => ({
  character: emptySlots(),
  image: emptySlots(),
  props: emptySlots(),
  video: [],
  audio: [],
})

interface MaterialState {
  materials: Materials
  tagMode: AssetTagMode
  currentProjectId: string | null
  setSlot: (type: AssetType, index: number, data: Partial<Materials['character'][0]>) => void
  clearSlot: (type: AssetType, index: number) => void
  setTagMode: (type: AssetType, val: boolean) => void
  bulkFill: (type: AssetType, items: { name: string; desc: string }[]) => void
  load: () => Promise<void>
  loadForProject: (projectId?: string) => Promise<void>
  persist: () => Promise<void>
  buildAssetMap: () => AssetMapEntry[]
  buildSystemPromptInfo: () => {
    assetLibraryInfo: string
    assetCallRule: string
    subjectTagHint: string
    nameMappingInstruction: string
    hasAnyTagAsset: boolean
    continuityIronRule: string
    consistencyAnchor: string
  }
  setSlotImage: (type: AssetType, index: number, imageFileId: number, imageUrl: string) => void
  clearSlotImage: (type: AssetType, index: number) => Promise<void>
  getAssetImageForTag: (tag: string) => { imageUrl: string; imageFileId: number; name: string; type: AssetType } | null
}

export const useMaterialStore = create<MaterialState>((set, get) => ({
  materials: createEmptyMaterials(),
  tagMode: DEFAULT_TAG_MODE,
  currentProjectId: null,

  setSlot: (type, index, data) => {
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      arr[index] = { ...arr[index], ...data }
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  clearSlot: (type, index) => {
    const slot = get().materials[type][index] as Materials['character'][0]
    if (slot.imageFileId) {
      get().clearSlotImage(type, index)
    }
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
    await get().loadForProject(undefined)
  },

  loadForProject: async (projectId?: string) => {
    const pid = projectId ?? null
    set({ currentProjectId: pid })
    try {
      const saved = await materialsGet<{ materials?: Materials; tagMode?: AssetTagMode }>(pid)
      if (saved?.materials) {
        set({ materials: saved.materials, tagMode: saved.tagMode ?? DEFAULT_TAG_MODE })
      } else {
        set({
          materials: createEmptyMaterials(),
          tagMode: DEFAULT_TAG_MODE,
        })
      }
    } catch {
      // ignore
    }
  },

  persist: async () => {
    const { materials, tagMode, currentProjectId } = get()
    const serializeable = {
      character: materials.character.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url, imageFileId: m.imageFileId, imageUrl: m.imageUrl })),
      image: materials.image.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url, imageFileId: m.imageFileId, imageUrl: m.imageUrl })),
      props: materials.props.map(m => ({ name: m.name, desc: m.desc, file: null, url: m.url, imageFileId: m.imageFileId, imageUrl: m.imageUrl })),
      video: materials.video,
      audio: materials.audio,
    }
    await materialsSave(currentProjectId, { materials: serializeable, tagMode })
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

    // 文字模式：标签关闭但有描述时，生成文字模式引导块
    const hasCharDesc = !tagMode.character && materials.character.some(m => m.name)
    const hasImgDesc = !tagMode.image && materials.image.some(m => m.name)
    const hasPropsDesc = !tagMode.props && materials.props.some(m => m.name)

    const lines: string[] = []

    if (hasAnyTagAsset) {
      // 标签模式：输出完整的@标签资产库
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
    }

    // 文字模式引导块（标签关闭但有描述）
    if (hasCharDesc) {
      lines.push('\n【角色参考描述（文字模式，禁止使用@标签，直接写入提示词主体）】：')
      materials.character.filter(m => m.name).forEach(m => {
        lines.push(`  · ${m.name}：${m.desc || '（无描述）'}`)
      })
      lines.push('  ✅ 以上角色请直接将外貌描述融入 [角色分动] 字段的文字中，不要使用任何@标签。')
    }
    if (hasImgDesc) {
      lines.push('\n【场景参考描述（文字模式，禁止使用@标签，直接写入环境描述）】：')
      materials.image.filter(m => m.name).forEach(m => {
        lines.push(`  · ${m.name}：${m.desc || '（无描述）'}`)
      })
      lines.push('  ✅ 以上场景请将环境描述直接融入 [光影] 或 [环境] 字段，不要使用任何@标签。')
    }
    if (hasPropsDesc) {
      lines.push('\n【道具参考描述（文字模式，禁止使用@标签，直接写入提示词主体）】：')
      materials.props.filter(m => m.name).forEach(m => {
        lines.push(`  · ${m.name}：${m.desc || '（无描述）'}`)
      })
      lines.push('  ✅ 以上道具请将外观描述直接写入提示词，不要使用任何@标签。')
    }

    const assetLibraryInfo = lines.join('\n')

    const continuityIronRule = `【视觉流连贯性铁律（防止跳跃感）】：
  ① 动作连续性：相邻镜头角色动作/位置/朝向物理一致
  ② 环境稳定性：同场景光影/天气/背景不随意变动
  ③ 景别逻辑：遵循大远景→全景→中景→特写剪辑美学
  ④ 视轴守恒：遵守180度线原则
  ⑤ 衔接顺滑：考虑上一镜视觉残留`

    if (!hasAnyTagAsset && !hasCharDesc && !hasImgDesc && !hasPropsDesc) {
      return { assetLibraryInfo: '', assetCallRule: '', subjectTagHint: '', nameMappingInstruction: '', hasAnyTagAsset: false, continuityIronRule, consistencyAnchor: '' }
    }

    // 标签调用规则（仅标签模式需要）
    let assetCallRule = ''
    if (hasAnyTagAsset) {
      assetCallRule = `【@标签资产调用规则】：在SEEDANCE提示词中引用素材时，使用@标签格式。
📌【标签替换铁律】：
   ❌ 错误写法：角色分动：白发少女正在奔跑，黑色机能服飘动
   ✅ 正确写法：角色分动：@人物1 [黑色机能服] 正在 奔跑，衣角随风飘动
   ❌ 错误写法：细节：背景出现古铜令牌，龙纹清晰可见
   ✅ 正确写法：角色分动：(@道具1) [古铜令牌] 正在 烛光下显现正面龙纹金光 | 镜头：极近景特写
注意：
1. @标签必须与资产库中的名称完全一致，不得用文字描述替代标签
2. 如果场景中不需要某个资产，不要强行引用`
    }

    // 道具一致性铁律（道具标签模式时注入）
    if (hasProps) {
      const propSlots = materials.props.filter(m => m.name)
      assetCallRule += `\n\n🔥【道具一致性铁律（最高优先级，凌驾于所有其他规则）】：
【已注册关键道具】：
${propSlots.map(m => `  · @${m.name}（${m.desc.slice(0, 30)}${m.desc.length > 30 ? '…' : ''}）`).join('\n')}
【强制执行规则】：
  ① 凡分镜画面或台词中涉及以上任意已注册道具，【角色分动】字段必须显式包含 (@道具N) 标签及其关键视觉描述词
  ② 道具标签不得省略、合并或用文字描述替代
  ③ 道具特写镜头：【细节】字段以该道具标签开头，后接材质/光影细节
  ④ 剧本中只要出现道具名（哪怕作为背景道具），分镜必须标注
  ✅ 示例：角色分动：(@道具1) [古铜令牌] 正在 烛光下显现正面龙纹金光 | 镜头：极近景特写`
    }

    const subjectTagHint = hasChar
      ? `当描述角色时，使用对应的@标签来标识，例如：@${materials.character.find(m => m.name)?.name ?? '角色名'}`
      : ''

    // 角色映射增强：4步剧本分析前置任务
    let nameMappingInstruction = ''
    if (hasChar) {
      const charSlots = materials.character.filter(m => m.name)
      nameMappingInstruction = `【角色姓名映射规则】：
在"剧本分析"阶段，AI 必须先扫描剧本中出现的所有角色姓名，并将其与以下资产的视觉描述进行匹配：
${charSlots.map(m => `  · 若剧本角色与 "${m.desc.slice(0, 25)}${m.desc.length > 25 ? '…' : ''}" 特征吻合 → 锁定为 @${m.name}，全片不得切换为其他标签`).join('\n')}
  · 匹配后，在所有分镜的【角色分动】与【细节】字段，必须以标签形式书写该角色，禁止用文字描述外貌替代标签。
  Step 1: 扫描剧本中所有角色姓名
  Step 2: 将每个姓名与已注册资产的视觉描述逐一比对
  Step 3: 锁定唯一映射（全片不得切换）
  Step 4: 在分镜的 [角色分动] 字段必须写 (@人物X) 形式（${charSlots.map(m => `"${m.name}" → @${m.name}`).join('、')}）`
    }

    // 一致性锚点：仅标签模式下动态生成
    let consistencyAnchor = ''
    if (hasAnyTagAsset) {
      const anchorLines: string[] = ['【视觉一致性锚点（全篇严格遵守）】：']
      if (hasChar) {
        const charNames = materials.character.filter(m => m.name).map(m => `@${m.name}`)
        anchorLines.push(`  · 角色锚点：${charNames.join('、')} 的外观/服装/发型全篇保持一致，不得随意改变`)
      }
      if (hasImg) {
        const imgNames = materials.image.filter(m => m.name).map(m => `@${m.name}`)
        anchorLines.push(`  · 场景锚点：${imgNames.join('、')} 的光影/天气/背景元素全篇保持一致`)
      }
      if (hasProps) {
        const propNames = materials.props.filter(m => m.name).map(m => `@${m.name}`)
        anchorLines.push(`  · 道具锚点：${propNames.join('、')} 出现时状态/位置必须符合叙事逻辑`)
      }
      consistencyAnchor = anchorLines.join('\n')
    }

    return {
      assetLibraryInfo,
      assetCallRule,
      subjectTagHint,
      nameMappingInstruction,
      hasAnyTagAsset,
      continuityIronRule,
      consistencyAnchor,
    }
  },

  setSlotImage: (type, index, imageFileId, imageUrl) => {
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      arr[index] = { ...arr[index], imageFileId, imageUrl }
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  clearSlotImage: async (type, index) => {
    const slot = get().materials[type][index] as Materials['character'][0]
    if (slot.imageFileId) {
      try {
        await fetch(`/api/media/${slot.imageFileId}`, { method: 'DELETE' })
      } catch {
        // ignore deletion errors
      }
    }
    set(state => {
      const arr = [...state.materials[type]] as Materials['character']
      arr[index] = { ...arr[index], imageFileId: undefined, imageUrl: undefined }
      return { materials: { ...state.materials, [type]: arr } }
    })
    get().persist()
  },

  getAssetImageForTag: (tag) => {
    const { materials } = get()
    const cleanTag = tag.replace(/^@/, '')
    const types: AssetType[] = ['character', 'image', 'props']
    for (const type of types) {
      const slot = materials[type].find(m => m.name === cleanTag)
      if (slot && slot.imageUrl && slot.imageFileId) {
        return { imageUrl: slot.imageUrl, imageFileId: slot.imageFileId, name: slot.name, type }
      }
    }
    return null
  },
}))
