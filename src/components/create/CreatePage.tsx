import React, { useState, useRef, useCallback, useEffect } from 'react'
import DirectorGrid from './DirectorGrid'
import ParamPanel from './ParamPanel'
import DurationControl from './DurationControl'
import StoryboardTable from './StoryboardTable'
import StorylineTimeline from './StorylineTimeline'
import ShotEditModal from '../modals/ShotEditModal'
import SafetyModal from '../modals/SafetyModal'
import VisionModal from '../modals/VisionModal'
import StcModal from '../modals/StcModal'
import ScriptPasteModal from '../modals/ScriptPasteModal'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useChainStore } from '../../store/useChainStore'
import { useHistoryStore } from '../../store/useHistoryStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { DIRECTORS } from '../../data/directors'
import { CAMERA_TECHS } from '../../data/cameraTechs'
import { LIGHTING_TECHS } from '../../data/lightingTechs'
import { STYLE_MAP } from '../../data/styleMap'
import { streamGenerate, generate } from '../../services/api'
import { buildAnalyzeSystemPrompt, buildAnalyzeUserPrompt } from '../../prompts/analyze'
import { buildGlobalRefineSystemPrompt, buildGlobalRefineUserPrompt, buildIntegrateSystemPrompt, buildIntegrateUserPrompt } from '../../prompts/singleShot'
import { EXTRACT_SYSTEM_PROMPT, buildExtractUserPrompt } from '../../prompts/extract'
import { sanitizeText } from '../../utils/sanitize'
import { extractShotData, extractPrompts, extractShotsForIntegrate } from '../../utils/shotDataExtractor'
import { exportTxt } from '../../utils/exportTxt'
import { exportExcel } from '../../utils/exportExcel'
import { exportWord } from '../../utils/exportWord'
import { playCompletionSound, playErrorSound } from '../../utils/sound'
import {
  splitScript, buildInitialScenes, generateScene, extractBridge,
} from '../../services/chainEngine'
import { buildGenerateSystemPrompt, buildGenerateUserPrompt, buildExtremeShortSystemPrompt, extractDialogues } from '../../prompts/generate'
import type { Director, HistoryRecord, SafetyResult, AnalysisResult, ExtractionResult, Episode } from '../../types'
import { useProjectStore } from '../../store/useProjectStore'
import { useShotStore } from '../../store/useShotStore'
import type { Params } from './ParamPanel'

const DEFAULT_PARAMS: Params = {
  shotCount: '智能',
  customShotCount: '',
  aspectRatio: '16:9',
  quality: 'cinematic, 8K UHD, RAW photo, highly detailed, masterpiece',
  cameraTechs: ['dolly_in'],
  lightingTechs: [],
  visualStyle: 'cinematic',
  enableBGM: false,
  enableSubtitle: false,
  enableFidelity: false,
  enableSTC: true,
  narrativeMode: 'mini',
}

const CreatePage: React.FC<{ loadedRecord?: HistoryRecord | null; loadedEpisode?: Episode | null }> = ({ loadedRecord, loadedEpisode }) => {
  const { textSettings, autoSafety, autoSound, enableWordFilter, autoSaveHistory, setFlag } = useSettingsStore()
  const chainStore = useChainStore()
  const { add: addHistory, records: historyRecords } = useHistoryStore()
  const materialStore = useMaterialStore()
  const { currentProject, currentEpisode, updateEpisodeStatus } = useProjectStore()

  const [plot, setPlot] = useState('')
  const [selectedDirector, setSelectedDirector] = useState<Director>(DIRECTORS[0])
  const [params, setParams] = useState<Params>(DEFAULT_PARAMS)
  const [duration, setDuration] = useState(120)
  const [mode, setMode] = useState<'single' | 'chain'>('chain')
  const [paramCollapsed, setParamCollapsed] = useState(false)

  // Script import state
  const [isScriptImported, setIsScriptImported] = useState(false)
  const [showPasteModal, setShowPasteModal] = useState(false)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractStatus, setExtractStatus] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Results
  const [storyboard, setStoryboard] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [error, setError] = useState('')

  // Analysis
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [showAnalysis, setShowAnalysis] = useState(false)

  // Refine
  const [refineText, setRefineText] = useState('')
  const [isRefining, setIsRefining] = useState(false)

  // Integrated prompt
  const [integratedPrompt, setIntegratedPrompt] = useState('')
  const [showIntegrated, setShowIntegrated] = useState(false)
  const [isIntegrating, setIsIntegrating] = useState(false)

  // Modals
  const [editModal, setEditModal] = useState<{ row: string; index: number } | null>(null)
  const [safetyModal, setSafetyModal] = useState<SafetyResult | null>(null)
  const [showVision, setShowVision] = useState(false)
  const [showStc, setShowStc] = useState(false)
  const [pendingSafetyAction, setPendingSafetyAction] = useState<(() => void) | null>(null)
  const [viewSceneId, setViewSceneId] = useState<number | null>(null)

  const abortRef = useRef<AbortController | null>(null)

  // Restore storyboard from chainStore on remount (tab switch)
  useEffect(() => {
    if (!storyboard && chainStore.scenes.length > 0 && !chainStore.isRunning) {
      const contents = useChainStore.getState().sceneContents
      const restored = chainStore.scenes.map(s => contents[s.id] ?? '').join('\n')
      if (restored.trim()) setStoryboard(restored)
    }
  }, [])

  // Load history record
  useEffect(() => {
    if (!loadedRecord) return
    setPlot(loadedRecord.fullPlot || loadedRecord.plot || '')
    setStoryboard(loadedRecord.storyboard || '')
    const foundDirector = DIRECTORS.find(d => d.id === loadedRecord.directorId)
    if (foundDirector) setSelectedDirector(foundDirector)
    chainStore.reset()
  }, [loadedRecord])

  // Load episode script
  useEffect(() => {
    if (!loadedEpisode) return
    setPlot(loadedEpisode.script || '')
    chainStore.reset()
    // 尝试恢复该集最近一次生成的分镜内容
    const prevRecord = historyRecords.find(r => r.episodeId === loadedEpisode.id)
    setStoryboard(prevRecord ? (prevRecord.storyboard || '') : '')
  }, [loadedEpisode])

  const buildSystemContext = useCallback(() => {
    const assetInfo = materialStore.buildSystemPromptInfo()
    const isDonghua = !!(selectedDirector.donghuaProfile)
    const styleDesc = STYLE_MAP[params.visualStyle] ?? ''
    const donghuaRules = isDonghua && selectedDirector.donghuaProfile
      ? `使用国漫/修仙动漫专属提示词风格：\n角色风格：${selectedDirector.donghuaProfile.charStyle}\n世界风格：${selectedDirector.donghuaProfile.worldStyle}\n特效风格：${selectedDirector.donghuaProfile.vfxStyle}`
      : ''

    // Build camera/lighting preference string to inject into system prompt
    const cameraPrefs = params.cameraTechs.length > 0
      ? CAMERA_TECHS.filter(t => params.cameraTechs.includes(t.value)).map(t => t.label).join('、')
      : ''
    const lightingPrefs = params.lightingTechs.length > 0
      ? LIGHTING_TECHS.filter(t => params.lightingTechs.includes(t.value)).map(t => t.label).join('、')
      : ''

    const cameraLightingBlock = [
      cameraPrefs ? `【运镜偏好】：${cameraPrefs}` : '',
      lightingPrefs ? `【光影偏好】：${lightingPrefs}` : '',
    ].filter(Boolean).join('\n')

    return {
      directorInfo: selectedDirector,
      isDonghua,
      styleContext: styleDesc,
      donghuaRules,
      ...assetInfo,
      aspectRatio: `--ar ${params.aspectRatio}`,
      quality: params.quality,
      enableBGM: params.enableBGM,
      enableSubtitle: params.enableSubtitle,
      selectedStyleDesc: [styleDesc, cameraLightingBlock].filter(Boolean).join('\n'),
      isSTC: params.enableSTC,
      cameraTechs: params.cameraTechs,
      lightingTechs: params.lightingTechs,
    }
  }, [selectedDirector, params, materialStore])

  // 极速瞬间模式：duration<15s 时自动切回单段模式
  useEffect(() => {
    if (duration < 15 && mode === 'chain') {
      setMode('single')
    }
  }, [duration, mode])

  const runSafety = useCallback((text: string, onProceed: (cleanText: string) => void) => {
    const result = sanitizeText(text, enableWordFilter)
    const hasIssues = result.replacedRedZone.length > 0 || result.detectedRedZone.length > 0 ||
      result.detectedCelebrity.length > 0 || result.detectedIP.length > 0

    if (hasIssues || result.replaced.length > 0) {
      setSafetyModal(result)
      setPendingSafetyAction(() => () => {
        setSafetyModal(null)
        onProceed(result.text)
      })
    } else {
      onProceed(result.text)
    }
  }, [enableWordFilter])

  const doGenerate = useCallback(async (cleanPlot: string) => {
    if (!cleanPlot.trim()) { setError('请输入故事情节'); return }
    if (!textSettings.key) { setError('请先配置 API Key'); return }

    setError('')
    setStoryboard('')
    setIntegratedPrompt('')
    setShowIntegrated(false)
    setIsStreaming(true)
    chainStore.reset()

    const ctrl = new AbortController()
    abortRef.current = ctrl

    try {
      // 提取台词（台词锁定机制，对齐 V6）
      const dialogues = extractDialogues(cleanPlot)

      if (mode === 'single') {
        const ctx = buildSystemContext()
        // 极速瞬间模式（<15s）：使用独立的 system prompt
        const systemPrompt = duration < 15
          ? buildExtremeShortSystemPrompt(ctx, duration)
          : buildGenerateSystemPrompt({ ...ctx, isSTC: params.enableSTC })
        const userPrompt = buildGenerateUserPrompt({
          plot: cleanPlot,
          shotCount: params.shotCount,
          duration: `${duration}秒`,
          directorName: selectedDirector.name,
          analysisResult: analysisResult ? JSON.stringify(analysisResult) : undefined,
          dialogues,
        })

        let md = ''
        await streamGenerate(
          [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
          textSettings,
          (token) => { md += token; setStoryboard(md) },
          ctrl.signal
        )
        setIsStreaming(false)
        if (autoSound) playCompletionSound()
        if (autoSaveHistory && md) {
          const ep = useProjectStore.getState().currentEpisode
          const proj = useProjectStore.getState().currentProject
          const histId = await addHistory({
            createdAt: Date.now(),
            plot: cleanPlot.slice(0, 200),
            fullPlot: cleanPlot,
            director: selectedDirector.name,
            directorId: selectedDirector.id,
            storyboard: md,
            time: new Date().toLocaleString('zh-CN'),
            ...(proj ? { projectId: proj.id } : {}),
            ...(ep ? { episodeId: ep.id } : {}),
          } as Omit<HistoryRecord, 'id'>)
          const parsedShots = useShotStore.getState().parseFromMarkdown(md)
          await useShotStore.getState().saveShotsToDB(histId, parsedShots)
          if (ep) await updateEpisodeStatus(ep.id, 'storyboarded')
        }
      } else {
        // 链式模式
        const ctx = buildSystemContext()
        const assetInfo = materialStore.buildSystemPromptInfo()
        const isDonghuaDirector = !!(selectedDirector.donghuaProfile)
        const promptSuffix = isDonghuaDirector ? selectedDirector.donghuaProfile?.promptSuffix : ctx.selectedStyleDesc

        // Step 1: 切分剧本
        chainStore.setCleanPlot(cleanPlot)
        const splitMap = await splitScript(
          cleanPlot,
          params.narrativeMode as never,
          textSettings,
          params.enableSTC,
          selectedDirector.category,
          ctrl.signal
        )

        // Step 2: 构建场次
        const scenes = buildInitialScenes(params.narrativeMode as never, duration, splitMap)
        chainStore.setScenes(scenes)
        chainStore.setRunning(true)

        let globalOffset = 0

        // Step 3: 逐场次生成
        for (let i = 0; i < scenes.length; i++) {
          if (useChainStore.getState().isCancelled) break
          const scene = scenes[i]
          chainStore.setCurrentSceneId(scene.id)
          chainStore.updateScene(scene.id, {})

          const prevBridgeContent = i > 0 ? (useChainStore.getState().sceneContents[scenes[i - 1].id] ?? '') : ''
          const bridgeState = i > 0 ? extractBridge(prevBridgeContent) : null

          const directorBlock = selectedDirector.id !== 'generic'
            ? `【导演风格：${selectedDirector.name}】\n▶ 风格特征：${selectedDirector.style}\n▶ 运镜手法：${selectedDirector.techniques.join('、')}\n▶ 光影风格：${selectedDirector.lighting}`
            : ''

          try {
            const { content, chatHistory: newHistory, bridgeState: newBridge } = await generateScene({
              scene,
              sceneIndex: i,
              totalScenes: scenes.length,
              settings: textSettings,
              systemContext: {
                directorBlock,
                assetInfo: assetInfo.assetLibraryInfo,
                assetCallRule: assetInfo.assetCallRule,
                tagHint: assetInfo.subjectTagHint,
                nameMappingInstruction: assetInfo.nameMappingInstruction,
                selectedStyleDesc: ctx.selectedStyleDesc,
                enableBGM: params.enableBGM,
                enableSubtitle: params.enableSubtitle,
                hasAnyTagAsset: assetInfo.hasAnyTagAsset,
                aspectRatio: `--ar ${params.aspectRatio}`,
                quality: params.quality,
                isDonghuaDirector,
                promptSuffix,
                continuityIronRule: assetInfo.continuityIronRule,
                consistencyAnchor: assetInfo.consistencyAnchor,
              },
              isSTC: params.enableSTC,
              isFaithfulMode: params.enableFidelity || isScriptImported,
              chatHistory: useChainStore.getState().sceneChatHistory[i] ?? [],
              bridgeState,
              globalOffset,
              cleanPlot,
              dialogueLockList: dialogues,
              onToken: (token) => chainStore.appendSceneContent(scene.id, token),
              signal: ctrl.signal,
            })
            chainStore.setSceneContent(scene.id, content)
            chainStore.setSceneChatHistory(i + 1, newHistory)
            if (newBridge) chainStore.setSceneBridge(scene.id, newBridge)
            globalOffset += scene.estimatedDuration
          } catch (e) {
            if ((e as Error).name === 'AbortError') break
            chainStore.updateScene(scene.id, { error: String(e) })
            globalOffset += scene.estimatedDuration
          }
        }

        chainStore.setRunning(false)
        chainStore.setCurrentSceneId(null)

        const latestContents = useChainStore.getState().sceneContents
        const allContent = scenes.map(s => latestContents[s.id] ?? '').join('\n')
        setStoryboard(allContent)

        if (autoSound && !useChainStore.getState().isCancelled) playCompletionSound()

        // STC 链式完成后自动触发自检（对齐 6.5 行为）
        if (params.enableSTC && allContent && !useChainStore.getState().isCancelled) {
          setShowStc(true)
        }
        if (autoSaveHistory && allContent) {
          const ep = useProjectStore.getState().currentEpisode
          const proj = useProjectStore.getState().currentProject
          const histId = await addHistory({
            createdAt: Date.now(),
            plot: cleanPlot.slice(0, 200),
            fullPlot: cleanPlot,
            director: selectedDirector.name,
            directorId: selectedDirector.id,
            storyboard: allContent,
            time: new Date().toLocaleString('zh-CN'),
            ...(proj ? { projectId: proj.id } : {}),
            ...(ep ? { episodeId: ep.id } : {}),
          } as Omit<HistoryRecord, 'id'>)
          const parsedShots = useShotStore.getState().parseFromMarkdown(allContent)
          await useShotStore.getState().saveShotsToDB(histId, parsedShots)
          if (ep) await updateEpisodeStatus(ep.id, 'storyboarded')
        }
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') {
        setError(String(e))
        playErrorSound()
      }
    }
    setIsStreaming(false)
  }, [plot, mode, textSettings, params, duration, selectedDirector, analysisResult, autoSound, autoSaveHistory, buildSystemContext, materialStore, chainStore, addHistory, isScriptImported])

  const handleGenerate = () => {
    if (!plot.trim()) { setError('请输入故事情节'); return }
    if (autoSafety) {
      runSafety(plot, doGenerate)
    } else {
      doGenerate(plot)
    }
  }

  const handleAnalyze = async () => {
    if (!plot.trim()) { setError('请输入故事情节'); return }
    if (!textSettings.key) { setError('请先配置 API Key'); return }
    setIsAnalyzing(true)
    setError('')
    try {
      const systemPrompt = buildAnalyzeSystemPrompt({
        director: selectedDirector,
        isSTC: params.enableSTC,
        isDonghua: !!(selectedDirector.donghuaProfile),
        duration,
        enableSound: params.enableBGM,
      })
      const result = await generate(
        [{ role: 'system', content: systemPrompt }, { role: 'user', content: buildAnalyzeUserPrompt(plot) }],
        textSettings
      )
      const parsed: AnalysisResult = JSON.parse(result.replace(/```json\n?|```/g, '').trim())
      setAnalysisResult(parsed)
      setShowAnalysis(true)
    } catch (e) {
      setError(`分析失败: ${String(e)}`)
    }
    setIsAnalyzing(false)
  }

  const handleCancel = () => {
    abortRef.current?.abort()
    chainStore.cancel()
    setIsStreaming(false)
  }

  const handleRefine = async () => {
    if (!refineText.trim() || !storyboard) return
    setIsRefining(true)
    try {
      let newMd = ''
      await streamGenerate(
        [
          { role: 'system', content: buildGlobalRefineSystemPrompt() },
          { role: 'user', content: buildGlobalRefineUserPrompt(storyboard, refineText) },
        ],
        textSettings,
        (token) => { newMd += token; setStoryboard(newMd) }
      )
    } catch (e) {
      setError(String(e))
    }
    setIsRefining(false)
  }

  const handleCopyAll = () => {
    const prompts = extractPrompts(storyboard)
    navigator.clipboard.writeText(prompts.join('\n\n---\n\n'))
    alert(`已复制 ${prompts.length} 条提示词`)
  }

  const handleIntegrate = async () => {
    const shots = extractShotsForIntegrate(storyboard)
    if (!shots.length) { setError('暂无可整合的分镜数据'); return }
    if (!textSettings.key) { setError('请先配置 API Key'); return }

    setIsIntegrating(true)
    setShowIntegrated(true)
    setIntegratedPrompt('')

    const systemPrompt = buildIntegrateSystemPrompt({
      directorName: selectedDirector.id !== 'generic' ? selectedDirector.name : undefined,
      directorStyle: selectedDirector.style,
      plot: plot.slice(0, 200),
      duration,
    })

    try {
      const result = await generate(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: buildIntegrateUserPrompt(shots) },
        ],
        textSettings
      )
      setIntegratedPrompt(result)
    } catch (e) {
      setIntegratedPrompt(`整合失败：${String(e)}`)
    }
    setIsIntegrating(false)
  }

  const handleSaveHistory = async () => {
    if (!storyboard) return
    const histId = await addHistory({
      createdAt: Date.now(),
      plot: plot.slice(0, 200),
      fullPlot: plot,
      director: selectedDirector.name,
      directorId: selectedDirector.id,
      storyboard: storyboard,
      time: new Date().toLocaleString('zh-CN'),
    } as Omit<HistoryRecord, 'id'>)
    const parsedShots = useShotStore.getState().parseFromMarkdown(storyboard)
    await useShotStore.getState().saveShotsToDB(histId, parsedShots)
    alert('✅ 已保存到历史记录')
  }

  const handleExport = async (type: 'txt' | 'excel' | 'word') => {
    const shots = extractShotData(storyboard)
    if (!shots.length) { alert('暂无可导出的分镜数据'); return }
    const title = plot.slice(0, 30)
    const directorName = selectedDirector.name
    const dur = `${duration}秒`
    if (type === 'txt') await exportTxt(shots, title, directorName, dur)
    else if (type === 'excel') await exportExcel(shots, title, directorName, dur)
    else await exportWord(shots, title, directorName, dur)
  }

  // Script file import
  const handleFileImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith('.txt')) { alert('请选择 .txt 格式的剧本文件'); return }
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      if (text) {
        setPlot(text.trim())
        setIsScriptImported(true)
        doExtractAssets(text.trim())
      }
    }
    reader.readAsText(file, 'UTF-8')
    e.target.value = ''
  }

  // Extract assets via AI
  const doExtractAssets = async (scriptText: string) => {
    if (!textSettings.key) { setExtractStatus('❌ 请先配置 API Key'); return }
    setIsExtracting(true)
    setExtractStatus('🔍 正在分析剧本资产...')

    const truncated = scriptText.length > 10000 ? scriptText.slice(0, 10000) + '\n…（已截断）' : scriptText

    try {
      const result = await generate(
        [
          { role: 'system', content: EXTRACT_SYSTEM_PROMPT },
          { role: 'user', content: buildExtractUserPrompt(truncated) },
        ],
        textSettings
      )
      const parsed: ExtractionResult = JSON.parse(result.replace(/```json\n?|```/g, '').trim())

      const mapItems = (items: { name: string; visual_desc?: string; desc?: string }[]) =>
        items.map(i => ({ name: i.name, desc: i.visual_desc ?? i.desc ?? '' }))
      if (parsed.characters?.length) materialStore.bulkFill('character', mapItems(parsed.characters))
      if (parsed.scenes?.length) materialStore.bulkFill('image', mapItems(parsed.scenes))
      if (parsed.props?.length) materialStore.bulkFill('props', mapItems(parsed.props))

      const c = (parsed.characters || []).length
      const s = (parsed.scenes || []).length
      const p = (parsed.props || []).length
      setExtractStatus(`✅ 同步完成：${c} 人物、${s} 场景、${p} 道具已锁定。`)
      setTimeout(() => setExtractStatus(''), 8000)
    } catch (e) {
      setExtractStatus(`❌ 提取失败：${String(e).slice(0, 80)}`)
    }
    setIsExtracting(false)
    setShowPasteModal(false)
  }

  const handlePasteExtract = async (text: string) => {
    setPlot(text)
    setIsScriptImported(true)
    await doExtractAssets(text)
  }

  const viewingContent = viewSceneId !== null
    ? (chainStore.sceneContents[viewSceneId] ?? '')
    : null

  const displayContent = viewingContent !== null ? viewingContent : storyboard

  return (
    <div className="h-full flex flex-col overflow-hidden relative">
      {/* Left + Right Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Config */}
        <div className="w-80 min-w-[280px] max-w-[360px] border-r border-gray-800 flex flex-col overflow-y-auto overflow-x-hidden bg-gray-900/50 shrink-0">
          <div className="p-3 space-y-4">
            {/* Director */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs text-gray-500 font-medium">🎬 导演风格</span>
                {selectedDirector.id !== 'generic' && (
                  <span className="text-xs text-amber-400 bg-amber-900/20 px-1.5 py-0.5 rounded border border-amber-800/30">
                    {selectedDirector.name}
                  </span>
                )}
              </div>
              <DirectorGrid selectedId={selectedDirector.id} onSelect={setSelectedDirector} />
            </div>

            {/* Duration */}
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
              <DurationControl seconds={duration} onChange={setDuration} />
            </div>

            {/* Mode Switch */}
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
              <div className="text-xs text-gray-400 mb-2">生成模式</div>
              <div className="flex gap-1.5">
                <button
                  onClick={() => duration >= 15 && setMode('chain')}
                  disabled={duration < 15}
                  title={duration < 15 ? '极速瞬间模式（<15s）不支持链式分段' : ''}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    mode === 'chain' && duration >= 15 ? 'border-amber-500 bg-amber-900/30 text-amber-300' : 'border-gray-700 text-gray-400'
                  } ${duration < 15 ? 'opacity-40 cursor-not-allowed' : ''}`}>
                  ⛓️ 链式引擎
                </button>
                <button onClick={() => setMode('single')}
                  className={`flex-1 py-1.5 text-xs rounded-lg border font-medium transition-colors ${
                    mode === 'single' ? 'border-amber-500 bg-amber-900/30 text-amber-300' : 'border-gray-700 text-gray-400'
                  }`}>
                  📄 单段生成
                </button>
              </div>
            </div>

            {/* Params */}
            <div className="bg-gray-800/50 rounded-xl p-3 border border-gray-700/50">
              <ParamPanel
                params={params}
                onChange={u => setParams(p => ({ ...p, ...u }))}
                collapsed={paramCollapsed}
                onToggleCollapse={() => setParamCollapsed(v => !v)}
              />
            </div>
          </div>
        </div>

        {/* Right Panel: Input + Output */}
        <div className="flex-1 overflow-y-auto min-w-0">
          {/* 项目面包屑导航 */}
          {currentProject && currentEpisode && (
            <div className="px-3 py-2 border-b border-gray-800 bg-amber-900/10 flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V7z" />
              </svg>
              <span className="text-xs text-amber-400 font-medium">{currentProject.name}</span>
              <span className="text-gray-600">›</span>
              <span className="text-xs text-gray-300">第{currentEpisode.episodeNumber}集：{currentEpisode.title}</span>
              {currentEpisode.mark === 'fire' && <span className="text-xs">🔥</span>}
              {currentEpisode.mark === 'money' && <span className="text-xs">💰</span>}
            </div>
          )}
          {/* Plot Input */}
          <div className="border-b border-gray-800 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-gray-500">📝 故事情节</span>
              <span className="text-xs text-gray-700">{plot.length} 字</span>
              {isScriptImported && (
                <span className="text-xs text-emerald-500 bg-emerald-900/20 px-1.5 py-0.5 rounded border border-emerald-800/30">
                  🔒 已导入剧本
                </span>
              )}
              <div className="ml-auto flex gap-1.5 flex-wrap">
                {/* Word filter quick toggle */}
                <button
                  onClick={() => setFlag('enableWordFilter', !enableWordFilter)}
                  className={`px-2 py-1 text-xs rounded-lg border transition-colors ${
                    enableWordFilter
                      ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30'
                      : 'text-gray-500 bg-gray-800/30 border-gray-700'
                  }`}>
                  🛡️ 词过滤: {enableWordFilter ? '开' : '关'}
                </button>
                {/* Script import buttons */}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2 py-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg hover:bg-amber-900/30 transition-colors">
                  📂 导入剧本
                </button>
                <button
                  onClick={() => setShowPasteModal(true)}
                  className="px-2 py-1 text-xs text-amber-400 bg-amber-900/20 border border-amber-800/30 rounded-lg hover:bg-amber-900/30 transition-colors">
                  📋 粘贴提取
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".txt"
                  className="hidden"
                  onChange={handleFileImport}
                />
                <button onClick={() => setShowVision(true)}
                  className="px-2 py-1 text-xs text-purple-400 bg-purple-900/20 border border-purple-800/30 rounded-lg hover:bg-purple-900/30 transition-colors">
                  👁️ 视觉反推
                </button>
                <button onClick={handleAnalyze} disabled={isAnalyzing}
                  className="px-2 py-1 text-xs text-sky-400 bg-sky-900/20 border border-sky-800/30 rounded-lg hover:bg-sky-900/30 transition-colors disabled:opacity-50">
                  {isAnalyzing ? '分析中...' : '🔬 AI分析'}
                </button>
              </div>
            </div>
            <textarea
              value={plot}
              onChange={e => setPlot(e.target.value)}
              placeholder="在此输入故事情节、剧本大纲或分镜描述..."
              rows={5}
              className="w-full bg-gray-800/60 border border-gray-700 text-sm text-gray-200 placeholder-gray-600 px-3 py-2.5 rounded-xl focus:outline-none focus:border-amber-500 resize-none leading-relaxed"
            />

            {/* Extract status */}
            {extractStatus && (
              <div className={`mt-1.5 text-xs px-3 py-1.5 rounded-lg border ${
                extractStatus.includes('✅') ? 'text-emerald-400 bg-emerald-900/20 border-emerald-800/30' :
                extractStatus.includes('❌') ? 'text-red-400 bg-red-900/20 border-red-800/30' :
                'text-amber-400 bg-amber-900/20 border-amber-800/30'
              }`}>
                {extractStatus}
              </div>
            )}

            {/* Analysis Card */}
            {analysisResult && showAnalysis && (
              <div className="mt-2 bg-sky-900/20 border border-sky-700/30 rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-sky-400 font-medium">🔬 AI分析结果</span>
                  <button onClick={() => setShowAnalysis(false)} className="text-gray-500 hover:text-gray-300 text-xs">收起</button>
                </div>
                <div className="space-y-1 text-xs text-gray-400">
                  <div><span className="text-sky-300">主题：</span>{analysisResult.themeStatement}</div>
                  <div><span className="text-sky-300">情绪基调：</span>{analysisResult.emotion}</div>
                  <div><span className="text-sky-300">推荐镜头：</span>{analysisResult.recommendedShots}</div>
                </div>
              </div>
            )}

            {error && (
              <div className="mt-2 text-xs text-red-400 bg-red-900/20 border border-red-800/30 px-3 py-2 rounded-lg">
                {error}
              </div>
            )}
          </div>

          {/* Timeline (Chain Mode) */}
          {mode === 'chain' && chainStore.scenes.length > 0 && (
            <div className="border-b border-gray-800 p-3 shrink-0">
              <StorylineTimeline
                scenes={chainStore.scenes}
                sceneContents={chainStore.sceneContents}
                currentSceneId={chainStore.currentSceneId}
                isRunning={chainStore.isRunning}
                onSceneClick={id => setViewSceneId(viewSceneId === id ? null : id)}
              />
              {viewSceneId !== null && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-xs text-amber-400">
                    查看: {chainStore.scenes.find(s => s.id === viewSceneId)?.beatName}
                  </span>
                  <button onClick={() => setViewSceneId(null)} className="text-xs text-gray-500 hover:text-gray-300">
                    返回全部
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Storyboard Output */}
          <div className="min-w-0">
            {displayContent ? (
              <StoryboardTable
                markdown={displayContent}
                isStreaming={isStreaming || chainStore.isRunning}
                onEditShot={(row, index) => setEditModal({ row, index })}
              />
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center p-8">
                <div className="text-5xl mb-4">🎬</div>
                <p className="text-gray-500 text-sm">输入故事情节后，点击生成分镜</p>
                <p className="text-gray-600 text-xs mt-1">
                  {mode === 'chain' ? '链式引擎将自动按BS2节拍分段生成' : '单段模式一次性生成完整分镜表'}
                </p>
                <p className="text-gray-700 text-xs mt-3">Ctrl+Enter 快速生成</p>
              </div>
            )}
          </div>

          {/* Refine & Export Bar */}
          {storyboard && (
            <div className="border-t border-gray-800 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={refineText}
                  onChange={e => setRefineText(e.target.value)}
                  placeholder="全局修改意见（如：增强动作感、调整为夜景风格...）"
                  className="flex-1 bg-gray-800 border border-gray-700 text-xs text-gray-200 placeholder-gray-600 px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500"
                  onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) handleRefine() }}
                />
                <button onClick={handleRefine} disabled={isRefining || !refineText.trim()}
                  className="px-3 py-2 text-xs bg-sky-700/30 text-sky-400 border border-sky-700/50 rounded-lg hover:bg-sky-700/40 disabled:opacity-50 transition-colors">
                  {isRefining ? '修改中...' : '全局修改'}
                </button>
              </div>

              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => setShowStc(true)}
                  className="px-3 py-1.5 text-xs bg-purple-900/30 text-purple-400 rounded-lg hover:bg-purple-900/40 transition-colors border border-purple-800/30">
                  🐱 STC自检
                </button>
                <button onClick={handleIntegrate} disabled={isIntegrating}
                  className="px-3 py-1.5 text-xs bg-amber-900/30 text-amber-400 rounded-lg hover:bg-amber-900/40 transition-colors border border-amber-800/30 disabled:opacity-50">
                  {isIntegrating ? '整合中...' : '✨ 整合提示词'}
                </button>
                <button onClick={handleCopyAll}
                  className="px-3 py-1.5 text-xs bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600">
                  📋 复制提示词
                </button>
                <button onClick={handleSaveHistory}
                  className="px-3 py-1.5 text-xs bg-teal-900/30 text-teal-400 rounded-lg hover:bg-teal-900/40 transition-colors border border-teal-800/30">
                  💾 保存历史
                </button>
                <button onClick={() => handleExport('txt')}
                  className="px-3 py-1.5 text-xs bg-gray-700/50 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors border border-gray-600">
                  📄 导出TXT
                </button>
                <button onClick={() => handleExport('excel')}
                  className="px-3 py-1.5 text-xs bg-green-900/30 text-green-400 rounded-lg hover:bg-green-900/40 transition-colors border border-green-800/30">
                  📊 导出Excel
                </button>
                <button onClick={() => handleExport('word')}
                  className="px-3 py-1.5 text-xs bg-blue-900/30 text-blue-400 rounded-lg hover:bg-blue-900/40 transition-colors border border-blue-800/30">
                  📝 导出Word
                </button>
              </div>

              {/* Integrated Prompt Section */}
              {showIntegrated && (
                <div className="mt-2 bg-amber-900/10 border border-amber-800/30 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs text-amber-400 font-semibold">✨ 整合提示词（含时间段）</span>
                    <div className="flex gap-2">
                      {integratedPrompt && !isIntegrating && (
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(integratedPrompt)
                            alert('✅ 整合提示词已复制！')
                          }}
                          className="px-2 py-0.5 text-xs text-amber-400 border border-amber-800/30 rounded hover:bg-amber-900/20">
                          📋 复制全部
                        </button>
                      )}
                      <button onClick={() => setShowIntegrated(false)} className="text-gray-500 hover:text-gray-300 text-xs">✕</button>
                    </div>
                  </div>
                  {isIntegrating ? (
                    <div className="flex items-center gap-2 text-xs text-amber-400 py-2">
                      <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                      整合中...
                    </div>
                  ) : (
                    <div className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap font-mono bg-gray-800/50 rounded-lg p-3 max-h-48 overflow-y-auto select-all">
                      {integratedPrompt || '暂无内容'}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Generate Button (Fixed Bottom) */}
      <div className="border-t border-gray-800 bg-gray-900 px-4 py-3 flex items-center gap-3 shrink-0">
        <div className="flex-1" />
        {(isStreaming || chainStore.isRunning) ? (
          <button onClick={handleCancel}
            className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white font-semibold rounded-xl text-sm transition-colors shadow-lg shadow-red-900/30">
            ⛔ 停止生成
          </button>
        ) : (
          <button onClick={handleGenerate} data-action="generate"
            className="px-8 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold rounded-xl text-sm transition-all shadow-lg shadow-amber-900/40 hover:shadow-amber-900/60">
            ⚡ 生成分镜  <span className="text-xs opacity-70 ml-1">Ctrl+Enter</span>
          </button>
        )}
      </div>

      {/* Floating Generate Button */}
      {!isStreaming && !chainStore.isRunning && storyboard && (
        <button
          onClick={handleGenerate}
          className="fixed right-6 bottom-20 w-12 h-12 bg-amber-600 hover:bg-amber-500 text-white rounded-full shadow-lg shadow-amber-900/50 flex items-center justify-center text-lg transition-all hover:scale-110 z-40"
          title="重新生成">
          ⚡
        </button>
      )}

      {/* Modals */}
      {editModal && (
        <ShotEditModal
          shotRow={editModal.row}
          shotIndex={editModal.index}
          onClose={() => setEditModal(null)}
          onApply={(newRow, index) => {
            let fixed = newRow.split('\n').find(l => l.trim().startsWith('|')) || newRow.trim()
            if (!fixed.startsWith('|')) fixed = '| ' + fixed
            if (!fixed.endsWith('|')) fixed = fixed + ' |'
            const lines = storyboard.split('\n')
            let dataRowCount = 0
            const newLines = lines.map(line => {
              if (line.trim().startsWith('|') && !line.includes('---') &&
                !line.includes('景别') && !line.includes('时间段')) {
                if (dataRowCount === index) { dataRowCount++; return fixed }
                dataRowCount++
              }
              return line
            })
            setStoryboard(newLines.join('\n'))
          }}
        />
      )}

      {safetyModal && (
        <SafetyModal
          result={safetyModal}
          onApply={() => pendingSafetyAction?.()}
          onClose={() => setSafetyModal(null)}
        />
      )}

      {showVision && (
        <VisionModal
          onClose={() => setShowVision(false)}
          onFillPlot={p => { setPlot(p); setShowVision(false) }}
        />
      )}

      {showStc && (
        <StcModal
          storyboardContent={storyboard}
          originalPlot={plot}
          onClose={() => setShowStc(false)}
        />
      )}

      {showPasteModal && (
        <ScriptPasteModal
          onClose={() => setShowPasteModal(false)}
          onExtract={handlePasteExtract}
          isExtracting={isExtracting}
        />
      )}
    </div>
  )
}

export default CreatePage
