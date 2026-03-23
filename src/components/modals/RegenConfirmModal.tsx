import React, { useState } from 'react'

interface RegenConfirmModalProps {
  title: string
  preview: string
  onConfirm: (instruction: string) => void
  onClose: () => void
}

const PREVIEW_LIMIT = 300

const RegenConfirmModal: React.FC<RegenConfirmModalProps> = ({ title, preview, onConfirm, onClose }) => {
  const [instruction, setInstruction] = useState('')

  const previewText = preview.length > PREVIEW_LIMIT
    ? preview.slice(0, PREVIEW_LIMIT) + '…'
    : preview

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-1 border border-divider-strong rounded-xl w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-divider">
          <h3 className="text-indigo-400 font-semibold text-sm">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">当前内容</label>
            <div className="bg-surface-2 rounded-lg p-3 text-xs text-gray-400 border border-divider leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">
              {previewText || '（暂无内容）'}
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 block">修改要求（可选，留空则按原参数重新生成）</label>
            <textarea
              value={instruction}
              onChange={e => setInstruction(e.target.value)}
              rows={3}
              placeholder="例：加强反转节奏，结局改为开放式，增加更多打脸爽点…"
              className="w-full bg-surface-2 border border-divider text-sm text-gray-200 px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60 resize-none"
              autoFocus
            />
          </div>
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <button
            onClick={onClose}
            className="flex-1 py-2 text-sm text-gray-400 border border-divider rounded-lg hover:bg-surface-3 transition-colors"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(instruction.trim())}
            className="flex-1 py-2 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg transition-colors"
          >
            确认重新生成
          </button>
        </div>
      </div>
    </div>
  )
}

export default RegenConfirmModal
