import React, { useState, useMemo } from 'react'
import { useMaterialStore } from '../../store/useMaterialStore'
import AnimatedOverlay from '../common/AnimatedOverlay'
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
    <AnimatedOverlay open={open} onClose={onClose}>
      <div
        className="bg-surface-1 rounded-xl border border-divider-strong w-full max-w-lg max-h-[80vh] flex flex-col shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-divider shrink-0">
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
            className="w-full bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60"
          />
        </div>

        {/* Tab */}
        <div className="flex gap-1 px-4 pb-2 shrink-0">
          {TAB_LABELS.map(t => (
            <button
              key={t.key}
              onClick={() => { setActiveTab(t.key); setSearch('') }}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${activeTab === t.key ? 'bg-brand-600 text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'}`}
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
                    className={`relative rounded-lg overflow-hidden border-2 transition-all ${selected ? 'border-indigo-500' : 'border-transparent hover:border-gray-600'}`}
                  >
                    <img
                      src={item.imageUrl}
                      alt={item.name}
                      className="w-full aspect-square object-cover"
                    />
                    {selected && (
                      <div className="absolute top-1 right-1 w-4 h-4 bg-indigo-500 rounded-full flex items-center justify-center">
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
        <div className="flex items-center justify-between px-4 py-3 border-t border-divider shrink-0">
          <span className="text-xs text-gray-400">已选 {localSelected.length} 项</span>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-1.5 text-sm bg-surface-2 hover:bg-surface-3 text-gray-200 rounded-lg"
            >
              取消
            </button>
            <button
              onClick={() => { onConfirm(localSelected); onClose() }}
              className="px-4 py-1.5 text-sm bg-brand-600 hover:bg-brand-500 text-white rounded-lg shadow-sm shadow-brand-600/20"
            >
              确定
            </button>
          </div>
        </div>
      </div>
    </AnimatedOverlay>
  )
}

export default RefImagePickerModal
