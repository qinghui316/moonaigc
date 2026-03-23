import React, { useEffect, useMemo, useState } from 'react'
import { useHistoryStore } from '../../store/useHistoryStore'
import Skeleton from '../common/Skeleton'
import type { HistoryRecord } from '../../types'

interface HistoryPageProps {
  onLoad: (record: HistoryRecord) => void
  currentProjectId?: string | null
  currentEpisodeId?: string | null
  currentRecordId?: number | null
  embedded?: boolean
  onClose?: () => void
}

const HistoryPage: React.FC<HistoryPageProps> = ({
  onLoad,
  currentProjectId,
  currentEpisodeId,
  currentRecordId,
  embedded = false,
  onClose,
}) => {
  const { records, isLoading, load, delete: deleteRecord } = useHistoryStore()
  const [scope, setScope] = useState<'episode' | 'all'>(currentEpisodeId ? 'episode' : 'all')

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!currentEpisodeId) setScope('all')
  }, [currentEpisodeId])

  const visibleRecords = useMemo(() => {
    const sorted = [...records].sort((a, b) => b.id - a.id)
    if (scope === 'episode' && currentEpisodeId) {
      return sorted.filter(record => record.episodeId === currentEpisodeId)
    }
    if (scope === 'episode' && currentProjectId) {
      return sorted.filter(record => record.projectId === currentProjectId)
    }
    return sorted
  }, [currentEpisodeId, currentProjectId, records, scope])

  const scopeLabel = scope === 'episode' ? '当前集历史' : '全部历史'

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg p-3 space-y-2">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-3 w-full rounded" />
            <Skeleton className="h-3 w-3/4 rounded" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={`flex items-center justify-between gap-3 shrink-0 ${embedded ? 'px-5 py-4 border-b border-divider bg-surface-1' : 'px-4 py-3 border-b border-divider'}`}>
        <div>
          <h2 className="text-indigo-400 font-semibold">历史版本</h2>
          <p className="text-xs text-gray-500 mt-1">{scopeLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          {currentEpisodeId && (
            <div className="flex items-center gap-1 rounded-lg border border-divider bg-surface-2/60 p-1">
              <button
                type="button"
                onClick={() => setScope('episode')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${scope === 'episode' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                当前集
              </button>
              <button
                type="button"
                onClick={() => setScope('all')}
                className={`px-2.5 py-1 text-xs rounded-md transition-colors ${scope === 'all' ? 'bg-brand-600 text-white' : 'text-gray-400 hover:text-gray-200'}`}
              >
                全部历史
              </button>
            </div>
          )}
          {embedded && onClose && (
            <button
              type="button"
              onClick={onClose}
              className="px-2.5 py-1 text-xs text-gray-400 border border-divider rounded-lg hover:text-gray-200 hover:border-gray-600 transition-colors"
            >
              关闭
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {visibleRecords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">🕘</div>
            <p className="text-gray-500 text-sm">当前范围还没有历史记录</p>
            <p className="text-gray-600 text-xs mt-1">生成并保存分镜后，会在这里保留可回载的历史版本</p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleRecords.map(record => {
              const active = currentRecordId === record.id
              return (
                <div
                  key={record.id}
                  className={`bg-surface-2/50 border rounded-lg p-3 transition-colors group ${
                    active ? 'border-indigo-600/60 shadow-[0_0_0_1px_rgba(217,119,6,0.35)]' : 'border-divider hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="text-xs text-indigo-400 font-medium bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-800/30">
                          {record.directorId || 'standard'}
                        </span>
                        <span className="text-xs text-gray-500">{record.time || new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                        {active && (
                          <span className="text-xs text-emerald-400 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-800/30">
                            当前载入
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{record.plot}</p>
                    </div>
                    <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={() => onLoad(record)}
                        className="px-2.5 py-1 text-xs bg-indigo-600/20 text-indigo-400 border border-indigo-700/50 rounded-lg hover:bg-indigo-600/30 transition-colors"
                      >
                        载入
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteRecord(record.id)}
                        className="px-2.5 py-1 text-xs text-red-400 border border-red-800/50 rounded-lg hover:bg-red-900/20 transition-colors"
                      >
                        删除
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
