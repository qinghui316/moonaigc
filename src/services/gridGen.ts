import type { ShotData, Materials } from '../types'
import { parseSeedanceFields, buildStructuredInput } from './imagePrompt'

const ROLE_LABELS: Record<number, string[]> = {
  4: ['建立', '推进', '冲突', '收束'],
  6: ['建立', '进入', '互动', '推进', '冲突', '收束'],
  9: ['建立', '进入', '互动', '推进', '冲突', '反应', '细节', '高潮', '余韵'],
}

const ROLE_PROMPT_LABELS: Record<number, string[]> = {
  4: ['Establishing beat', 'Story push', 'Conflict beat', 'Closing beat'],
  6: ['Establishing beat', 'Entry beat', 'Interaction beat', 'Story push', 'Conflict beat', 'Closing beat'],
  9: ['Establishing beat', 'Entry beat', 'Interaction beat', 'Story push', 'Conflict beat', 'Reaction beat', 'Detail beat', 'Climax beat', 'Afterglow beat'],
}

const ROLE_TARGETS: Record<number, number[]> = {
  4: [0, 0.28, 0.68, 1],
  6: [0, 0.14, 0.3, 0.52, 0.76, 1],
  9: [0, 0.1, 0.2, 0.34, 0.5, 0.62, 0.74, 0.88, 1],
}

export function parseTimeRange(timeStr: string): number {
  const match = timeStr.match(/(\d+(?:\.\d+)?)\s*s?\s*[-–~]\s*(\d+(?:\.\d+)?)\s*s?/i)
  if (match) return parseFloat(match[2])
  const single = timeStr.match(/(\d+(?:\.\d+)?)/)?.[1]
  return single ? parseFloat(single) : 0
}

function getRoleLabels(gridCount: number): string[] {
  return ROLE_LABELS[gridCount] ?? Array.from({ length: gridCount }, (_, i) => `格 ${i + 1}`)
}

function getRolePromptLabels(gridCount: number): string[] {
  return ROLE_PROMPT_LABELS[gridCount] ?? Array.from({ length: gridCount }, (_, i) => `Panel role ${i + 1}`)
}

function getRoleTargets(gridCount: number): number[] {
  return ROLE_TARGETS[gridCount] ?? Array.from({ length: gridCount }, (_, i) => (gridCount === 1 ? 0 : i / (gridCount - 1)))
}

function findNearestUnusedIndex(target: number, used: Set<number>, total: number): number {
  const ideal = Math.round(target * Math.max(0, total - 1))
  if (!used.has(ideal)) return ideal

  for (let radius = 1; radius < total; radius++) {
    const left = ideal - radius
    const right = ideal + radius
    if (left >= 0 && !used.has(left)) return left
    if (right < total && !used.has(right)) return right
  }

  return Math.max(0, Math.min(total - 1, ideal))
}

function fillMissingIndices(indices: number[], total: number, targetCount: number): number[] {
  const selected = [...indices].sort((a, b) => a - b)
  const used = new Set(selected)

  while (selected.length < targetCount) {
    let bestIndex = -1
    let bestScore = -1

    for (let i = 0; i < total; i++) {
      if (used.has(i)) continue

      const prev = [...selected].filter(idx => idx < i).pop()
      const next = selected.find(idx => idx > i)
      const leftGap = prev == null ? i + 1 : i - prev
      const rightGap = next == null ? total - i : next - i
      const score = Math.min(leftGap, rightGap)

      if (score > bestScore) {
        bestScore = score
        bestIndex = i
      }
    }

    if (bestIndex < 0) break
    used.add(bestIndex)
    selected.push(bestIndex)
    selected.sort((a, b) => a - b)
  }

  return selected.slice(0, targetCount)
}

function chooseRoleDrivenIndices(total: number, gridCount: number): number[] {
  if (total <= 0) return []

  const used = new Set<number>()
  const indices = getRoleTargets(gridCount).map(target => {
    const idx = findNearestUnusedIndex(target, used, total)
    used.add(idx)
    return idx
  })

  return fillMissingIndices(indices, total, gridCount)
}

function createTransitionShot(fromShot: ShotData, toShot: ShotData): ShotData {
  return {
    ...fromShot,
    scene: `[过渡帧] ${fromShot.scene} -> ${toShot.scene}`,
    prompt: fromShot.prompt,
  }
}

function insertTransitionShots(
  shots: ShotData[],
  roleLabels: string[],
  targetCount: number
): { shots: ShotData[]; isTransition: boolean[]; roleLabels: string[] } {
  const result = [...shots]
  const isTransition = shots.map(() => false)

  while (result.length < targetCount) {
    let bestGap = -1
    let insertAt = Math.max(1, result.length)

    for (let i = 0; i < result.length - 1; i++) {
      const gap = parseTimeRange(result[i + 1].time) - parseTimeRange(result[i].time)
      if (gap > bestGap) {
        bestGap = gap
        insertAt = i + 1
      }
    }

    const prev = result[Math.max(0, insertAt - 1)]
    const next = result[Math.min(result.length - 1, insertAt)]
    result.splice(insertAt, 0, createTransitionShot(prev, next))
    isTransition.splice(insertAt, 0, true)
  }

  return {
    shots: result.slice(0, targetCount),
    isTransition: isTransition.slice(0, targetCount),
    roleLabels: roleLabels.slice(0, targetCount),
  }
}

