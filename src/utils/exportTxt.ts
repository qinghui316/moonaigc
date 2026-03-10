import { downloadFile } from './download'
import type { ShotData } from '../types'

export const exportTxt = async (shots: ShotData[], title: string, director: string, duration: string): Promise<void> => {
  const lines: string[] = [
    `═══════════════════════════════════════`,
    `  MoonAIGC · 分镜脚本`,
    `═══════════════════════════════════════`,
    `标题：${title || '未命名项目'}`,
    `导演风格：${director}`,
    `预计时长：${duration}`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    ``,
    `───────────────────────────────────────`,
    `  分 镜 内 容`,
    `───────────────────────────────────────`,
    ``,
  ]

  shots.forEach((shot, i) => {
    lines.push(`【第 ${String(i + 1).padStart(2, '0')} 镜】${shot.time}`)
    lines.push(`  景别：${shot.shotType}`)
    lines.push(`  运镜：${shot.camera}`)
    lines.push(`  场景：${shot.scene}`)
    lines.push(`  灯光：${shot.lighting}`)
    lines.push(`  动作：${shot.drama}`)
    lines.push(`  提示词：${shot.prompt}`)
    lines.push(``)
  })

  lines.push(`───────────────────────────────────────`)
  lines.push(`  共 ${shots.length} 个镜头`)
  lines.push(`═══════════════════════════════════════`)

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' })
  await downloadFile(blob, `MoonAIGC分镜_${new Date().toISOString().slice(0, 10)}.txt`)
}
