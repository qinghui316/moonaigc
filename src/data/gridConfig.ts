export interface GridLayout {
  cols: number
  rows: number
  label: string
}

export const GRID_LAYOUTS: GridLayout[] = [
  { cols: 2, rows: 2, label: '2x2 四宫格' },
  { cols: 3, rows: 2, label: '3x2 六宫格' },
  { cols: 3, rows: 3, label: '3x3 九宫格' },
]

export const CELL_ASPECT_RATIOS = ['16:9', '3:2', '4:3', '1:1']

// 根据宫格整体宽高比选最接近的图片尺寸（单次直出模式使用）
export function selectBestGridImageSize(
  cols: number,
  rows: number,
  cellAspectRatio: string
): string {
  // 解析格子宽高比
  const [cw, ch] = cellAspectRatio.split(':').map(Number)
  const gridRatio = (cw * cols) / (ch * rows)

  // 豆包可用尺寸列表（宽:高）
  const sizes = [
    { ratio: 16 / 9, size: '2848x1600' },
    { ratio: 9 / 16, size: '1600x2848' },
    { ratio: 4 / 3, size: '2304x1728' },
    { ratio: 3 / 4, size: '1728x2304' },
    { ratio: 1 / 1, size: '2048x2048' },
    { ratio: 3 / 2, size: '2496x1664' },
    { ratio: 2 / 3, size: '1664x2496' },
    { ratio: 21 / 9, size: '3136x1344' },
  ]

  let best = sizes[0]
  let minDiff = Infinity
  for (const s of sizes) {
    const diff = Math.abs(s.ratio - gridRatio)
    if (diff < minDiff) {
      minDiff = diff
      best = s
    }
  }
  return best.size
}
