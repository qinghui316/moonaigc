import { downloadFile } from './download'
import type { ShotData } from '../types'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getXLSX = (): any => (window as unknown as Record<string, unknown>).XLSX

export const exportExcel = async (shots: ShotData[], title: string, director: string, duration: string): Promise<void> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const XLSX: any = getXLSX()
  if (!XLSX) {
    alert('Excel导出需要 XLSX 库，请检查页面加载状态')
    return
  }

  const book = XLSX.utils.book_new()

  const headers = ['序号', '时长', '景别与镜头', '摄影机运动', '场景与环境', '灯光与色调', '戏剧动作', 'AI提示词']
  const rows = shots.map((s, i) => [i + 1, s.time, s.shotType, s.camera, s.scene, s.lighting, s.drama, s.prompt])
  const sheet1 = XLSX.utils.aoa_to_sheet([headers, ...rows])
  XLSX.utils.book_append_sheet(book, sheet1, '分镜脚本')

  const infoData = [
    ['项目信息', ''],
    ['标题', title || '未命名项目'],
    ['导演风格', director],
    ['预计时长', duration],
    ['生成时间', new Date().toLocaleString('zh-CN')],
    ['总镜头数', shots.length.toString()],
    ['生成工具', 'MoonAIGC'],
  ]
  const sheet2 = XLSX.utils.aoa_to_sheet(infoData)
  XLSX.utils.book_append_sheet(book, sheet2, '项目信息')

  const wbout = XLSX.write(book, { bookType: 'xlsx', type: 'array' })
  const blob = new Blob([wbout], { type: 'application/octet-stream' })
  await downloadFile(blob, `MoonAIGC分镜_${new Date().toISOString().slice(0, 10)}.xlsx`)
}
