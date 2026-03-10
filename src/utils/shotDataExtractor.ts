import type { ShotData } from '../types'

// 从Markdown表格文本提取结构化镜头数据（兼容V5.1的时间段列和戏剧张力列）
export const extractShotData = (markdown: string): ShotData[] => {
  if (!markdown) return []
  const lines = markdown.split('\n').filter(l => l.trim().startsWith('|'))
  const shots: ShotData[] = []
  let headerDetected = false
  let hasDrama = false

  for (const line of lines) {
    if (line.includes('---')) continue
    const cells = line.split('|').filter(Boolean).map(c => c.trim())
    if (cells.length < 5) continue

    // 检测是否为表头行
    const isHeader = cells.some(c =>
      c.includes('时长') || c.includes('时间段') || c.includes('时间') ||
      c.includes('序号') || c.includes('景别')
    )
    if (isHeader && !headerDetected) {
      headerDetected = true
      // 检测是否有戏剧张力列
      hasDrama = cells.some(c => c.includes('戏剧') || c.includes('张力'))
      continue
    }

    if (!headerDetected) continue

    // 最后一列为提示词
    const promptIdx = cells.length - 1
    // 戏剧张力在倒数第2列（如果有）
    const dramaIdx = hasDrama ? promptIdx - 1 : -1

    shots.push({
      time: cells[0] ?? '',
      shotType: cells[1] ?? '',
      camera: cells[2] ?? '',
      scene: cells[3] ?? '',
      lighting: cells[4] ?? '',
      drama: dramaIdx >= 0 ? (cells[dramaIdx] ?? '') : '',
      prompt: cells[promptIdx] ?? '',
    })
  }

  return shots
}

// 只提取所有AI提示词（最后列）
export const extractPrompts = (markdown: string): string[] => {
  return extractShotData(markdown).map(s => s.prompt).filter(Boolean)
}

// 提取整合提示词需要的分镜数据
export const extractShotsForIntegrate = (markdown: string) => {
  return extractShotData(markdown).map((s, i) => ({
    timeRange: s.time || `第${i + 1}镜`,
    shotType: s.shotType,
    camera: s.camera,
    scene: s.scene,
    lighting: s.lighting,
    prompt: s.prompt,
  })).filter(s => s.prompt)
}
