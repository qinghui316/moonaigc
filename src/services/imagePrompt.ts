import type { Materials, ApiSettings } from '../types'
import { STYLE_MAP_EN, DEFAULT_STYLE_EN } from '../data/styleMap'
import { detectStyleFromText } from '../data/styleAutoMap'

type SeedanceFallback = {
  shotType?: string
  camera?: string
  scene?: string
  lighting?: string
}

const SEEDANCE_FIELDS: Array<[string, RegExp]> = [
  ['镜头', /镜头[：:]\s*(.+?)(?=\s*环境[：:]|\s*叙事目的[：:]|\s*角色分动[：:]|$)/s],
  ['环境', /环境[：:]\s*(.+?)(?=\s*叙事目的[：:]|\s*衔接[：:]|\s*角色分动[：:]|\s*细节[：:]|$)/s],
  ['叙事目的', /叙事目的[：:]\s*(.+?)(?=\s*衔接[：:]|\s*角色分动[：:]|\s*细节[：:]|$)/s],
  ['衔接', /衔接[：:]\s*(.+?)(?=\s*角色分动[：:]|\s*细节[：:]|\s*光影[：:]|$)/s],
  ['角色分动', /角色分动[：:]\s*(.+?)(?=\s*细节[：:]|\s*光影[：:]|$)/s],
  ['细节', /细节[：:]\s*(.+?)(?=\s*光影[：:]|\s*台词[：:]|$)/s],
  ['光影', /光影[：:]\s*(.+?)(?=\s*台词[：:]|\s*音效[：:]|$)/s],
  ['台词', /台词(?:[(（][^)）]*[)）])?[：:]\s*"?(.+?)"?(?=\s*音效[：:]|$)/s],
  ['音效', /音效[：:]\s*(.+?)$/s],
]

function compactText(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function clampText(text: string, max = 160): string {
  const trimmed = compactText(text)
  if (trimmed.length <= max) return trimmed
  return `${trimmed.slice(0, max).trim()}…`
}

function normalizePromptLine(text: string): string {
  return compactText(
    text
      .replace(/^[\-•]\s*/g, '')
      .replace(/^参考图\d+\s*:\s*/g, '')
      .replace(/^无参考图[:：]?\s*/g, '')
  )
}

function buildReferenceBlock(refImageDescs: string[]): string {
  if (refImageDescs.length === 0) return '无参考图'
  return refImageDescs
    .map((desc, index) => `参考图${index + 1}: [${normalizePromptLine(desc)}]`)
    .join('\n')
}

export function parseSeedanceFields(
  prompt: string,
  fallback?: SeedanceFallback
): Record<string, string> {
  const fields: Record<string, string> = {}

  for (const [key, re] of SEEDANCE_FIELDS) {
    const match = prompt.match(re)
    if (match?.[1]) fields[key] = compactText(match[1])
  }

  if (!fields['镜头'] && (fallback?.shotType || fallback?.camera)) {
    fields['镜头'] = compactText([fallback.shotType, fallback.camera].filter(Boolean).join(' '))
  }
  if (!fields['环境'] && fallback?.scene) {
    fields['环境'] = compactText(fallback.scene)
  }
  if (!fields['光影'] && fallback?.lighting) {
    fields['光影'] = compactText(fallback.lighting)
  }

  return fields
}

export function expandAtTags(text: string, materials: Materials): string {
  let result = text
  const slots = [
    ...materials.character,
    ...materials.image,
    ...materials.props,
  ]

  for (const slot of slots) {
    if (!slot.name) continue
    const escaped = slot.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    result = result.replace(new RegExp(`@${escaped}`, 'g'), slot.desc ? `[${slot.desc.slice(0, 80)}]` : slot.name)
  }

  return result
}

export function stripAtBrackets(text: string): string {
  return text
    .replace(/@(\S+)\s*\[([^\]]*)\]/g, '$2')
    .replace(/@(\S+)/g, '$1')
    .replace(/\[([^\]]*)\]/g, '$1')
}

export function cleanShootingMarks(text: string): string {
  return compactText(
    text
      .replace(/\s*\[禁BGM[^\]]*\]\s*/g, ' ')
      .replace(/\s*\[禁字幕[^\]]*\]\s*/g, ' ')
      .replace(/\s*拍摄指令[：:]\[[^\]]*\]\s*/g, ' ')
  )
}

