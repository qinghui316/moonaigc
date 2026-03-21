import type { ApiSettings } from '../types'
import { generate, type ApiMessage } from './api'

export interface GridSourceShot {
  ref: string
  time: string
  shotType: string
  scene: string
  prompt: string
}

export interface GridPanelDraft {
  panel_number: number
  time_range: string
  source_shot_refs: string[]
  seedance_prompt: string
  image_prompt_text: string
}

export interface GridStoryboardDraft {
  grid_layout: string
  grid_aspect_ratio: string
  panels: GridPanelDraft[]
}

interface RefImagePayload {
  base64: string
  mimeType: string
}

export interface GridStoryboardResult {
  rawText: string
  validationPassed: boolean
  draft: GridStoryboardDraft | null
}

function buildSystemPrompt(): string {
  return `你是“宫格分镜重组助手”。
你的任务不是自由改编剧情，而是根据用户给出的若干条原始分镜提示词和参考图，重组成一套适合 3x3 九宫格生成的结果。

强制规则：
1. 仅输出纯 JSON，不要输出任何解释、标题、代码块标记或 Markdown。
2. 输出结构固定为：
{
  "grid_layout": "3x3",
  "grid_aspect_ratio": "16:9",
  "panels": [
    {
      "panel_number": 1,
      "time_range": "0-7s",
      "source_shot_refs": ["源分镜1"],
      "seedance_prompt": "...",
      "image_prompt_text": "..."
    }
  ]
}
3. panels 必须精确 9 条，panel_number 必须是 1 到 9。
4. 允许根据用户选中的分镜内容扩写、拆分、补足过渡、反应、细节镜头，但不得脱离源内容乱编新剧情。
5. source_shot_refs 必须引用用户输入里的源分镜编号，可以一格对应多个源分镜。
6. seedance_prompt 必须是适合后续生视频/镜头控制的完整中文提示词。
7. image_prompt_text 必须是适合九宫格整图生成的高密度中文视觉提示词，突出景别、主体、动作、环境、构图重点，并在末尾加入 "no timecode, no subtitles"。
8. 不要输出空字段，不要省略字段，不要输出多余字段。
9. 保持全组角色身份、服装、发型、场景架构、关键道具和视觉风格一致。`
}

function buildUserPrompt(
  shots: GridSourceShot[],
  aspectRatio: string,
  styleLabel: string,
  refDescs: string[],
): string {
  const sourceBlock = shots.map((shot, index) => (
    `源分镜${index + 1}：
时间段：${shot.time || '未提供'}
景别：${shot.shotType || '未提供'}
画面描述：${shot.scene || '未提供'}
原始提示词：${shot.prompt || '未提供'}`
  )).join('\n\n')

  const refBlock = refDescs.length > 0
    ? refDescs.map((desc, index) => `参考图${index + 1}：${desc}`).join('\n')
    : '无参考图'

  return `请基于以下内容生成 3x3 宫格分镜 JSON。

目标画幅：${aspectRatio}
目标风格：${styleLabel}

参考图信息：
${refBlock}

源分镜输入：
${sourceBlock}

注意：
- 这些源分镜本身可能每条都包含一整段故事内容。
- 你需要把这些故事内容重新组织成 9 条宫格面板结果。
- 输出必须是纯 JSON。`
}

function buildUserContent(
  prompt: string,
  refImages: RefImagePayload[],
  mode: ApiSettings['mode'],
): unknown {
  if (mode === 'anthropic') {
    const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
    refImages.forEach(image => {
      content.push({
        type: 'image',
        source: {
          type: 'base64',
          media_type: image.mimeType,
          data: image.base64,
        },
      })
    })
    return content
  }

  const content: Array<Record<string, unknown>> = [{ type: 'text', text: prompt }]
  refImages.forEach(image => {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:${image.mimeType};base64,${image.base64}`,
      },
    })
  })
  return content
}

function extractJsonText(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fenced?.[1]) return fenced[1].trim()

  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

function normalizeDraft(candidate: unknown): GridStoryboardDraft | null {
  if (!candidate || typeof candidate !== 'object') return null
  const obj = candidate as Record<string, unknown>
  if (obj.grid_layout !== '3x3') return null
  if (!Array.isArray(obj.panels) || obj.panels.length !== 9) return null

  const panels = obj.panels.map((panel, index) => {
    if (!panel || typeof panel !== 'object') return null
    const item = panel as Record<string, unknown>
    const panelNumber = Number(item.panel_number)
    const timeRange = String(item.time_range ?? '').trim()
    const seedancePrompt = String(item.seedance_prompt ?? '').trim()
    const imagePromptText = String(item.image_prompt_text ?? '').trim()
    const sourceShotRefs = Array.isArray(item.source_shot_refs)
      ? item.source_shot_refs.map(ref => String(ref)).filter(Boolean)
      : []

    if (panelNumber !== index + 1 || !timeRange || !seedancePrompt || !imagePromptText) {
      return null
    }

    return {
      panel_number: panelNumber,
      time_range: timeRange,
      source_shot_refs: sourceShotRefs,
      seedance_prompt: seedancePrompt,
      image_prompt_text: imagePromptText,
    }
  })

  if (panels.some(panel => panel == null)) return null

  return {
    grid_layout: '3x3',
    grid_aspect_ratio: String(obj.grid_aspect_ratio ?? '16:9'),
    panels: panels as GridPanelDraft[],
  }
}

export async function generateNineGridStoryboard(
  shots: GridSourceShot[],
  refImages: RefImagePayload[],
  refDescs: string[],
  styleLabel: string,
  aspectRatio: string,
  textSettings: ApiSettings,
  signal?: AbortSignal,
): Promise<GridStoryboardResult> {
  const rawText = await generate(
    [
      { role: 'system', content: buildSystemPrompt() },
      {
        role: 'user',
        content: buildUserContent(
          buildUserPrompt(shots, aspectRatio, styleLabel, refDescs),
          refImages,
          textSettings.mode,
        ),
      },
    ] satisfies ApiMessage[],
    textSettings,
    signal,
  )

  try {
    const parsed = JSON.parse(extractJsonText(rawText))
    const draft = normalizeDraft(parsed)
    return {
      rawText,
      validationPassed: !!draft,
      draft,
    }
  } catch {
    return {
      rawText,
      validationPassed: false,
      draft: null,
    }
  }
}

export function buildNineGridImagePrompt(input: {
  aspectRatio: string
  refBlock: string
  panelPrompts: string[]
  fallbackRaw?: string
}): string {
  const panelLines = input.panelPrompts.length > 0
    ? input.panelPrompts.map((prompt, index) => `Panel ${index + 1}: ${prompt}`).join('\n')
    : (input.fallbackRaw ?? '')

  return `Grid spec:
strict 3x3 grid, exactly 9 equal-sized rectangular panels, aligned rows and columns, uniform spacing between panels, no merged panels, no spanning panels, no collage, no irregular panel shapes.

Global references:
${input.refBlock || '无参考图'}

Global anchors:
All panels belong to one coherent storyboard sheet. Maintain the same character identity, hairstyle, costume, environment architecture, key props, lighting logic, and color continuity across all panels. no text, no subtitles, no dialogue bubbles, no speech bubbles, no captions, no watermark, no logo, no readable signage, no comic page layout.

Panels:
${panelLines}`
}
