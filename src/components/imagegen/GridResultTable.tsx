import React from 'react'
import { highlightAtTags } from '../../utils/parseTable'
import type { GridPanelRecord } from '../../types'

interface GridResultTableProps {
  panels: GridPanelRecord[]
}

const GridResultTable: React.FC<GridResultTableProps> = ({ panels }) => {
  if (panels.length === 0) {
    return (
      <div className="p-4 text-sm text-gray-500 border border-gray-800 rounded-xl bg-gray-900/40">
        暂无宫格分镜结果
      </div>
    )
  }

  return (
    <div className="overflow-auto border border-gray-800 rounded-xl">
      <table className="w-full text-xs border-collapse min-w-[960px]">
        <thead className="sticky top-0 z-10">
          <tr>
            <th className="text-gray-500 font-medium text-left px-2 py-2 border-b border-gray-700 bg-gray-900 w-16">面板</th>
            <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-gray-700 bg-gray-900 w-24">时间段</th>
            <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-gray-700 bg-gray-900 w-40">来源分镜</th>
            <th className="text-gray-400 font-medium text-left px-2 py-2 border-b border-gray-700 bg-gray-900">SEEDANCE提示词</th>
          </tr>
        </thead>
        <tbody>
          {panels.map(panel => (
            <tr key={panel.id} className="border-b border-gray-800 hover:bg-gray-800/40 transition-colors">
              <td className="px-2 py-2 text-gray-300 font-medium">#{panel.panelOrder}</td>
              <td className="px-2 py-2 text-gray-300">{panel.timeRange}</td>
              <td className="px-2 py-2 text-gray-400">
                <div className="flex flex-wrap gap-1">
                  {panel.sourceShotRefs.map(ref => (
                    <span
                      key={`${panel.id}-${ref}`}
                      className="px-1.5 py-0.5 rounded bg-amber-900/40 border border-amber-700/40 text-amber-300"
                    >
                      {ref}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-2 py-2 align-top text-gray-300">
                {panel.sourceSeedancePrompts && panel.sourceSeedancePrompts.length > 0 ? (
                  <div className="space-y-2">
                    {panel.sourceSeedancePrompts.map(item => (
                      <div
                        key={`${panel.id}-${item.sourceShotRef}`}
                        className="rounded-lg border border-gray-800 bg-gray-900/60 p-2"
                      >
                        <div className="mb-1 text-[11px] text-amber-300">{item.sourceShotRef}</div>
                        <div dangerouslySetInnerHTML={{ __html: highlightAtTags(item.prompt) }} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div dangerouslySetInnerHTML={{ __html: highlightAtTags(panel.seedancePrompt) }} />
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default GridResultTable
