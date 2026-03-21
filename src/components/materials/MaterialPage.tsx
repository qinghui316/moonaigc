import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { generate } from '../../services/api'
import { callImageGenAPI, uploadExternalImageUrl } from '../../services/imageGen'
import { EXTRACT_SYSTEM_PROMPT, buildExtractUserPrompt } from '../../prompts/extract'
import { ASSET_IMAGE_PROMPTS } from '../../prompts/assetImage'
import { STYLE_MAP, STYLE_OPTIONS } from '../../data/styleMap'
import AssetImageGenModal from './AssetImageGenModal'
import type { AssetType, ExtractionResult } from '../../types'

const SLOT_COUNT = 10

const TYPE_LABELS: Record<AssetType, string> = {
  character: '角色 (@人物)',
  image: '场景 (@图片)',
  props: '道具 (@道具)',
}

interface AssetImageGenTarget {
  type: AssetType
  index: number
  name: string
  desc: string
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

const MaterialPage: React.FC = () => {
  const {
    materials,
    tagMode,
    setSlot,
    clearSlot,
    setTagMode,
    bulkFill,
    setSlotImage,
    clearSlotImage,
  } = useMaterialStore()
  const { textSettings, imageSettings, assetStyleKey, setAssetStyleKey } = useSettingsStore()

  const [activeType, setActiveType] = useState<AssetType>('character')
  const [extracting, setExtracting] = useState(false)
  const [extractPlot, setExtractPlot] = useState('')
  const [showExtractModal, setShowExtractModal] = useState(false)
  const [assetGenTarget, setAssetGenTarget] = useState<AssetImageGenTarget | null>(null)
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchProgress, setBatchProgress] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [reversingSlot, setReversingSlot] = useState<number | null>(null)
  const batchAbortRef = useRef<AbortController | null>(null)

  useEffect(() => () => {
    batchAbortRef.current?.abort()
  }, [])

