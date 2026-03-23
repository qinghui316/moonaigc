import React, { useState } from 'react'
import { STYLE_OPTIONS } from '../../data/styleMap'
import { CAMERA_TECHS } from '../../data/cameraTechs'
import { LIGHTING_TECHS } from '../../data/lightingTechs'

export interface Params {
  shotCount: string
  customShotCount: string
  aspectRatio: string
  quality: string
  cameraTechs: string[]
  lightingTechs: string[]
  visualStyle: string
  enableBGM: boolean
  enableSubtitle: boolean
  enableFidelity: boolean
  enableSTC: boolean
  narrativeMode: string
}

interface ParamPanelProps {
  params: Params
  onChange: (update: Partial<Params>) => void
  collapsed?: boolean
  onToggleCollapse?: () => void
}

const ASPECT_RATIOS = ['16:9', '9:16', '1:1', '4:3', '21:9', '3:2']
const QUALITY_OPTIONS = [
  { value: 'cinematic, 8K UHD, RAW photo, highly detailed, masterpiece', label: '8K 旗舰' },
  { value: 'cinematic, 4K, highly detailed, high quality', label: '4K 高清' },
  { value: 'cinematic, 1080p, high quality', label: '1080p 标准' },
  { value: 'anime style, high quality, detailed', label: '动漫高清' },
]

