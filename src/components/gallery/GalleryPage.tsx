import React, { useState, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/useProjectStore'

interface MediaItem {
  id: number
  url: string
  fileName: string
  refType: string
  assetType?: string | null
  projectId?: string | null
  createdAt: string
  fileSize: number
}

const GalleryPage: React.FC = () => {
  const { projects, loadProjects } = useProjectStore()
  const [items, setItems] = useState<MediaItem[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [filterProject, setFilterProject] = useState('')
  const [filterType, setFilterType] = useState<'all' | 'shot' | 'grid' | 'asset'>('all')
  const [loading, setLoading] = useState(false)
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)

  const LIMIT = 48

  const loadItems = useCallback(async (p = 1, projectId = filterProject, type = filterType) => {
    setLoading(true)
    const params = new URLSearchParams({ page: String(p), limit: String(LIMIT) })
    if (projectId) params.set('projectId', projectId)
    if (type === 'shot') params.set('refType', 'shot')
    else if (type === 'grid') params.set('refType', 'grid')
    else if (type === 'asset') params.set('refType', 'asset')
    try {
      const resp = await fetch(`/api/media?${params}`)
      if (resp.ok) {
        const data = await resp.json() as { items: MediaItem[]; total: number }
        setItems(p === 1 ? data.items : prev => [...prev, ...data.items])
        setTotal(data.total)
        setPage(p)
      }
    } finally {
      setLoading(false)
    }
  }, [filterProject, filterType])

  useEffect(() => {
    loadProjects()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    loadItems(1, filterProject, filterType)
  }, [filterProject, filterType]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: number) => {
    if (!confirm('确认删除这张图片？')) return
    await fetch(`/api/media/${id}`, { method: 'DELETE' })
    setItems(prev => prev.filter(i => i.id !== id))
    setTotal(prev => prev - 1)
  }

  const hasMore = items.length < total

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      {/* 顶部筛选栏 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0 flex-wrap">
        <span className="text-sm text-gray-300 font-medium">图片画廊</span>
        <select
          value={filterProject}
          onChange={e => setFilterProject(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none max-w-[180px]"
        >
          <option value="">全部项目</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {(['all', 'shot', 'grid', 'asset'] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`px-3 py-1.5 text-xs transition-colors ${filterType === t ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              {t === 'all' ? '全部' : t === 'shot' ? '分镜图' : t === 'grid' ? '宫格图' : '素材图'}
            </button>
          ))}
        </div>
        <span className="text-xs text-gray-500 ml-auto">共 {total} 张</span>
      </div>

      {/* 图片网格 */}
      <div className="flex-1 overflow-y-auto p-4">
        {loading && items.length === 0 && (
          <div className="flex items-center justify-center h-40 text-gray-600">加载中...</div>
        )}
        {!loading && items.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 text-gray-600 gap-2">
            <span className="text-3xl">🖼</span>
            <span className="text-sm">暂无图片</span>
          </div>
        )}
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2">
          {items.map(item => (
            <div key={item.id} className="relative group aspect-square bg-gray-800 rounded-lg overflow-hidden">
              <img
                src={item.url}
                alt={item.fileName}
                className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setLightboxSrc(item.url)}
                loading="lazy"
              />
              <div className="absolute top-1 left-1 text-xs bg-black/60 text-gray-300 px-1 rounded opacity-0 group-hover:opacity-100">
                {item.refType === 'shot' ? '镜' : item.refType === 'grid' ? '宫' : '素'}
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100">
                <a
                  href={item.url}
                  download={item.fileName}
                  className="text-xs bg-gray-800/90 text-white px-1.5 py-0.5 rounded"
                  onClick={e => e.stopPropagation()}
                >
                  ↓
                </a>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(item.id) }}
                  className="text-xs bg-red-600/90 text-white px-1.5 py-0.5 rounded"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>

        {hasMore && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => loadItems(page + 1)}
              disabled={loading}
              className="px-6 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 text-sm rounded-lg disabled:opacity-50"
            >
              {loading ? '加载中...' : '加载更多'}
            </button>
          </div>
        )}
      </div>

      {/* 灯箱 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="放大" className="max-h-full max-w-full rounded-xl" />
          <button
            className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300"
            onClick={() => setLightboxSrc(null)}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  )
}

export default GalleryPage