export function buildStructuredInput(
  fields: Record<string, string>,
  styleCN: string,
  sceneDesc: string,
  materials?: Materials,
): string {
  const expand = (text: string) => {
    if (!text) return ''
    const replaced = materials ? expandAtTags(text, materials) : text
    return cleanShootingMarks(stripAtBrackets(replaced))
  }

  const parts: string[] = []
  if (fields['镜头']) parts.push(`景别与运镜：${fields['镜头']}`)
  if (fields['叙事目的']) parts.push(`叙事意图：${expand(fields['叙事目的'])}`)
  if (fields['衔接']) parts.push(`衔接方式：${expand(fields['衔接'])}`)
  if (fields['角色分动']) parts.push(`角色动作：${expand(fields['角色分动'])}`)
  if (fields['细节']) parts.push(`情绪细节：${expand(fields['细节'])}`)
  if (fields['环境']) parts.push(`场景环境：${expand(fields['环境'])}`)
  if (fields['光影']) parts.push(`光影氛围：${cleanShootingMarks(fields['光影'])}`)
  if (fields['台词']) parts.push(`台词暗示：${expand(fields['台词'])}`)
  if (fields['音效']) parts.push(`音效暗示：${expand(fields['音效'])}`)
  if (sceneDesc) parts.push(`画面描述：${cleanShootingMarks(sceneDesc)}`)
  if (styleCN) parts.push(`视觉风格：${styleCN}`)

  const autoStyle = detectStyleFromText(`${sceneDesc} ${styleCN}`.trim(), '')
  if (autoStyle) parts.push(`自动风格补充：${autoStyle}`)

  return parts.join('\n')
}

export function buildDirectImagePrompt(
  fields: Record<string, string>,
  styleKey: string,
  sceneDesc: string,
  refImageDescs: string[],
): string {
  const styleEN = STYLE_MAP_EN[styleKey] ?? DEFAULT_STYLE_EN
  const parts: string[] = []

  if (refImageDescs.length > 0) {
    parts.push(refImageDescs.map((desc, i) => `Reference Image ${i + 1}: ${normalizePromptLine(desc)}`).join('. '))
  } else {
    parts.push('No reference image.')
  }

  parts.push(
    'Single decisive cinematic moment, not a sequence.',
    'Keep the same character identity, hairstyle, costume, environment architecture, and key prop state.',
    'Do not add subtitles, dialogue bubbles, captions, logos, or extra props.'
  )

  const orderedSegments = [
    fields['叙事目的'] ? `Narrative intent: ${stripAtBrackets(fields['叙事目的'])}.` : '',
    fields['衔接'] ? `Transition cue: ${stripAtBrackets(fields['衔接'])}.` : '',
    fields['角色分动'] ? `Subject action: ${stripAtBrackets(fields['角色分动'])}.` : '',
    fields['细节'] ? `Expression and detail: ${stripAtBrackets(fields['细节'])}.` : '',
    fields['环境'] ? `Environment state: ${cleanShootingMarks(stripAtBrackets(fields['环境']))}.` : '',
    fields['光影'] ? `Lighting and composition: ${cleanShootingMarks(fields['光影'])}.` : '',
    sceneDesc ? `Scene anchor: ${cleanShootingMarks(sceneDesc)}.` : '',
  ].filter(Boolean)

  parts.push(...orderedSegments)
  parts.push(`Style: ${styleEN}.`)

  const autoStyle = detectStyleFromText(sceneDesc, styleEN)
  if (autoStyle) parts.push(`Additional style anchor: ${autoStyle}.`)

  parts.push('High quality, cinematic still, strong continuity control.')

  return parts.join(' ')
}

export async function refinePromptViaAI(
  structuredInput: string,
  textSettings: ApiSettings,
  refImageDescs: string[],
): Promise<string> {
  const systemPrompt = `你是专业分镜插画提示词设计师。你的任务是把结构化分镜描述，改写成适合图片生成模型使用的中文提示词。

必须遵守以下规则：
1. 输出必须以参考图声明开头。如果有参考图，逐行写“参考图1: [...]”。如果没有参考图，第一行必须是“无参考图”。
2. 输出顺序固定为：
   参考图声明
   全局一致性锚点
   叙事目的与衔接
   主体动作
   场景与道具状态
   光影与构图
   风格尾段
3. 只描述一个决定性瞬间，不写连续动作过程，不写“先……再……”。
4. 绝对优先保留角色身份、脸部特征、发型、服装、场景架构、关键道具状态，不得随意改造、现代化或替换。
5. 台词暗示和音效暗示只允许转成视觉状态、气氛和表演细节，不得生成字幕、对白框、对话文字。
6. 不要输出字段名、JSON、@标签、括号说明、额外解释。
7. 禁止出现“字幕、对白框、文字、logo、水印、额外人物、额外道具”等会诱导模型画出脏内容的指令。
8. 全文控制在 180 到 240 字内，短而硬，不要空话。

参考图声明示例：
参考图1: [角色-林晚]
参考图2: [场景-旧客厅]

输出风格要求：
- 语言简洁，画面导向明确
- 优先写稳定锚点，再写动作和构图
- 尾段再补风格、镜头气质和质感词`

  const refBlock = buildReferenceBlock(refImageDescs)
  const userPrompt = `请把以下结构化分镜描述改写成图片生成提示词。\n\n结构化输入：\n${structuredInput}\n\n参考图信息：\n${refBlock}`

  const { generate } = await import('./api')
  const result = await generate(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    textSettings
  )

  return result.trim()
}
