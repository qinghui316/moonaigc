import React from 'react'

interface ChainProgressBarProps {
  label: string
  current: number
  total: number
  detail: string
  onStop: () => void
}

const ChainProgressBar: React.FC<ChainProgressBarProps> = ({ label, current, total, detail, onStop }) => {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="mx-4 mt-3 mb-1 bg-surface-2/80 border border-divider rounded-lg px-3 py-2.5 shrink-0">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-xs text-indigo-400 flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
          链式生成中 — {label} {detail} ({current}/{total})
        </span>
        <button
          onClick={onStop}
          className="text-xs text-red-400 hover:text-red-300 transition-colors px-1.5 py-0.5 border border-red-800/40 rounded"
        >
          停止
        </button>
      </div>
      <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
        <div
          className="h-full bg-indigo-500 rounded-full transition-all duration-500 relative overflow-hidden"
          style={{ width: `${pct}%` }}
        >
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(90deg, transparent 25%, rgba(255,255,255,0.15) 50%, transparent 75%)',
              backgroundSize: '200% 100%',
              animation: 'shimmer 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
      <div className="text-right text-xs text-gray-600 mt-0.5">{pct}%</div>
    </div>
  )
}

export default ChainProgressBar
