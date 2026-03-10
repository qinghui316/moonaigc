import React, { useEffect } from 'react'
import { useHistoryStore } from '../../store/useHistoryStore'
import type { HistoryRecord } from '../../types'

interface HistoryPageProps {
  onLoad: (record: HistoryRecord) => void
}

const HistoryPage: React.FC<HistoryPageProps> = ({ onLoad }) => {
  const { records, isLoading, load, delete: deleteRecord, clear } = useHistoryStore()

  useEffect(() => {
    load()
  }, [])

  const handleClearAll = () => {
    if (confirm(`确定要清空所有 ${records.length} 条历史记录吗？`)) {
      clear()
    }
  }

  if (isLoading) {
    return <div className="flex-1 flex items-center justify-center text-gray-500 text-sm">加载中...</div>
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-amber-400 font-semibold">历史记录</h2>
        {records.length > 0 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">{records.length} 条记录</span>
            <button onClick={handleClearAll}
              className="text-xs text-red-400 hover:text-red-300 border border-red-800/50 rounded-lg px-2 py-1 hover:bg-red-900/20 transition-colors">
              清空全部
            </button>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {records.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-4xl mb-3">📋</div>
            <p className="text-gray-500 text-sm">还没有历史记录</p>
            <p className="text-gray-600 text-xs mt-1">生成分镜后将自动保存到此处</p>
          </div>
        ) : (
          <div className="space-y-3">
            {records.map(record => (
              <div key={record.id} className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 hover:border-gray-600 transition-colors group">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-amber-400 font-medium bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30">
                        {record.directorId || '标准'}
                      </span>
                      <span className="text-xs text-gray-500">{record.time || new Date(record.createdAt).toLocaleString('zh-CN')}</span>
                    </div>
                    <p className="text-sm text-gray-300 line-clamp-2 leading-relaxed">{record.plot}</p>
                  </div>
                  <div className="flex gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onLoad(record)}
                      className="px-2.5 py-1 text-xs bg-amber-600/20 text-amber-400 border border-amber-700/50 rounded-lg hover:bg-amber-600/30 transition-colors"
                    >
                      载入
                    </button>
                    <button
                      onClick={() => deleteRecord(record.id)}
                      className="px-2.5 py-1 text-xs text-red-400 border border-red-800/50 rounded-lg hover:bg-red-900/20 transition-colors"
                    >
                      删除
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryPage
