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
  title?: string
  subtitle?: string
  captions?: string[]
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

function truncateLabel(text: string, max: number): string {
  const value = text.trim()
  if (value.length <= max) return value
  return `${value.slice(0, max).trim()}…`
}

export async function composeGridCanvas(
  imageUrls: string[],
  config: GridComposeConfig
): Promise<HTMLCanvasElement> {
  const {
    cols,
    rows,
    cellWidth,
    cellHeight,
    gap = 4,
    bgColor = '#000000',
    cornerRadius = 8,
    showLabels = false,
    labels = [],
    title,
    subtitle,
    captions = [],
  } = config

  const headerHeight = title ? 54 : 0
  const totalWidth = cols * cellWidth + (cols - 1) * gap
  const totalHeight = headerHeight + rows * cellHeight + (rows - 1) * gap

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')!

  ctx.fillStyle = bgColor
  ctx.fillRect(0, 0, totalWidth, totalHeight)

  if (title) {
    const gradient = ctx.createLinearGradient(0, 0, totalWidth, 0)
    gradient.addColorStop(0, '#261a10')
    gradient.addColorStop(1, '#4a2f19')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, totalWidth, headerHeight)

    ctx.fillStyle = '#f3e7d5'
    ctx.font = 'bold 22px sans-serif'
    ctx.textBaseline = 'middle'
    ctx.fillText(truncateLabel(title, 28), 16, headerHeight / 2 - 2)

    if (subtitle) {
      ctx.fillStyle = '#ceb690'
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      ctx.fillText(truncateLabel(subtitle, 40), totalWidth - 16, headerHeight / 2 + 4)
      ctx.textAlign = 'left'
    }
  }

  for (let i = 0; i < cols * rows; i++) {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = col * (cellWidth + gap)
    const y = headerHeight + row * (cellHeight + gap)

    const url = imageUrls[i]
    if (url) {
      try {
        const img = await loadImageFromUrl(url)
        ctx.save()
        ctx.beginPath()
        ctx.roundRect(x, y, cellWidth, cellHeight, cornerRadius)
        ctx.clip()

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

    ctx.strokeStyle = 'rgba(255,255,255,0.08)'
    ctx.lineWidth = 1
    ctx.strokeRect(x + 0.5, y + 0.5, cellWidth - 1, cellHeight - 1)

    if (showLabels) {
      const label = labels[i] ?? `#${i + 1}`
      const labelText = truncateLabel(label, 10)
      ctx.fillStyle = 'rgba(0,0,0,0.62)'
      ctx.fillRect(x + 6, y + 6, Math.max(42, labelText.length * 12), 20)
      ctx.fillStyle = '#ffffff'
      ctx.font = '12px sans-serif'
      ctx.fillText(labelText, x + 10, y + 20)
    }

    const caption = captions[i]?.trim()
    if (caption) {
      const safeCaption = truncateLabel(caption, Math.max(14, Math.floor(cellWidth / 18)))
      const overlayHeight = 22
      const overlayY = y + cellHeight - overlayHeight
      const overlay = ctx.createLinearGradient(0, overlayY, 0, y + cellHeight)
      overlay.addColorStop(0, 'rgba(0,0,0,0)')
      overlay.addColorStop(1, 'rgba(0,0,0,0.74)')
      ctx.fillStyle = overlay
      ctx.fillRect(x, overlayY - 10, cellWidth, overlayHeight + 10)
      ctx.fillStyle = '#f8f2ea'
      ctx.font = '11px sans-serif'
      ctx.fillText(safeCaption, x + 8, y + cellHeight - 8)
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
