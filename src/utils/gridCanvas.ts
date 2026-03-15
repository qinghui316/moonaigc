export interface GridComposeConfig {
  cols: number
  rows: number
  cellWidth: number
  cellHeight: number
  gap?: number
  bgColor?: string
  cornerRadius?: number
  showLabels?: boolean
  labels?: string[]
}

export async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

export async function composeGridCanvas(
  imageUrls: string[],
  config: GridComposeConfig
): Promise<HTMLCanvasElement> {
  const {
    cols, rows, cellWidth, cellHeight,
    gap = 4, bgColor = '#000000',
    cornerRadius = 6, showLabels = false, labels = [],
  } = config

  const totalWidth = cols * cellWidth + (cols - 1) * gap
  const totalHeight = rows * cellHeight + (rows - 1) * gap

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * (cellWidth + gap)
    const y = row * (cellHeight + gap)

    const url = imageUrls[i]
    if (url) {
      try {
        const img = await loadImageFromUrl(url)
        ctx.save()
        // 圆角裁切
        ctx.beginPath()
        ctx.roundRect(x, y, cellWidth, cellHeight, cornerRadius)
        ctx.clip()
        // 居中填充
        const scale = Math.max(cellWidth / img.width, cellHeight / img.height)
        const dw = img.width * scale
        const dh = img.height * scale
        const dx = x + (cellWidth - dw) / 2
        const dy = y + (cellHeight - dh) / 2
        ctx.drawImage(img, dx, dy, dw, dh)
        ctx.restore()
      } catch {
        ctx.fillStyle = '#1a1a2e'
        ctx.fillRect(x, y, cellWidth, cellHeight)
      }
    } else {
      ctx.fillStyle = '#1a1a2e'
      ctx.fillRect(x, y, cellWidth, cellHeight)
    }

    // 可选：左上角序号标签
    if (showLabels) {
      const label = labels[i] ?? `#${i + 1}`
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(x + 2, y + 2, 28, 16)
      ctx.fillStyle = '#ffffff'
      ctx.font = '11px sans-serif'
      ctx.fillText(label, x + 5, y + 14)
    }
  }

  return canvas
}

export function downloadCanvas(canvas: HTMLCanvasElement, filename = 'grid.png') {
  const link = document.createElement('a')
  link.href = canvas.toDataURL('image/png')
  link.download = filename
  link.click()
}
