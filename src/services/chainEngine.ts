import type { ApiSettings, Scene, NarrativeMode, ChatMessage, BridgeState } from '../types'
import { BS2_BEATS, BURST_BEATS, MOOD_BEATS } from '../data/bs2beats'
import { streamGenerate, generate } from './api'
import {
  buildChainSplitPrompt, buildFaithfulSplitPrompt,
  buildSceneSystemPrompt, buildSceneUserPrompt,
} from '../prompts/chain'

// 根据叙事模式获取节拍列表
const getBeatsByMode = (mode: NarrativeMode) => {
  if (mode === 'burst') return BURST_BEATS
  if (mode === 'mood') return MOOD_BEATS
  if (mode === 'mini') return BS2_BEATS.filter(b => b.modes.includes('mini'))
  // full or plain
  return BS2_BEATS.filter(b => b.modes.includes('full'))
}

// 根据时长计算模式（对齐V5.1的at()函数）
export const calcNarrativeMode = (durationSeconds: number): 'burst' | 'mini' | 'full' => {
  if (durationSeconds < 25) return 'burst'
  if (durationSeconds < 85) return 'mini'
  return 'full'
}

// 计算各场次时长分配
export const calcSceneDurations = (totalSeconds: number, beats: typeof BS2_BEATS): number[] => {
  const totalPct = beats.reduce((sum, b, i) => {
    const nextPct = i < beats.length - 1 ? beats[i + 1].pct : 100
    return sum + (nextPct - b.pct)
  }, 0)
  return beats.map((b, i) => {
    const nextPct = i < beats.length - 1 ? beats[i + 1].pct : 100
    const dur = Math.round(((nextPct - b.pct) / Math.max(totalPct, 1)) * totalSeconds)
    return Math.max(2, dur)
  })
}

// 简单镜数计算
const calcShotRange = (durationSeconds: number): { min: number; max: number } => {
  const dur = Math.max(5, Math.min(300, durationSeconds))
  if (dur < 10) return { min: 1, max: 2 }
  if (dur < 20) return { min: 1, max: Math.ceil(dur / 5) }
  const min = Math.max(1, Math.floor(dur / 15))
  const max = Math.max(min, Math.ceil(dur / 5))
  return { min, max: Math.min(max, min * 3) }
}

// AI剧本切分（STC模式）
export const splitScript = async (
  plot: string,
  mode: NarrativeMode,
  settings: ApiSettings,
  isSTC: boolean,
  directorCategory?: string,
  signal?: AbortSignal
): Promise<Record<number, string>> => {
  const beats = getBeatsByMode(mode)
  const totalDuration = 120 // default, will be overridden by caller

  const scenesJson = beats.map((b, i) =>
    `{"id":${i + 1},"beatName":"${b.nameZh}","task":"${b.task.slice(0, 60)}","estimatedDuration":${Math.max(2, Math.round(totalDuration / beats.length))}}`
  ).join(',\n')

  let prompt: string
  if (!isSTC) {
    prompt = buildFaithfulSplitPrompt(plot, beats.length, scenesJson)
  } else {
    const modeLabels: Record<string, string> = {
      burst: `极简短片（${beats.length}节拍）——瞬时爆发模式`,
      mini: `迷你故事（${beats.length}节拍）——迷你弧线模式`,
      full: `完整长片（${beats.length}节拍）——标准BS2节拍模式`,
      mood: `氛围意境片（${directorCategory ?? ''}风格，4情绪阶段）——情绪阶段模式`,
    }
    prompt = buildChainSplitPrompt({
      plot,
      narrativeMode: mode,
      modeLabel: modeLabels[mode] ?? `${mode}模式`,
      sceneCount: beats.length,
      scenesJson,
      isShort: plot.length < beats.length * 12,
      directorCategory,
    })
  }

  try {
    const result = await generate(
      [{ role: 'user', content: prompt }],
      settings,
      signal
    )
    const json = result.replace(/```json\n?|```/g, '').trim()
    const parsed = JSON.parse(json)
    const map: Record<number, string> = {}
    const scenes = parsed.scenes ?? parsed
    if (Array.isArray(scenes)) {
      for (const item of scenes) {
        if (item.id != null && item.contentSummary) {
          map[Number(item.id)] = item.contentSummary
        }
      }
    }
    return map
  } catch {
    return {}
  }
}

// 构建初始场次列表
export const buildInitialScenes = (
  mode: NarrativeMode,
  totalSeconds: number,
  splitMap: Record<number, string>
): Scene[] => {
  const beats = getBeatsByMode(mode)
  const durations = calcSceneDurations(totalSeconds, beats)

  return beats.map((beat, i) => ({
    id: i + 1,
    title: beat.nameZh,
    beatKey: beat.key,
    beatName: beat.nameZh,
    beatTask: beat.task,
    beatColorClass: beat.colorClass,
    narrativeMode: mode,
    estimatedDuration: durations[i] || Math.max(2, Math.round(totalSeconds / beats.length)),
    contentSummary: splitMap[i + 1] ?? beat.task,
  }))
}

