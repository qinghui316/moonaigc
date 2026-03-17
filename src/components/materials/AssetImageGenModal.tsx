import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { callImageGenAPI, uploadExternalImageUrl } from '../../services/imageGen'
import { ASSET_IMAGE_PROMPTS, ASSET_IMAGE_TYPE_LABELS } from '../../prompts/assetImage'
import { STYLE_MAP } from '../../data/styleMap'
import { IMAGE_PLATFORMS } from '../../data/platforms'
import type { AssetType, ImageGenSettings } from '../../types'

interface Props {
  type: AssetType
  index: number
  name: string
  desc: string
  styleKey?: string
  onClose: () => void
}

const AssetImageGenModal: React.FC<Props> = ({ type, index, name, desc, styleKey = 'cinematic', onClose }) => {
  const { imageSettings } = useSettingsStore()
  const setSlot = useMaterialStore(s => s.setSlotImage)
  const currentProjectId = useMaterialStore(s => s.currentProjectId)

  const currentImagePlatform = IMAGE_PLATFORMS.find(p => p.id === imageSettings.platformId) ?? IMAGE_PLATFORMS[0]
  const currentModelDef = currentImagePlatform.models.find(m => m.value === imageSettings.model)
  const effectiveAspectRatios = currentModelDef?.aspectRatios ?? currentImagePlatform.aspectRatios
  const effectiveResolutions = currentModelDef?.resolutions ?? currentImagePlatform.resolutions

  useEffect(() => {
    const { setImageSettings } = useSettingsStore.getState()
    const { imageSettings: s } = useSettingsStore.getState()
    const platform = IMAGE_PLATFORMS.find(p => p.id === s.platformId) ?? IMAGE_PLATFORMS[0]
    const modelDef = platform.models.find(m => m.value === s.model)
    const ratios = modelDef?.aspectRatios ?? platform.aspectRatios
    const ress = (modelDef?.resolutions ?? platform.resolutions).map(r => r.value)
    const updates: Partial<ImageGenSettings> = {}
    if (!ratios.includes(s.aspectRatio)) updates.aspectRatio = ratios[0] as ImageGenSettings['aspectRatio']
    if (!ress.includes(s.imageResolution)) updates.imageResolution = ress[0] as ImageGenSettings['imageResolution']
    if (Object.keys(updates).length > 0) setImageSettings(updates)
  }, [imageSettings.platformId, imageSettings.model]) // eslint-disable-line react-hooks/exhaustive-deps

  const styleDesc = STYLE_MAP[styleKey] ?? '概念艺术风格'
  const defaultPrompt = ASSET_IMAGE_PROMPTS[type]?.(name, desc, styleDesc) ?? `${desc}, ${styleDesc}, high quality`
  const [prompt, setPrompt] = useState(defaultPrompt)
  const [generating, setGenerating] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState('')

  const handleGenerate = async () => {
    if (!imageSettings.key) { setError('请先在设置中配置图片生成 API Key'); return }
    setError('')
    setGenerating(true)
    try {
      const result = await callImageGenAPI(imageSettings, prompt)
      let url = result.url
      if (result.b64) {
        try {
          const uploadResp = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: result.b64,
              mimeType: 'image/jpeg',
              refType: 'asset',
              refId: `${type}-${index}`,
              filename: `asset_${type}_${index}_${Date.now()}.jpg`,
              ...(currentProjectId ? { projectId: currentProjectId } : {}),
            }),
          })
          if (uploadResp.ok) {
            const data = await uploadResp.json() as { id: number; url: string }
            url = data.url
            setSlot(type, index, data.id, url)
          }
        } catch { /* ignore upload error */ }
        if (!url) {
          url = `data:image/jpeg;base64,${result.b64}`
          setSlot(type, index, 0, url)
        }
      } else if (url) {
        // 外部 URL（RunningHub 等），下载后存入数据库
        const uploaded = await uploadExternalImageUrl(url, {
          refType: 'asset',
          refId: `${type}-${index}`,
          filename: `asset_${type}_${index}_${Date.now()}.jpg`,
          ...(currentProjectId ? { projectId: currentProjectId } : {}),
        })
        if (uploaded) {
          url = uploaded.url
          setSlot(type, index, uploaded.id, url)
        } else {
          setSlot(type, index, 0, url)
        }
      }
      if (url) setPreviewUrl(url)
    } catch (e) {
      setError(String(e))
    }
    setGenerating(false)
  }

  const typeLabel = ASSET_IMAGE_TYPE_LABELS[type] ?? '资产图'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      {/* 宽弹窗：左控制区 + 右预览区 */}
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col">
        {/* 标题栏 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-800 shrink-0">
          <h3 className="text-amber-400 font-bold text-sm">🎨 生成资产图 — {name}（{typeLabel}）</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800">✕</button>
        </div>

        {/* 主体：左右分栏 */}
        <div className="flex flex-1 min-h-0 gap-0">
          {/* 左侧：控制区 */}
          <div className="flex flex-col gap-3 p-4 w-[52%] border-r border-gray-800">
            {/* 提示词 */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-gray-400">提示词（可编辑）</label>
                <button onClick={() => setPrompt(defaultPrompt)} className="text-xs text-amber-500 hover:text-amber-400">恢复默认</button>
              </div>
              <textarea
                value={prompt}
                onChange={e => setPrompt(e.target.value)}
                rows={6}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* 比例 + 清晰度 */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">比例</span>
              <select
                value={imageSettings.aspectRatio}
                onChange={e => useSettingsStore.getState().setImageSettings({ aspectRatio: e.target.value as ImageGenSettings['aspectRatio'] })}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500"
              >
                {effectiveAspectRatios.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <span className="text-xs text-gray-400 shrink-0">清晰度</span>
              <select
                value={imageSettings.imageResolution}
                onChange={e => useSettingsStore.getState().setImageSettings({ imageResolution: e.target.value as ImageGenSettings['imageResolution'] })}
                className="flex-1 bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none focus:border-amber-500"
              >
                {effectiveResolutions.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>

            {error && <p className="text-xs text-red-400">{error}</p>}

            {/* 按钮 */}
            <div className="flex gap-2 mt-auto">
              <button onClick={onClose} className="flex-1 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg transition-colors">取消</button>
              <button
                onClick={handleGenerate}
                disabled={generating}
                className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white font-medium text-sm rounded-lg disabled:opacity-50 transition-colors"
              >
                {generating ? '🎨 生成中...' : '🚀 开始生成'}
              </button>
            </div>
          </div>

          {/* 右侧：预览区 */}
          <div className="flex-1 p-4 flex flex-col items-center justify-center">
            {generating ? (
              <div className="flex flex-col items-center gap-3 text-gray-500">
                <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs">生成中，请稍候…</span>
              </div>
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="生成结果"
                className="max-w-full max-h-[360px] rounded-xl shadow-lg object-contain cursor-zoom-in"
                onClick={() => window.open(previewUrl, '_blank')}
              />
            ) : (
              <div className="w-full h-full min-h-[200px] flex flex-col items-center justify-center border border-dashed border-gray-700 rounded-xl text-gray-600 gap-2">
                <span className="text-3xl">🖼️</span>
                <span className="text-xs">点击「开始生成」后在此预览</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default AssetImageGenModal
