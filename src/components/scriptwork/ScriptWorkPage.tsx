import React, { useState, useRef, useEffect } from 'react'
import RegenConfirmModal from '../modals/RegenConfirmModal'
import { useProjectStore } from '../../store/useProjectStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { streamGenerate } from '../../services/api'
import {
  buildCreativePlanSystemPrompt,
  buildCreativePlanUserPrompt,
} from '../../prompts/drama/creativePlan'
import {
  buildCharacterDevSystemPrompt,
  buildCharacterDevUserPrompt,
} from '../../prompts/drama/characterDev'
import {
  buildEpisodeDirSystemPrompt,
  buildEpisodeDirUserPrompt,
  buildEpisodeDirBatchUserPrompt,
  type PrevEpisodeBrief,
} from '../../prompts/drama/episodeDirectory'
import {
  buildEpisodeScriptSystemPrompt,
  buildEpisodeScriptUserPrompt,
} from '../../prompts/drama/episodeScript'
import {
  buildFaithfulEpisodeSystemPrompt,
  buildFaithfulEpisodeUserPrompt,
  buildBlockbusterEpisodeSystemPrompt,
  buildBlockbusterEpisodeUserPrompt,
} from '../../prompts/drama/importScript'
import { GENRE_LIST } from '../../data/drama/genreGuide'
import ChainProgressBar from '../common/ChainProgressBar'
import type { TabId } from '../layout/TabNav'
import type { Episode } from '../../types'

interface ScriptWorkPageProps {
  onNavigate: (tab: TabId) => void
  onLoadEpisode: (episode: Episode) => void
}

interface ChainProgress {
  label: string
  current: number
  total: number
  detail: string
}

type RightTab = 'plan' | 'chars' | 'episode'

