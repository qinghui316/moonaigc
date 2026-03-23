import React, { useState, useRef, useCallback } from 'react'
import { GRID_LAYOUTS, CELL_ASPECT_RATIOS, selectBestGridImageSize } from '../../data/gridConfig'
import { selectShotsForGrid, assembleGridPrompt, GRID_NEGATIVE_PROMPT } from '../../services/gridGen'
import { composeGridCanvas } from '../../utils/gridCanvas'
import { callImageGenAPI, uploadExternalImageUrl } from '../../services/imageGen'
import { collectRefImages, buildRefImageDescs, loadRefImageBase64s } from '../../services/refImageCollector'
import { parseSeedanceFields, buildStructuredInput, refinePromptViaAI } from '../../services/imagePrompt'
import { STYLE_MAP_EN } from '../../data/styleMap'
import { GLOBAL_NEGATIVE_PROMPT, STYLE_NEGATIVE_PROMPTS } from '../../data/negativePrompts'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useShotStore } from '../../store/useShotStore'
import type { ShotData } from '../../types'

interface GridModalProps {
  shots: ShotData[]
  styleKey: string
  projectId?: string
  episodeId?: string
  onClose: () => void
  onGridSaved?: (url: string) => void
}

const GridModal: React.FC<GridModalProps> = ({ shots, styleKey, projectId, episodeId, onClose, onGridSaved }) => {
  const { textSettings, imageSettings } = useSettingsStore()
  const { materials } = useMaterialStore()
  const { shotImages, setEditedPrompt } = useShotStore()
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
      const selection = selectShotsForGrid(shots, gridCount)
      const { shots: selected, roleLabels } = selection
      const styleEN = STYLE_MAP_EN[styleKey] ?? 'cinematic film still'
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const isInline = imageSettings.platformId !== 'doubao-image'
      const baseNeg = [GLOBAL_NEGATIVE_PROMPT, styleNeg].filter(Boolean).join(', ')
      // 直出模式追加宫格专用负向词
      const negativePrompt = genMode === 'direct'
        ? [baseNeg, GRID_NEGATIVE_PROMPT].filter(Boolean).join(', ')
        : (isInline ? baseNeg : baseNeg)

      if (genMode === 'direct') {
        // selectBestGridImageSize 返回豆包像素格式，只对豆包平台使用；其他平台保持原分辨率档位
        const gridSize = imageSettings.platformId === 'doubao-image'
          ? selectBestGridImageSize(layout.cols, layout.rows, cellAspect)
          : imageSettings.imageResolution
        const settingsForGrid = {
          ...imageSettings,
          imageResolution: gridSize as typeof imageSettings.imageResolution,
          aspectRatio: cellAspect as typeof imageSettings.aspectRatio,
        }

        // 从所有选中镜头的 prompt 中收集有图的素材参考图（去重）
        const seenIds = new Set<number>()
        const materialRefs = selected.flatMap(shot => {
          const originalIndex = shots.indexOf(shot)
          const savedRefs = useShotStore.getState().selectedMaterialRefs[originalIndex]
          const refs = savedRefs ?? collectRefImages(shot.prompt, materials, undefined, { includeFallback: false }).map(ref => ({
            name: ref.name,
            type: ref.type,
            desc: ref.desc,
            imageUrl: ref.imageUrl,
            imageFileId: ref.imageFileId,
          }))
          return refs.filter(ref => {
            if (seenIds.has(ref.imageFileId)) return false
            seenIds.add(ref.imageFileId)
            return true
          }).map(ref => ({ ...ref, tag: `@${ref.name}` }))
        })
        const localRefs = selected.flatMap(shot => {
          const originalIndex = shots.indexOf(shot)
          return useShotStore.getState().selectedLocalRefs[originalIndex] ?? []
        })
        const uniqueLocalRefs = localRefs.filter((ref, index, arr) => arr.findIndex(item => item.id === ref.id) === index)
        const refBase64s = [
          ...await loadRefImageBase64s(materialRefs),
          ...uniqueLocalRefs.map(ref => ({ base64: ref.base64, mimeType: ref.mimeType })),
        ]
        const refImageIds = materialRefs.map(r => r.imageFileId)

        // 1. 每格：优先用已精炼的提示词，未精炼的并发调 AI 精炼
        const { editedPrompts } = useShotStore.getState()
        const needRefineIndices: number[] = []
        const preResults: (string | null)[] = selected.map((shot) => {
          const originalIndex = shots.indexOf(shot)
          const saved = editedPrompts[originalIndex]
          if (saved) return saved
          needRefineIndices.push(selected.indexOf(shot))
          return null
        })

        if (needRefineIndices.length > 0 && textSettings.key) {
          setProgress(`✨ AI并发精炼 ${needRefineIndices.length} 格提示词（${selected.length - needRefineIndices.length} 格已缓存）...`)
          let doneCount = 0
          const refineResults = await Promise.all(
            needRefineIndices.map(async (idx) => {
              const shot = selected[idx]
              const fields = parseSeedanceFields(shot.prompt, {
                shotType: shot.shotType, camera: shot.camera,
                scene: shot.scene, lighting: shot.lighting,
              })
              const structured = buildStructuredInput(fields, '', shot.scene, materials)
              const refs = collectRefImages(shot.prompt, materials)
              const refDescs = buildRefImageDescs(refs)
              try {
                const refined = await refinePromptViaAI(structured, textSettings, refDescs)
                const originalIndex = shots.indexOf(shot)
                if (originalIndex >= 0) setEditedPrompt(originalIndex, refined)
                doneCount++
                setProgress(`✨ AI精炼 ${doneCount}/${needRefineIndices.length}`)
                return refined
              } catch {
                doneCount++
                return structured.replace(/\n/g, ' | ').slice(0, 200)
              }
            })
          )
          let ri = 0
          for (const idx of needRefineIndices) {
            preResults[idx] = refineResults[ri++]
          }
        }

        // 未精炼且无 API Key 的降级为结构化文本
        const refinedDescs = preResults.map((desc, idx) => {
          if (desc) return desc
          const shot = selected[idx]
          const fields = parseSeedanceFields(shot.prompt, {
            shotType: shot.shotType, camera: shot.camera,
            scene: shot.scene, lighting: shot.lighting,
          })
          return buildStructuredInput(fields, '', shot.scene, materials).replace(/\n/g, ' | ').slice(0, 200)
        })

        // 2. 用精炼后的描述组装宫格提示词
        const prompt = assembleGridPrompt(
          refinedDescs,
          layout.cols,
          layout.rows,
          styleEN,
          roleLabels,
          buildRefImageDescs(materialRefs)
        )
        setProgress('🎨 生成宫格图中...')
        const result = await callImageGenAPI(settingsForGrid, prompt, refBase64s, negativePrompt, refImageIds)
        if (result.b64) {
          const dataUrl = `data:image/jpeg;base64,${result.b64}`
          setResultUrl(dataUrl)
          // 保存宫格图到数据库
          const saved = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: result.b64, mimeType: 'image/jpeg', refType: 'grid',
              ...(projectId ? { projectId } : {}),
              ...(episodeId ? { episodeId } : {}),
            }),
          })
          if (saved.ok) {
            const { url } = await saved.json() as { url: string }
            onGridSaved?.(url)
          }
        } else if (result.url) {
          setResultUrl(result.url)
          // 外部 URL 下载后保存
          const uploaded = await uploadExternalImageUrl(result.url, {
            refType: 'grid',
            ...(projectId ? { projectId } : {}),
            ...(episodeId ? { episodeId } : {}),
          })
          if (uploaded) onGridSaved?.(uploaded.url)
        }
      } else {
        // 逐格合成：使用 shotStore 中已生成的分镜图，不再重新调 API
        const [cw, ch] = cellAspect.split(':').map(Number)
        const cellPx = 512
        const cellW = cellPx
        const cellH = Math.round(cellPx * ch / cw)

        // 收集每格对应的已生成图片 URL（按 rowIndex 匹配）
        const imageUrls: string[] = selected.map((shot) => {
          // selected 镜头的 rowIndex 存在 shot 上（从 shots 数组的原始索引）
          const originalIndex = shots.indexOf(shot)
          const img = shotImages[originalIndex]
          return img?.url ?? ''
        })

        const hasAnyImage = imageUrls.some(u => u !== '')
        if (!hasAnyImage) {
          setError('逐格合成模式需要已有分镜图，请先在 AI 生图页面生成分镜图后再使用')
          setGenerating(false)
          return
        }

        setProgress('🖼 合成画布中...')
        const captions = selected.map(shot => shot.scene.replace(/\s+/g, ' ').trim()).map(text => text.slice(0, 28))
        const canvas = await composeGridCanvas(imageUrls, {
          cols: layout.cols, rows: layout.rows,
          cellWidth: cellW, cellHeight: cellH,
          gap: 4, bgColor: '#000000', cornerRadius: 6,
          showLabels: true,
          labels: roleLabels.map((label, i) => `${i + 1} ${label}`),
          title: `${layout.label}故事板`,
          subtitle: genMode === 'compose' ? 'Compose' : 'Direct',
          captions,
        })
        const composeDataUrl = canvas.toDataURL('image/png')
        setResultUrl(composeDataUrl)
        // 保存合成宫格图
        const b64 = composeDataUrl.split(',')[1]
        if (b64) {
          const saved = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: b64, mimeType: 'image/png', refType: 'grid',
              ...(projectId ? { projectId } : {}),
              ...(episodeId ? { episodeId } : {}),
            }),
          })
          if (saved.ok) {
            const { url } = await saved.json() as { url: string }
            onGridSaved?.(url)
          }
        }
      }
    } catch (e) {
      setError(String(e))
    }
    setProgress('')
    setGenerating(false)
  }, [shots, gridCount, layout, cellAspect, genMode, styleKey, imageSettings, projectId, episodeId, onGridSaved, textSettings, materials, shotImages, setEditedPrompt])

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `grid_${layout.cols}x${layout.rows}_${Date.now()}.png`
    link.click()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-surface-1 rounded-xl border border-divider-strong w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-divider">
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
                className="w-full bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40"
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
                className="w-full bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40"
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
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${genMode === 'compose' ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-600/20' : 'bg-surface-2 border-divider text-gray-400 hover:text-gray-200'}`}
                >
                  逐格合成
                </button>
                <button
                  onClick={() => setGenMode('direct')}
                  className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${genMode === 'direct' ? 'bg-brand-600 border-brand-600 text-white shadow-sm shadow-brand-600/20' : 'bg-surface-2 border-divider text-gray-400 hover:text-gray-200'}`}
                >
                  单次直出（快速）
                </button>
              </div>
              {genMode === 'compose' && (
                <p className="text-xs text-gray-500 mt-1.5">使用已生成的分镜图合成，请先在 AI 生图页面生成分镜图</p>
              )}
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
              className="flex-1 py-2.5 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg shadow-sm shadow-brand-600/20 disabled:opacity-50 transition-colors"
            >
              {generating ? (progress || '生成中...') : '🎬 开始生成宫格'}
            </button>
            {generating && (
              <button
                onClick={() => abortRef.current?.abort()}
                className="px-4 py-2.5 bg-surface-2 hover:bg-surface-3 text-gray-200 text-sm rounded-lg"
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
                className="w-full py-2 bg-surface-2 hover:bg-surface-3 text-gray-200 text-sm rounded-lg"
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