  const handleExtract = async () => {
    if (!extractPlot.trim()) return
    setExtracting(true)
    try {
      const result = await generate(
        [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractUserPrompt(extractPlot) },
        ],
        textSettings,
      )
      const parsed: ExtractionResult = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
      if (parsed.characters?.length) {
        bulkFill('character', parsed.characters.map(item => ({ name: item.name, desc: item.visual_desc })))
      }
      if (parsed.scenes?.length) {
        bulkFill('image', parsed.scenes.map(item => ({ name: item.name, desc: item.visual_desc })))
      }
      if (parsed.props?.length) {
        bulkFill('props', parsed.props.map(item => ({ name: item.name, desc: item.visual_desc })))
      }
      setShowExtractModal(false)
    } catch (err) {
      alert(`提取失败：${String(err)}`)
    } finally {
      setExtracting(false)
    }
  }

  const handleBatchGenImages = async () => {
    if (batchGenerating) {
      batchAbortRef.current?.abort()
      return
    }
    if (!imageSettings.key) {
      alert('请先在设置中配置图片生成 API Key')
      return
    }

    const pendingSlots = materials[activeType]
      .map((slot, index) => ({ slot, index }))
      .filter(({ slot }) => !!slot.name && !slot.imageFileId)

    if (pendingSlots.length === 0) {
      alert('当前类型没有剩余素材可生成')
      return
    }

    const abortController = new AbortController()
    batchAbortRef.current = abortController
    setBatchGenerating(true)
    let completed = 0

    try {
      for (let i = 0; i < pendingSlots.length; i++) {
        const { slot, index } = pendingSlots[i]
        if (!slot.name) continue

        setBatchProgress(`生成中 ${i + 1}/${pendingSlots.length}：${slot.name}`)

        try {
          const styleDesc = STYLE_MAP[assetStyleKey] ?? '概念艺术风格'
          const prompt = ASSET_IMAGE_PROMPTS[activeType]?.(slot.name, slot.desc, styleDesc) ?? `${slot.desc}, ${styleDesc}`
          const result = await callImageGenAPI(
            imageSettings,
            prompt,
            undefined,
            undefined,
            undefined,
            abortController.signal,
          )

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
                  refId: `${activeType}-${index}`,
                  filename: `asset_${activeType}_${index}_${Date.now()}.jpg`,
                }),
                signal: abortController.signal,
              })
              if (uploadResp.ok) {
                const data = await uploadResp.json() as { id: number; url: string }
                url = data.url
                setSlotImage(activeType, index, data.id, url)
              }
            } catch (err) {
              if (isAbortError(err)) throw err
            }
            if (!url) {
              url = `data:image/jpeg;base64,${result.b64}`
              setSlotImage(activeType, index, 0, url)
            }
          } else if (url) {
            const uploaded = await uploadExternalImageUrl(url, {
              refType: 'asset',
              refId: `${activeType}-${index}`,
              filename: `asset_${activeType}_${index}_${Date.now()}.jpg`,
            }, abortController.signal)
            if (uploaded) {
              setSlotImage(activeType, index, uploaded.id, uploaded.url)
            } else {
              setSlotImage(activeType, index, 0, url)
            }
          }
          completed += 1
        } catch (err) {
          if (isAbortError(err)) {
            setBatchProgress(`已取消（已完成 ${completed}/${pendingSlots.length}）`)
            return
          }
          // keep processing remaining slots
        }
      }

      setBatchProgress('')
    } finally {
      batchAbortRef.current = null
      setBatchGenerating(false)
    }
  }

  const handleReverseImage = useCallback(async (slotIndex: number, imageUrl: string) => {
    if (!textSettings.key) {
      alert('请先配置文字 AI API Key')
      return
    }
    setReversingSlot(slotIndex)
    try {
      const imgResp = await fetch(imageUrl)
      const blob = await imgResp.blob()
      const b64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve((reader.result as string).split(',')[1])
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })
      const mimeType = blob.type || 'image/jpeg'
      const assetLabel = activeType === 'character' ? '角色人物' : activeType === 'image' ? '场景环境' : '道具物品'
      const systemPrompt = `你是专业的影视素材描述员。请根据图片，用50-120字中文精确描述这个${assetLabel}的外观特征，包括：外貌、结构、颜色、材质、风格等视觉细节。仅输出描述文字，不要标题或解释。`

      const messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image_url', image_url: { url: `data:${mimeType};base64,${b64}` } },
            { type: 'text', text: '请描述这个素材的视觉特征。' },
          ],
        },
      ]
      const result = await generate(messages as Parameters<typeof generate>[0], textSettings)
      if (result) {
        setSlot(activeType, slotIndex, { desc: result.trim() })
      }
    } catch (err) {
      alert(`反推失败：${String(err)}`)
    } finally {
      setReversingSlot(null)
    }
  }, [activeType, setSlot, textSettings])

  const slots = materials[activeType]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-amber-400 font-semibold">素材资产库</h2>
        <div className="flex items-center gap-2">
          <select
            value={assetStyleKey}
            onChange={e => setAssetStyleKey(e.target.value)}
            className="px-2 py-1.5 bg-gray-800 text-gray-300 border border-gray-700 rounded-lg text-xs focus:outline-none focus:border-amber-500"
            title="生图风格"
          >
            {STYLE_OPTIONS.map(option => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
          <button
            onClick={handleBatchGenImages}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-400 border border-purple-700/50 rounded-lg text-xs hover:bg-purple-600/30 transition-colors disabled:opacity-50"
          >
            {batchGenerating ? '取消生成' : '🎨 批量生成剩余素材图'}
          </button>
          <button
            onClick={() => setShowExtractModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 text-amber-400 border border-amber-700/50 rounded-lg text-xs hover:bg-amber-600/30 transition-colors"
          >
            ✨ AI提取素材
          </button>
        </div>
      </div>

      {batchProgress && (
        <div className="px-4 py-2 border-b border-gray-800 text-xs text-amber-400 shrink-0">
          {batchProgress}
        </div>
      )}

      <div className="flex gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
        {(['character', 'image', 'props'] as AssetType[]).map(type => {
          const filled = materials[type].filter(item => item.name).length
          const withImg = materials[type].filter(item => item.imageUrl).length
          return (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                activeType === type ? 'border-amber-500 bg-amber-900/30 text-amber-300' : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}
            >
              {TYPE_LABELS[type]}
              {filled > 0 && <span className="ml-1.5 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{filled}</span>}
              {withImg > 0 && <span className="ml-1 bg-purple-600 text-white text-xs px-1 py-0.5 rounded-full">图{withImg}</span>}
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/30 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-500">
          {tagMode[activeType] ? '✅ @标签模式：AI提示词中将使用 @标签 引用资产' : '📝 描述模式：AI提示词中将直接使用文字描述'}
        </span>
        <label className="flex items-center gap-2 cursor-pointer">
          <span className="text-xs text-gray-400">@标签模式</span>
          <div
            onClick={() => setTagMode(activeType, !tagMode[activeType])}
            className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${tagMode[activeType] ? 'bg-amber-500' : 'bg-gray-700'}`}
          >
            <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${tagMode[activeType] ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </div>
        </label>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: SLOT_COUNT }).map((_, index) => {
            const slot = slots[index]
            const isEmpty = !slot?.name && !slot?.desc

            return (
              <div
                key={index}
                className={`bg-gray-800/50 rounded-xl border p-3 flex gap-3 ${isEmpty ? 'border-gray-700/50 border-dashed' : 'border-gray-700'}`}
              >
                <div className="flex-1 min-w-0 flex flex-col">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold shrink-0 ${isEmpty ? 'bg-gray-700 text-gray-500' : 'bg-amber-600 text-white'}`}>
                      {index + 1}
                    </div>
                    <input
                      type="text"
                      placeholder={`${activeType === 'character' ? '角色名' : activeType === 'image' ? '场景名' : '道具名'}...`}
                      value={slot?.name ?? ''}
                      onChange={e => setSlot(activeType, index, { name: e.target.value })}
                      className="flex-1 min-w-0 bg-transparent text-xs text-gray-200 placeholder-gray-600 border-b border-transparent hover:border-gray-600 focus:border-amber-500 focus:outline-none px-1 py-0.5"
                    />
                    {!isEmpty && (
                      <button
                        onClick={() => clearSlot(activeType, index)}
                        className="text-gray-600 hover:text-red-400 transition-colors text-xs shrink-0"
                      >
                        ×
                      </button>
                    )}
                  </div>

                  <textarea
                    placeholder="视觉描述（中文或英文）..."
                    value={slot?.desc ?? ''}
                    onChange={e => setSlot(activeType, index, { desc: e.target.value })}
                    rows={3}
                    className="w-full bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-gray-300 placeholder-gray-600 px-2 py-1.5 resize-none focus:outline-none focus:border-amber-500 flex-1"
                  />

                  {tagMode[activeType] && slot?.name && (
                    <div className="mt-1.5 flex items-center gap-1">
                      <span className="text-xs text-amber-400 font-mono bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30">@{slot.name}</span>
                      <span className="text-xs text-gray-600">标签</span>
                    </div>
                  )}

                  {slot?.name && slot?.desc && (
                    <button
                      onClick={() => setAssetGenTarget({ type: activeType, index, name: slot.name, desc: slot.desc })}
                      className="mt-2 w-full text-xs py-1.5 bg-purple-600/20 text-purple-400 border border-purple-700/50 rounded-lg hover:bg-purple-600/30 transition-colors"
                    >
                      {slot.imageUrl ? '🔁 重新生成' : '🎨 生成图片'}
                    </button>
                  )}
                </div>

                <div className="relative shrink-0 w-24 group rounded-lg overflow-hidden self-stretch">
                  {slot?.imageUrl ? (
                    <>
                      <img
                        src={slot.imageUrl}
                        alt="资产图"
                        onClick={() => setLightboxSrc(slot.imageUrl ?? null)}
                        className="w-full h-full object-cover cursor-zoom-in"
                      />
                      <button
                        onClick={() => void clearSlotImage(activeType, index)}
                        className="absolute top-1 right-1 text-xs bg-red-600/80 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        ×
                      </button>
                      <button
                        onClick={() => void handleReverseImage(index, slot.imageUrl!)}
                        disabled={reversingSlot === index}
                        className="absolute bottom-1 left-1 right-1 text-xs bg-blue-600/90 text-white py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-70"
                        title="AI识别图片内容并自动填写描述"
                      >
                        {reversingSlot === index ? '识别中...' : '🧠 反推描述'}
                      </button>
                    </>
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-900/40 border border-dashed border-gray-700 rounded-lg text-gray-700 min-h-[80px]">
                      <span className="text-xl">🖼️</span>
                      <span className="text-xs mt-0.5">暂无图</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {assetGenTarget && (
        <AssetImageGenModal
          type={assetGenTarget.type}
          index={assetGenTarget.index}
          name={assetGenTarget.name}
          desc={assetGenTarget.desc}
          styleKey={assetStyleKey}
          onClose={() => setAssetGenTarget(null)}
        />
      )}

      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="预览" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/50 rounded-full hover:bg-black/70"
            onClick={() => setLightboxSrc(null)}
          >
            ×
          </button>
        </div>
      )}

      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-amber-400 font-semibold">✨ AI自动提取素材</h3>
              <button onClick={() => setShowExtractModal(false)} className="text-gray-400 hover:text-white">×</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">粘贴故事情节，AI 将自动提取人物、场景、道具并填入对应卡位。</p>
              <textarea
                value={extractPlot}
                onChange={e => setExtractPlot(e.target.value)}
                rows={6}
                placeholder="粘贴故事情节..."
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button
                onClick={() => setShowExtractModal(false)}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExtract}
                disabled={extracting || !extractPlot.trim()}
                className="flex-1 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50"
              >
                {extracting ? '提取中...' : '开始提取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialPage
