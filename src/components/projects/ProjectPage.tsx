import React, { useEffect, useState } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { GENRE_LIST } from '../../data/drama/genreGuide'
import type { TabId } from '../layout/TabNav'
import type { Project } from '../../types'

interface ProjectPageProps {
  onNavigate: (tab: TabId) => void
}

const AUDIENCE_OPTIONS = ['女频', '男频', '全年龄']
const TONE_OPTIONS = ['甜虐', '爽燃', '搞笑', '暗黑', '温情']
const ENDING_OPTIONS = ['大团圆', '开放式', '反转式', '悲剧']
const EPISODE_OPTIONS = [
  { label: '5集', value: 5 },
  { label: '10集', value: 10 },
  { label: '15集', value: 15 },
  { label: '20集', value: 20 },
  { label: '30集', value: 30 },
]

const emptyForm = {
  name: '',
  genre: [] as string[],
  audience: '女频',
  tone: '甜虐',
  endingType: '大团圆',
  totalEpisodes: 10,
  worldSetting: '',
}

const ProjectPage: React.FC<ProjectPageProps> = ({ onNavigate }) => {
  const { projects, loadProjects, addProject, deleteProject, selectProject } = useProjectStore()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [customEpisodes, setCustomEpisodes] = useState('')

  useEffect(() => {
    loadProjects()
  }, [])

  const toggleGenre = (id: string) => {
    setForm(f => {
      if (f.genre.includes(id)) return { ...f, genre: f.genre.filter(g => g !== id) }
      if (f.genre.length >= 2) return { ...f, genre: [f.genre[1], id] }
      return { ...f, genre: [...f.genre, id] }
    })
  }

  const handleCreate = async () => {
    if (!form.name.trim()) return
    if (form.genre.length === 0) return
    setSaving(true)
    const p = await addProject({
      name: form.name.trim(),
      genre: form.genre,
      audience: form.audience,
      tone: form.tone,
      endingType: form.endingType,
      totalEpisodes: form.totalEpisodes,
      worldSetting: form.worldSetting.trim(),
      creativePlan: '',
      characterDoc: '',
    })
    setSaving(false)
    setShowForm(false)
    setForm(emptyForm)
    await selectProject(p.id)
    onNavigate('scriptwork')
  }

  const handleOpen = async (p: Project) => {
    await selectProject(p.id)
    onNavigate('scriptwork')
  }

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`确定要删除项目「${name}」吗？该项目下的所有剧集和素材将一并删除。`)) return
    await deleteProject(id)
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800 shrink-0">
        <h2 className="text-amber-400 font-semibold">项目管理</h2>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-amber-600/20 text-amber-400 border border-amber-700/50 rounded-lg hover:bg-amber-600/30 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          新建项目
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {projects.length === 0 && !showForm ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <div className="text-5xl mb-4">🎬</div>
            <p className="text-gray-400 text-sm font-medium">还没有项目</p>
            <p className="text-gray-600 text-xs mt-1 mb-4">创建项目，开始你的微短剧创作之旅</p>
            <button
              onClick={() => setShowForm(true)}
              className="px-4 py-2 text-sm bg-amber-600/20 text-amber-400 border border-amber-700/50 rounded-lg hover:bg-amber-600/30 transition-colors"
            >
              新建第一个项目
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map(p => (
              <div
                key={p.id}
                className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 hover:border-gray-600 transition-colors group cursor-pointer"
                onClick={() => handleOpen(p)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-2">
                      <h3 className="text-gray-100 font-medium truncate">{p.name}</h3>
                    </div>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {p.genre.map(g => {
                        const item = GENRE_LIST.find(gl => gl.id === g)
                        return (
                          <span key={g} className="text-xs bg-amber-900/30 text-amber-400 border border-amber-800/40 px-1.5 py-0.5 rounded">
                            {item?.name ?? g}
                          </span>
                        )
                      })}
                      <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{p.audience}</span>
                      <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{p.tone}</span>
                      <span className="text-xs bg-gray-700/50 text-gray-400 px-1.5 py-0.5 rounded">{p.totalEpisodes}集</span>
                    </div>
                    {p.worldSetting && (
                      <p className="text-xs text-gray-500 line-clamp-1">{p.worldSetting}</p>
                    )}
                    <p className="text-xs text-gray-600 mt-1">{new Date(p.createdAt).toLocaleDateString('zh-CN')}</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(p.id, p.name) }}
                    className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-300 p-1"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 新建项目弹窗 */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
              <h3 className="text-gray-100 font-semibold">新建项目</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-500 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {/* 项目名称 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">项目名称 *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="例：战神奶爸归来"
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600"
                />
              </div>

              {/* 题材选择 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">题材组合 * <span className="text-gray-600">（最多选2个）</span></label>
                <div className="flex flex-wrap gap-1.5">
                  {GENRE_LIST.map(g => (
                    <button
                      key={g.id}
                      onClick={() => toggleGenre(g.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                        form.genre.includes(g.id)
                          ? 'bg-amber-600/30 text-amber-300 border-amber-600/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                      }`}
                    >
                      {g.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* 受众 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">目标受众</label>
                <div className="flex gap-2">
                  {AUDIENCE_OPTIONS.map(o => (
                    <button
                      key={o}
                      onClick={() => setForm(f => ({ ...f, audience: o }))}
                      className={`flex-1 text-sm py-1.5 rounded-lg border transition-colors ${
                        form.audience === o
                          ? 'bg-amber-600/30 text-amber-300 border-amber-600/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* 基调 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">故事基调</label>
                <div className="flex gap-2 flex-wrap">
                  {TONE_OPTIONS.map(o => (
                    <button
                      key={o}
                      onClick={() => setForm(f => ({ ...f, tone: o }))}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        form.tone === o
                          ? 'bg-amber-600/30 text-amber-300 border-amber-600/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* 结局 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">结局类型</label>
                <div className="flex gap-2 flex-wrap">
                  {ENDING_OPTIONS.map(o => (
                    <button
                      key={o}
                      onClick={() => setForm(f => ({ ...f, endingType: o }))}
                      className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
                        form.endingType === o
                          ? 'bg-amber-600/30 text-amber-300 border-amber-600/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {o}
                    </button>
                  ))}
                </div>
              </div>

              {/* 集数 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">集数规模</label>
                <div className="flex gap-1.5 flex-wrap">
                  {EPISODE_OPTIONS.map(o => (
                    <button
                      key={o.value}
                      onClick={() => { setForm(f => ({ ...f, totalEpisodes: o.value })); setCustomEpisodes('') }}
                      className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                        form.totalEpisodes === o.value && !customEpisodes
                          ? 'bg-amber-600/30 text-amber-300 border-amber-600/60'
                          : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                  <input
                    type="number"
                    min={1}
                    max={200}
                    value={customEpisodes}
                    onChange={e => {
                      setCustomEpisodes(e.target.value)
                      const v = parseInt(e.target.value)
                      if (!isNaN(v) && v > 0) setForm(f => ({ ...f, totalEpisodes: v }))
                    }}
                    placeholder="自定义"
                    className={`w-20 text-xs px-2 py-1.5 rounded-lg border transition-colors bg-gray-800 focus:outline-none ${
                      customEpisodes ? 'text-amber-300 border-amber-600/60' : 'text-gray-400 border-gray-700'
                    }`}
                  />
                </div>
                <p className="text-xs text-gray-600 mt-1">当前：{form.totalEpisodes} 集</p>
              </div>

              {/* 世界观 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">世界观/背景设定 <span className="text-gray-600">（可选，AI会基于此创作）</span></label>
                <textarea
                  value={form.worldSetting}
                  onChange={e => setForm(f => ({ ...f, worldSetting: e.target.value }))}
                  placeholder="例：现代都市，男主是退役特种兵，回乡后发现家族企业被人窃取，带着失散多年的儿子开始复仇之路……"
                  rows={3}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-amber-600 resize-none"
                />
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleCreate}
                disabled={saving || !form.name.trim() || form.genre.length === 0}
                className="flex-1 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? '创建中…' : '创建并进入工作台'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectPage
