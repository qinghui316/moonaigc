import React, { useEffect, useRef } from 'react'
import { parseTableRows, highlightAtTags } from '../../utils/parseTable'

interface StoryboardTableProps {
  markdown: string
  isStreaming?: boolean
  onCopyShot?: (row: string) => void
  onEditShot?: (row: string, index: number) => void
  onGenImage?: (rowIndex: number, row: string[]) => void
  shotImages?: Record<number, { url: string }>
}

const StoryboardTable: React.FC<StoryboardTableProps> = ({ markdown, isStreaming = false, onEditShot, onGenImage, shotImages }) => {
  const tableRef = useRef<HTMLDivElement>(null)
  const { headers, rows } = parseTableRows(markdown)

  useEffect(() => {
    if (isStreaming && tableRef.current) {
      tableRef.current.scrollTop = tableRef.current.scrollHeight
    }
  }, [markdown, isStreaming])

  if (!headers.length) {
    if (isStreaming) {
      return (
        <div className="p-4 text-gray-500 text-sm flex items-center gap-2">
          <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse rounded-sm" />
          正在生成分镜...
        </div>
      )
    }
    return null
  }

  return (
    <div ref={tableRef} className="overflow-auto">
      <table className="w-full text-xs border-collapse min-w-[900px]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="text-gray-500 font-medium text-left px-2 py-1.5 border-b border-gray-700 bg-gray-900 w-6">#</th>
            {headers.map((h, i) => (
              <th key={i} className="text-gray-400 font-medium text-left px-2 py-1.5 border-b border-gray-700 bg-gray-900 whitespace-nowrap">
                {h}
              </th>
            ))}
            <th className="text-gray-500 font-medium text-left px-2 py-1.5 border-b border-gray-700 bg-gray-900 w-16">操作</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, ri) => (
            <tr key={ri} className="group border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
              <td className="px-2 py-2 text-gray-600">{ri + 1}</td>
              {row.map((cell, ci) => (
                <td key={ci} className={`px-2 py-2 align-top ${ci === row.length - 1 ? 'text-gray-400 text-xs max-w-xs' : 'text-gray-300'}`}>
                  {ci === row.length - 1 ? (
                    <div dangerouslySetInnerHTML={{ __html: highlightAtTags(cell) }} />
                  ) : cell}
                </td>
              ))}
              <td className="px-2 py-2">
                {/* 已有图片的缩略图标记 */}
                {shotImages?.[ri] && (
                  <img src={shotImages[ri].url} alt="缩略图"
                    className="w-8 h-8 object-cover rounded mb-1 cursor-pointer"
                    onClick={() => onGenImage?.(ri, row)}
                  />
                )}
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    onClick={() => navigator.clipboard.writeText(row[row.length - 1] || '')}
                    title="复制提示词"
                    className="p-1 text-gray-500 hover:text-amber-400 rounded hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  {onGenImage && (
                    <button
                      onClick={() => onGenImage(ri, row)}
                      title="AI 生图"
                      className="p-1 text-gray-500 hover:text-purple-400 rounded hover:bg-gray-700 transition-colors"
                    >
                      🖼️
                    </button>
                  )}
                  {onEditShot && (
                    <button
                      onClick={() => onEditShot(row.join(' | '), ri)}
                      title="编辑此镜头"
                      className="p-1 text-gray-500 hover:text-sky-400 rounded hover:bg-gray-700 transition-colors"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
          {isStreaming && (
            <tr>
              <td colSpan={headers.length + 2} className="px-2 py-2">
                <span className="inline-block w-2 h-4 bg-amber-400 animate-pulse rounded-sm" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export default StoryboardTable
