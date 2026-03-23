import React, { useState, useRef } from 'react'
import { DIRECTORS, DIRECTOR_CATEGORIES } from '../../data/directors'
import type { Director } from '../../types'

interface DirectorGridProps {
  selectedId: string
  onSelect: (director: Director) => void
}

const DirectorGrid: React.FC<DirectorGridProps> = ({ selectedId, onSelect }) => {
  const [category, setCategory] = useState('all')
  const scrollRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)
  const startX = useRef(0)
  const scrollLeft = useRef(0)

  const filtered = category === 'all'
    ? DIRECTORS
    : DIRECTORS.filter(d => d.category === category)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return
    isDragging.current = true
    startX.current = e.pageX - scrollRef.current.offsetLeft
    scrollLeft.current = scrollRef.current.scrollLeft
    scrollRef.current.style.cursor = 'grabbing'
  }
  const handleMouseLeave = () => {
    isDragging.current = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }
  const handleMouseUp = () => {
    isDragging.current = false
    if (scrollRef.current) scrollRef.current.style.cursor = 'grab'
  }
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !scrollRef.current) return
    e.preventDefault()
    const x = e.pageX - scrollRef.current.offsetLeft
    scrollRef.current.scrollLeft = scrollLeft.current - (x - startX.current) * 2
  }

  return (
    <div>
      {/* Category filters */}
      <div className="flex gap-1.5 flex-wrap mb-3">
        {DIRECTOR_CATEGORIES.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              category === cat.id
                ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                : 'border-divider text-gray-400 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Director cards scroll (drag to scroll) */}
      <div
        ref={scrollRef}
        className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin select-none"
        style={{ cursor: 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseLeave={handleMouseLeave}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
      >
        {filtered.map(director => (
          <button
            key={director.id}
            onClick={() => onSelect(director)}
            className={`flex-shrink-0 w-32 p-2.5 rounded-lg border text-left transition-all ${
              selectedId === director.id
                ? 'border-indigo-500 bg-indigo-900/30 shadow-lg shadow-indigo-900/20'
                : 'border-divider bg-surface-2/50 hover:border-gray-600 hover:bg-surface-2'
            }`}
          >
            <div className={`w-full h-1.5 rounded-full bg-gradient-to-r ${director.color} mb-2`} />
            <div className="text-xs font-semibold text-gray-200 leading-tight mb-1 truncate">
              {director.name}
            </div>
            <div className="text-xs text-gray-500 line-clamp-2 leading-snug">
              {director.style}
            </div>
            {director.donghuaProfile && (
              <div className="mt-1.5 text-xs bg-surface-2/60 text-gray-400 px-1.5 py-0.5 rounded border border-divider/50">
                国漫IP
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

export default DirectorGrid