const ParamPanel: React.FC<ParamPanelProps> = ({ params, onChange, collapsed, onToggleCollapse }) => {
  const [subTab, setSubTab] = useState<'basic' | 'camera' | 'lighting' | 'style'>('basic')

  const toggleCameraTech = (val: string) => {
    const next = params.cameraTechs.includes(val)
      ? params.cameraTechs.filter(v => v !== val)
      : [...params.cameraTechs, val]
    onChange({ cameraTechs: next })
  }

  const toggleLightingTech = (val: string) => {
    const next = params.lightingTechs.includes(val)
      ? params.lightingTechs.filter(v => v !== val)
      : [...params.lightingTechs, val]
    onChange({ lightingTechs: next })
  }

  return (
    <div>
      {/* Panel header with collapse toggle */}
      {onToggleCollapse && (
        <div className="flex items-center justify-between mb-2 cursor-pointer" onClick={onToggleCollapse}>
          <span className="text-xs text-gray-400 font-medium">⚙️ 生成参数</span>
          <span className="text-gray-500 text-xs">{collapsed ? '▶ 展开参数' : '▼ 收起参数'}</span>
        </div>
      )}

      {!collapsed && (
        <>
          {/* SubTab Nav */}
          <div className="flex gap-1 bg-gray-800 p-1 rounded-lg mb-3">
            {(['basic', 'camera', 'lighting', 'style'] as const).map(t => (
              <button key={t} onClick={() => setSubTab(t)}
                className={`flex-1 py-1 text-xs rounded-md font-medium transition-colors ${
                  subTab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-gray-200'
                }`}>
                {t === 'basic' ? '基础' : t === 'camera' ? '运镜' : t === 'lighting' ? '光影' : '风格'}
              </button>
            ))}
          </div>

          {subTab === 'basic' && (
            <div className="space-y-3">
              {/* STC Toggle */}
              <div className={`rounded-lg p-3 border transition-colors ${
                params.enableSTC
                  ? 'border-indigo-500/50 bg-gradient-to-br from-indigo-950/40 to-indigo-950/20'
                  : 'border-indigo-800/30 bg-gradient-to-br from-indigo-950/20 to-indigo-950/10'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold text-indigo-300">🎭 叙事结构构建（STC）</span>
                  <button
                    onClick={() => onChange({ enableSTC: !params.enableSTC })}
                    className={`relative w-9 h-5 rounded-full transition-colors ${
                      params.enableSTC ? 'bg-indigo-500' : 'bg-gray-600'
                    }`}>
                    <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      params.enableSTC ? 'translate-x-3.5' : 'translate-x-0'
                    }`} />
                  </button>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: params.enableSTC ? '#4338CA' : '#78716c', fontWeight: params.enableSTC ? 500 : 400 }}>
                  {params.enableSTC
                    ? '已启用 BS2 好莱坞节拍 · AI 将主动构建冲突弧线，适合从零创作场景。'
                    : '已关闭 · 直接视觉化模式，忠实还原剧本画面，不干预叙事结构。'}
                </p>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">画面比例</label>
                <div className="flex gap-1.5 flex-wrap">
                  {ASPECT_RATIOS.map(r => (
                    <button key={r} onClick={() => onChange({ aspectRatio: r })}
                      className={`px-2.5 py-1 text-xs rounded border transition-colors ${
                        params.aspectRatio === r
                          ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">画质等级</label>
                <div className="space-y-1">
                  {QUALITY_OPTIONS.map(q => (
                    <label key={q.value} className="flex items-center gap-2 cursor-pointer group">
                      <input type="radio" name="quality" value={q.value}
                        checked={params.quality === q.value}
                        onChange={() => onChange({ quality: q.value })}
                        className="accent-indigo-500" />
                      <span className="text-xs text-gray-300 group-hover:text-white">{q.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">分镜数量</label>
                <div className="flex gap-1.5 items-center flex-wrap">
                  <button onClick={() => onChange({ shotCount: '智能' })}
                    className={`px-2.5 py-1.5 text-xs rounded border transition-colors whitespace-nowrap ${
                      params.shotCount === '智能'
                        ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                        : 'border-gray-700 text-gray-400'
                    }`}>
                    智能
                  </button>
                  {[8, 10, 12, 15, 20].map(n => (
                    <button key={n} onClick={() => onChange({ shotCount: String(n) })}
                      className={`px-2.5 py-1.5 text-xs rounded border transition-colors ${
                        params.shotCount === String(n)
                          ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}>
                      {n}
                    </button>
                  ))}
                  <input type="number" min={4} max={50} placeholder="自定义"
                    value={params.shotCount !== '智能' && ![8,10,12,15,20].includes(Number(params.shotCount)) ? params.shotCount : ''}
                    onChange={e => onChange({ shotCount: e.target.value })}
                    className="w-16 bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs text-gray-400 mb-1.5 block">链式叙事模式</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { value: 'burst', label: '⚡ 爆裂模式', desc: '3节拍 极速冲击' },
                    { value: 'mini', label: '🎯 精简模式', desc: '6节拍 结构清晰' },
                    { value: 'full', label: '📖 完整BS2', desc: '13节拍 全面深度' },
                    { value: 'mood', label: '🎨 意境模式', desc: '4阶段 情绪优先' },
                  ].map(m => (
                    <button key={m.value} onClick={() => onChange({ narrativeMode: m.value })}
                      className={`p-2 rounded border text-left transition-colors ${
                        params.narrativeMode === m.value
                          ? 'border-indigo-500 bg-indigo-900/20 text-indigo-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-600'
                      }`}>
                      <div className="text-xs font-medium">{m.label}</div>
                      <div className="text-xs opacity-60 mt-0.5">{m.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-4 flex-wrap">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={params.enableBGM}
                    onChange={e => onChange({ enableBGM: e.target.checked })}
                    className="accent-indigo-500" />
                  <span className="text-xs text-gray-300">🎵 BGM建议</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={params.enableSubtitle}
                    onChange={e => onChange({ enableSubtitle: e.target.checked })}
                    className="accent-indigo-500" />
                  <span className="text-xs text-gray-300">💬 字幕提示</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={params.enableFidelity}
                    onChange={e => onChange({ enableFidelity: e.target.checked })}
                    className="accent-indigo-500" />
                  <span className="text-xs text-gray-300">🔒 保真模式</span>
                </label>
              </div>
            </div>
          )}

          {subTab === 'camera' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">运镜技法（多选）</label>
                <button onClick={() => onChange({ cameraTechs: [] })} className="text-xs text-gray-600 hover:text-gray-400">清空</button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {CAMERA_TECHS.map(s => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox"
                      checked={params.cameraTechs.includes(s.value)}
                      onChange={() => toggleCameraTech(s.value)}
                      className="accent-indigo-500 shrink-0" />
                    <span className="text-xs text-gray-300 group-hover:text-white">{s.label}</span>
                  </label>
                ))}
              </div>
              {params.cameraTechs.length > 0 && (
                <div className="mt-2 text-xs text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded">
                  已选 {params.cameraTechs.length} 项运镜技法
                </div>
              )}
            </div>
          )}

          {subTab === 'lighting' && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-gray-400">光影风格（多选）</label>
                <button onClick={() => onChange({ lightingTechs: [] })} className="text-xs text-gray-600 hover:text-gray-400">清空</button>
              </div>
              <div className="grid grid-cols-1 gap-1">
                {LIGHTING_TECHS.map(s => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                    <input type="checkbox"
                      checked={params.lightingTechs.includes(s.value)}
                      onChange={() => toggleLightingTech(s.value)}
                      className="accent-indigo-500 shrink-0" />
                    <span className="text-xs text-gray-300 group-hover:text-white">{s.label}</span>
                  </label>
                ))}
              </div>
              {params.lightingTechs.length > 0 && (
                <div className="mt-2 text-xs text-indigo-400 bg-indigo-900/20 px-2 py-1 rounded">
                  已选 {params.lightingTechs.length} 项光影风格
                </div>
              )}
            </div>
          )}

          {subTab === 'style' && (
            <div>
              <label className="text-xs text-gray-400 mb-1.5 block">视觉风格</label>
              <div className="grid grid-cols-2 gap-1.5">
                {STYLE_OPTIONS.map(s => (
                  <label key={s.value} className="flex items-center gap-2 cursor-pointer group">
                    <input type="radio" name="visualStyle" value={s.value}
                      checked={params.visualStyle === s.value}
                      onChange={() => onChange({ visualStyle: s.value })}
                      className="accent-indigo-500" />
                    <span className="text-xs text-gray-300 group-hover:text-white">{s.label}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

export default ParamPanel
