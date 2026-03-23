import React, { useState } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { generate } from '../../services/api'
import { buildSingleShotSystemPrompt, buildSingleShotUserPrompt } from '../../prompts/singleShot'

interface ShotEditModalProps {
  shotRow: string
  shotIndex: number
  onClose: () => void
  onApply: (newRow: string, index: number) => void
}

const ShotEditModal: React.FC<ShotEditModalProps> = ({ shotRow, shotIndex, onClose, onApply }) => {
  const { textSettings } = useSettingsStore()
  const [instruction, setInstruction] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState('')

  const handleEdit = async () => {
    if (!instruction.trim()) return
    setLoading(true)
    try {
      const newRow = await generate(
        [
          { role: 'system', content: buildSingleShotSystemPrompt() },
          { role: 'user', content: buildSingleShotUserPrompt({ originalRow: shotRow, editInstruction: instruction, shotIndex }) },
        ],
        textSettings
      )
      setResult(newRow.trim())
    } catch (e) {
      alert(`修改失败：${String(e)}`)
    }
    setLoading(false)
  }

  const handleApply = () => {
    if (result) {
      onApply(result, shotIndex)
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-indigo-400 font-semibold">✏️ 单镜精准修改 · 第{shotIndex + 1}镜</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">原始镜头</label>
            <div className="bg-gray-800 rounded-lg p-2 text-xs text-gray-400 border border-gray-700 line-clamp-3">
              {shotRow}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">修改要求</label>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={3}
              placeholder="例如：将景别改为特写，增加悲伤情绪，调整为夕阳光线..."
              className="w-full bg-gray-800 border border-gray-700 text-sm text-gray-200 px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
            />
          </div>

          {result && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">修改结果</label>
              <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-2 text-xs text-green-300">
                {result}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            取消
          </button>
          {result ? (
            <button onClick={handleApply} className="flex-1 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition-colors">
              ✅ 应用修改
            </button>
          ) : (
            <button onClick={handleEdit} disabled={loading || !instruction.trim()}
              className="flex-1 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'AI修改中...' : '🎯 AI修改'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ShotEditModal
