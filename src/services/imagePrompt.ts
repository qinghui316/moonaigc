import type { Materials } from '../types'
import type { ApiSettings } from '../types'
import { STYLE_MAP_EN, DEFAULT_STYLE_EN } from '../data/styleMap'
import { detectStyleFromText } from '../data/styleAutoMap'

// 解析 SEEDANCE 七维格式，对齐 V6 的 Zn 函数
// 同时接收表格列值作为回退（当 SEEDANCE 字段为空时）
export function parseSeedanceFields(
  prompt: string,
  fallback?: { shotType?: string; camera?: string; scene?: string; lighting?: string }
): Record<string, string> {
  const fields: Record<string, string> = {}
  // 更新字段顺序：镜头→环境→叙事目的→衔接→角色分动→细节→光影→台词→音效
  const fieldPatterns: [string, RegExp][] = [
    ['镜头', /镜头：(.+?)(?=\s*环境：|\s*叙事目的：|\s*角色分动：|$)/s],
    ['环境', /环境：(.+?)(?=\s*叙事目的：|\s*衔接：|\s*角色分动：|\s*细节：|$)/s],
    ['叙事目的', /叙事目的：(.+?)(?=\s*衔接：|\s*角色分动：|\s*细节：|$)/s],
    ['衔接', /衔接：(.+?)(?=\s*角色分动：|\s*细节：|\s*光影：|$)/s],
    ['角色分动', /角色分动：(.+?)(?=\s*细节：|\s*光影：|$)/s],
    ['细节', /细节：(.+?)(?=\s*光影：|\s*台词|$)/s],
    ['光影', /光影：(.+?)(?=\s*台词|\s*音效：|$)/s],
    ['台词', /台词[(@（][^)）]*[)）][：:]\s*"?(.+?)"?(?=\s*台词[(@（]|\s*音效：|\s*$)/s],
    ['音效', /音效：(.+?)(?=\s*\[禁|$)/s],
  ]
  for (const [key, re] of fieldPatterns) {
    const m = prompt.match(re)
    if (m) fields[key] = m[1].trim()
  }

  // 回退：从表格独立列值填充空字段（对齐 V6 的 Zn 函数）
  if (fallback) {
    if (!fields['镜头'] && (fallback.shotType || fallback.camera)) {
      fields['镜头'] = [fallback.shotType, fallback.camera].filter(Boolean).join(' ')
    }
    if (!fields['光影'] && fallback.lighting) {
      fields['光影'] = fallback.lighting
    }
    if (!fields['环境'] && fallback.scene) {
      fields['环境'] = fallback.scene
    }
  }

  return fields
}

// 将 @人物N, @图片N 替换为素材库中的描述文字（对齐 V6 的 He 函数）
export function expandAtTags(text: string, materials: Materials): string {
  let result = text
  const allSlots = [
    ...materials.character.map(m => ({ ...m, prefix: '@' })),
    ...materials.image.map(m => ({ ...m, prefix: '@' })),
    ...materials.props.map(m => ({ ...m, prefix: '@' })),
  ]
  for (const slot of allSlots) {
    if (!slot.name) continue
    const re = new RegExp(`@${slot.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
    result = result.replace(re, slot.desc ? `[${slot.desc.slice(0, 60)}]` : slot.name)
  }
  return result
}

// 去除 @xxx [...] 中的 @ 和中括号，保留纯文本（对齐 V6 的 Oe 函数）
export function stripAtBrackets(text: string): string {
  return text
    .replace(/@(\S+)\s*\[([^\]]*)\]/g, '$2')
    .replace(/@(\S+)/g, '$1')
    .replace(/\[([^\]]*)\]/g, '$1')
}

// 去除拍摄指令标记
export function cleanShootingMarks(text: string): string {
  return text.replace(/\s*\[禁BGM\]\s*/g, ' ').replace(/\s*\[禁字幕\]\s*/g, ' ').trim()
}

// 构建结构化输入（给 AI 精炼用，含回退逻辑）
// materials 传入时，会先将各字段中的 @标签替换为素材库描述文字，再清洗符号
export function buildStructuredInput(
  fields: Record<string, string>,
  styleCN: string,
  sceneDesc: string,
  materials?: Materials,
): string {
  // 有素材库时：先 expandAtTags（替换 @标签为描述），再 stripAtBrackets（清洗符号）
  const expand = (text: string) =>
    materials ? stripAtBrackets(expandAtTags(text, materials)) : stripAtBrackets(text)

  const parts: string[] = []
  if (fields['镜头']) parts.push(`景别与运镜：${fields['镜头']}`)
  if (fields['叙事目的']) parts.push(`叙事意图：${expand(fields['叙事目的'])}`)
  if (fields['衔接']) parts.push(`衔接方式：${expand(fields['衔接'])}`)
  if (fields['角色分动']) parts.push(`角色动作：${expand(fields['角色分动'])}`)
  if (fields['细节']) parts.push(`情绪细节：${expand(fields['细节'])}`)
  if (fields['环境']) parts.push(`场景环境：${expand(fields['环境'])}`)
  if (fields['光影']) parts.push(`光影氛围：${fields['光影']}`)
  if (fields['台词']) parts.push(`台词暗示：${expand(fields['台词'])}`)
  if (fields['音效']) parts.push(`音效暗示：${cleanShootingMarks(expand(fields['音效']))}`)
  if (sceneDesc) parts.push(`画面描述：${sceneDesc}`)
  if (styleCN) parts.push(`视觉风格：${styleCN}`)
  // 中文风格词自动识别：扫描场景描述，追加英文风格关键词（供 AI 精炼时参考）
  const autoStyle = detectStyleFromText(sceneDesc + ' ' + styleCN, '')
  if (autoStyle) parts.push(`自动风格补充：${autoStyle}`)
  return parts.join('\n')
}

// 直接拼接回退模式（英文），对齐 V6 的 buildDirectImagePrompt
export function buildDirectImagePrompt(
  fields: Record<string, string>,
  styleKey: string,
  sceneDesc: string,
  refImageDescs: string[],
): string {
  const styleEN = STYLE_MAP_EN[styleKey] ?? DEFAULT_STYLE_EN
  const parts: string[] = []

  // 参考图声明放开头
  if (refImageDescs.length > 0) {
    parts.push(refImageDescs.map((d, i) => `Reference Image ${i + 1}: ${d}`).join(', '))
  }

  const action = stripAtBrackets(fields['角色分动'] ?? '')
  if (action) parts.push(action)

  const detail = stripAtBrackets(fields['细节'] ?? '')
  if (detail) parts.push(detail)

  const env = stripAtBrackets(cleanShootingMarks(fields['环境'] ?? ''))
  if (env) parts.push(env)

  const light = fields['光影'] ?? ''
  if (light) parts.push(light)

  if (sceneDesc) parts.push(sceneDesc)

  parts.push(styleEN)

  // 中文风格词自动识别：扫描场景描述，追加匹配到的英文风格
  const autoStyle = detectStyleFromText(sceneDesc, styleEN)
  if (autoStyle) parts.push(autoStyle)

  parts.push('high quality, cinematic, 8k')

  return parts.filter(Boolean).join(', ')
}

// AI 精炼：将结构化 SEEDANCE 描述精炼为图片生成提示词（中文输出，200词）
// 对齐 V6 的 Vn 函数，参考图声明放在开头
export async function refinePromptViaAI(
  structuredInput: string,
  textSettings: ApiSettings,
  refImageDescs: string[],
): Promise<string> {
  const systemPrompt = `你是专业分镜插画师，精通将分镜描述转化为图像生成提示词。

🔥【视觉连续性铁律（最高优先级）】：
绝对优先遵守@标签括号内的描述（包含角色、道具、场景外观），这是保证全片一致性的核心锚点，必须完整体现在提示词中。

铁律（违反则失败）：
1. 每镜只描述一个决定性瞬间的静止画面，禁止描述动作过程（如"A做完X然后B做Y"），而是捕捉该过程中最具张力的一帧定格：所有角色的姿态、表情、身体位置应是同一时刻的状态
2. 推断道具-角色-环境的逻辑关联状态：角色手持游戏手柄 → 电视屏幕必须亮着显示游戏画面；角色看书 → 灯必须亮；角色喝水 → 杯子必须有水
3. 【台词暗示】和【音效暗示】字段只提取场景状态信息，转化为视觉细节，不写进对话框
4. 禁止输出@符号、括号标签、字段名等结构化标记
5. 叙事意图：从结构化输入中的【叙事意图】和【衔接方式】字段提取，转化为构图引导（如"推进情节"→构图向前聚焦，"场景切换"→广角建立全景）
6. 输出不超过 200 词，格式：参考图声明 → 叙事意图与衔接 → 主体动作 → 场景环境状态 → 光影构图 → 风格
7. 若附带前一镜参考图（第一张），画面风格、色调、角色造型必须与其保持视觉连续性
8. 开头必须先声明参考图，标注每张参考图对应的角色/场景/道具名称，确保图片生成模型能将参考图与提示词中的对应元素匹配。格式：参考图1: [类型-名称], 参考图2: [类型-名称]...。声明之后再写场景描述。`

  const refBlock = refImageDescs.length > 0
    ? `\n本次生图将附带以下参考图（图片文件单独传入，你需要在提示词开头先声明对应关系）：\n${refImageDescs.map((d, i) => `- 参考图${i + 1}: ${d}`).join('\n')}`
    : `\n注意：本次无参考图，请在提示词开头写"无参考图"后直接描述场景。`

  const userPrompt = `请将以下结构化分镜描述转写为图像生成提示词：\n\n${structuredInput}${refBlock}`

  const { generate } = await import('./api')
  const result = await generate(
    [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    textSettings
  )
  return result.trim()
}
