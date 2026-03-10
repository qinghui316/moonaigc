import React from 'react'
import type { Scene, SceneStatus } from '../../types'

interface StorylineTimelineProps {
  scenes: Scene[]
  sceneContents: Record<number, string>
  currentSceneId: number | null
  isRunning: boolean
  onSceneClick: (sceneId: number) => void
  onRetry?: (sceneId: number) => void
}

const StorylineTimeline: React.FC<StorylineTimelineProps> = ({
  scenes, sceneContents, currentSceneId, isRunning, onSceneClick, onRetry
}) => {
  const getStatus = (scene: Scene): SceneStatus => {
    if (scene.error) return 'error'
    if (sceneContents[scene.id]) return 'done'
    if (currentSceneId === scene.id) return 'loading'
    return 'waiting'
  }

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <div className="text-xs text-gray-400">故事轴 · BS2节拍</div>
        {isRunning && (
          <span className="text-xs text-amber-400 animate-pulse flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-amber-400 rounded-full animate-ping" />
            生成中...
          </span>
        )}
      </div>
      <div className="flex gap-1.5 flex-wrap">
        {scenes.map(scene => {
          const status = getStatus(scene)
          const isLoading = status === 'loading'
          const isDone = status === 'done'
          const isError = status === 'error'

          return (
            <button
              key={scene.id}
              onClick={() => isDone || isError ? onSceneClick(scene.id) : undefined}
              className={`relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs transition-all border ${
                isLoading
                  ? 'border-amber-500 bg-amber-900/30 text-amber-300 animate-pulse'
                  : isDone
                  ? 'border-green-700 bg-green-900/20 text-green-400 hover:bg-green-900/30 cursor-pointer'
                  : isError
                  ? 'border-red-700 bg-red-900/20 text-red-400 hover:bg-red-900/30 cursor-pointer'
                  : 'border-gray-700 bg-gray-800/50 text-gray-500'
              }`}
            >
              <div className={`w-1.5 h-1.5 rounded-full ${scene.beatColorClass}`} />
              <span>{scene.beatName}</span>
              {isLoading && <span className="w-1 h-3 bg-amber-400 animate-pulse rounded-sm" />}
              {isDone && <svg className="w-3 h-3 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>}
              {isError && onRetry && (
                <span
                  onClick={e => { e.stopPropagation(); onRetry(scene.id) }}
                  className="text-red-400 hover:text-white"
                >
                  ↺
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default StorylineTimeline
