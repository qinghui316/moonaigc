import type { ShotData, Materials } from '../types'
import { parseSeedanceFields, buildStructuredInput } from './imagePrompt'

// 从时间段字符串中提取结束秒数
export function parseTimeRange(timeStr: string): number {
  const m = timeStr.match(/(\d+(?:\.\d+)?)\s*s?\s*[-–]\s*(\d+(?:\.\d+)?)\s*s?/i)
  if (m) return parseFloat(m[2])
  const single = timeStr.match(/(\d+(?:\.\d+)?)/)?.[1]
  return single ? parseFloat(single) : 0
}

// 均匀抽取镜头，不足时在间隔最大处插入过渡帧
export function selectShotsForGrid(
  shots: ShotData[],
  gridCount: number
): { shots: ShotData[]; isTransition: boolean[] } {
  if (shots.length === 0) return { shots: [], isTransition: [] }
  if (shots.length >= gridCount) {
    // 均匀抽取
    const step = (shots.length - 1) / (gridCount - 1)
    const selected = Array.from({ length: gridCount }, (_, i) =>
      shots[Math.round(i * step)]
    )
    return { shots: selected, isTransition: selected.map(() => false) }
  }

  // 不足：在时间间隔最大处插入过渡帧
  const result = [...shots]
  const isTransition = shots.map(() => false)

  while (result.length < gridCount) {
    let maxGap = -1
    let insertAt = 0
    for (let i = 0; i < result.length - 1; i++) {
      const t1 = parseTimeRange(result[i].time)
      const t2 = parseTimeRange(result[i + 1].time)
      const gap = t2 - t1
      if (gap > maxGap) {
        maxGap = gap
        insertAt = i + 1
      }
    }
    // 插入过渡帧（复制前镜内容标记为过渡）
    result.splice(insertAt, 0, { ...result[insertAt - 1], scene: `[过渡帧] ${result[insertAt - 1].scene}` })
    isTransition.splice(insertAt, 0, true)
  }

  return { shots: result.slice(0, gridCount), isTransition: isTransition.slice(0, gridCount) }
}

// 宫格专用负向词常量
export const GRID_NEGATIVE_PROMPT = 'no text, no typography, no dialogue bubbles, no speech bubbles, no captions, no subtitles, Do not draw any text in image, no watermark, no label'

// 单次直出模式：将所有格子描述拼成一个英文 prompt（对齐 6.5 格式）
// 每格用 parseSeedanceFields + buildStructuredInput（含 @标签展开）生成结构化描述
export function buildGridDirectPrompt(
  shots: ShotData[],
  cols: number,
  rows: number,
  styleEN: string,
  materials?: Materials
): string {
  const gridCount = cols * rows
  const cells = shots.slice(0, gridCount)

  const panelDescs = cells.map((shot, i) => {
    const timeStr = shot.time || `Panel ${i + 1}`
    const fields = parseSeedanceFields(shot.prompt, {
      shotType: shot.shotType,
      camera: shot.camera,
      scene: shot.scene,
      lighting: shot.lighting,
    })
    // 用 buildStructuredInput 展开 @标签，生成精简结构化描述（约150-200字/格）
    const structured = buildStructuredInput(fields, '', shot.scene, materials)
    // 截取前200字符避免单格过长
    const desc = structured.replace(/\n/g, ' | ').slice(0, 200)
    return `Panel ${i + 1} [${timeStr}]: ${desc}`
  }).join('\n')

  return `Create one single storyboard contact sheet in ${cols}x${rows} grid layout.
Cinematic style should be consistent across all panels.
Do not draw any text in image. ${GRID_NEGATIVE_PROMPT}.
Each panel follows these shot briefs:
${panelDescs}
Style: ${styleEN}
IMPORTANT: Each cell must be a different cinematic moment. Maintain visual consistency in character appearance, costume, and environment across all panels. No grid lines visible, seamless layout.`
}

// 用已精炼的每格描述组装最终宫格提示词
export function assembleGridPrompt(
  refinedDescs: string[],
  cols: number,
  rows: number,
  styleEN: string,
): string {
  const panelDescs = refinedDescs.map((desc, i) => {
    const trimmed = desc.slice(0, 250)
    return `Panel ${i + 1}: ${trimmed}`
  }).join('\n')

  return `Create one single storyboard contact sheet in ${cols}x${rows} grid layout.
Cinematic style should be consistent across all panels.
Do not draw any text in image. ${GRID_NEGATIVE_PROMPT}.
Each panel follows these shot briefs:
${panelDescs}
Style: ${styleEN}
IMPORTANT: Each cell must be a different cinematic moment. Maintain visual consistency in character appearance, costume, and environment across all panels. No grid lines visible, seamless layout.`
}

// 过渡帧 prompt
export function buildTransitionPrompt(prevShot: ShotData, nextShot: ShotData, styleEN: string): string {
  return `Cinematic transition frame between two scenes.
Previous: ${prevShot.scene}
Next: ${nextShot.scene}
Style: ${styleEN}, seamless visual bridge, motion blur or dissolve effect`
}
