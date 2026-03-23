import React, { useState } from 'react'

interface ScriptPasteModalProps {
  onClose: () => void
  onExtract: (text: string) => void
  isExtracting: boolean
}

const ScriptPasteModal: React.FC<ScriptPasteModalProps> = ({ onClose, onExtract, isExtracting }) => {
  const [text, setText] = useState('')

  const handleExtract = () => {
    if (!text.trim()) return
    onExtract(text.trim())
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-gray-900 rounded-lg w-full max-w-2xl shadow-2xl border border-gray-700 max-h-[90vh] flex flex-col"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-700 shrink-0">
          <div>
            <h3 className="text-base font-bold text-white">📋 粘贴提取剧本</h3>
            <p className="text-xs text-gray-400 mt-0.5">粘贴剧本文字，AI 自动提取人物/场景/道具到素材库</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex-1 overflow-auto">
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="在此粘贴剧本内容，支持长文本（最多10000字）..."
            className="w-full h-64 bg-gray-800 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 px-3 py-2.5 rounded-lg focus:outline-none focus:border-indigo-500 resize-none"
          />
          <p className="text-xs text-gray-600 mt-2">{text.length} 字</p>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-gray-700 flex justify-end gap-3 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded-lg transition-colors">
            取消
          </button>
          <button
            onClick={handleExtract}
            disabled={!text.trim() || isExtracting}
            className="px-6 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-lg disabled:opacity-50 transition-colors">
            {isExtracting ? '🔍 提取中...' : '🚀 AI提取资产'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ScriptPasteModal
