import React, { useState, useMemo } from 'react'
import { useMaterialStore } from '../../store/useMaterialStore'
import type { AssetType } from '../../types'

export interface ManualRefItem {
  name: string
  type: AssetType
  desc: string
  imageUrl: string
  imageFileId: number
}

interface RefImagePickerModalProps {
  open: boolean
  onClose: () => void
  selectedRefs: ManualRefItem[]
  onConfirm: (refs: ManualRefItem[]) => void
}

const TAB_LABELS: { key: AssetType; label: string }[] = [
  { key: 'character', label: '角色' },
  { key: 'image', label: '场景' },
  { key: 'props', label: '道具' },
]

const RefImagePickerModal: React.FC<RefImagePickerModalProps> = ({ open, onClose, selectedRefs, onConfirm }) => {
  const { materials } = useMaterialStore()
  const [activeTab, setActiveTab] = useState<AssetType>('character')
  const [search, setSearch] = useState('')
  const [localSelected, setLocalSelected] = useState<ManualRefItem[]>(selectedRefs)

  // 当弹窗打开时同步外部已选项
  React.useEffect(() => {
    if (open) setLocalSelected(selectedRefs)
  }, [open, selectedRefs])

  const items = useMemo(() => {
    return materials[activeTab]
      .filter(m => m.name && m.imageUrl && m.imageFileId)
      .filter(m => !search || m.name.includes(search) || (m.desc ?? '').includes(search))
      .map(m => ({
        name: m.name,
        type: activeTab,
        desc: m.desc ?? '',
        imageUrl: m.imageUrl!,
        imageFileId: m.imageFileId!,
      }))
  }, [materials, activeTab, search])

  const isSelected = (item: ManualRefItem) =>
    localSelected.some(r => r.imageFileId === item.imageFileId)

  const toggleItem = (item: ManualRefItem) => {
    setLocalSelected(prev =>
      prev.some(r => r.imageFileId === item.imageFileId)
        ? prev.filter(r => r.imageFileId !== item.imageFileId)
        : [...prev, item]
    )
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-lg max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 shrink-0">
          <span className="text-sm font-medium text-white">从素材库选择参考图</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-lg leading-none">✕</button>
        </div>

        {/* 搜索框 */}
        <div className="px-4 pt-3 pb-2 shrink-0">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索名称或描述..."
            className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-4 pb-2 shrink-0">
          {TAB_LABELS.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSearch('') }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${activeTab === t.key ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* 素材网格 */}
        <div className="flex-1 overflow-y-auto px-4 pb-3">
          {items.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">暂无{TAB_LABELS.find(t => t.key === activeTab)?.label}参考图</p>
          ) : (
            <div className="grid grid-cols-4 gap-2">
              {items.map(item => {
                const selected = isSelected(item)
                return (
                  <button
                    key={item.imageFileId}
                    onClick={() => toggleItem(item)}
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-amber-500' : 'border-transparent hover:border-gray-600'}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full aspect-square object-cover"
                    />
                    {selected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center">
                        <span className="text-white text-[9px] font-bold">✓</span>
                      </div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                      <p className="text-white text-[10px] truncate">{item.name}</p>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-700 shrink-0">
          <span className="text-xs text-gray-400">已选 {localSelected.length} 项</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={() => { onConfirm(localSelected); onClose() }}
              className="px-4 py-1.5 text-sm bg-amber-600 hover:bg-amber-500 text-white rounded-lg"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RefImagePickerModal