const ScriptWorkPage: React.FC<ScriptWorkPageProps> = ({ onNavigate, onLoadEpisode }) => {
  const {
    currentProject, episodes, currentEpisode,
    updateProject, batchAddEpisodes, updateEpisode, selectEpisode, deleteEpisode,
  } = useProjectStore()
  const materialStore = useMaterialStore()
  const { textSettings } = useSettingsStore()

  const [generating, setGenerating] = useState<string | null>(null)
  const [streamText, setStreamText] = useState('')
  const [dirMode, setDirMode] = useState<'single' | 'chain'>('single')
  const [chainProgress, setChainProgress] = useState<ChainProgress | null>(null)
  const [rightTab, setRightTab] = useState<RightTab>('plan')
  const [regenTarget, setRegenTarget] = useState<'plan' | 'chars' | 'dir' | null>(null)

  // Local editable state for plan/chars with debounced save
  const [localPlan, setLocalPlan] = useState('')
  const [localChars, setLocalChars] = useState('')
  const planDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const charsDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Sync local state when project changes
  useEffect(() => {
    if (currentProject) {
      setLocalPlan(currentProject.creativePlan)
      setLocalChars(currentProject.characterDoc)
    }
  }, [currentProject?.id])

  if (!currentProject) {
    return (
      <div className="h-full flex items-center justify-center text-gray-500 text-sm">
        请先在「项目管理」中选择或创建一个项目
      </div>
    )
  }

  const genreNames = currentProject.genre
    .map(id => GENRE_LIST.find(g => g.id === id)?.name ?? id)
    .join(' + ')

  const isGenerating = generating !== null
  const isDirGenerating = generating === 'dir' || generating === 'dir_chain'
  // Lock tabs during generation except script_chain (which auto-switches per episode)
  const tabLocked = isGenerating && generating !== 'script_chain'

  const abort = () => {
    abortRef.current?.abort()
    setGenerating(null)
    setStreamText('')
    setChainProgress(null)
  }

  const handlePlanChange = (val: string) => {
    setLocalPlan(val)
    if (planDebounceRef.current) clearTimeout(planDebounceRef.current)
    planDebounceRef.current = setTimeout(() => {
      updateProject(currentProject.id, { creativePlan: val })
    }, 300)
  }

  const handleCharsChange = (val: string) => {
    setLocalChars(val)
    if (charsDebounceRef.current) clearTimeout(charsDebounceRef.current)
    charsDebounceRef.current = setTimeout(() => {
      updateProject(currentProject.id, { characterDoc: val })
    }, 300)
  }

  // 生成创作方案
  const handleGenCreativePlan = async (editInstruction?: string) => {
    if (!textSettings) return
    setRightTab('plan')
    setGenerating('plan')
    setStreamText('')
    abortRef.current = new AbortController()
    let result = ''
    try {
      await streamGenerate(
        [
          { role: 'system', content: buildCreativePlanSystemPrompt() },
          {
            role: 'user', content: buildCreativePlanUserPrompt({
              genre: currentProject.genre,
              audience: currentProject.audience,
              tone: currentProject.tone,
              endingType: currentProject.endingType,
              totalEpisodes: currentProject.totalEpisodes,
              worldSetting: currentProject.worldSetting,
            }, editInstruction)
          },
        ],
        textSettings,
        (token) => { result += token; setStreamText(result) },
        abortRef.current.signal,
      )
      await updateProject(currentProject.id, { creativePlan: result })
      setLocalPlan(result)
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
  }

  // 生成角色档案
  const handleGenCharacters = async (editInstruction?: string) => {
    if (!textSettings || !currentProject.creativePlan) return
    setRightTab('chars')
    setGenerating('chars')
    setStreamText('')
    abortRef.current = new AbortController()
    let result = ''
    try {
      await streamGenerate(
        [
          { role: 'system', content: buildCharacterDevSystemPrompt() },
          { role: 'user', content: buildCharacterDevUserPrompt(currentProject.creativePlan, editInstruction) },
        ],
        textSettings,
        (token) => { result += token; setStreamText(result) },
        abortRef.current.signal,
      )
      await updateProject(currentProject.id, { characterDoc: result })
      setLocalChars(result)
      const jsonMatch = result.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          if (parsed.characters?.length) {
            materialStore.bulkFill('character', parsed.characters.map((c: { name: string; visual_desc: string }) => ({
              name: c.name, desc: c.visual_desc,
            })))
          }
          if (parsed.scenes?.length) {
            materialStore.bulkFill('image', parsed.scenes.map((s: { name: string; visual_desc: string }) => ({
              name: s.name, desc: s.visual_desc,
            })))
          }
          if (parsed.props?.length) {
            materialStore.bulkFill('props', parsed.props.map((p: { name: string; visual_desc: string }) => ({
              name: p.name, desc: p.visual_desc,
            })))
          }
        } catch { /* ignore parse error */ }
      }
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
  }

  // 生成分集目录（流式单次）
  const handleGenDirectory = async (editInstruction?: string) => {
    if (!textSettings || !currentProject.creativePlan || !currentProject.characterDoc) return
    // 清除旧集数
    for (const ep of episodes) await deleteEpisode(ep.id)
    setGenerating('dir')
    setStreamText('')
    abortRef.current = new AbortController()
    let result = ''
    try {
      await streamGenerate(
        [
          { role: 'system', content: buildEpisodeDirSystemPrompt() },
          {
            role: 'user', content: buildEpisodeDirUserPrompt(
              currentProject.creativePlan,
              currentProject.characterDoc,
              currentProject.totalEpisodes,
              editInstruction,
            )
          },
        ],
        textSettings,
        (token) => { result += token; setStreamText(result) },
        abortRef.current.signal,
      )
      const jsonMatch = result.match(/```json\s*([\s\S]*?)```/)
      if (jsonMatch) {
        try {
          const parsed: Array<{
            episodeNumber: number; title: string; summary: string;
            hookType: string; mark: string
          }> = JSON.parse(jsonMatch[1])
          await batchAddEpisodes(parsed.map(ep => ({
            projectId: currentProject.id,
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            summary: ep.summary,
            hookType: ep.hookType,
            mark: ep.mark,
            script: '',
            status: 'outline' as const,
            sourceText: '',
          })))
        } catch { /* ignore parse error */ }
      }
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
  }

  // 生成分集目录（链式分批）
  const handleGenDirectoryChain = async (editInstruction?: string) => {
    if (!textSettings || !currentProject.creativePlan || !currentProject.characterDoc) return
    // 清除旧集数
    for (const ep of episodes) await deleteEpisode(ep.id)
    const BATCH_SIZE = 5
    const total = currentProject.totalEpisodes
    const totalBatches = Math.ceil(total / BATCH_SIZE)
    setGenerating('dir_chain')
    setStreamText('')
    abortRef.current = new AbortController()
    const allGenerated: PrevEpisodeBrief[] = []
    try {
      for (let batchIdx = 0; batchIdx < totalBatches; batchIdx++) {
        const batchStart = batchIdx * BATCH_SIZE + 1
        const batchEnd = Math.min((batchIdx + 1) * BATCH_SIZE, total)
        setChainProgress({
          label: '分集目录',
          current: batchIdx + 1,
          total: totalBatches,
          detail: `第${batchStart}-${batchEnd}集`,
        })
        setStreamText('')
        let result = ''
        await streamGenerate(
          [
            { role: 'system', content: buildEpisodeDirSystemPrompt() },
            {
              role: 'user', content: buildEpisodeDirBatchUserPrompt(
                currentProject.creativePlan,
                currentProject.characterDoc,
                batchStart,
                batchEnd,
                total,
                allGenerated,
                editInstruction,
              )
            },
          ],
          textSettings,
          (token) => { result += token; setStreamText(result) },
          abortRef.current.signal,
        )
        const jsonMatch = result.match(/```json\s*([\s\S]*?)```/)
        if (jsonMatch) {
          try {
            const parsed: PrevEpisodeBrief[] = JSON.parse(jsonMatch[1])
            allGenerated.push(...parsed)
            await batchAddEpisodes(parsed.map(ep => ({
              projectId: currentProject.id,
              episodeNumber: ep.episodeNumber,
              title: ep.title,
              summary: ep.summary,
              hookType: ep.hookType,
              mark: ep.mark,
              script: '',
              status: 'outline' as const,
              sourceText: '',
            })))
          } catch { /* ignore parse error */ }
        }
      }
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
    setChainProgress(null)
  }

  // 生成单集剧本
  const handleGenScript = async (ep: Episode) => {
    if (!textSettings) return
    selectEpisode(ep.id)
    setRightTab('episode')
    setGenerating(`script_${ep.id}`)
    setStreamText('')
    abortRef.current = new AbortController()
    let result = ''
    const sortedEps = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
    const prevEp = sortedEps.find(e => e.episodeNumber === ep.episodeNumber - 1)
    const nextEp = sortedEps.find(e => e.episodeNumber === ep.episodeNumber + 1)

    const isImported = currentProject.sourceMode === 'imported'
    const adaptMode = currentProject.adaptMode as 'faithful' | 'blockbuster' | ''

    let messages: Parameters<typeof streamGenerate>[0]
    if (isImported && adaptMode === 'faithful') {
      messages = [
        { role: 'system', content: buildFaithfulEpisodeSystemPrompt() },
        {
          role: 'user', content: buildFaithfulEpisodeUserPrompt(
            ep.episodeNumber, ep.title, ep.summary,
            ep.sourceText || '',
            currentProject.characterDoc,
            prevEp ? `第${prevEp.episodeNumber}集结尾：${prevEp.summary}` : undefined
          )
        },
      ]
    } else if (isImported && adaptMode === 'blockbuster') {
      messages = [
        { role: 'system', content: buildBlockbusterEpisodeSystemPrompt() },
        {
          role: 'user', content: buildBlockbusterEpisodeUserPrompt(
            ep.episodeNumber, ep.title, ep.summary,
            currentProject.creativePlan, currentProject.characterDoc,
            currentProject.totalEpisodes,
            prevEp ? `第${prevEp.episodeNumber}集结尾：${prevEp.summary}` : undefined,
            nextEp ? `第${nextEp.episodeNumber}集「${nextEp.title}」：${nextEp.summary}` : undefined
          )
        },
      ]
    } else {
      if (!currentProject.creativePlan) { setGenerating(null); return }
      messages = [
        { role: 'system', content: buildEpisodeScriptSystemPrompt(ep.episodeNumber === 1) },
        {
          role: 'user', content: buildEpisodeScriptUserPrompt({
            episodeNumber: ep.episodeNumber,
            title: ep.title,
            summary: ep.summary,
            hookType: ep.hookType,
            mark: ep.mark,
            characterDoc: currentProject.characterDoc,
            creativePlan: currentProject.creativePlan,
            prevEpisodeHook: prevEp?.summary,
            prevEpisodeScript: prevEp?.script || undefined,
            nextEpisodeBrief: nextEp ? `第${nextEp.episodeNumber}集「${nextEp.title}」—— ${nextEp.summary}` : undefined,
            totalEpisodes: currentProject.totalEpisodes,
          })
        },
      ]
    }

    try {
      await streamGenerate(messages, textSettings, (token) => { result += token; setStreamText(result) }, abortRef.current.signal)
      await updateEpisode(ep.id, { script: result, status: 'scripted' })
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
  }

  // 链式生成全部剧本
  const handleGenAllScripts = async () => {
    if (!textSettings || !currentProject.creativePlan || episodes.length === 0) return
    const sortedEps = [...episodes].sort((a, b) => a.episodeNumber - b.episodeNumber)
    const pending = sortedEps.filter(ep => ep.status !== 'scripted' && ep.status !== 'storyboarded')
    if (pending.length === 0) return
    setGenerating('script_chain')
    abortRef.current = new AbortController()
    try {
      for (let i = 0; i < pending.length; i++) {
        const ep = pending[i]
        selectEpisode(ep.id)
        setRightTab('episode')
        setChainProgress({
          label: '全部剧本',
          current: i + 1,
          total: pending.length,
          detail: `第${ep.episodeNumber}集「${ep.title}」`,
        })
        setStreamText('')
        const freshEps = useProjectStore.getState().episodes
        const prevEp = freshEps.find(e => e.episodeNumber === ep.episodeNumber - 1)
        const nextEp = freshEps.find(e => e.episodeNumber === ep.episodeNumber + 1)
        let result = ''
        await streamGenerate(
          [
            { role: 'system', content: buildEpisodeScriptSystemPrompt(ep.episodeNumber === 1) },
            {
              role: 'user', content: buildEpisodeScriptUserPrompt({
                episodeNumber: ep.episodeNumber,
                title: ep.title,
                summary: ep.summary,
                hookType: ep.hookType,
                mark: ep.mark,
                characterDoc: currentProject.characterDoc,
                creativePlan: currentProject.creativePlan,
                prevEpisodeHook: prevEp?.summary,
                prevEpisodeScript: prevEp?.script || undefined,
                nextEpisodeBrief: nextEp ? `第${nextEp.episodeNumber}集「${nextEp.title}」—— ${nextEp.summary}` : undefined,
                totalEpisodes: currentProject.totalEpisodes,
              })
            },
          ],
          textSettings,
          (token) => { result += token; setStreamText(result) },
          abortRef.current.signal,
        )
        await updateEpisode(ep.id, { script: result, status: 'scripted' })
      }
    } catch { /* ignore abort */ }
    setGenerating(null)
    setStreamText('')
    setChainProgress(null)
  }

  // 进入分镜生成
  const handleGoStoryboard = (ep: Episode) => {
    if (!ep.script) return
    onLoadEpisode(ep)
    onNavigate('create')
  }

  const handleSelectEpisode = (epId: string) => {
    selectEpisode(epId)
    setRightTab('episode')
  }

  const activeEp = currentEpisode
  const canGenDir = !isGenerating && !!currentProject.creativePlan && !!currentProject.characterDoc
  const pendingScripts = episodes.filter(ep => ep.status !== 'scripted' && ep.status !== 'storyboarded')

  return (
    <>
    <div className="h-full flex overflow-hidden">
      {/* 左栏 */}
      <div className="w-72 shrink-0 flex flex-col border-r border-gray-800 overflow-hidden">
        {/* 项目头部 */}
        <div className="px-4 py-3 border-b border-gray-800 shrink-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs text-indigo-400 bg-indigo-900/20 px-1.5 py-0.5 rounded border border-indigo-800/30">{genreNames}</span>
            <span className="text-xs text-gray-500">{currentProject.totalEpisodes}集</span>
          </div>
          <h3 className="text-gray-100 font-medium text-sm truncate">{currentProject.name}</h3>
        </div>

        {/* 操作按钮 */}
        <div className="px-3 py-3 border-b border-gray-800 space-y-2 shrink-0">
          <button
            onClick={() => currentProject.creativePlan ? setRegenTarget('plan') : handleGenCreativePlan()}
            disabled={isGenerating}
            className="w-full text-xs py-2 rounded-lg border transition-colors flex items-center gap-1.5 justify-center
              bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-700 hover:text-indigo-400 disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            {generating === 'plan' ? '生成中…' : currentProject.creativePlan ? '重新生成创作方案' : '生成创作方案'}
          </button>

          <button
            onClick={() => currentProject.characterDoc ? setRegenTarget('chars') : handleGenCharacters()}
            disabled={isGenerating || !currentProject.creativePlan}
            className="w-full text-xs py-2 rounded-lg border transition-colors flex items-center gap-1.5 justify-center
              bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-700 hover:text-indigo-400 disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            {generating === 'chars' ? '生成中…' : currentProject.characterDoc ? '重新生成角色' : '生成角色体系'}
          </button>

          {/* 分集目录 - 模式切换 + 生成按钮 */}
          {currentProject.creativePlan && currentProject.characterDoc && (
            <div>
              <div className="text-xs text-gray-600 mb-1">分集目录生成模式</div>
              <div className="flex gap-1 mb-1.5">
                <button
                  onClick={() => setDirMode('single')}
                  disabled={isGenerating}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${
                    dirMode === 'single'
                      ? 'bg-indigo-600/20 text-indigo-400 border-indigo-600/40'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600 disabled:opacity-40'
                  }`}
                >
                  流式(一次)
                </button>
                <button
                  onClick={() => setDirMode('chain')}
                  disabled={isGenerating}
                  className={`flex-1 text-xs py-1 rounded border transition-colors ${
                    dirMode === 'chain'
                      ? 'bg-indigo-600/20 text-indigo-400 border-indigo-600/40'
                      : 'bg-gray-800 text-gray-500 border-gray-700 hover:border-gray-600 disabled:opacity-40'
                  }`}
                >
                  链式(分批)
                </button>
              </div>
            </div>
          )}

          <button
            onClick={() => episodes.length > 0
              ? setRegenTarget('dir')
              : dirMode === 'single' ? handleGenDirectory() : handleGenDirectoryChain()
            }
            disabled={!canGenDir}
            className="w-full text-xs py-2 rounded-lg border transition-colors flex items-center gap-1.5 justify-center
              bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-700 hover:text-indigo-400 disabled:opacity-40"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
            {isDirGenerating ? '生成中…' : episodes.length > 0 ? '重新生成分集目录' : '生成分集目录'}
          </button>

          {/* 链式生成全部剧本 */}
          {episodes.length > 0 && (
            <button
              onClick={handleGenAllScripts}
              disabled={isGenerating || !currentProject.creativePlan || pendingScripts.length === 0}
              className="w-full text-xs py-2 rounded-lg border transition-colors flex items-center gap-1.5 justify-center
                bg-gray-800 text-gray-300 border-gray-700 hover:border-indigo-700 hover:text-indigo-400 disabled:opacity-40"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {generating === 'script_chain'
                ? '生成中…'
                : pendingScripts.length === 0
                  ? '全部剧本已完成'
                  : `链式生成全部剧本（${pendingScripts.length}集）`
              }
            </button>
          )}
        </div>

        {/* 分集目录列表 */}
        <div className="flex-1 overflow-y-auto">
          {episodes.length === 0 ? (
            <div className="text-center py-8 text-gray-600 text-xs px-4">
              {!currentProject.creativePlan
                ? '请先生成创作方案'
                : !currentProject.characterDoc
                  ? '请先生成角色体系'
                  : '点击上方按钮生成分集目录'}
            </div>
          ) : (
            <div>
              {episodes.map(ep => (
                <button
                  key={ep.id}
                  onClick={() => handleSelectEpisode(ep.id)}
                  className={`w-full text-left px-4 py-2.5 border-b border-gray-800/50 transition-colors hover:bg-gray-800/50 ${
                    activeEp?.id === ep.id ? 'bg-gray-800/70 border-l-2 border-l-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs text-gray-500">第{ep.episodeNumber}集</span>
                    {ep.mark === 'fire' && <span className="text-xs">🔥</span>}
                    {ep.mark === 'money' && <span className="text-xs">💰</span>}
                    <span className={`text-xs ml-auto px-1 py-0.5 rounded ${
                      ep.status === 'storyboarded' ? 'text-emerald-400 bg-emerald-900/20'
                        : ep.status === 'scripted' ? 'text-indigo-400 bg-indigo-900/20'
                          : 'text-gray-600 bg-gray-800/50'
                    }`}>
                      {ep.status === 'storyboarded' ? '已分镜' : ep.status === 'scripted' ? '已成稿' : '待创作'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-300 truncate">{ep.title}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 右栏 */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Tab 栏 */}
        <div className="flex border-b border-gray-800 shrink-0 px-1">
          <button
            onClick={() => !tabLocked && setRightTab('plan')}
            className={`text-xs px-4 py-2.5 border-b-2 transition-colors ${
              rightTab === 'plan'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            } ${tabLocked && rightTab !== 'plan' ? 'pointer-events-none opacity-40' : ''}`}
          >
            创作方案
          </button>
          <button
            onClick={() => !tabLocked && setRightTab('chars')}
            className={`text-xs px-4 py-2.5 border-b-2 transition-colors ${
              rightTab === 'chars'
                ? 'border-indigo-500 text-indigo-400'
                : 'border-transparent text-gray-500 hover:text-gray-300'
            } ${tabLocked && rightTab !== 'chars' ? 'pointer-events-none opacity-40' : ''}`}
          >
            角色档案
          </button>
          {activeEp && (
            <button
              onClick={() => !tabLocked && setRightTab('episode')}
              className={`text-xs px-4 py-2.5 border-b-2 transition-colors max-w-[200px] truncate ${
                rightTab === 'episode'
                  ? 'border-indigo-500 text-indigo-400'
                  : 'border-transparent text-gray-500 hover:text-gray-300'
              } ${tabLocked && rightTab !== 'episode' ? 'pointer-events-none opacity-40' : ''}`}
            >
              第{activeEp.episodeNumber}集·{activeEp.title}
            </button>
          )}
        </div>

        {/* Tab 内容区 */}
        <div className="flex-1 overflow-hidden relative">

          {/* 分集目录生成浮层（绝对覆盖，优先级最高） */}
          {isDirGenerating && (
            <div className="absolute inset-0 z-10 bg-gray-950/95 flex flex-col overflow-hidden">
              {generating === 'dir_chain' && chainProgress && (
                <ChainProgressBar {...chainProgress} onStop={abort} />
              )}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                <span className="text-xs text-indigo-400">
                  {generating === 'dir_chain' ? '正在链式生成分集目录…' : '正在生成分集目录…'}
                </span>
                {generating !== 'dir_chain' && (
                  <button onClick={abort} className="ml-auto text-xs text-red-400 hover:text-red-300">停止</button>
                )}
              </div>
              <div className="flex-1 overflow-y-auto p-4">
                <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{streamText || '正在生成…'}</pre>
              </div>
            </div>
          )}

          {/* 创作方案 Tab */}
          <div className="h-full flex flex-col overflow-hidden" style={{ display: rightTab === 'plan' ? 'flex' : 'none' }}>
            {generating === 'plan' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs text-indigo-400">正在生成创作方案…</span>
                  <button onClick={abort} className="ml-auto text-xs text-red-400 hover:text-red-300">停止</button>
                </div>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{streamText}</pre>
              </div>
            ) : (
              <textarea
                value={localPlan}
                onChange={e => handlePlanChange(e.target.value)}
                placeholder="点击左侧「生成创作方案」按钮开始生成，或直接在此手动填写…&#10;&#10;创作方案 → 角色体系 → 分集目录 → 单集剧本"
                className="w-full flex-1 resize-none bg-transparent text-sm text-gray-200 p-4 focus:outline-none leading-relaxed placeholder-gray-700"
              />
            )}
          </div>

          {/* 角色档案 Tab */}
          <div className="h-full flex flex-col overflow-hidden" style={{ display: rightTab === 'chars' ? 'flex' : 'none' }}>
            {generating === 'chars' ? (
              <div className="flex-1 overflow-y-auto p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                  <span className="text-xs text-indigo-400">正在生成角色体系…</span>
                  <button onClick={abort} className="ml-auto text-xs text-red-400 hover:text-red-300">停止</button>
                </div>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{streamText}</pre>
              </div>
            ) : (
              <textarea
                value={localChars}
                onChange={e => handleCharsChange(e.target.value)}
                placeholder="点击左侧「生成角色体系」按钮开始生成，或直接在此手动填写…"
                className="w-full flex-1 resize-none bg-transparent text-sm text-gray-200 p-4 focus:outline-none leading-relaxed placeholder-gray-700"
              />
            )}
          </div>

          {/* 当前集 Tab */}
          <div className="h-full flex flex-col overflow-hidden" style={{ display: rightTab === 'episode' ? 'flex' : 'none' }}>
              {activeEp ? (
                <>
                  {/* 集标题栏 */}
                  <div className="px-4 py-3 border-b border-gray-800 shrink-0 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-indigo-400 font-medium">第{activeEp.episodeNumber}集</span>
                        {activeEp.mark === 'fire' && <span>🔥</span>}
                        {activeEp.mark === 'money' && <span>💰</span>}
                        <span className="text-sm text-gray-200 truncate">{activeEp.title}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 truncate">{activeEp.summary}</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleGenScript(activeEp)}
                        disabled={isGenerating || (!currentProject.creativePlan && currentProject.sourceMode !== 'imported')}
                        className="text-xs px-3 py-1.5 bg-gray-800 border border-gray-700 text-gray-300 rounded-lg hover:border-indigo-700 hover:text-indigo-400 disabled:opacity-40 transition-colors"
                      >
                        {generating === `script_${activeEp.id}` ? '生成中…' :
                          activeEp.script ?
                            (currentProject.sourceMode === 'imported' ? `重写剧本（${currentProject.adaptMode === 'faithful' ? '忠实' : '爆款'}）` : '重新生成剧本') :
                            (currentProject.sourceMode === 'imported' ? `生成剧本（${currentProject.adaptMode === 'faithful' ? '忠实改写' : '爆款改编'}）` : 'AI 生成剧本')
                        }
                      </button>
                      {activeEp.script && (
                        <button
                          onClick={() => handleGoStoryboard(activeEp)}
                          disabled={isGenerating}
                          className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 disabled:opacity-40 transition-colors"
                        >
                          进入分镜生成 →
                        </button>
                      )}
                      {isGenerating && generating !== 'script_chain' && (
                        <button
                          onClick={abort}
                          className="text-xs px-3 py-1.5 bg-red-900/30 border border-red-800/50 text-red-400 rounded-lg hover:bg-red-900/50 transition-colors"
                        >
                          停止
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 链式生成全部剧本进度条 */}
                  {generating === 'script_chain' && chainProgress && (
                    <ChainProgressBar {...chainProgress} onStop={abort} />
                  )}

                  {/* 剧本编辑区 */}
                  <div className="flex-1 overflow-hidden">
                    {(generating === `script_${activeEp.id}` || generating === 'script_chain') ? (
                      <div className="h-full overflow-y-auto p-4">
                        <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">{streamText || '正在生成剧本…'}</pre>
                      </div>
                    ) : (
                      <textarea
                        value={activeEp.script}
                        onChange={e => updateEpisode(activeEp.id, { script: e.target.value })}
                        placeholder="点击「AI 生成剧本」，或直接在此手动编写剧本内容……"
                        className="w-full h-full resize-none bg-transparent text-sm text-gray-200 p-4 focus:outline-none leading-relaxed placeholder-gray-700"
                      />
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center text-gray-600">
                  <div className="text-4xl mb-3">🎬</div>
                  <p className="text-sm">从左侧分集目录中选择一集</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

    {regenTarget && (
      <RegenConfirmModal
        title={
          regenTarget === 'plan' ? '重新生成创作方案'
            : regenTarget === 'chars' ? '重新生成角色体系'
              : '重新生成分集目录'
        }
        preview={
          regenTarget === 'plan' ? currentProject.creativePlan
            : regenTarget === 'chars' ? currentProject.characterDoc
              : episodes.map(e => `第${e.episodeNumber}集  ${e.title}`).join('\n')
        }
        onConfirm={(instruction) => {
          setRegenTarget(null)
          if (regenTarget === 'plan') handleGenCreativePlan(instruction || undefined)
          else if (regenTarget === 'chars') handleGenCharacters(instruction || undefined)
          else if (dirMode === 'chain') handleGenDirectoryChain(instruction || undefined)
          else handleGenDirectory(instruction || undefined)
        }}
        onClose={() => setRegenTarget(null)}
      />
    )}
    </>
  )
}

export default ScriptWorkPage
