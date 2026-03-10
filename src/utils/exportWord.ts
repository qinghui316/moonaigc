import { downloadFile } from './download'
import type { ShotData } from '../types'

export const exportWord = async (shots: ShotData[], title: string, director: string, duration: string): Promise<void> => {
  const tableRows = shots.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${s.time}</td>
      <td>${s.shotType}</td>
      <td>${s.camera}</td>
      <td>${s.scene}</td>
      <td>${s.lighting}</td>
      <td>${s.drama}</td>
      <td style="font-size:10px;">${s.prompt}</td>
    </tr>
  `).join('')

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">
    <head>
      <meta charset="UTF-8">
      <style>
        body { font-family: "Microsoft YaHei", sans-serif; margin: 20px; }
        h1 { color: #D97706; font-size: 18px; }
        .meta { color: #666; font-size: 12px; margin-bottom: 20px; }
        table { border-collapse: collapse; width: 100%; font-size: 11px; }
        th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: left; vertical-align: top; }
        th { background: #F59E0B; color: white; font-weight: bold; }
        tr:nth-child(even) { background: #FEF9F0; }
      </style>
    </head>
    <body>
      <h1>MoonAIGC · 分镜脚本</h1>
      <div class="meta">
        标题：${title || '未命名项目'} ｜ 导演风格：${director} ｜ 预计时长：${duration} ｜ 
        生成时间：${new Date().toLocaleString('zh-CN')}
      </div>
      <table>
        <thead>
          <tr>
            <th>序号</th><th>时长</th><th>景别</th><th>运镜</th>
            <th>场景</th><th>灯光</th><th>动作</th><th>AI提示词</th>
          </tr>
        </thead>
        <tbody>${tableRows}</tbody>
      </table>
      <p style="text-align:center;color:#999;margin-top:20px;">共 ${shots.length} 个镜头 · MoonAIGC 生成</p>
    </body>
    </html>
  `

  const blob = new Blob(['\ufeff' + html], { type: 'application/msword;charset=utf-8' })
  await downloadFile(blob, `MoonAIGC分镜_${new Date().toISOString().slice(0, 10)}.doc`)
}