export function selectShotsForGrid(
  shots: ShotData[],
  gridCount: number
): { shots: ShotData[]; isTransition: boolean[]; roleLabels: string[] } {
  if (shots.length === 0) return { shots: [], isTransition: [], roleLabels: [] }

  const roleLabels = getRoleLabels(gridCount)

  if (shots.length >= gridCount) {
    const indices = chooseRoleDrivenIndices(shots.length, gridCount)
    return {
      shots: indices.map(index => shots[index]),
      isTransition: indices.map(() => false),
      roleLabels,
    }
  }

  return insertTransitionShots(shots, roleLabels, gridCount)
}

export const GRID_NEGATIVE_PROMPT =
  'no text, no typography, no dialogue bubbles, no speech bubbles, no captions, no subtitles, no watermark, no logo, no readable signage, no mirrored duplicate, no repeated panel'

function clampLine(text: string, max = 240): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= max) return compact
  return `${compact.slice(0, max).trim()}…`
}

function splitRefDeclarations(desc: string): { declarations: string[]; body: string } {
  const lines = desc
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)

  const declarations: string[] = []
  const bodyLines: string[] = []

  for (const line of lines) {
    if (/^参考图\d+\s*:/.test(line) || /^无参考图/.test(line)) {
      declarations.push(line)
    } else {
      bodyLines.push(line)
    }
  }

  return {
    declarations,
    body: bodyLines.join('，'),
  }
}

function formatReferenceDecls(refImageDescs: string[]): string[] {
  return refImageDescs.map((desc, index) => {
    const [head, ...rest] = desc.split(/[：:]/)
    const detail = clampLine(rest.join('：').trim(), 60)
    return detail
      ? `参考图${index + 1}: [${head.trim()}]，${detail}`
      : `参考图${index + 1}: [${head.trim()}]`
  })
}

function buildGlobalReferenceBlock(refinedDescs: string[], refImageDescs?: string[]): string {
  const lines = new Set<string>()

  if (refImageDescs?.length) {
    formatReferenceDecls(refImageDescs).forEach(line => lines.add(line))
  }

  refinedDescs.forEach(desc => {
    splitRefDeclarations(desc).declarations.forEach(line => lines.add(line))
  })

  if (lines.size === 0) return '无参考图'
  return [...lines].join('\n')
}

function buildPanelBodies(refinedDescs: string[]): string[] {
  return refinedDescs.map(desc => clampLine(splitRefDeclarations(desc).body || desc.replace(/\s+/g, ' ').trim(), 260))
}

export function buildGridDirectPrompt(
  shots: ShotData[],
  cols: number,
  rows: number,
  styleEN: string,
  materials?: Materials
): string {
  const gridCount = cols * rows
  const selection = selectShotsForGrid(shots, gridCount)
  const promptLabels = getRolePromptLabels(gridCount)

  const panelDescs = selection.shots.map((shot, index) => {
    const fields = parseSeedanceFields(shot.prompt, {
      shotType: shot.shotType,
      camera: shot.camera,
      scene: shot.scene,
      lighting: shot.lighting,
    })
    const structured = buildStructuredInput(fields, '', shot.scene, materials)
    return `Panel ${index + 1} - ${promptLabels[index]}: ${clampLine(structured.replace(/\n/g, ' | '), 240)}`
  }).join('\n')

  return `Global references:
无参考图

Global anchors:
All panels belong to one storyboard contact sheet. Keep the same character identity, face, hairstyle, costume, environment architecture, and key prop state across the whole sheet.

Layout and anti-duplication rules:
Create one single storyboard contact sheet in ${cols}x${rows} grid layout.
Every panel must show a different cinematic moment.
No duplicated framing, no mirrored duplicate, no repeated panel, no subtitles, no captions, no watermark, no readable text.
Use light separation between panels. Do not use thick comic borders.

Panel briefs:
${panelDescs}

Style:
${styleEN}`
}

export function assembleGridPrompt(
  refinedDescs: string[],
  cols: number,
  rows: number,
  styleEN: string,
  roleLabels?: string[],
  refImageDescs?: string[],
): string {
  const gridCount = cols * rows
  const promptLabels = roleLabels?.length === refinedDescs.length ? roleLabels : getRolePromptLabels(gridCount)
  const panelBodies = buildPanelBodies(refinedDescs)
  const globalReferenceBlock = buildGlobalReferenceBlock(refinedDescs, refImageDescs)

  const panelBriefs = panelBodies.map((body, index) => (
    `Panel ${index + 1} - ${promptLabels[index] ?? `Panel role ${index + 1}`}: ${body}`
  )).join('\n')

  return `Global references:
${globalReferenceBlock}

Global anchors:
All panels belong to one storyboard contact sheet.
Maintain the same character identity, face, hairstyle, costume, environment architecture, and key prop state across all panels.
Keep continuity in color palette, lighting logic, and scene geography.

Layout and anti-duplication rules:
Create one single storyboard contact sheet in ${cols}x${rows} grid layout.
Every panel must depict a different cinematic moment from the same sequence.
Avoid duplicated framing, mirrored duplication, or near-identical poses.
${GRID_NEGATIVE_PROMPT}.
Use clean panel separation, but no heavy comic borders.

Panel briefs:
${panelBriefs}

Style:
${styleEN}

Final instruction:
Make the sheet feel like one coherent storyboard page with clear narrative progression from panel 1 to panel ${refinedDescs.length}.`
}

export function buildTransitionPrompt(prevShot: ShotData, nextShot: ShotData, styleEN: string): string {
  return `Cinematic transition frame between two scenes.
Previous: ${prevShot.scene}
Next: ${nextShot.scene}
Style: ${styleEN}, seamless visual bridge, motion blur or dissolve effect`
}
