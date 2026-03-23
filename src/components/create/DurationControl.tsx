import React from 'react'

interface DurationControlProps {
  seconds: number
  onChange: (seconds: number) => void
}

const PRESETS = [
  { label: '5s', value: 5 },
  { label: '15s', value: 15 },
  { label: '30s', value: 30 },
  { label: '1min', value: 60 },
  { label: '2min', value: 120 },
  { label: '3min', value: 180 },
  { label: '5min', value: 300 },
]

const formatDuration = (seconds: number): string => {
  if (seconds < 60) return `${seconds}秒`
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return s > 0 ? `${m}分${s}秒` : `${m}分钟`
}

const DurationControl: React.FC<DurationControlProps> = ({ seconds, onChange }) => {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-xs text-gray-400">视频总时长</label>
        <span className="text-indigo-400 font-mono text-sm font-bold">{formatDuration(seconds)}</span>
      </div>

      <input
        type="range"
        min={5}
        max={300}
        step={5}
        value={seconds}
        onChange={e => onChange(Number(e.target.value))}
        className="w-full accent-indigo-500 cursor-pointer"
      />

      <div className="flex gap-1.5 flex-wrap">
        {PRESETS.map(p => (
          <button
            key={p.value}
            onClick={() => onChange(p.value)}
            className={`px-2 py-1 text-xs rounded border transition-colors ${
              seconds === p.value
                ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                : 'border-gray-700 text-gray-500 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DurationControl
