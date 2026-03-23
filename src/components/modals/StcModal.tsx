import React, { useState } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { generate } from '../../services/api'
import { buildStcCheckPrompt } from '../../prompts/stcCheck'
import type { StcQaResult } from '../../types'

interface StcModalProps {
  storyboardContent: string
  originalPlot?: string
  onClose: () => void
}

const STATUS_ICON = { pass: '✅', warn: '⚠️', fail: '❌' }
const STATUS_COLOR = { pass: 'text-green-400', warn: 'text-yellow-400', fail: 'text-red-400' }

const StcModal: React.FC<StcModalProps> = ({ storyboardContent, originalPlot = '', onClose }) => {
  const { textSettings } = useSettingsStore()
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<StcQaResult | null>(null)
  const [error, setError] = useState('')

  const handleCheck = async () => {
    if (!storyboardContent) { setError('暂无分镜内容可检测'); return }
    setLoading(true)
    setError('')
    try {
      const raw = await generate(
        [{ role: 'user', content: buildStcCheckPrompt({ originalPlot, storyboardContent }) }],
        textSettings
      )
      const parsed: StcQaResult = JSON.parse(raw.replace(/```json\n?|```/g, '').trim())
      setResult(parsed)
    } catch (e) {
      setError(`检测失败：${String(e)}`)
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-divider-strong rounded-xl w-full max-w-xl shadow-2xl max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-divider sticky top-0 bg-surface-1">
          <h3 className="text-indigo-400 font-semibold">🐱 STC 质量自检</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-4">
          <p className="text-xs text-gray-500">
            基于 Save the Cat (BS2) 方法论，检测分镜脚本中的3个核心质量指标
          </p>

          {!result && !loading && (
            <button onClick={handleCheck}
              className="w-full py-3 bg-brand-600 hover:bg-brand-500 text-white font-semibold rounded-lg transition-colors">
              🚀 开始 STC 自检
            </button>
          )}

          {loading && (
            <div className="flex items-center justify-center gap-3 py-8 text-indigo-400">
              <div className="w-5 h-5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm">AI正在自检中...</span>
            </div>
          )}

          {error && (
            <div className="text-sm text-red-400 bg-red-900/20 border border-red-800/30 px-3 py-2 rounded-lg">
              {error}
            </div>
          )}

          {result && (
            <div className="space-y-4">
              {/* Save Cat */}
              <div className="bg-surface-2 rounded-lg p-3 border border-divider">
                <div className="flex items-center gap-2 mb-2">
                  <span className={STATUS_ICON[result.saveCat.status] + ' text-base'}>{STATUS_ICON[result.saveCat.status]}</span>
                  <span className={`text-sm font-semibold ${STATUS_COLOR[result.saveCat.status]}`}>救猫咪时刻</span>
                </div>
                <p className="text-xs text-gray-400">{result.saveCat.detail}</p>
                {result.saveCat.suggestion && (
                  <p className="text-xs text-indigo-400 mt-1.5 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-800/30">
                    💡 {result.saveCat.suggestion}
                  </p>
                )}
              </div>

              {/* Double Magic */}
              <div className="bg-surface-2 rounded-lg p-3 border border-divider">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{STATUS_ICON[result.doubleMagic.status]}</span>
                  <span className={`text-sm font-semibold ${STATUS_COLOR[result.doubleMagic.status]}`}>双重魔法世界</span>
                </div>
                <p className="text-xs text-gray-400">{result.doubleMagic.detail}</p>
                {result.doubleMagic.settings?.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {result.doubleMagic.settings.map((s, i) => (
                      <div key={i} className="text-xs text-gray-500 flex items-start gap-1">
                        <span className="text-indigo-400">•</span>
                        <span>{s}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clichés */}
              <div className="bg-surface-2 rounded-lg p-3 border border-divider">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{result.cliches?.length > 0 ? '⚠️' : '✅'}</span>
                  <span className={`text-sm font-semibold ${result.cliches?.length > 0 ? 'text-yellow-400' : 'text-green-400'}`}>
                    陈词滥调检测 {result.cliches?.length > 0 ? `(${result.cliches.length}处)` : '(未发现)'}
                  </span>
                </div>
                {result.cliches?.map((c, i) => (
                  <div key={i} className="text-xs mb-2">
                    <div className="text-yellow-400">⚠ {c.original}</div>
                    <div className="text-gray-500 mt-0.5 ml-3">→ {c.direction}</div>
                  </div>
                ))}
              </div>

              <button onClick={handleCheck}
                className="w-full py-2 text-sm text-gray-400 border border-divider rounded-lg hover:bg-surface-3 transition-colors">
                🔄 重新检测
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default StcModal
