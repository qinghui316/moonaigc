import React from 'react'
import type { SafetyResult } from '../../types'

interface SafetyModalProps {
  result: SafetyResult
  onApply: () => void
  onClose: () => void
}

const SafetyModal: React.FC<SafetyModalProps> = ({ result, onApply, onClose }) => {
  const hasIssues = result.detectedRedZone.length > 0 || result.detectedYellowZone.length > 0 ||
    result.detectedCelebrity.length > 0 || result.detectedIP.length > 0

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg shadow-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 sticky top-0 bg-gray-900">
          <h3 className="text-amber-400 font-semibold">🛡️ 安全审核报告</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {result.replacedRedZone.length > 0 && (
            <div className="bg-red-900/20 border border-red-700/50 rounded-lg p-3">
              <div className="text-red-400 text-xs font-semibold mb-2">🔴 红区词（已自动替换 {result.replacedRedZone.length} 处）</div>
              <div className="space-y-1">
                {result.replacedRedZone.slice(0, 5).map((r, i) => (
                  <div key={i} className="text-xs flex items-center gap-2">
                    <span className="text-red-400 line-through">{r.bad}</span>
                    <span className="text-gray-500">→</span>
                    <span className="text-green-400">{r.good}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.replacedYellowZone.length > 0 && (
            <div className="bg-yellow-900/20 border border-yellow-700/50 rounded-lg p-3">
              <div className="text-yellow-400 text-xs font-semibold mb-2">🟡 黄区词（已自动替换 {result.replacedYellowZone.length} 处）</div>
              <div className="flex flex-wrap gap-1.5">
                {result.replacedYellowZone.slice(0, 8).map((r, i) => (
                  <span key={i} className="text-xs text-yellow-400 bg-yellow-900/30 px-1.5 py-0.5 rounded">{r.bad} → {r.good}</span>
                ))}
              </div>
            </div>
          )}

          {result.detectedRedZone.length > 0 && (
            <div className="bg-red-900/30 border border-red-600/50 rounded-lg p-3">
              <div className="text-red-300 text-xs font-semibold mb-2">⚠️ 未替换红区词（需手动处理）</div>
              <div className="flex flex-wrap gap-1.5">
                {result.detectedRedZone.map((w, i) => (
                  <span key={i} className="text-xs text-red-300 bg-red-800/40 px-1.5 py-0.5 rounded">{w}</span>
                ))}
              </div>
            </div>
          )}

          {result.detectedCelebrity.length > 0 && (
            <div className="bg-orange-900/20 border border-orange-700/50 rounded-lg p-3">
              <div className="text-orange-400 text-xs font-semibold mb-2">👤 检测到名人（注意肖像权）</div>
              <div className="flex flex-wrap gap-1.5">
                {result.detectedCelebrity.map((w, i) => (
                  <span key={i} className="text-xs text-orange-400 bg-orange-900/30 px-1.5 py-0.5 rounded">{w}</span>
                ))}
              </div>
            </div>
          )}

          {result.detectedIP.length > 0 && (
            <div className="bg-purple-900/20 border border-purple-700/50 rounded-lg p-3">
              <div className="text-purple-400 text-xs font-semibold mb-2">©️ 检测到IP词（注意版权）</div>
              <div className="flex flex-wrap gap-1.5">
                {result.detectedIP.map((w, i) => (
                  <span key={i} className="text-xs text-purple-400 bg-purple-900/30 px-1.5 py-0.5 rounded">{w}</span>
                ))}
              </div>
            </div>
          )}

          {!hasIssues && result.replaced.length === 0 && (
            <div className="flex items-center gap-2 text-green-400 text-sm p-3 bg-green-900/20 border border-green-700/50 rounded-lg">
              <span>✅</span>
              <span>未检测到违禁词，内容安全</span>
            </div>
          )}

          {result.replaced.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3 text-xs text-gray-400">
              <div>共替换 <span className="text-amber-400 font-bold">{result.replaced.length}</span> 处违禁词</div>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 pt-0 sticky bottom-0 bg-gray-900">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            查看内容
          </button>
          <button onClick={onApply} className="flex-1 py-2 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg transition-colors">
            应用替换并继续
          </button>
        </div>
      </div>
    </div>
  )
}

export default SafetyModal