// 从场次内容中提取视觉桥梁（via API）
export const extractBridgeViaAPI = async (
  sceneContent: string,
  settings: ApiSettings,
  signal?: AbortSignal
): Promise<BridgeState | null> => {
  try {
    const prompt = `请从以下分镜内容中提取【最后一镜的视觉终点状态】。
只输出纯JSON：{"charPosition":"...","lightPhase":"...","environment":"...","keyProp":"..."}

分镜内容：
${sceneContent}`
    const result = await generate(
      [{ role: 'user', content: prompt }],
      settings,
      signal
    )
    const json = result.replace(/```json\n?|```/g, '').trim()
    const n = json.indexOf('{'), e = json.lastIndexOf('}')
    if (n === -1 || e === -1) return null
    return JSON.parse(json.slice(n, e + 1)) as BridgeState
  } catch {
    return null
  }
}

// 简单提取（不调用API）
export const extractBridge = (sceneContent: string): BridgeState | null => {
  const lines = sceneContent.split('\n').filter(l => l.includes('|'))
  if (lines.length < 3) return null
  const lastDataLine = lines[lines.length - 1]
  const cells = lastDataLine.split('|').filter(Boolean).map(c => c.trim())
  if (cells.length < 5) return null
  return {
    charPosition: cells[3] || '',
    lightPhase: cells[4] || '',
    environment: cells[2] || '',
    keyProp: '',
  }
}

// 生成单个场次
export const generateScene = async (params: {
  scene: Scene
  sceneIndex: number
  totalScenes: number
  settings: ApiSettings
  systemContext: {
    directorBlock: string
    assetInfo: string
    assetCallRule: string
    tagHint: string
    nameMappingInstruction: string
    selectedStyleDesc: string
    enableBGM: boolean
    enableSubtitle: boolean
    hasAnyTagAsset: boolean
    aspectRatio?: string
    quality?: string
  }
  isSTC: boolean
  isFaithfulMode: boolean
  chatHistory: ChatMessage[]
  bridgeState: BridgeState | null
  globalOffset: number
  customShotCount?: number
  onToken: (token: string) => void
  signal?: AbortSignal
}): Promise<{ content: string; chatHistory: ChatMessage[]; bridgeState: BridgeState | null }> => {
  const {
    scene, sceneIndex, totalScenes, settings, systemContext, isSTC, isFaithfulMode,
    chatHistory, bridgeState, globalOffset, customShotCount, onToken, signal,
  } = params

  const isMoodMode = scene.narrativeMode === 'mood'
  const { min: shotMin, max: shotMax } = customShotCount
    ? { min: customShotCount, max: customShotCount }
    : calcShotRange(scene.estimatedDuration)

  const shotCountInstruction = customShotCount
    ? `\n【绝对指令 — 镜数锁定】：你必须且只能生成恰好 ${customShotCount} 个分镜。`
    : ''

  const bridgeInstruction = bridgeState
    ? `\n【视觉衔接约束（承接上一场次的视觉终点，第一镜必须从此状态开始）】：
${JSON.stringify(bridgeState, null, 2)}`
    : ''

  const systemPrompt = buildSceneSystemPrompt({
    ...systemContext,
    aspectRatio: systemContext.aspectRatio ?? '--ar 16:9',
    quality: systemContext.quality ?? 'cinematic, 8K UHD',
    isSTC: isSTC || isMoodMode,
    isMoodMode,
    sceneId: scene.id,
    totalScenes,
    globalOffset,
    estimatedDuration: scene.estimatedDuration,
    beatTask: scene.beatTask,
    shotMin,
    shotMax,
    shotCountInstruction,
    bridgeInstruction,
  })

  // 添加保真直通模式修饰
  const faithfulBlock = isFaithfulMode
    ? `\n\n🔒【保真直通模式（最高优先级指令）】：
- 当前剧本为导演终稿，严禁增删任何情节、人物或台词
- 你的唯一任务是将本场次剧本内容 1:1 视觉化
- 禁止调用任何扩写/润色/戏剧节拍重构逻辑
${systemContext.hasAnyTagAsset ? '- 已开启@标签模式的素材类别，标签必须优先于任何外貌描写' : '- 禁止在提示词中出现任何@人物/@图片/@道具标签'}`
    : ''

  const finalSystemPrompt = systemPrompt + faithfulBlock

  const contentSummary = scene.contentSummary || scene.beatTask

  const messages: ChatMessage[] = [
    { role: 'system', content: finalSystemPrompt },
    ...chatHistory,
    { role: 'user', content: `【本场次剧本（唯一依据，不得超出此范围）】\n${contentSummary}` },
  ]

  const content = await streamGenerate(messages, settings, onToken, signal)

  // 提取视觉桥梁（简单方式，不调用API）
  const newBridge = extractBridge(content)

  const newHistory: ChatMessage[] = [
    ...chatHistory,
    { role: 'user', content: buildSceneUserPrompt({
      beatName: scene.beatName, beatTask: scene.beatTask,
      contentSummary, narrativeMode: scene.narrativeMode,
      estimatedDuration: scene.estimatedDuration, bridgeContext: '',
      chatHistory: '', sceneIndex, totalScenes,
    }) },
    { role: 'assistant', content },
  ]

  // 只保留最近6条消息
  const trimmedHistory = newHistory.length > 6
    ? newHistory.slice(newHistory.length - 6)
    : newHistory

  return { content, chatHistory: trimmedHistory, bridgeState: newBridge }
}
