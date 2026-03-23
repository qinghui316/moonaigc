import React, { useState, useRef } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { analyzeImage, analyzeVideo, extractVideoFrames, fileToBase64 } from '../../services/vision'
import { useMaterialStore } from '../../store/useMaterialStore'
import type { VisionResult } from '../../types'

interface VisionModalProps {
  onClose: () => void
  onFillPlot?: (plot: string) => void
}

const VisionModal: React.FC<VisionModalProps> = ({ onClose, onFillPlot }) => {
  const { visionSettings } = useSettingsStore()
  const { bulkFill } = useMaterialStore()
  const [activeMode, setActiveMode] = useState<'image' | 'video'>('image')
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [progress, setProgress] = useState('')
  const [result, setResult] = useState<VisionResult | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleAnalyze = async () => {
    if (!files.length) return
    if (!visionSettings.key) { alert('请先配置视觉分析平台的 API Key'); return }
    setLoading(true)
    setResult(null)
    try {
      let res: VisionResult
      if (activeMode === 'image') {
        setProgress('正在分析图片...')
        const base64 = await fileToBase64(files[0])
        res = await analyzeImage(base64, files[0].type, visionSettings)
      } else {
        setProgress('正在提取视频帧...')
        const frames = await extractVideoFrames(files[0], 8)
        setProgress(`正在分析 ${frames.length} 帧画面...`)
        res = await analyzeVideo(frames, visionSettings)
      }
      setResult(res)
    } catch (e) {
      alert(`分析失败：${String(e)}`)
    }
    setLoading(false)
    setProgress('')
  }

  const handleApplyToMaterials = () => {
    if (!result) return
    if (result.characters?.length) {
      bulkFill('character', result.characters.map(c => ({ name: c.name, desc: c.visual_desc })))
    }
    if (result.scenes?.length) {
      bulkFill('image', result.scenes.map(s => ({ name: s.name, desc: s.visual_desc })))
    }
    if (result.props?.length) {
      bulkFill('props', result.props.map(p => ({ name: p.name, desc: p.visual_desc })))
    }
    alert('已填入素材库！')
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h3 className="text-indigo-400 font-semibold">👁️ 视觉反推</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        <div className="p-4 space-y-4">
          {/* Mode Tabs */}
          <div className="flex bg-gray-800 p-1 rounded-lg gap-1">
            {(['image', 'video'] as const).map(m => (
              <button key={m} onClick={() => setActiveMode(m)}
                className={`flex-1 py-1.5 text-sm rounded-md transition-colors ${
                  activeMode === m ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {m === 'image' ? '🖼️ 图片反推' : '🎬 视频反推'}
              </button>
            ))}
          </div>

          {/* Upload Area */}
          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-gray-700 hover:border-indigo-500 rounded-lg p-8 text-center cursor-pointer transition-colors"
          >
            {files.length > 0 ? (
              <div className="text-sm text-gray-300">
                已选择: {files[0].name}
                {files.length > 1 && ` 等${files.length}个文件`}
              </div>
            ) : (
              <div>
                <div className="text-3xl mb-2">{activeMode === 'image' ? '🖼️' : '🎬'}</div>
                <div className="text-sm text-gray-400">点击选择{activeMode === 'image' ? '图片' : '视频'}文件</div>
                <div className="text-xs text-gray-600 mt-1">
                  {activeMode === 'image' ? 'JPG / PNG / WEBP' : 'MP4 / MOV / AVI'}
                </div>
              </div>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept={activeMode === 'image' ? 'image/*' : 'video/*'}
            multiple={activeMode === 'image'}
            onChange={e => setFiles(Array.from(e.target.files ?? []))}
          />

          {/* Result */}
          {result && (
            <div className="space-y-3">
              {result.plot_summary && (
                <div className="bg-gray-800 rounded-lg p-3">
                  <div className="text-xs text-gray-500 mb-1">📖 故事概述</div>
                  <p className="text-sm text-gray-300">{result.plot_summary}</p>
                  {onFillPlot && (
                    <button onClick={() => onFillPlot(result.plot_summary)}
                      className="mt-2 text-xs text-indigo-400 hover:text-indigo-300">
                      → 填入情节框
                    </button>
                  )}
                </div>
              )}
              <div className="grid grid-cols-3 gap-2 text-xs">
                {[
                  { label: '角色', items: result.characters },
                  { label: '场景', items: result.scenes },
                  { label: '道具', items: result.props },
                ].map(({ label, items }) => (
                  <div key={label} className="bg-gray-800/60 border border-gray-700/50 rounded-lg p-2">
                    <div className="text-indigo-400 font-medium mb-1">{label} ({items?.length ?? 0})</div>
                    {items?.slice(0, 3).map((item, i) => (
                      <div key={i} className="text-gray-400 truncate">{item.name}</div>
                    ))}
                  </div>
                ))}
              </div>
              <button onClick={handleApplyToMaterials}
                className="w-full py-2 text-sm bg-indigo-600/20 text-indigo-400 border border-indigo-700/50 rounded-lg hover:bg-indigo-600/30 transition-colors">
                ✨ 自动填入素材库
              </button>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-4 pt-0">
          <button onClick={onClose} className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:bg-gray-800 transition-colors">
            关闭
          </button>
          <button onClick={handleAnalyze} disabled={loading || !files.length}
            className="flex-1 py-2 text-sm bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg transition-colors disabled:opacity-50">
            {loading ? progress || '分析中...' : '🚀 开始分析'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default VisionModal
