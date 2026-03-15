import React, { useState, useRef, useCallback } from 'react'
import { GRID_LAYOUTS, CELL_ASPECT_RATIOS, selectBestGridImageSize } from '../../data/gridConfig'
import { selectShotsForGrid, buildGridDirectPrompt, GRID_NEGATIVE_PROMPT } from '../../services/gridGen'
import { composeGridCanvas, downloadCanvas } from '../../utils/gridCanvas'
import { callImageGenAPI } from '../../services/imageGen'
import { STYLE_MAP_EN } from '../../data/styleMap'
import { GLOBAL_NEGATIVE_PROMPT, STYLE_NEGATIVE_PROMPTS } from '../../data/negativePrompts'
import { useSettingsStore } from '../../store/useSettingsStore'
import type { ShotData } from '../../types'

interface GridModalProps {
  shots: ShotData[]
  styleKey: string
  onClose: () => void
}

const GridModal: React.FC<GridModalProps> = ({ shots, styleKey, onClose }) => {
  const { imageSettings } = useSettingsStore()
  const [layoutIdx, setLayoutIdx] = useState(0)
  const [cellAspect, setCellAspect] = useState('16:9')
  const [genMode, setGenMode] = useState<'direct' | 'compose'>('compose')
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState('')
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)

  const layout = GRID_LAYOUTS[layoutIdx]
  const gridCount = layout.cols * layout.rows

  const handleGenerate = useCallback(async () => {
    if (!imageSettings.key) { setError('请先配置图片生成 API Key'); return }
    setGenerating(true)
    setError('')
    setResultUrl(null)
    abortRef.current = new AbortController()

    try {
      const { shots: selected } = selectShotsForGrid(shots, gridCount)
      const styleEN = STYLE_MAP_EN[styleKey] ?? 'cinematic film still'
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const isInline = imageSettings.platformId !== 'doubao-image'
      const baseNeg = [GLOBAL_NEGATIVE_PROMPT, styleNeg].filter(Boolean).join(', ')
      // 直出模式追加宫格专用负向词
      const negativePrompt = genMode === 'direct'
        ? [baseNeg, GRID_NEGATIVE_PROMPT].filter(Boolean).join(', ')
        : (isInline ? baseNeg : baseNeg)

      if (genMode === 'direct') {
        // 单次直出
        const prompt = buildGridDirectPrompt(selected, layout.cols, layout.rows, styleEN)
        const gridSize = selectBestGridImageSize(layout.cols, layout.rows, cellAspect)
        const settingsForGrid = { ...imageSettings, imageResolution: gridSize, aspectRatio: cellAspect }
        setProgress('🎨 单次直出生成中...')
        const result = await callImageGenAPI(settingsForGrid, prompt, [], negativePrompt)
        if (result.b64) {
          setResultUrl(`data:image/jpeg;base64,${result.b64}`)
        } else if (result.url) {
          setResultUrl(result.url)
        }
      } else {
        // 逐格合成
        const [cw, ch] = cellAspect.split(':').map(Number)
        const cellPx = 512
        const cellW = cellPx
        const cellH = Math.round(cellPx * ch / cw)
        const imageUrls: string[] = []

        for (let i = 0; i < selected.length; i++) {
          if (abortRef.current.signal.aborted) break
          setProgress(`🎨 生成格子 ${i + 1}/${gridCount}...`)
          const shot = selected[i]
          const prompt = `${shot.scene}${shot.prompt ? ', ' + shot.prompt.slice(0, 120) : ''}, ${styleEN}`
          try {
            const result = await callImageGenAPI(imageSettings, prompt, [], negativePrompt)
            if (result.b64) {
              imageUrls.push(`data:image/jpeg;base64,${result.b64}`)
            } else if (result.url) {
              imageUrls.push(result.url)
            } else {
              imageUrls.push('')
            }
          } catch {
            imageUrls.push('')
          }
        }

        if (!abortRef.current.signal.aborted) {
          setProgress('🖼 合成画布中...')
          const canvas = await composeGridCanvas(imageUrls, {
            cols: layout.cols, rows: layout.rows,
            cellWidth: cellW, cellHeight: cellH,
            gap: 4, bgColor: '#000000', cornerRadius: 6,
            showLabels: true,
            labels: selected.map((s, i) => `#${i + 1}`),
          })
          setResultUrl(canvas.toDataURL('image/png'))
        }
      }
    } catch (e) {
      setError(String(e))
    }
    setProgress('')
    setGenerating(false)
  }, [shots, gridCount, layout, cellAspect, genMode, styleKey, imageSettings])

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `grid_${layout.cols}x${layout.rows}_${Date.now()}.png`
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-700">
          <h2 className="text-white font-medium">宫格生成</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* 选项区 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">网格格式</label>
              <select
                value={layoutIdx}
                onChange={e => setLayoutIdx(Number(e.target.value))}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none"
              >
                {GRID_LAYOUTS.map((l, i) => (
                  <option key={i} value={i}>{l.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">格子宽高比</label>
              <select
                value={cellAspect}
                onChange={e => setCellAspect(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none"
              >
                {CELL_ASPECT_RATIOS.map(r => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>
            <div className="col-span-2">
              <label className="text-xs text-gray-400 mb-1 block">生成模式</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGenMode('compose')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${genMode === 'compose' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
                >
                  逐格合成（高质量）
                </button>
                <button
                  onClick={() => setGenMode('direct')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${genMode === 'direct' ? 'bg-amber-600 border-amber-600 text-white' : 'bg-gray-800 border-gray-700 text-gray-400 hover:text-gray-200'}`}
                >
                  单次直出（快速）
                </button>
              </div>
            </div>
          </div>

          <p className="text-xs text-gray-500">
            共 {shots.length} 镜头，将均匀抽取 {gridCount} 镜组成 {layout.cols}×{layout.rows} 宫格
          </p>

          {error && <p className="text-xs text-red-400">{error}</p>}

          {/* 生成/下载按钮 */}
          <div className="flex gap-2">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition-colors"
            >
              {generating ? (progress || '生成中...') : '🎬 开始生成宫格'}
            </button>
            {generating && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-4 py-2.5 bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm rounded-lg"
              >
                取消
              </button>
            )}
          </div>

          {/* 预览区 */}
          {resultUrl && (
            <div className="space-y-2">
              <img src={resultUrl} alt="宫格预览" className="w-full rounded-lg" />
              <button
                onClick={handleDownload}
                className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-gray-200 text-sm rounded-lg"
              >
                ⬇ 下载宫格图
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default GridModal
