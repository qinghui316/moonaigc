import React from 'react'
import { highlightAtTags } from '../../utils/parseTable'
import type { GridPanelRecord } from '../../types'

interface GridResultTableProps {
  panels: GridPanelRecord[]
}

const GridResultTable: React.FC<GridResultTableProps> = ({ panels }) => {
  if (panels.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 ring-1 ring-divider rounded-lg bg-surface-1/40">
        暂无宫格分镜结果
      </div>
    )
  }

  // 从所有 panels 的 sourceSeedancePrompts 中提取去重的源分镜列表（按出现顺序）
  const uniqueSourceShots: Array<{ ref: string; prompt: string }> = []
  const seenRefs = new Set<string>()
  for (const panel of panels) {
    if (panel.sourceSeedancePrompts) {
      for (const item of panel.sourceSeedancePrompts) {
        if (!seenRefs.has(item.sourceShotRef)) {
          seenRefs.add(item.sourceShotRef)
          uniqueSourceShots.push({ ref: item.sourceShotRef, prompt: item.prompt })
        }
      }
    }
  }

  const hasSourcePrompts = uniqueSourceShots.length > 0

  // 回退：旧数据无 sourceSeedancePrompts，显示原 9 面板
  if (!hasSourcePrompts) {
    return (
      <div className="overflow-auto ring-1 ring-divider rounded-lg">
        <table className="w-full text-xs border-collapse min-w-[960px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="text-gray-500 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 w-16 uppercase tracking-wider">面板</th>
              <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 w-24 uppercase tracking-wider">时间段</th>
              <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 w-40 uppercase tracking-wider">来源分镜</th>
              <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 uppercase tracking-wider">SEEDANCE提示词</th>
            </tr>
          </thead>
          <tbody>
            {panels.map(panel => (
              <tr key={panel.id} className="border-b border-divider/50 hover:bg-surface-3/40 transition-colors">
                <td className="px-2 py-2 text-gray-300 font-medium">#{panel.panelOrder}</td>
                <td className="px-2 py-2 text-gray-300">{panel.timeRange}</td>
                <td className="px-2 py-2 text-gray-400">
                  <div className="flex flex-wrap gap-1">
                    {panel.sourceShotRefs.map(ref => (
                      <span
                        key={`${panel.id}-${ref}`}
                        className="px-1.5 py-0.5 rounded bg-indigo-900/40 border border-indigo-700/40 text-indigo-300"
                      >
                        {ref}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-2 py-2 align-top text-gray-300">
                  <div dangerouslySetInnerHTML={{ __html: highlightAtTags(panel.seedancePrompt) }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  // 按源分镜展示原始 SEEDANCE 提示词
  return (
    <div className="overflow-auto ring-1 ring-divider rounded-lg">
      <table className="w-full text-xs border-collapse">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 w-24 uppercase tracking-wider">源分镜</th>
            <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-divider bg-surface-1 uppercase tracking-wider">SEEDANCE提示词</th>
          </tr>
        </thead>
        <tbody>
          {uniqueSourceShots.map(item => (
            <tr key={item.ref} className="border-b border-divider/50 hover:bg-surface-3/40 transition-colors">
              <td className="px-2 py-2 align-top">
                <span className="px-1.5 py-0.5 rounded bg-indigo-900/40 border border-indigo-700/40 text-indigo-300">
                  {item.ref}
                </span>
              </td>
              <td className="px-2 py-2 align-top text-gray-300">
                <div
                  className="whitespace-pre-wrap"
                  dangerouslySetInnerHTML={{ __html: highlightAtTags(item.prompt) }}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default GridResultTable
