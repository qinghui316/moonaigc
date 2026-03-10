import React, { useState } from 'react'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { generate } from '../../services/api'
import { EXTRACT_SYSTEM_PROMPT, buildExtractUserPrompt } from '../../prompts/extract'
import type { AssetType, ExtractionResult } from '../../types'

const SLOT_COUNT = 10
const TYPE_LABELS: Record<AssetType, string> = {
  character: '👤 角色 (@人物)',
  image: '🏞️ 场景 (@图片)',
  props: '🔑 道具 (@道具)',
}

const MaterialPage: React.FC = () => {
  const { materials, tagMode, setSlot, clearSlot, setTagMode, bulkFill } = useMaterialStore()
  const { textSettings } = useSettingsStore()
  const [activeType, setActiveType] = useState<AssetType>('character')
  const [extracting, setExtracting] = useState(false)
  const [extractPlot, setExtractPlot] = useState('')
  const [showExtractModal, setShowExtractModal] = useState(false)

  const handleExtract = async () => {
    if (!extractPlot.trim()) return
    setExtracting(true)
    try {
      const result = await generate(
        [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractUserPrompt(extractPlot) },
        ],
        textSettings
      )
      const parsed: ExtractionResult = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
      if (parsed.characters?.length) {
        bulkFill('character', parsed.characters.map(c => ({ name: c.name, desc: c.visual_desc })))
      }
      if (parsed.scenes?.length) {
        bulkFill('image', parsed.scenes.map(s => ({ name: s.name, desc: s.visual_desc })))
      }
      if (parsed.props?.length) {
        bulkFill('props', parsed.props.map(p => ({ name: p.name, desc: p.visual_desc })))
      }
      setShowExtractModal(false)
    } catch (e) {
      alert(`提取失败：${String(e)}`)
    }
    setExtracting(false)
  }

  const slots = materials[activeType]

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-amber-400 font-semibold">素材资产库</h2>
        <button
          onClick={() => setShowExtractModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-600/20 text-amber-400 border border-amber-700/50 rounded-lg text-xs hover:bg-amber-600/30 transition-colors"
        >
          ✨ AI提取素材
        </button>
      </div>

      {/* Type Tabs */}
      <div className="flex gap-2 px-4 py-2 border-b border-gray-800 shrink-0">
        {(['character', 'image', 'props'] as AssetType[]).map(t => {
          const filled = materials[t].filter(m => m.name).length
          return (
            <button key={t} onClick={() => setActiveType(t)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                activeType === t
                  ? 'border-amber-500 bg-amber-900/30 text-amber-300'
                  : 'border-gray-700 text-gray-400 hover:border-gray-600'
              }`}>
              {TYPE_LABELS[t]}
              {filled > 0 && <span className="ml-1.5 bg-amber-600 text-white text-xs px-1.5 py-0.5 rounded-full">{filled}</span>}
            </button>
          )
        })}
      </div>

      {/* @Tag Mode Toggle */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-800/30 border-b border-gray-800 shrink-0">
        <span className="text-xs text-gray-500">
          {tagMode[activeType]
            ? '✅ @标签模式：AI提示词中将使用 @标签 引用资产'
            : '📝 描述模式：AI提示词中将内嵌文字描述'}
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

      {/* Slots Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {Array.from({ length: SLOT_COUNT }).map((_, i) => {
            const slot = slots[i]
            const isEmpty = !slot?.name && !slot?.desc
            return (
              <div key={i} className={`bg-gray-800/50 rounded-xl border p-3 ${isEmpty ? 'border-gray-700/50 border-dashed' : 'border-gray-700'}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-5 h-5 rounded flex items-center justify-center text-xs font-bold ${isEmpty ? 'bg-gray-700 text-gray-500' : 'bg-amber-600 text-white'}`}>
                    {i + 1}
                  </div>
                  <input
                    type="text"
                    placeholder={`${activeType === 'character' ? '角色名' : activeType === 'image' ? '场景名' : '道具名'}...`}
                    value={slot?.name ?? ''}
                    onChange={e => setSlot(activeType, i, { name: e.target.value })}
                    className="flex-1 bg-transparent text-xs text-gray-200 placeholder-gray-600 border-b border-transparent hover:border-gray-600 focus:border-amber-500 focus:outline-none px-1 py-0.5"
                  />
                  {!isEmpty && (
                    <button onClick={() => clearSlot(activeType, i)}
                      className="text-gray-600 hover:text-red-400 transition-colors text-xs">✕</button>
                  )}
                </div>
                <textarea
                  placeholder="视觉描述（中文或英文）..."
                  value={slot?.desc ?? ''}
                  onChange={e => setSlot(activeType, i, { desc: e.target.value })}
                  rows={3}
                  className="w-full bg-gray-900/50 border border-gray-700 rounded-lg text-xs text-gray-300 placeholder-gray-600 px-2 py-1.5 resize-none focus:outline-none focus:border-amber-500"
                />
                {tagMode[activeType] && slot?.name && (
                  <div className="mt-1.5 flex items-center gap-1">
                    <span className="text-xs text-amber-400 font-mono bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30">
                      @{slot.name}
                    </span>
                    <span className="text-xs text-gray-600">→ 在提示词中使用此标签</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Extract Modal */}
      {showExtractModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-amber-400 font-semibold">✨ AI自动提取素材</h3>
              <button onClick={() => setShowExtractModal(false)} className="text-gray-400 hover:text-white">✕</button>
            </div>
            <div className="p-4 space-y-3">
              <p className="text-xs text-gray-500">粘贴故事情节，AI将自动提取人物、场景、道具，填入对应卡位。</p>
              <textarea
                value={extractPlot}
                onChange={e => setExtractPlot(e.target.value)}
                rows={6}
                placeholder="粘贴故事情节..."
                className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>
            <div className="flex gap-2 p-4 pt-0">
              <button onClick={() => setShowExtractModal(false)}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
                取消
              </button>
              <button onClick={handleExtract} disabled={extracting || !extractPlot.trim()}
                className="flex-1 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors disabled:opacity-50">
                {extracting ? '提取中...' : '🚀 开始提取'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default MaterialPage
