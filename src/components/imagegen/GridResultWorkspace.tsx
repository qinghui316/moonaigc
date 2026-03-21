import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useHistoryStore } from '../../store/useHistoryStore'
import { useProjectStore } from '../../store/useProjectStore'
import { useShotStore } from '../../store/useShotStore'
import { parseTableRows } from '../../utils/parseTable'
import { STYLE_MAP } from '../../data/styleMap'
import { IMAGE_PLATFORMS } from '../../data/platforms'
import { GLOBAL_NEGATIVE_PROMPT, GLOBAL_NEGATIVE_PROMPT_INLINE, STYLE_NEGATIVE_PROMPTS } from '../../data/negativePrompts'
import { GRID_NEGATIVE_PROMPT } from '../../services/gridGen'
import { buildRefImageDescs, collectRefImages, loadRefImageBase64s } from '../../services/refImageCollector'
import { buildNineGridImagePrompt, generateNineGridStoryboard, type GridSourceShot } from '../../services/gridStoryboard'
import { callImageGenAPI, fetchAssetImageAsBase64, uploadExternalImageUrl } from '../../services/imageGen'
import {
  createGridResult,
  deleteGridResult,
  getGridResult,
  listGridResults,
  normalizeGridPanels,
  normalizeGridReferenceImages,
  updateGridResultMedia,
} from '../../services/gridResults'
import type { GridResultRecord, ImageGenSettings } from '../../types'
import GridResultTable from './GridResultTable'
import { getPreferredEpisodeId, setPreferredEpisodeId } from '../../utils/imagegenPrefs'

interface SourceShotRow {
  index: number
  ref: string
  time: string
  shotType: string
  scene: string
  prompt: string
}

interface GridResultWorkspaceProps {
  styleKey: string
  onStyleChange: (styleKey: string) => void
}

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === 'AbortError'
    : err instanceof Error && err.name === 'AbortError'
}

