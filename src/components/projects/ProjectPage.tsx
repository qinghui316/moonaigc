import React, { useEffect, useState, useCallback } from 'react'
import { useProjectStore } from '../../store/useProjectStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { GENRE_LIST } from '../../data/drama/genreGuide'
import {
  tryRuleSplit, aiSplitScript,
  generateImportCreativePlan, generateImportCharacterDoc,
  splitEpisodesToPartial, extractCharactersFromDoc, extractScenesFromDoc,
  normalizeAssetName,
} from '../../services/scriptImport'
import type { TabId } from '../layout/TabNav'
import type { Project } from '../../types'

interface ProjectPageProps {
  onNavigate: (tab: TabId) => void
}

const AUDIENCE_OPTIONS = ['女频', '男频', '全年龄']
const TONE_OPTIONS = ['甜虐', '爽燃', '搞笑', '暗黑', '温情']
const ENDING_OPTIONS = ['大团圆', '开放式', '反转式', '悲剧']
const IMPORT_AUDIENCE_OPTIONS: { label: string; value: string }[] = [
  { label: '不选择（参考原剧本）', value: '' },
  { label: '女频', value: '女频' },
  { label: '男频', value: '男频' },
  { label: '全年龄', value: '全年龄' },
]
const IMPORT_TONE_OPTIONS: { label: string; value: string }[] = [
  { label: '不选择（参考原剧本）', value: '' },
  { label: '甜虐', value: '甜虐' },
  { label: '爽燃', value: '爽燃' },
  { label: '搞笑', value: '搞笑' },
  { label: '暗黑', value: '暗黑' },
  { label: '温情', value: '温情' },
]
const IMPORT_ENDING_OPTIONS: { label: string; value: string }[] = [
  { label: '不选择（参考原剧本）', value: '' },
  { label: '大团圆', value: '大团圆' },
  { label: '开放式', value: '开放式' },
  { label: '反转式', value: '反转式' },
  { label: '悲剧', value: '悲剧' },
]
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
  const { projects, loadProjects, addProject, deleteProject, selectProject, updateProject, batchAddEpisodes } = useProjectStore()
  const { textSettings } = useSettingsStore()
  const materialStore = useMaterialStore()
  const [showForm, setShowForm] = useState(false)
  const [createMode, setCreateMode] = useState<'ai' | 'import'>('ai')
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [customEpisodes, setCustomEpisodes] = useState('')

  // 导入剧本相关状态
  const [importText, setImportText] = useState('')
  const [adaptMode, setAdaptMode] = useState<'faithful' | 'blockbuster'>('blockbuster')
  const [episodeCountMode, setEpisodeCountMode] = useState<'manual' | 'auto'>('auto')
  const [importEpisodes, setImportEpisodes] = useState(10)
  const [importCustomEpisodes, setImportCustomEpisodes] = useState('')
  const [importProgress, setImportProgress] = useState('')
  // 导入模式可选字段（空字符串 = 不选择，由AI从原文判断）
  const [importAudience, setImportAudience] = useState('')
  const [importTone, setImportTone] = useState('')
  const [importEndingType, setImportEndingType] = useState('')

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

  const handleImport = useCallback(async () => {
    if (!form.name.trim() || !importText.trim()) return
    if (!textSettings.key) { alert('请先在设置中配置文字 AI API Key'); return }
    setSaving(true)
    setImportProgress('创建项目...')

    // Step 1: 创建项目（importStatus = splitting）
    const p = await addProject({
      name: form.name.trim(),
      genre: form.genre.length ? form.genre : [],
      audience: importAudience,
      tone: importTone,
      endingType: importEndingType,
      totalEpisodes: importEpisodes,
      worldSetting: '',
      creativePlan: '',
      characterDoc: '',
      sourceMode: 'imported',
      adaptMode,
      sourceScript: importText,
      episodeCountMode,
      importStatus: 'splitting',
      currentStep: 1,
      lastCompletedStep: 0,
      importError: '',
    })

    try {
      setImportProgress('拆分集数...')
      // Step 2: 拆集
      let splitResult = tryRuleSplit(importText)
      if (!splitResult || Math.abs(splitResult.length - importEpisodes) > 3) {
        splitResult = await aiSplitScript(
          importText,
          episodeCountMode === 'auto' ? 0 : importEpisodes,
          adaptMode,
          textSettings,
          chunk => setImportProgress(`拆集中...${chunk.length}`)
        )
      }

      const actualCount = splitResult.length
      // 更新项目集数（AI auto 模式下集数由 AI 决定）
      await updateProject(p.id, {
        totalEpisodes: actualCount,
        importStatus: 'split_done',
        currentStep: 2,
        lastCompletedStep: 1,
      })

      // 批量创建剧集
      const episodePartials = splitEpisodesToPartial(p.id, splitResult)
      await batchAddEpisodes(episodePartials.map(e => ({
        ...e,
        projectId: p.id,
        episodeNumber: e.episodeNumber,
        title: e.title,
        summary: e.summary,
        hookType: e.hookType,
        mark: e.mark,
        script: '',
        status: 'outline' as const,
        sourceText: e.sourceText,
      })))

      setImportProgress('生成创作方案...')
      // Step 3: 生成创作方案
      const creativePlan = await generateImportCreativePlan(
        importText, adaptMode, actualCount, splitResult, textSettings,
        () => setImportProgress('生成创作方案中...')
      )
      await updateProject(p.id, {
        creativePlan,
        importStatus: 'plan_done',
        currentStep: 3,
        lastCompletedStep: 2,
      })

      setImportProgress('生成角色档案...')
      // Step 4: 生成角色档案
      const characterDoc = await generateImportCharacterDoc(
        importText, creativePlan, adaptMode, textSettings,
        () => setImportProgress('生成角色档案中...')
      )
      await updateProject(p.id, {
        characterDoc,
        importStatus: 'character_done',
        currentStep: 4,
        lastCompletedStep: 3,
      })

      // Step 5: 自动写入素材库（去重）
      const chars = extractCharactersFromDoc(characterDoc)
      const scenes = extractScenesFromDoc(creativePlan)
      const existingMats = materialStore.materials
      const existingNames = new Set([
        ...existingMats.character.map(m => normalizeAssetName(m.name)),
        ...existingMats.image.map(m => normalizeAssetName(m.name)),
      ])
      const newChars = chars.filter(c => !existingNames.has(normalizeAssetName(c.name)))
      const newScenes = scenes.filter(s => !existingNames.has(normalizeAssetName(s.name)))
      if (newChars.length) {
        materialStore.bulkFill('character', newChars.map(c => ({ name: c.name, desc: c.desc })))
      }
      if (newScenes.length) {
        materialStore.bulkFill('image', newScenes.map(s => ({ name: s.name, desc: s.desc })))
      }

      setImportProgress('完成！')
    } catch (e) {
      await updateProject(p.id, {
        importStatus: 'failed',
        importError: String(e),
      })
      alert(`导入失败：${String(e)}`)
    }

    setSaving(false)
    setImportProgress('')
    setShowForm(false)
    setImportText('')
    setImportAudience('')
    setImportTone('')
    setImportEndingType('')
    setForm(emptyForm)
    await selectProject(p.id)
    onNavigate('scriptwork')
  }, [
    form, importText, adaptMode, episodeCountMode, importEpisodes,
    importAudience, importTone, importEndingType,
    textSettings, addProject, updateProject, batchAddEpisodes, materialStore,
  ])

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
                      {p.sourceMode === 'imported' && (
                        <span className={`text-xs px-1.5 py-0.5 rounded shrink-0 ${
                          p.importStatus === 'character_done' ? 'bg-green-900/40 text-green-400' :
                          p.importStatus === 'failed' ? 'bg-red-900/40 text-red-400' :
                          'bg-blue-900/40 text-blue-400'
                        }`}>
                          {p.importStatus === 'character_done' ? '📄 导入完成' :
                           p.importStatus === 'failed' ? '❌ 导入失败' :
                           p.importStatus === 'idle' ? '📄 导入' : '⏳ 导入中'}
                        </span>
                      )}
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
              <button onClick={() => { setShowForm(false); setImportProgress(''); setImportAudience(''); setImportTone(''); setImportEndingType('') }} className="text-gray-500 hover:text-gray-300">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* 模式选择 */}
            <div className="flex gap-1 px-5 pt-4">
              <button
                onClick={() => setCreateMode('ai')}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${createMode === 'ai' ? 'bg-amber-600/30 text-amber-300 border-amber-600/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}
              >
                ✨ AI 创建项目
              </button>
              <button
                onClick={() => setCreateMode('import')}
                className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${createMode === 'import' ? 'bg-blue-600/30 text-blue-300 border-blue-600/50' : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-600'}`}
              >
                📄 导入已有剧本
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
                <label className="block text-xs text-gray-400 mb-1.5">
                  题材组合{createMode === 'ai' ? ' *' : ''}
                  <span className="text-gray-600 ml-1">
                    {createMode === 'ai' ? '（最多选2个）' : '（可选，不选则AI从原文判断）'}
                  </span>
                </label>
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

              {/* 受众 — AI模式必选，导入模式可选 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">目标受众</label>
                {createMode === 'ai' ? (
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
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {IMPORT_AUDIENCE_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setImportAudience(o.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          importAudience === o.value
                            ? (o.value === '' ? 'bg-gray-700 text-gray-300 border-gray-500' : 'bg-amber-600/30 text-amber-300 border-amber-600/60')
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 基调 — AI模式必选，导入模式可选 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">故事基调</label>
                {createMode === 'ai' ? (
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
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {IMPORT_TONE_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setImportTone(o.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          importTone === o.value
                            ? (o.value === '' ? 'bg-gray-700 text-gray-300 border-gray-500' : 'bg-amber-600/30 text-amber-300 border-amber-600/60')
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 结局 — AI模式必选，导入模式可选 */}
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">结局类型</label>
                {createMode === 'ai' ? (
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
                ) : (
                  <div className="flex gap-2 flex-wrap">
                    {IMPORT_ENDING_OPTIONS.map(o => (
                      <button
                        key={o.value}
                        onClick={() => setImportEndingType(o.value)}
                        className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${
                          importEndingType === o.value
                            ? (o.value === '' ? 'bg-gray-700 text-gray-300 border-gray-500' : 'bg-amber-600/30 text-amber-300 border-amber-600/60')
                            : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600'
                        }`}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* 集数 — 仅AI模式显示，导入模式有专属集数选择 */}
              {createMode === 'ai' && (
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
              )}

              {/* 世界观 */}
              {createMode === 'ai' && (
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
              )}

              {/* 导入剧本专属区域 */}
              {createMode === 'import' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">原始文本 * <span className="text-gray-600">（大纲/故事梗概/小说/完整剧本均可）</span></label>
                    <textarea
                      value={importText}
                      onChange={e => setImportText(e.target.value)}
                      placeholder="粘贴你的剧本文本，可以是完整剧本、故事大纲、小说梗概……"
                      rows={6}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-blue-600 resize-none"
                    />
                    <p className="text-xs text-gray-600 mt-1">{importText.length} 字</p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">改编模式</label>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setAdaptMode('faithful')}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${adaptMode === 'faithful' ? 'bg-blue-600/30 text-blue-300 border-blue-600/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                      >
                        📜 忠于原有剧本
                      </button>
                      <button
                        onClick={() => setAdaptMode('blockbuster')}
                        className={`flex-1 py-2 text-sm rounded-lg border transition-colors ${adaptMode === 'blockbuster' ? 'bg-purple-600/30 text-purple-300 border-purple-600/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                      >
                        🚀 爆款结构改编
                      </button>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
                      {adaptMode === 'faithful' ? '保留原文人物和情节脉络，仅做结构整理' : '在保留核心IP基础上，按短剧爆款节奏重新规划'}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 mb-1.5">集数模式</label>
                    <div className="flex gap-2 mb-2">
                      <button
                        onClick={() => setEpisodeCountMode('auto')}
                        className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${episodeCountMode === 'auto' ? 'bg-blue-600/30 text-blue-300 border-blue-600/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                      >
                        AI 自动判断
                      </button>
                      <button
                        onClick={() => setEpisodeCountMode('manual')}
                        className={`flex-1 py-1.5 text-sm rounded-lg border transition-colors ${episodeCountMode === 'manual' ? 'bg-blue-600/30 text-blue-300 border-blue-600/50' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                      >
                        手动指定集数
                      </button>
                    </div>
                    {episodeCountMode === 'manual' && (
                      <div className="flex gap-1.5 flex-wrap">
                        {EPISODE_OPTIONS.map(o => (
                          <button
                            key={o.value}
                            onClick={() => { setImportEpisodes(o.value); setImportCustomEpisodes('') }}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${importEpisodes === o.value && !importCustomEpisodes ? 'bg-amber-600/30 text-amber-300 border-amber-600/60' : 'bg-gray-800 text-gray-400 border-gray-700'}`}
                          >
                            {o.label}
                          </button>
                        ))}
                        <input
                          type="number"
                          min={1} max={200}
                          value={importCustomEpisodes}
                          onChange={e => {
                            setImportCustomEpisodes(e.target.value)
                            const v = parseInt(e.target.value)
                            if (!isNaN(v) && v > 0) setImportEpisodes(v)
                          }}
                          placeholder="自定义"
                          className="w-20 text-xs px-2 py-1.5 rounded-lg border bg-gray-800 text-gray-400 border-gray-700 focus:outline-none focus:border-amber-600"
                        />
                      </div>
                    )}
                  </div>

                  {importProgress && (
                    <div className="text-xs text-blue-400 bg-blue-900/20 border border-blue-800/30 rounded-lg px-3 py-2">
                      ⏳ {importProgress}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-800 flex gap-3">
              <button
                onClick={() => { setShowForm(false); setImportProgress(''); setImportAudience(''); setImportTone(''); setImportEndingType('') }}
                className="flex-1 py-2 text-sm text-gray-400 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
              >
                取消
              </button>
              {createMode === 'ai' ? (
                <button
                  onClick={handleCreate}
                  disabled={saving || !form.name.trim() || form.genre.length === 0}
                  className="flex-1 py-2 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? '创建中…' : '创建并进入工作台'}
                </button>
              ) : (
                <button
                  onClick={handleImport}
                  disabled={saving || !form.name.trim() || !importText.trim()}
                  className="flex-1 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  title={!form.name.trim() ? '请填写项目名称' : !importText.trim() ? '请粘贴原始文本' : ''}
                >
                  {saving ? (importProgress || '处理中…') : '📄 导入并生成'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectPage
