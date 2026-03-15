import type { ShotData } from '../types'
import type { Materials } from '../types'

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
    const sceneStr = shot.scene || ''
    const promptExcerpt = shot.prompt ? shot.prompt.slice(0, 100) : ''
    return `Panel ${i + 1}: ${timeStr} | ${sceneStr}${promptExcerpt ? ` | ${promptExcerpt}` : ''}`
  }).join('\n')

  // 从素材库提取角色/场景/道具约束
  let constraintBlock = ''
  if (materials) {
    const constraints: string[] = []
    materials.character.filter(m => m.name && m.desc).forEach(m => {
      constraints.push(`Character "${m.name}": ${m.desc.slice(0, 60)}`)
    })
    materials.image.filter(m => m.name && m.desc).forEach(m => {
      constraints.push(`Scene "${m.name}": ${m.desc.slice(0, 60)}`)
    })
    materials.props.filter(m => m.name && m.desc).forEach(m => {
      constraints.push(`Prop "${m.name}": ${m.desc.slice(0, 60)}`)
    })
    if (constraints.length > 0) {
      constraintBlock = `\nCharacter/scene/prop constraints:\n${constraints.join('\n')}`
    }
  }

  return `Create one single storyboard contact sheet in ${cols}x${rows} grid layout.
Cinematic style should be consistent across all panels.
Do not draw any text in image. ${GRID_NEGATIVE_PROMPT}.
Each panel follows these shot briefs:
${panelDescs}${constraintBlock}
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