const GridResultWorkspace: React.FC<GridResultWorkspaceProps> = ({ styleKey, onStyleChange }) => {
  const { textSettings, imageSettings } = useSettingsStore()
  const { materials } = useMaterialStore()
  const { records: history, load: loadHistoryStore } = useHistoryStore()
  const { projects, episodes, loadProjects, selectProject, currentProject, currentEpisode } = useProjectStore()
  const shotStore = useShotStore()

  const [selectedProjectId, setSelectedProjectId] = useState('')
  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)
  const [sourceRows, setSourceRows] = useState<SourceShotRow[]>([])
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [results, setResults] = useState<GridResultRecord[]>([])
  const [selectedResultId, setSelectedResultId] = useState<number | null>(null)
  const [selectedResult, setSelectedResult] = useState<GridResultRecord | null>(null)
  const [loadingResults, setLoadingResults] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const gridDefaultsAppliedRef = useRef(false)
  const generateAbortRef = useRef<AbortController | null>(null)
  const regenerateAbortRef = useRef<AbortController | null>(null)

  const currentImagePlatform = IMAGE_PLATFORMS.find(p => p.id === imageSettings.platformId)
    ?? IMAGE_PLATFORMS[0]
  const currentModelDef = currentImagePlatform.models.find(m => m.value === imageSettings.model)
  const effectiveAspectRatios = currentModelDef?.aspectRatios ?? currentImagePlatform.aspectRatios
  const effectiveResolutions = currentModelDef?.resolutions ?? currentImagePlatform.resolutions
  const resultDisplayNumbers = useMemo(
    () => new Map(results.map((result, index) => [result.id, index + 1])),
    [results],
  )
  const latestRecordForEpisode = useCallback((episodeId?: string | null) => {
    if (!episodeId) return null
    const recs = history.filter(item => item.episodeId === episodeId)
    return recs.length > 0 ? recs.reduce((a, b) => (b.id > a.id ? b : a)) : null
  }, [history])

  useEffect(() => {
    void loadProjects()
    if (history.length === 0) {
      void loadHistoryStore()
    }
  }, [history.length, loadHistoryStore, loadProjects])

  useEffect(() => () => {
    generateAbortRef.current?.abort()
    regenerateAbortRef.current?.abort()
  }, [])

  useEffect(() => {
    const { setImageSettings } = useSettingsStore.getState()
    const { imageSettings: current } = useSettingsStore.getState()
    const platform = IMAGE_PLATFORMS.find(p => p.id === current.platformId) ?? IMAGE_PLATFORMS[0]
    const modelDef = platform.models.find(m => m.value === current.model)
    const ratios = modelDef?.aspectRatios ?? platform.aspectRatios
    const resolutions = (modelDef?.resolutions ?? platform.resolutions).map(item => item.value)
    const updates: Partial<ImageGenSettings> = {}

    if (!ratios.includes(current.aspectRatio)) {
      updates.aspectRatio = ratios[0] as ImageGenSettings['aspectRatio']
    }
    if (!resolutions.includes(current.imageResolution)) {
      updates.imageResolution = resolutions[0] as ImageGenSettings['imageResolution']
    }
    if (Object.keys(updates).length > 0) {
      setImageSettings(updates)
    }
  }, [imageSettings.model, imageSettings.platformId])

  useEffect(() => {
    if (gridDefaultsAppliedRef.current) return
    const updates: Partial<ImageGenSettings> = {}
    if (effectiveAspectRatios.includes('16:9') && imageSettings.aspectRatio !== '16:9') {
      updates.aspectRatio = '16:9'
    }
    if (effectiveResolutions.some(item => item.value === '4K') && imageSettings.imageResolution !== '4K') {
      updates.imageResolution = '4K'
    }
    if (Object.keys(updates).length > 0) {
      useSettingsStore.getState().setImageSettings(updates)
    }
    gridDefaultsAppliedRef.current = true
  }, [effectiveAspectRatios, effectiveResolutions, imageSettings.aspectRatio, imageSettings.imageResolution])

  const episodesWithRecord = useMemo(() => {
    if (!selectedProjectId) return []
    return episodes.map(episode => ({
      episode,
      record: latestRecordForEpisode(episode.id),
    }))
  }, [episodes, latestRecordForEpisode, selectedProjectId])

  const currentHistory = useMemo(
    () => history.find(item => item.id === selectedHistoryId) ?? null,
    [history, selectedHistoryId],
  )

  const occupiedSourceRefSet = useMemo(
    () => new Set(results.flatMap(result => result.sourceShotRefs ?? [])),
    [results],
  )

  const loadResultDetail = useCallback(async (id: number | null) => {
    if (!id) {
      setSelectedResultId(null)
      setSelectedResult(null)
      return
    }

    const detail = await getGridResult(id)
    if (!detail) return

    setSelectedResultId(id)
    setSelectedResult({
      ...detail,
      panels: normalizeGridPanels(detail.panels),
      usedReferenceImages: normalizeGridReferenceImages(detail.usedReferenceImages),
    })

  }, [])

  const loadResultsForEpisode = useCallback(async (projectId: string, episodeId?: string | null) => {
    setLoadingResults(true)
    const list = await listGridResults(projectId, episodeId ?? undefined)
    setResults(list)
    setLoadingResults(false)

    if (list.length > 0) {
      await loadResultDetail(list[0].id)
    } else {
      setSelectedResultId(null)
      setSelectedResult(null)
      setSelectedItems(new Set())
    }
  }, [loadResultDetail])

  const handleSelectProject = useCallback(async (projectId: string) => {
    setSelectedProjectId(projectId)
    setSelectedHistoryId(null)
    setSourceRows([])
    setSelectedItems(new Set())
    setResults([])
    setSelectedResult(null)
    setSelectedResultId(null)
    setStatus('')
    setError('')

    if (projectId) {
      await selectProject(projectId)
    }
  }, [selectProject])

  useEffect(() => {
    if (!selectedProjectId && currentProject?.id) {
      setSelectedProjectId(currentProject.id)
    }
  }, [currentProject?.id, selectedProjectId])

  const handleSelectHistory = useCallback(async (historyId: number) => {
    setSelectedHistoryId(historyId)
    setStatus('')
    setError('')

    const record = history.find(item => item.id === historyId)
    if (!record) return
    if (record.projectId && record.episodeId) {
      setPreferredEpisodeId(record.projectId, record.episodeId)
    }

    const { headers, rows } = parseTableRows(record.storyboard)
    const parsed = rows.map((cells, index) => {
      const get = (key: string) => {
        const columnIndex = headers.findIndex(header => header.includes(key))
        return columnIndex >= 0 ? (cells[columnIndex] ?? '') : ''
      }

      const time = get('时间')
      return {
        index,
        ref: `源分镜${index + 1}${time ? ` ${time}` : ''}`,
        time,
        shotType: get('景别'),
        scene: get('画面'),
        prompt: cells[cells.length - 1] ?? '',
      }
    })

    setSourceRows(parsed)
    setSelectedItems(new Set())

    if (record.projectId) {
      await loadResultsForEpisode(record.projectId, record.episodeId)
    }
  }, [history, loadResultsForEpisode])

  useEffect(() => {
    if (!currentProject?.id) return
    if (selectedHistoryId != null) return
    if (selectedProjectId !== currentProject.id) return
    const preferredEpisodeId = getPreferredEpisodeId(currentProject.id)
    const targetEpisodeId = preferredEpisodeId ?? currentEpisode?.id ?? null
    if (!targetEpisodeId) return
    const latest = latestRecordForEpisode(targetEpisodeId)
    if (!latest || selectedHistoryId === latest.id) return
    void handleSelectHistory(latest.id)
  }, [
    currentProject?.id,
    currentEpisode?.id,
    selectedProjectId,
    selectedHistoryId,
    latestRecordForEpisode,
    handleSelectHistory,
  ])

  useEffect(() => {
    setSelectedItems(prev => {
      const next = new Set(
        Array.from(prev).filter(index => {
          const row = sourceRows.find(item => item.index === index)
          return row ? !occupiedSourceRefSet.has(row.ref) : false
        }),
      )
      return next.size === prev.size ? prev : next
    })
  }, [occupiedSourceRefSet, sourceRows])

  const selectableSourceRows = useMemo(
    () => sourceRows.filter(row => !occupiedSourceRefSet.has(row.ref)),
    [occupiedSourceRefSet, sourceRows],
  )

  const selectedSourceShots = useMemo(
    () => sourceRows.filter(row => selectedItems.has(row.index) && !occupiedSourceRefSet.has(row.ref)),
    [occupiedSourceRefSet, selectedItems, sourceRows],
  )

  const selectedSourceRefSet = useMemo(
    () => new Set(selectedSourceShots.map(row => row.ref)),
    [selectedSourceShots],
  )

  const handleGenerate = useCallback(async () => {
    if (generating) {
      generateAbortRef.current?.abort()
      return
    }
    if (false) {
      setError('当前集已有宫格结果，删除后才能重新选择源分镜并生成')
      return
    }
    if (!selectedHistoryId || !currentHistory) {
      setError('请先选择一个已生成分镜的集数')
      return
    }
    if (!textSettings.key) {
      setError('请先配置文本生成 API Key')
      return
    }
    if (!imageSettings.key) {
      setError('请先配置图片生成 API Key')
      return
    }
    if (selectedSourceShots.length === 0) {
      setError('请至少选择一条源分镜')
      return
    }

    setGenerating(true)
    setError('')
    setStatus('生成 9 宫格分镜中...')
    const abortController = new AbortController()
    generateAbortRef.current = abortController
    let createdResultId: number | null = null
    let mediaPersisted = false

    try {
      const sourceShots: GridSourceShot[] = selectedSourceShots.map(row => ({
        ref: row.ref,
        time: row.time,
        shotType: row.shotType,
        scene: row.scene,
        prompt: row.prompt,
      }))
      const sourceShotPromptMap = new Map(
        sourceShots.map(shot => [shot.ref, shot.prompt.trim()]),
      )

      const seenIds = new Set<number>()
      const materialRefs = selectedSourceShots.flatMap(row => {
        const savedRefs = shotStore.selectedMaterialRefs[row.index]
        const refs = savedRefs ?? collectRefImages(row.prompt, materials, undefined, { includeFallback: false }).map(ref => ({
          name: ref.name,
          type: ref.type,
          desc: ref.desc,
          imageUrl: ref.imageUrl,
          imageFileId: ref.imageFileId,
        }))
        return refs
          .filter(ref => {
            if (seenIds.has(ref.imageFileId)) return false
            seenIds.add(ref.imageFileId)
            return true
          })
          .map(ref => ({ ...ref, tag: `@${ref.name}`, sourceShotRef: row.ref }))
      })

      const localRefs = selectedSourceShots.flatMap(row => shotStore.selectedLocalRefs[row.index] ?? [])
      const uniqueLocalRefs = localRefs.filter((ref, index, arr) => arr.findIndex(item => item.id === ref.id) === index)

      const usedReferenceImages = [
        ...materialRefs.map(ref => ({
          kind: 'material' as const,
          name: ref.name,
          typeLabel: ref.type === 'character' ? '角色' : ref.type === 'image' ? '场景' : '道具',
          imageUrl: ref.imageUrl,
          imageFileId: ref.imageFileId,
          sourceShotRefs: ref.sourceShotRef ? [ref.sourceShotRef] : [],
        })),
        ...uniqueLocalRefs.map(ref => ({
          kind: 'local' as const,
          name: ref.name,
          typeLabel: '本地',
          imageUrl: null,
          imageFileId: null,
          sourceShotRefs: [],
        })),
      ]

      const refImages = [
        ...await loadRefImageBase64s(materialRefs),
        ...uniqueLocalRefs.map(ref => ({ base64: ref.base64, mimeType: ref.mimeType })),
      ]
      const refDescs = buildRefImageDescs(materialRefs)
      const refBlock = refDescs.length > 0
        ? refDescs.map((desc, index) => `参考图${index + 1}: ${desc}`).join('\n')
        : '无参考图'

      const storyboard = await generateNineGridStoryboard(
        sourceShots,
        refImages,
        refDescs,
        STYLE_MAP[styleKey] ?? styleKey,
        imageSettings.aspectRatio,
        textSettings,
        abortController.signal,
      )

      const created = await createGridResult({
        projectId: currentHistory.projectId,
        episodeId: currentHistory.episodeId,
        historyId: currentHistory.id,
        layout: '3x3',
        aspectRatio: imageSettings.aspectRatio,
        sourceShotRefs: sourceShots.map(shot => shot.ref),
        usedReferenceImages,
        rawModelOutput: storyboard.rawText,
        validationPassed: storyboard.validationPassed,
        panels: storyboard.draft?.panels.map(panel => {
          const sourceSeedancePrompts = panel.source_shot_refs
            .map(ref => {
              const prompt = sourceShotPromptMap.get(ref)
              return prompt ? { sourceShotRef: ref, prompt } : null
            })
            .filter((item): item is { sourceShotRef: string; prompt: string } => item !== null)

          return {
            panelOrder: panel.panel_number,
            timeRange: panel.time_range,
            seedancePrompt: sourceSeedancePrompts[0]?.prompt ?? panel.seedance_prompt,
            sourceSeedancePrompts,
            imagePromptText: panel.image_prompt_text,
            sourceShotRefs: panel.source_shot_refs,
          }
        }) ?? [],
      })
      createdResultId = created.id

      setStatus('生成 9 宫格图片中...')

      const panelPrompts = storyboard.draft?.panels.map(panel => panel.image_prompt_text) ?? []
      const finalPrompt = buildNineGridImagePrompt({
        aspectRatio: imageSettings.aspectRatio,
        refBlock,
        panelPrompts,
        fallbackRaw: storyboard.rawText,
      })
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const negativePrompt = imageSettings.platformId !== 'doubao-image'
        ? `${GLOBAL_NEGATIVE_PROMPT_INLINE}${styleNeg ? `, ${styleNeg}` : ''}, ${GRID_NEGATIVE_PROMPT}`
        : [GLOBAL_NEGATIVE_PROMPT, styleNeg, GRID_NEGATIVE_PROMPT].filter(Boolean).join(', ')

      const result = await callImageGenAPI(
        imageSettings,
        finalPrompt,
        refImages,
        negativePrompt,
        materialRefs.map(ref => ref.imageFileId),
        abortController.signal,
      )

      let mediaFileId: number | undefined
      let mediaUrl: string | undefined

      if (result.b64) {
        const uploadResp = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: result.b64,
            mimeType: 'image/jpeg',
            refType: 'grid',
            refId: String(created.id),
            projectId: currentHistory.projectId,
            episodeId: currentHistory.episodeId,
          }),
          signal: abortController.signal,
        })
        if (!uploadResp.ok) throw new Error('宫格图上传失败')
        const uploadData = await uploadResp.json() as { id: number; url: string }
        mediaFileId = uploadData.id
        mediaUrl = uploadData.url
      } else if (result.url) {
        const uploaded = await uploadExternalImageUrl(result.url, {
          refType: 'grid',
          refId: String(created.id),
          projectId: currentHistory.projectId,
          episodeId: currentHistory.episodeId,
        }, abortController.signal)
        if (!uploaded) throw new Error('宫格图下载保存失败')
        mediaFileId = uploaded.id
        mediaUrl = uploaded.url
      } else {
        throw new Error('宫格图生成结果为空')
      }

      if (mediaFileId) {
        await updateGridResultMedia(created.id, mediaFileId)
        mediaPersisted = true
      }

      await loadResultsForEpisode(currentHistory.projectId ?? '', currentHistory.episodeId)
      const detail = await getGridResult(created.id)
      if (detail) {
        setSelectedResultId(created.id)
        setSelectedResult({
          ...detail,
          mediaUrl: mediaUrl ?? detail.mediaUrl,
          panels: normalizeGridPanels(detail.panels),
          usedReferenceImages: normalizeGridReferenceImages(detail.usedReferenceImages),
        })
      }
      setStatus('宫格结果已保存，源分镜已冻结')
    } catch (err) {
      if (createdResultId != null && !mediaPersisted) {
        try {
          await deleteGridResult(createdResultId)
        } catch {
          // ignore rollback errors
        }
      }
      if (isAbortError(err)) {
        setError('')
        setStatus('已取消生成')
      } else {
        setError(String(err))
        setStatus('')
      }
    } finally {
      generateAbortRef.current = null
      setGenerating(false)
    }
  }, [
    currentHistory,
    generating,
    imageSettings,
    loadResultsForEpisode,
    materials,
    selectedHistoryId,
    selectedSourceShots,
    shotStore.selectedLocalRefs,
    shotStore.selectedMaterialRefs,
    styleKey,
    textSettings,
  ])

  const handleRegenerateResult = useCallback(async () => {
    if (regenerating) {
      regenerateAbortRef.current?.abort()
      return
    }
    if (!selectedResult) return
    if (!imageSettings.key) {
      setError('请先配置图片生成 API Key')
      return
    }

    setRegenerating(true)
    setError('')
    setStatus('重新生成宫格图片中...')
    const abortController = new AbortController()
    regenerateAbortRef.current = abortController

    try {
      const materialRefs = (selectedResult.usedReferenceImages ?? [])
        .filter(ref => ref.kind === 'material' && !!ref.imageUrl)
      const localSourceRefSet = new Set(selectedResult.sourceShotRefs)
      const localRefs = sourceRows
        .filter(row => localSourceRefSet.has(row.ref))
        .flatMap(row => shotStore.selectedLocalRefs[row.index] ?? [])
      const uniqueLocalRefs = localRefs.filter((ref, index, arr) => arr.findIndex(item => item.id === ref.id) === index)

      const refImages = [
        ...await Promise.all(materialRefs.map(async ref => fetchAssetImageAsBase64(ref.imageUrl!))),
        ...uniqueLocalRefs.map(ref => ({ base64: ref.base64, mimeType: ref.mimeType })),
      ]

      const refBlock = (selectedResult.usedReferenceImages ?? []).length > 0
        ? (selectedResult.usedReferenceImages ?? [])
          .map((ref, index) => `参考图${index + 1}: [${ref.typeLabel}-${ref.name}]`)
          .join('\n')
        : '无参考图'

      const panelPrompts = normalizeGridPanels(selectedResult.panels).map(panel => panel.imagePromptText).filter(Boolean)
      const finalPrompt = buildNineGridImagePrompt({
        aspectRatio: imageSettings.aspectRatio,
        refBlock,
        panelPrompts,
        fallbackRaw: selectedResult.rawModelOutput,
      })
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const negativePrompt = imageSettings.platformId !== 'doubao-image'
        ? `${GLOBAL_NEGATIVE_PROMPT_INLINE}${styleNeg ? `, ${styleNeg}` : ''}, ${GRID_NEGATIVE_PROMPT}`
        : [GLOBAL_NEGATIVE_PROMPT, styleNeg, GRID_NEGATIVE_PROMPT].filter(Boolean).join(', ')

      const result = await callImageGenAPI(
        imageSettings,
        finalPrompt,
        refImages,
        negativePrompt,
        materialRefs.map(ref => ref.imageFileId).filter((id): id is number => typeof id === 'number'),
        abortController.signal,
      )

      let mediaFileId: number | undefined
      let mediaUrl: string | undefined

      if (result.b64) {
        const uploadResp = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: result.b64,
            mimeType: 'image/jpeg',
            refType: 'grid',
            refId: String(selectedResult.id),
            projectId: selectedResult.projectId,
            episodeId: selectedResult.episodeId,
          }),
          signal: abortController.signal,
        })
        if (!uploadResp.ok) throw new Error('宫格图上传失败')
        const uploadData = await uploadResp.json() as { id: number; url: string }
        mediaFileId = uploadData.id
        mediaUrl = uploadData.url
      } else if (result.url) {
        const uploaded = await uploadExternalImageUrl(result.url, {
          refType: 'grid',
          refId: String(selectedResult.id),
          projectId: selectedResult.projectId ?? undefined,
          episodeId: selectedResult.episodeId ?? undefined,
        }, abortController.signal)
        if (!uploaded) throw new Error('宫格图下载保存失败')
        mediaFileId = uploaded.id
        mediaUrl = uploaded.url
      } else {
        throw new Error('宫格图生成结果为空')
      }

      if (mediaFileId) {
        await updateGridResultMedia(selectedResult.id, mediaFileId)
      }

      const detail = await getGridResult(selectedResult.id)
      if (detail) {
        setSelectedResult({
          ...detail,
          mediaUrl: mediaUrl ?? detail.mediaUrl,
          panels: normalizeGridPanels(detail.panels),
          usedReferenceImages: normalizeGridReferenceImages(detail.usedReferenceImages),
        })
      }
      if (selectedResult.projectId) {
        await loadResultsForEpisode(selectedResult.projectId, selectedResult.episodeId)
      }
      setStatus('宫格图片已重新生成')
    } catch (err) {
      if (isAbortError(err)) {
        setError('')
        setStatus('已取消生成')
      } else {
        setError(String(err))
        setStatus('')
      }
    } finally {
      regenerateAbortRef.current = null
      setRegenerating(false)
    }
  }, [
    imageSettings,
    loadResultsForEpisode,
    regenerating,
    selectedResult,
    shotStore.selectedLocalRefs,
    sourceRows,
    styleKey,
  ])

  const handleDeleteResult = useCallback(async () => {
    if (!selectedResultId || deleting) return
    const confirmed = window.confirm('删除当前宫格结果后，将解除源分镜冻结，确定继续吗？')
    if (!confirmed) return

    setDeleting(true)
    setError('')
    setStatus('删除宫格结果中...')

    try {
      await deleteGridResult(selectedResultId)
      if (currentHistory?.projectId) {
        await loadResultsForEpisode(currentHistory.projectId, currentHistory.episodeId)
      } else {
        setResults([])
        setSelectedResult(null)
        setSelectedResultId(null)
      }
      if (sourceRows.length > 0) {
        setSelectedItems(new Set())
      }
      setStatus('宫格结果已删除，可重新选择源分镜')
    } catch (err) {
      setError(String(err))
      setStatus('')
    } finally {
      setDeleting(false)
    }
  }, [currentHistory, deleting, loadResultsForEpisode, selectedResultId, sourceRows.length])

  return (
    <div className="flex flex-1 min-h-0 overflow-hidden flex-col">
      <div className="border-b border-gray-800 px-3 py-2">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="w-[200px] min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">项目</span>
            <select
              value={selectedProjectId}
              onChange={e => void handleSelectProject(e.target.value)}
              className="h-10 w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 rounded-xl focus:outline-none focus:border-amber-500"
            >
              <option value="">选择项目</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>{project.name}</option>
              ))}
            </select>
          </label>

          <label className="w-[240px] min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">集数</span>
            <select
              value={selectedHistoryId ?? ''}
              onChange={e => e.target.value && void handleSelectHistory(Number(e.target.value))}
              disabled={!selectedProjectId}
              className="h-10 w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 rounded-xl focus:outline-none focus:border-amber-500 disabled:opacity-60"
            >
              <option value="">选择集数</option>
              {episodesWithRecord.map(({ episode, record }) => (
                <option key={episode.id} value={record?.id ?? ''} disabled={!record}>
                  第{episode.episodeNumber}集：{episode.title}{record ? '' : '（未生成分镜）'}
                </option>
              ))}
            </select>
          </label>

          <label className="min-w-0 flex-1">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">视觉风格</span>
            <select
              value={styleKey}
              onChange={e => onStyleChange(e.target.value)}
              className="h-10 w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 rounded-xl focus:outline-none focus:border-amber-500"
            >
              {Object.entries(STYLE_MAP).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </label>

          <label className="w-[96px] min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">比例</span>
            <select
              value={imageSettings.aspectRatio}
              onChange={e => useSettingsStore.getState().setImageSettings({ aspectRatio: e.target.value as ImageGenSettings['aspectRatio'] })}
              className="h-10 w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 rounded-xl focus:outline-none focus:border-amber-500"
            >
              {effectiveAspectRatios.map(ratio => (
                <option key={ratio} value={ratio}>{ratio}</option>
              ))}
            </select>
          </label>

          <label className="w-[160px] min-w-0">
            <span className="mb-1 block text-[11px] font-medium text-gray-500">分辨率</span>
            <select
              value={imageSettings.imageResolution}
              onChange={e => useSettingsStore.getState().setImageSettings({ imageResolution: e.target.value as ImageGenSettings['imageResolution'] })}
              className="h-10 w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 rounded-xl focus:outline-none focus:border-amber-500"
            >
              {effectiveResolutions.map(item => (
                <option key={item.value} value={item.value}>{item.label}</option>
              ))}
            </select>
          </label>

          <div className="ml-auto flex items-center gap-2.5 pb-[1px]">
            <button
              onClick={() => setSelectedItems(new Set(selectableSourceRows.map(row => row.index)))}
              disabled={selectableSourceRows.length === 0}
              className="text-sm font-medium text-amber-400 hover:text-amber-300 whitespace-nowrap disabled:opacity-40"
            >
              全选
            </button>
            <button
              onClick={() => setSelectedItems(new Set())}
              disabled={selectedItems.size === 0}
              className="text-sm text-gray-500 hover:text-gray-300 whitespace-nowrap disabled:opacity-40"
            >
              清除
            </button>
            <div className="text-[13px] text-gray-500 whitespace-nowrap">
              已选 {selectedItems.size} 条源分镜
            </div>
            <button
              onClick={() => void handleGenerate()}
              disabled={!generating && selectedSourceShots.length === 0}
              className="h-10 text-sm bg-purple-700 hover:bg-purple-600 text-white px-4 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              {generating ? '取消生成' : '生成 9 宫格'}
            </button>
          </div>
        </div>

        {occupiedSourceRefSet.size > 0 && (
          <div className="mt-1.5 text-xs text-amber-400">
            当前集已有宫格结果，已占用的源分镜会冻结；未占用的源分镜仍可继续选择生成
          </div>
        )}

        {(status || error) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-4 text-xs">
            {status && <div className="text-amber-400">{status}</div>}
            {error && <div className="text-red-400">{error}</div>}
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="w-96 border-r border-gray-800 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-gray-800">
            <div className="text-sm text-gray-200 font-medium">源分镜列表</div>
            <div className="mt-1 text-xs text-gray-500">选择要参与本次 9 宫格生成的原始分镜</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {sourceRows.length === 0 ? (
              <div className="p-4 text-xs text-gray-600 text-center">请选择项目与集数后勾选源分镜</div>
            ) : (
              sourceRows.map(row => {
                const occupied = occupiedSourceRefSet.has(row.ref)
                const checked = occupied || selectedItems.has(row.index)
                return (
                  <label
                    key={row.index}
                    className={`block p-3 border-b border-gray-800 transition-colors ${
                      checked ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'
                    } ${occupied ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={occupied}
                        onChange={e => {
                          setSelectedItems(prev => {
                            const next = new Set(prev)
                            if (e.target.checked) next.add(row.index)
                            else next.delete(row.index)
                            return next
                          })
                        }}
                        className="mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-xs text-gray-400">{row.ref}</div>
                        <div className="text-xs text-amber-500">{row.shotType || '未标注景别'}</div>
                        <div className="text-xs text-gray-500 truncate">{row.scene || row.prompt}</div>
                      </div>
                    </div>
                  </label>
                )
              })
            )}
          </div>
        </div>

        <div className="w-64 border-r border-gray-800 flex flex-col overflow-hidden shrink-0">
          <div className="px-3 py-2 border-b border-gray-800 text-sm text-gray-300">宫格结果列表</div>
          <div className="flex-1 overflow-y-auto">
            {loadingResults && <div className="p-4 text-xs text-gray-500">加载中...</div>}
            {!loadingResults && results.length === 0 && (
              <div className="p-4 text-xs text-gray-600">当前集还没有宫格结果</div>
            )}
            {results.map(result => (
              <button
                key={result.id}
                onClick={() => void loadResultDetail(result.id)}
                className={`w-full text-left p-3 border-b border-gray-800 transition-colors ${
                  selectedResultId === result.id ? 'bg-gray-800/70' : 'hover:bg-gray-800/40'
                }`}
              >
                <div className="flex items-center gap-2">
                  {result.mediaUrl ? (
                    <img
                      src={result.mediaUrl}
                      alt={`grid-${result.id}`}
                      className="w-16 h-10 object-cover rounded cursor-zoom-in"
                      onClick={(e) => {
                        e.stopPropagation()
                        setLightboxSrc(result.mediaUrl ?? null)
                      }}
                    />
                  ) : (
                    <div className="w-16 h-10 rounded bg-gray-800 border border-dashed border-gray-700" />
                  )}
                  <div className="min-w-0">
                    <div className="text-xs text-gray-200">结果{resultDisplayNumbers.get(result.id) ?? result.id}</div>
                    <div className="text-[11px] text-gray-500">
                      {new Date(result.createdAt).toLocaleString('zh-CN', {
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </div>
                    <div className={`text-[11px] ${result.validationPassed ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {result.validationPassed ? '结构化通过' : '结构化降级'}
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedResult ? (
            <div className="flex-1 flex items-center justify-center text-sm text-gray-600">
              请选择一个宫格结果查看详情
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-start gap-4">
                <div className="w-[520px] shrink-0">
                  {selectedResult.mediaUrl ? (
                    <img
                      src={selectedResult.mediaUrl}
                      alt={`grid-result-${selectedResult.id}`}
                      className="w-full rounded-xl border border-gray-800 cursor-zoom-in"
                      onClick={() => setLightboxSrc(selectedResult.mediaUrl ?? null)}
                    />
                  ) : (
                    <div className="w-full aspect-video rounded-xl border border-dashed border-gray-800 flex items-center justify-center text-sm text-gray-600">
                      暂无宫格图
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-sm text-gray-300 font-medium">结果{resultDisplayNumbers.get(selectedResult.id) ?? selectedResult.id}</div>
                      <div className="text-xs text-gray-500">
                        {new Date(selectedResult.createdAt).toLocaleString('zh-CN')}
                      </div>
                    </div>
                    <button
                      onClick={() => void handleRegenerateResult()}
                      disabled={!regenerating && deleting}
                      className="mr-2 text-xs px-3 py-1.5 rounded-lg border border-amber-700/50 bg-amber-900/20 text-amber-300 hover:bg-amber-900/30 disabled:opacity-50"
                    >
                      {regenerating ? '取消生成' : '重新生成'}
                    </button>
                    <button
                      onClick={() => void handleDeleteResult()}
                      disabled={deleting || regenerating}
                      className="text-xs px-3 py-1.5 rounded-lg border border-red-800/60 bg-red-900/20 text-red-300 hover:bg-red-900/30 disabled:opacity-50"
                    >
                      {deleting ? '删除中...' : '删除宫格'}
                    </button>
                  </div>

                  <div>
                    <div className="text-xs text-gray-500 mb-1">本次选中的源分镜</div>
                    <div className="flex flex-wrap gap-2">
                      {selectedResult.sourceShotRefs.map(ref => (
                        <span
                          key={`${selectedResult.id}-${ref}`}
                          className={`px-2 py-1 rounded-full border text-xs ${
                            selectedSourceRefSet.has(ref)
                              ? 'border-amber-600/60 bg-amber-900/30 text-amber-300'
                              : 'border-gray-700 bg-gray-800 text-gray-300'
                          }`}
                        >
                          {ref}
                        </span>
                      ))}
                    </div>
                  </div>

                  {!!selectedResult.usedReferenceImages?.length && (
                    <div>
                      <div className="text-xs text-gray-500 mb-1">本次实际上传参考图</div>
                      <div className="flex flex-wrap gap-2">
                        {selectedResult.usedReferenceImages.map((ref, index) => (
                          <div
                            key={`${selectedResult.id}-used-ref-${index}-${ref.name}`}
                            className="flex items-center gap-2 rounded-lg border border-gray-800 bg-gray-900/70 px-2 py-1.5"
                          >
                            {ref.imageUrl ? (
                              <img
                                src={ref.imageUrl}
                                alt={ref.name}
                                className="w-8 h-8 rounded object-cover border border-gray-700"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded border border-dashed border-gray-700 bg-gray-800 flex items-center justify-center text-[10px] text-gray-500">
                                本地
                              </div>
                            )}
                            <div className="min-w-0">
                              <div className="text-xs text-gray-200 leading-tight">{ref.name}</div>
                              <div className="text-[10px] text-gray-500">
                                {ref.typeLabel}
                                {ref.sourceShotRefs.length > 0 ? ` · ${ref.sourceShotRefs.join('、')}` : ''}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {!selectedResult.validationPassed && selectedResult.rawModelOutput && (
                    <div className="rounded-xl border border-amber-700/40 bg-amber-900/10 p-3">
                      <div className="text-xs text-amber-300 mb-1">结构化降级输出</div>
                      <pre className="whitespace-pre-wrap text-xs text-gray-400">{selectedResult.rawModelOutput}</pre>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <div className="text-sm text-gray-300 font-medium mb-2">9 宫格分镜结果</div>
                <GridResultTable panels={normalizeGridPanels(selectedResult.panels)} />
              </div>
            </div>
          )}
        </div>
      </div>

      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="预览" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button
            className="absolute top-4 right-4 text-white text-2xl w-10 h-10 flex items-center justify-center bg-black/50 rounded-full hover:bg-black/70"
            onClick={() => setLightboxSrc(null)}
          >
            ×
          </button>
        </div>
      )}
    </div>
  )
}

export default GridResultWorkspace
