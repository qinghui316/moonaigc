import React, { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useHistoryStore } from '../../store/useHistoryStore'
import { useShotStore } from '../../store/useShotStore'
import { useProjectStore } from '../../store/useProjectStore'
import { parseTableRows } from '../../utils/parseTable'
import { parseSeedanceFields, buildStructuredInput, refinePromptViaAI } from '../../services/imagePrompt'
import { callImageGenAPI, uploadExternalImageUrl } from '../../services/imageGen'
import { collectRefImages, buildRefImageDescs, loadRefImageBase64s, clearRefImageCache } from '../../services/refImageCollector'
import { STYLE_MAP } from '../../data/styleMap'
import { IMAGE_PLATFORMS } from '../../data/platforms'
import { GLOBAL_NEGATIVE_PROMPT, GLOBAL_NEGATIVE_PROMPT_INLINE, STYLE_NEGATIVE_PROMPTS } from '../../data/negativePrompts'
import GridModal from './GridModal'
import GridResultWorkspace from './GridResultWorkspace'
import RefImagePickerModal, { type ManualRefItem } from './RefImagePickerModal'
import type { ImageGenSettings } from '../../types'
import { getPreferredEpisodeId, setPreferredEpisodeId } from '../../utils/imagegenPrefs'

interface ShotRow {
  index: number
  time: string
  shotType: string
  scene: string
  prompt: string
  cells: string[]
}

type LocalUploadRef = { id: string; base64: string; mimeType: string; name: string }
type MaterialDisplayRef = {
  kind: 'material'
  key: string
  source: '自动' | '手动'
  name: string
  typeLabel: string
  imageUrl: string
  imageFileId: number
  tag?: string
}
type LocalDisplayRef = {
  kind: 'local'
  key: string
  source: '本地'
  name: string
  imageUrl: string
  id: string
}

const ASSET_TYPE_LABELS: Record<ManualRefItem['type'], string> = {
  character: '角色',
  image: '场景',
  props: '道具',
}

const mapCollectedRefsToManualItems = (refs: ReturnType<typeof collectRefImages>): ManualRefItem[] =>
  refs.map(ref => ({
    name: ref.name,
    type: ref.type,
    desc: ref.desc,
    imageUrl: ref.imageUrl,
    imageFileId: ref.imageFileId,
  }))

const toRefImageInfos = (refs: ManualRefItem[]) =>
  refs.map(ref => ({
    tag: `@${ref.name}`,
    type: ref.type,
    name: ref.name,
    desc: ref.desc,
    imageUrl: ref.imageUrl,
    imageFileId: ref.imageFileId,
  }))

const mergeMaterialRefs = (autoRefs: ManualRefItem[], extraRefs: ManualRefItem[]) => {
  const seenIds = new Set(autoRefs.map(ref => ref.imageFileId))
  return [
    ...autoRefs,
    ...extraRefs.filter(ref => !seenIds.has(ref.imageFileId)),
  ]
}

const ImageGenPage: React.FC<{ selectedRowIndex?: number | null }> = ({ selectedRowIndex = null }) => {
  const { textSettings, imageSettings, imageStyleKey, setImageStyleKey } = useSettingsStore()
  const materialStore = useMaterialStore()
  const { records: history } = useHistoryStore()
  const shotStore = useShotStore()
  const setSelectedMaterialRefs = useShotStore(state => state.setSelectedMaterialRefs)
  const setSelectedLocalRefs = useShotStore(state => state.setSelectedLocalRefs)
  const { projects, episodes, loadProjects, selectProject, currentProject, currentEpisode } = useProjectStore()

  // 当前图片平台配置
  const currentImagePlatform = IMAGE_PLATFORMS.find(p => p.id === imageSettings.platformId)
    ?? IMAGE_PLATFORMS[0]

  // 当前选中模型的覆盖配置（如有），否则使用平台级默认
  const currentModelDef = currentImagePlatform.models.find(m => m.value === imageSettings.model)
  const effectiveAspectRatios = currentModelDef?.aspectRatios ?? currentImagePlatform.aspectRatios
  const effectiveResolutions = currentModelDef?.resolutions ?? currentImagePlatform.resolutions

  // 平台或模型切换时，自动重置不合法的比例/清晰度
  useEffect(() => {
    const { setImageSettings } = useSettingsStore.getState()
    const { imageSettings: s } = useSettingsStore.getState()
    const platform = IMAGE_PLATFORMS.find(p => p.id === s.platformId) ?? IMAGE_PLATFORMS[0]
    const modelDef = platform.models.find(m => m.value === s.model)
    const ratios = modelDef?.aspectRatios ?? platform.aspectRatios
    const ress = (modelDef?.resolutions ?? platform.resolutions).map(r => r.value)
    const updates: Partial<ImageGenSettings> = {}
    if (!ratios.includes(s.aspectRatio)) updates.aspectRatio = ratios[0] as ImageGenSettings['aspectRatio']
    if (!ress.includes(s.imageResolution)) updates.imageResolution = ress[0] as ImageGenSettings['imageResolution']
    if (Object.keys(updates).length > 0) setImageSettings(updates)
  }, [imageSettings.platformId, imageSettings.model]) // eslint-disable-line react-hooks/exhaustive-deps


  // 来源模式：历史记录 or 项目剧集
  const [sourceMode, setSourceMode] = useState<'history' | 'project'>('project')
  const [selectedProjectId, setSelectedProjectId] = useState<string>('')

  const [selectedHistoryId, setSelectedHistoryId] = useState<number | null>(null)
  const [rows, setRows] = useState<ShotRow[]>([])
  const [selectedRow, setSelectedRow] = useState<ShotRow | null>(null)
  const [editedPrompt, setEditedPrompt] = useState('')
  const [originalPrompt, setOriginalPrompt] = useState('')  // 恢复原始用
  const [refining, setRefining] = useState(false)           // AI精炼中
  const [refImageChecks, setRefImageChecks] = useState<Record<string, boolean>>({})
  const [generating, setGenerating] = useState<Record<number, boolean>>({})
  const [generatedImages, setGeneratedImages] = useState<Record<number, string>>({})
  const [error, setError] = useState('')
  const styleKey = imageStyleKey
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [pageMode, setPageMode] = useState<'shots' | 'grid'>('shots')
  const [showGridModal, setShowGridModal] = useState(false)
  const gridDefaultsAppliedRef = useRef(false)
  useEffect(() => {
    if (pageMode !== 'grid') return
    if (gridDefaultsAppliedRef.current) return
    const updates: Partial<ImageGenSettings> = {}
    if (effectiveAspectRatios.includes('16:9') && imageSettings.aspectRatio !== '16:9') updates.aspectRatio = '16:9'
    if (effectiveResolutions.some(item => item.value === '4K') && imageSettings.imageResolution !== '4K') updates.imageResolution = '4K'
    if (Object.keys(updates).length > 0) useSettingsStore.getState().setImageSettings(updates)
    gridDefaultsAppliedRef.current = true
  }, [pageMode, effectiveAspectRatios, effectiveResolutions, imageSettings.aspectRatio, imageSettings.imageResolution])
  // 手动参考图管理
  const [manualRefs, setManualRefs] = useState<ManualRefItem[]>([])
  const [localUploads, setLocalUploads] = useState<LocalUploadRef[]>([])
  const [showRefPicker, setShowRefPicker] = useState(false)
  const localUploadInputRef = React.useRef<HTMLInputElement>(null)
  // 底部画廊
  const galleryTab: 'shot' = 'shot'
  const [dbImages, setDbImages] = useState<{ id: number; url: string; refType: string; createdAt?: number }[]>([])

  const latestRecordForEpisode = useCallback((episodeId?: string | null) => {
    if (!episodeId) return null
    const recs = history.filter(item => item.episodeId === episodeId)
    return recs.length > 0 ? recs.reduce((a, b) => (b.id > a.id ? b : a)) : null
  }, [history])

  const loadGalleryImages = useCallback(async (projId: string, epId?: string) => {
    if (!projId) return
    const params = new URLSearchParams({ projectId: projId })
    if (epId) params.set('episodeId', epId)
    const resp = await fetch(`/api/media?${params.toString()}`)
    if (!resp.ok) return
    const data = await resp.json() as { items: { id: number; url: string; refType: string; createdAt: number }[]; total: number }
    setDbImages(data.items.filter(d => d.refType === 'shot'))
  }, [])

  const loadHistory = useCallback(async (id: number) => {
    setSelectedHistoryId(id)
    const rec = history.find(h => h.id === id)
    if (!rec) return
    if (rec.projectId && rec.episodeId) {
      setPreferredEpisodeId(rec.projectId, rec.episodeId)
    }
    // 从 DB 加载 shots（含 imageFile 回显）
    await shotStore.loadShotsFromDB(id)
    const { headers, rows: tableRows } = parseTableRows(rec.storyboard)
    const parsed: ShotRow[] = tableRows.map((cells, i) => {
      const get = (key: string) => {
        const idx = headers.findIndex(h => h.includes(key))
        return idx >= 0 ? (cells[idx] ?? '') : ''
      }
      return {
        index: i,
        time: get('时间'),
        shotType: get('景别'),
        scene: get('画面'),
        prompt: cells[cells.length - 1] ?? '',
        cells,
      }
    })
    setRows(parsed)
    setSelectedRow(null)
    setEditedPrompt('')
    setSelectedItems(new Set())
    // 切换历史记录时清空旧的参考图选择缓存（editedPrompts 已由 loadShotsFromDB 从 DB 恢复，不再清空）
    shotStore.clearSelectedRefs()
    // 从 store 恢复已生成的图片（loadShotsFromDB 已更新 shotImages）
    const imgs: Record<number, string> = {}
    const latestImages = useShotStore.getState().shotImages
    for (const [k, v] of Object.entries(latestImages)) {
      imgs[Number(k)] = v.url
    }
    setGeneratedImages(imgs)
    // 加载画廊图片（当前项目/集）
    if (rec.projectId) {
      loadGalleryImages(rec.projectId, rec.episodeId)
    }
  }, [history, shotStore, loadGalleryImages])

  const handleSelectRow = useCallback((row: ShotRow) => {
    setSelectedRow(row)
    setError('')
    // 构建原始结构化提示词（始终作为"恢复原始"的基准）
    const { headers } = parseTableRows(history.find(h => h.id === selectedHistoryId)?.storyboard ?? '')
    const fallback: Record<string, string | undefined> = {
      shotType: row.shotType,
      scene: row.scene,
      lighting: (() => {
        const idx = headers.findIndex(h => h.includes('光影'))
        return idx >= 0 ? row.cells[idx] : ''
      })(),
    }
    const fields = parseSeedanceFields(row.prompt, fallback)
    const styleName = STYLE_MAP[styleKey] ?? ''
    const structured = buildStructuredInput(fields, styleName, row.scene, materialStore.materials)
    setOriginalPrompt(structured)
    // 优先恢复用户已编辑/AI精炼过的提示词，没有则用原始结构化提示词
    const saved = useShotStore.getState().editedPrompts[row.index]
    setEditedPrompt(saved ?? structured)

    // 自动联动参考图
    const materials = materialStore.materials
    const refs = collectRefImages(row.prompt, materials)
    const storeState = useShotStore.getState()
    const savedMaterialRefs = storeState.selectedMaterialRefs[row.index] ?? []
    const savedLocalRefs = storeState.selectedLocalRefs[row.index] ?? []
    const hasSavedSelection =
      Object.prototype.hasOwnProperty.call(storeState.selectedMaterialRefs, row.index)
      || Object.prototype.hasOwnProperty.call(storeState.selectedLocalRefs, row.index)
    const savedImageIds = new Set(savedMaterialRefs.map(ref => ref.imageFileId))
    const autoRefIds = new Set(refs.map(ref => ref.imageFileId))
    const checks: Record<string, boolean> = {}
    refs.forEach(ref => {
      checks[ref.tag] = hasSavedSelection ? savedImageIds.has(ref.imageFileId) : true
    })
    setRefImageChecks(checks)
    setManualRefs(hasSavedSelection ? savedMaterialRefs.filter(ref => !autoRefIds.has(ref.imageFileId)) : [])
    setLocalUploads(hasSavedSelection ? savedLocalRefs : [])
  }, [selectedHistoryId, history, styleKey, materialStore.materials])

  const currentAutoCollectedRefs = useMemo(
    () => (selectedRow
      ? collectRefImages(selectedRow.prompt, materialStore.materials)
        .filter(ref => refImageChecks[ref.tag] !== false)
      : []),
    [selectedRow, materialStore.materials, refImageChecks],
  )

  const currentAutoMaterialRefs = useMemo(
    () => mapCollectedRefsToManualItems(currentAutoCollectedRefs),
    [currentAutoCollectedRefs],
  )

  const currentResolvedMaterialRefs = useMemo(
    () => mergeMaterialRefs(currentAutoMaterialRefs, manualRefs),
    [currentAutoMaterialRefs, manualRefs],
  )

  const resolveRefsForRow = useCallback((row: ShotRow, preferCurrentState = false) => {
    if (preferCurrentState && selectedRow?.index === row.index) {
      return {
        materialRefs: currentResolvedMaterialRefs,
        localRefs: localUploads,
      }
    }

    const storeState = useShotStore.getState()
    const hasSavedSelection =
      Object.prototype.hasOwnProperty.call(storeState.selectedMaterialRefs, row.index)
      || Object.prototype.hasOwnProperty.call(storeState.selectedLocalRefs, row.index)

    if (hasSavedSelection) {
      return {
        materialRefs: storeState.selectedMaterialRefs[row.index] ?? [],
        localRefs: storeState.selectedLocalRefs[row.index] ?? [],
      }
    }

    return {
      materialRefs: mapCollectedRefsToManualItems(collectRefImages(row.prompt, materialStore.materials)),
      localRefs: [] as LocalUploadRef[],
    }
  }, [selectedRow?.index, currentResolvedMaterialRefs, localUploads, materialStore.materials])

  const currentDisplayRefs = useMemo<(MaterialDisplayRef | LocalDisplayRef)[]>(() => {
    const autoRefById = new Map(currentAutoCollectedRefs.map(ref => [ref.imageFileId, ref]))
    const materialDisplayRefs: MaterialDisplayRef[] = currentResolvedMaterialRefs.map(ref => {
      const autoRef = autoRefById.get(ref.imageFileId)
      return {
        kind: 'material',
        key: `${autoRef ? 'auto' : 'manual'}_${ref.imageFileId}`,
        source: autoRef ? '自动' : '手动',
        name: ref.name,
        typeLabel: ASSET_TYPE_LABELS[ref.type],
        imageUrl: ref.imageUrl,
        imageFileId: ref.imageFileId,
        tag: autoRef?.tag,
      }
    })

    const localDisplayRefs: LocalDisplayRef[] = localUploads.map(ref => ({
      kind: 'local',
      key: `local_${ref.id}`,
      source: '本地',
      name: ref.name,
      imageUrl: `data:${ref.mimeType};base64,${ref.base64}`,
      id: ref.id,
    }))

    return [...materialDisplayRefs, ...localDisplayRefs]
  }, [currentAutoCollectedRefs, currentResolvedMaterialRefs, localUploads])

  const persistShotPrompt = useCallback(async (rowIndex: number, prompt: string) => {
    const shotId = useShotStore.getState().shotIds[rowIndex]
    if (!shotId) return
    try {
      await fetch(`/api/shots/${shotId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
      })
    } catch {
      // ignore prompt persistence failures and keep local state
    }
  }, [])

  useEffect(() => {
    if (!selectedRow) return
    setSelectedMaterialRefs(selectedRow.index, currentResolvedMaterialRefs)
    setSelectedLocalRefs(selectedRow.index, localUploads)
  }, [selectedRow, currentResolvedMaterialRefs, localUploads, setSelectedLocalRefs, setSelectedMaterialRefs])

  // AI精炼：将当前提示词精炼后写回文本框，供用户预览/修改
  useEffect(() => {
    if (pageMode !== 'shots' || rows.length === 0) return
    if (selectedRow && rows.some(row => row.index === selectedRow.index)) return

    const target = selectedRowIndex != null
      ? rows.find(row => row.index === selectedRowIndex) ?? rows[0]
      : rows[0]

    handleSelectRow(target)
  }, [pageMode, rows, selectedRow, selectedRowIndex, handleSelectRow])

  const handleRefine = useCallback(async () => {
    if (!textSettings.key) { setError('请先在设置中配置文字生成 API Key'); return }
    if (!selectedRow) return
    setRefining(true)
    setError('')
    try {
      const refs = collectRefImages(selectedRow.prompt, materialStore.materials)
        .filter(r => refImageChecks[r.tag] !== false)
      const refDescs = buildRefImageDescs(refs)
      const refined = await refinePromptViaAI(editedPrompt, textSettings, refDescs)
      setEditedPrompt(refined)
      shotStore.setEditedPrompt(selectedRow.index, refined)
      void persistShotPrompt(selectedRow.index, refined)
    } catch (e) {
      setError(`AI精炼失败：${String(e)}`)
    }
    setRefining(false)
  }, [selectedRow, editedPrompt, textSettings, materialStore.materials, refImageChecks, persistShotPrompt, shotStore])

  // 判断两个镜头之间是否发生了场景切换
  const hasSceneCut = useCallback((currentRowIndex: number, prevRowIndex: number): boolean => {
    const currentRow = rows[currentRowIndex]
    const prevRow = rows[prevRowIndex]
    if (!currentRow || !prevRow) return true
    const materials = materialStore.materials
    const currentScenes = new Set(
      collectRefImages(currentRow.prompt, materials).filter(r => r.type === 'image').map(r => r.name)
    )
    const prevScenes = new Set(
      collectRefImages(prevRow.prompt, materials).filter(r => r.type === 'image').map(r => r.name)
    )
    // 场景 tag 集合不同 → 切镜（包括一方有场景另一方没有的情况）
    if (currentScenes.size !== prevScenes.size) return true
    for (const s of currentScenes) {
      if (!prevScenes.has(s)) return true
    }
    return false
  }, [rows, materialStore.materials])

  // 获取前一镜已生成图片的 base64，用于链式参考
  const getPrevShotBase64 = useCallback(async (currentRowIndex: number): Promise<{ base64: string; mimeType: string } | undefined> => {
    const prevIdx = currentRowIndex - 1
    if (prevIdx < 0) return undefined
    // 场景切换时不传前一镜图片
    if (hasSceneCut(currentRowIndex, prevIdx)) return undefined
    const prevImage = useShotStore.getState().shotImages[prevIdx]
    if (!prevImage?.url) return undefined
    try {
      const { fetchAssetImageAsBase64 } = await import('../../services/imageGen')
      return await fetchAssetImageAsBase64(prevImage.url)
    } catch {
      return undefined
    }
  }, [hasSceneCut])

  const handleGenerate = useCallback(async (rowIndex: number, customPrompt?: string) => {
    if (!imageSettings.key) { setError('请在设置中配置图片生成 API Key'); return }
    setError('')
    setGenerating(prev => ({ ...prev, [rowIndex]: true }))
    try {
      const row = rows[rowIndex]
      if (!row) return

      const { materialRefs: allMaterialRefs, localRefs: rowLocalRefs } = resolveRefsForRow(row, true)
      const allMaterialRefInfos = toRefImageInfos(allMaterialRefs)
      const finalPrompt = customPrompt ?? editedPrompt

      const refBase64s = [
        ...await loadRefImageBase64s(allMaterialRefInfos),
        ...rowLocalRefs.map(u => ({ base64: u.base64, mimeType: u.mimeType })),
      ]
      // 链式参考：将前一镜已生成图片追加到参考图末尾
      const prevShot = await getPrevShotBase64(rowIndex)
      if (prevShot) refBase64s.push(prevShot)
      const refImageIds = allMaterialRefs.map(r => r.imageFileId)
      // 计算负向提示词（全局 + 风格特有）
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const isInlinePlatform = imageSettings.platformId !== 'doubao-image'
      const negativePrompt = isInlinePlatform
        ? GLOBAL_NEGATIVE_PROMPT_INLINE + (styleNeg ? `, ${styleNeg}` : '')
        : [GLOBAL_NEGATIVE_PROMPT, styleNeg].filter(Boolean).join(', ')
      const result = await callImageGenAPI(imageSettings, finalPrompt, refBase64s, negativePrompt, refImageIds)
      clearRefImageCache()

      let imgUrl = result.url
      let mediaFileId: number | undefined

      // 获取当前 shotId 用于回写
      const shotId = useShotStore.getState().shotIds[rowIndex]

      if (!imgUrl && result.b64) {
        const currentRec = history.find(h => h.id === selectedHistoryId)
        const uploadResp = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: result.b64, mimeType: 'image/jpeg', refType: 'shot',
            ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
            ...(currentRec?.projectId ? { projectId: currentRec.projectId } : {}),
            ...(currentRec?.episodeId ? { episodeId: currentRec.episodeId } : {}),
          }),
        })
        if (uploadResp.ok) {
          const uploadData = await uploadResp.json() as { id: number; url: string }
          imgUrl = uploadData.url
          mediaFileId = uploadData.id
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt, mediaFileId })
          setDbImages(prev => [...prev, { id: uploadData.id, url: uploadData.url, refType: 'shot' }])
          // 回写 Shot.imageFileId
          if (shotId) {
            fetch(`/api/shots/${shotId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageFileId: mediaFileId, prompt: finalPrompt }),
            }).catch(() => {/* ignore */})
          }
        }
      } else if (imgUrl) {
        // 外部 URL（RunningHub 等），下载后存入数据库
        const currentRec = history.find(h => h.id === selectedHistoryId)
        const uploaded = await uploadExternalImageUrl(imgUrl, {
          refType: 'shot',
          ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
          ...(currentRec?.projectId ? { projectId: currentRec.projectId } : {}),
          ...(currentRec?.episodeId ? { episodeId: currentRec.episodeId } : {}),
        })
        if (uploaded) {
          imgUrl = uploaded.url
          mediaFileId = uploaded.id
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt, mediaFileId })
          setDbImages(prev => [...prev, { id: uploaded.id, url: uploaded.url, refType: 'shot' }])
          if (shotId) {
            fetch(`/api/shots/${shotId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageFileId: mediaFileId, prompt: finalPrompt }),
            }).catch(() => {/* ignore */})
          }
        } else {
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt })
          // 上传失败时，尝试把图片内容作为 base64 上传
          const currentRec2 = history.find(h => h.id === selectedHistoryId)
          try {
            const { fetchAssetImageAsBase64 } = await import('../../services/imageGen')
            const imgData = await fetchAssetImageAsBase64(imgUrl)
            const fallbackResp = await fetch('/api/media/upload', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                base64: imgData.base64, mimeType: imgData.mimeType, refType: 'shot',
                ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
                ...(currentRec2?.projectId ? { projectId: currentRec2.projectId } : {}),
                ...(currentRec2?.episodeId ? { episodeId: currentRec2.episodeId } : {}),
              }),
            })
            if (fallbackResp.ok) {
              const fallbackData = await fallbackResp.json() as { id: number; url: string }
              imgUrl = fallbackData.url
              shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt, mediaFileId: fallbackData.id })
              setDbImages(prev => [...prev, { id: fallbackData.id, url: fallbackData.url, refType: 'shot' }])
            }
          } catch { /* 实在失败就只保留本地显示 */ }
        }
      }

      if (imgUrl) {
        setGeneratedImages(prev => ({ ...prev, [rowIndex]: imgUrl! }))
      }
    } catch (e) {
      setError(String(e))
    }
    setGenerating(prev => ({ ...prev, [rowIndex]: false }))
  }, [rows, imageSettings, editedPrompt, shotStore, selectedHistoryId, resolveRefsForRow, history, styleKey])

  const handleBatchGenerate = useCallback(async () => {
    if (selectedItems.size === 0) { setError('请先选择要生成的镜头'); return }
    setBatchGenerating(true)
    setError('')
    const total = selectedItems.size
    let done = 0
    let prevImageB64: string | undefined
    let prevBatchIdx: number | undefined

    // 初始化：如果第一个选中镜头的前一镜已有图片，作为链式参考起点（getPrevShotBase64 内已含切镜检测）
    const firstIdx = [...selectedItems].sort((a, b) => a - b)[0]
    if (firstIdx != null) {
      const prevShot = await getPrevShotBase64(firstIdx)
      if (prevShot) prevImageB64 = prevShot.base64
    }

    for (const idx of [...selectedItems].sort((a, b) => a - b)) {
      const row = rows[idx]
      if (!row) continue
      done++

      // 批量循环中检测切镜：如果与上一个处理的镜头场景不同，清掉 prevImageB64
      if (prevBatchIdx != null && hasSceneCut(idx, prevBatchIdx)) {
        prevImageB64 = undefined
      }
      const { materialRefs: refs, localRefs: rowLocalRefs } = resolveRefsForRow(row, true)
      const { headers } = parseTableRows(history.find(h => h.id === selectedHistoryId)?.storyboard ?? '')
      const fallback = {
        shotType: row.shotType,
        scene: row.scene,
        lighting: (() => {
          const lIdx = headers.findIndex(h => h.includes('光影'))
          return lIdx >= 0 ? row.cells[lIdx] : ''
        })(),
      }
      const fields = parseSeedanceFields(row.prompt, fallback)
      const styleName = STYLE_MAP[styleKey] ?? ''
      let structured = buildStructuredInput(fields, styleName, row.scene, materialStore.materials)
      const refInfos = toRefImageInfos(refs)

      // 每张图先 AI 精炼
      if (textSettings.key) {
        setBatchStatus(`✨ AI精炼提示词 (${done}/${total})`)
        try {
          structured = await refinePromptViaAI(structured, textSettings, buildRefImageDescs(refInfos))
          shotStore.setEditedPrompt(idx, structured)
          if (selectedRow?.index === idx) setEditedPrompt(structured)
          void persistShotPrompt(idx, structured)
        } catch {
          // 精炼失败则使用原始结构化提示词
        }
      }
      setBatchStatus(`🎨 生成图片 (${done}/${total})`)

      // 链式参考图：将上一镜 b64 插到参考图列表最前面
      const styleNeg = STYLE_NEGATIVE_PROMPTS[styleKey] ?? ''
      const isInlinePlatform = imageSettings.platformId !== 'doubao-image'
      const negativePrompt = isInlinePlatform
        ? GLOBAL_NEGATIVE_PROMPT_INLINE + (styleNeg ? `, ${styleNeg}` : '')
        : [GLOBAL_NEGATIVE_PROMPT, styleNeg].filter(Boolean).join(', ')

      try {
        const materialBase64s = await loadRefImageBase64s(refInfos)
        const refImageIds = refs.map(r => r.imageFileId)
        console.log(`[BatchDebug] 镜头${idx}: refs=${refs.length}个(${refs.map(r => r.name).join(',')}), base64=${materialBase64s.length}个, localRefs=${rowLocalRefs.length}个, refImageIds=`, refImageIds)
        // 将前一镜图片追加到参考图末尾
        const chainRefs = [
          ...materialBase64s,
          ...rowLocalRefs.map(u => ({ base64: u.base64, mimeType: u.mimeType })),
          ...(prevImageB64 ? [{ base64: prevImageB64, mimeType: 'image/jpeg' }] : []),
        ]
        const result = await callImageGenAPI(imageSettings, structured, chainRefs, negativePrompt, refImageIds)
        clearRefImageCache()

        let imgUrl = result.url
        let curB64 = result.b64

        const shotId = useShotStore.getState().shotIds[idx]

        if (!imgUrl && curB64) {
          const batchRec = history.find(h => h.id === selectedHistoryId)
          const uploadResp = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: curB64, mimeType: 'image/jpeg', refType: 'shot',
              ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
              ...(batchRec?.projectId ? { projectId: batchRec.projectId } : {}),
              ...(batchRec?.episodeId ? { episodeId: batchRec.episodeId } : {}),
            }),
          })
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json() as { id: number; url: string }
            imgUrl = uploadData.url
            shotStore.setShotImage(idx, { url: imgUrl, prompt: structured, mediaFileId: uploadData.id })
            setDbImages(prev => [...prev, { id: uploadData.id, url: uploadData.url, refType: 'shot' }])
            if (shotId) {
              fetch(`/api/shots/${shotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageFileId: uploadData.id, prompt: structured }),
              }).catch(() => {})
            }
          }
        } else if (imgUrl) {
          // 外部 URL（RunningHub 等），下载后存入数据库，同时取 b64 供下一镜链式参考
          const batchRec = history.find(h => h.id === selectedHistoryId)
          const uploaded = await uploadExternalImageUrl(imgUrl, {
            refType: 'shot',
            ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
            ...(batchRec?.projectId ? { projectId: batchRec.projectId } : {}),
            ...(batchRec?.episodeId ? { episodeId: batchRec.episodeId } : {}),
          })
          if (uploaded) {
            imgUrl = uploaded.url
            curB64 = uploaded.base64
            shotStore.setShotImage(idx, { url: imgUrl, prompt: structured, mediaFileId: uploaded.id })
            setDbImages(prev => [...prev, { id: uploaded.id, url: uploaded.url, refType: 'shot' }])
            if (shotId) {
              fetch(`/api/shots/${shotId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageFileId: uploaded.id, prompt: structured }),
              }).catch(() => {})
            }
          } else {
            shotStore.setShotImage(idx, { url: imgUrl, prompt: structured })
          }
        }

        if (imgUrl) setGeneratedImages(prev => ({ ...prev, [idx]: imgUrl! }))
        // 缓存本镜 b64 作为下一镜参考
        prevImageB64 = curB64
        prevBatchIdx = idx
      } catch (e) {
        setError(String(e))
        prevImageB64 = undefined
        prevBatchIdx = idx
      }
    }
    clearRefImageCache()
    setBatchGenerating(false)
    setBatchStatus('')
  }, [selectedItems, rows, selectedHistoryId, history, styleKey, textSettings, imageSettings, shotStore, resolveRefsForRow, selectedRow?.index])

  // 进入项目模式时加载项目列表
  useEffect(() => {
    if (sourceMode === 'project') loadProjects()
  }, [sourceMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sourceMode !== 'project') return
    if (!selectedProjectId && currentProject?.id) {
      setSelectedProjectId(currentProject.id)
    }
  }, [sourceMode, currentProject?.id, selectedProjectId])

  // 切换项目时加载剧集
  const handleSelectProject = useCallback(async (id: string) => {
    setSelectedProjectId(id)
    setRows([])
    setSelectedRow(null)
    setEditedPrompt('')
    setSelectedHistoryId(null)
    if (id) await selectProject(id)
  }, [selectProject])

  // 每集对应的最新历史记录（按 episodeId 分组，取最新 id）
  const episodesWithRecord = useMemo(() => {
    if (!selectedProjectId) return []
    return episodes.map(ep => {
      const latest = latestRecordForEpisode(ep.id)
      return { episode: ep, record: latest }
    })
  }, [episodes, latestRecordForEpisode, selectedProjectId])

  useEffect(() => {
    if (sourceMode !== 'project') return
    if (!currentProject?.id) return
    if (selectedHistoryId != null) return
    if (selectedProjectId !== currentProject.id) return
    const preferredEpisodeId = getPreferredEpisodeId(currentProject.id)
    const targetEpisodeId = preferredEpisodeId ?? currentEpisode?.id ?? null
    if (!targetEpisodeId) return
    const latest = latestRecordForEpisode(targetEpisodeId)
    if (!latest || selectedHistoryId === latest.id) return
    void loadHistory(latest.id)
  }, [
    sourceMode,
    currentProject?.id,
    currentEpisode?.id,
    selectedProjectId,
    selectedHistoryId,
    latestRecordForEpisode,
    loadHistory,
  ])

  const handleCloseGridModal = useCallback(() => {
    setShowGridModal(false)
    if (!selectedRow) return
    const saved = useShotStore.getState().editedPrompts[selectedRow.index]
    if (saved) setEditedPrompt(saved)
  }, [selectedRow])

  return (
    <div className="flex flex-col h-full bg-surface-0 text-gray-200">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-divider shrink-0">
        <button
          onClick={() => setPageMode('shots')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            pageMode === 'shots' ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
        >
          普通镜头生图
        </button>
        <button
          onClick={() => setPageMode('grid')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            pageMode === 'grid' ? 'bg-brand-600 text-white shadow-sm shadow-brand-600/20' : 'bg-surface-2 text-gray-400 hover:text-gray-200'
          }`}
        >
          宫格生图模式
        </button>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden flex-col" style={{ display: pageMode === 'grid' ? 'flex' : 'none' }}>
        <GridResultWorkspace styleKey={styleKey} onStyleChange={setImageStyleKey} />
      </div>
      <div className="flex flex-1 min-h-0 overflow-hidden flex-col" style={{ display: pageMode === 'shots' ? 'flex' : 'none' }}>
        <>
      {/* 顶部：选择分镜来源 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-divider shrink-0 flex-wrap">
        {/* 来源模式切换 */}
        <div className="flex rounded-lg overflow-hidden border border-divider shrink-0">
          <button
            onClick={() => setSourceMode('project')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === 'project' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'}`}
          >
            项目剧集
          </button>
          <button
            onClick={() => setSourceMode('history')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === 'history' ? 'bg-brand-600 text-white' : 'bg-surface-2 text-gray-400 hover:text-gray-200'}`}
          >
            历史记录
          </button>
        </div>

        {sourceMode === 'history' ? (
          /* 历史记录模式 */
          <select
            value={selectedHistoryId ?? ''}
            onChange={e => e.target.value && loadHistory(Number(e.target.value))}
            className="bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60 flex-1 max-w-xs"
          >
            <option value="">— 选择历史分镜 —</option>
            {history.slice(0, 20).map(h => (
              <option key={h.id} value={h.id}>{h.time} · {h.director} · {h.plot.slice(0, 20)}</option>
            ))}
          </select>
        ) : (
          /* 项目剧集模式 */
          <>
            <select
              value={selectedProjectId}
              onChange={e => handleSelectProject(e.target.value)}
              className="bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60 max-w-[160px]"
            >
              <option value="">— 选择项目 —</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            {selectedProjectId && (
              <select
                value={selectedHistoryId ?? ''}
                onChange={e => e.target.value && loadHistory(Number(e.target.value))}
                className="bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60 flex-1 max-w-xs disabled:opacity-60"
              >
                <option value="">— 选择集数 —</option>
                {episodesWithRecord.map(({ episode, record }) => (
                  <option
                    key={episode.id}
                    value={record?.id ?? ''}
                    disabled={!record}
                  >
                    第{episode.episodeNumber}集：{episode.title}
                    {record ? '' : '（未生成分镜）'}
                  </option>
                ))}
              </select>
            )}
          </>
        )}
        <span className="text-xs text-gray-500">视觉风格：</span>
        <select
          value={styleKey}
          onChange={e => setImageStyleKey(e.target.value)}
          className="bg-surface-2 border border-divider text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {Object.entries(STYLE_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.slice(0, 12)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">比例：</span>
        <select
          value={imageSettings.aspectRatio}
          onChange={e => useSettingsStore.getState().setImageSettings({ aspectRatio: e.target.value as ImageGenSettings['aspectRatio'] })}
          className="bg-surface-2 border border-divider text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {effectiveAspectRatios.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">清晰度：</span>
        <select
          value={imageSettings.imageResolution}
          onChange={e => useSettingsStore.getState().setImageSettings({ imageResolution: e.target.value as ImageGenSettings['imageResolution'] })}
          className="bg-surface-2 border border-divider text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {effectiveResolutions.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：镜头列表 */}
        <div className="w-64 bg-surface-1 flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-divider shrink-0">
            <button
              onClick={() => setSelectedItems(rows.length > 0 ? new Set(rows.map(r => r.index)) : new Set())}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >全选</button>
            <button onClick={() => setSelectedItems(new Set())} className="text-xs text-gray-500 hover:text-gray-300">清除</button>
            <button
              onClick={handleBatchGenerate}
              disabled={batchGenerating || selectedItems.size === 0}
              className="btn-press ml-auto text-xs bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded disabled:opacity-50"
            >
              {batchGenerating ? (batchStatus || '生成中...') : `批量生图(${selectedItems.size})`}
            </button>
            <button
              onClick={() => setShowGridModal(true)}
              disabled={rows.length === 0}
              className="btn-press text-xs bg-indigo-700 hover:bg-indigo-600 text-white px-2 py-1 rounded disabled:opacity-50"
              title="宫格生成"
            >
              宫格
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            {rows.length === 0 && (
              <div className="p-4 text-xs text-gray-600 text-center">请先选择分镜来源</div>
            )}
            {rows.map(row => (
              <div
                key={row.index}
                onClick={() => handleSelectRow(row)}
                className={`flex items-start gap-2 p-2.5 cursor-pointer border-b border-divider/60 hover:bg-surface-3/50 transition-colors ${
                  selectedRow?.index === row.index ? 'bg-surface-2 border-l-2 border-l-indigo-500' : ''
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedItems.has(row.index)}
                  onChange={e => {
                    e.stopPropagation()
                    setSelectedItems(prev => {
                      const next = new Set(prev)
                      e.target.checked ? next.add(row.index) : next.delete(row.index)
                      return next
                    })
                  }}
                  className="mt-0.5 shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5">
                    <span className="text-xs text-gray-500">#{row.index + 1}</span>
                    <span className="text-xs text-gray-400">{row.time}</span>
                    <span className="text-xs text-indigo-500/80">{row.shotType}</span>
                    {generatedImages[row.index] && (
                      <span className="ml-auto text-green-400 text-xs">✓</span>
                    )}
                  </div>
                  {generatedImages[row.index] ? (
                    <img src={generatedImages[row.index]} alt="缩略图"
                      className="w-full h-16 object-cover rounded"
                    />
                  ) : (
                    <p className="text-xs text-gray-500 truncate">{row.scene}</p>
                  )}
                  {generating[row.index] && (
                    <div className="text-xs text-indigo-400 animate-pulse mt-1">生成中...</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 右侧：生图面板 */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {!selectedRow ? (
            <div className="flex items-center justify-center h-full text-gray-600 text-sm">
              从左侧选择一个镜头以开始生图
            </div>
          ) : (
            <div className="flex flex-1 min-h-0 overflow-hidden">
              {/* 生图控制区：占满全宽，文本框 flex-1 填满，底部固定参考图+按钮 */}
              <div className="flex-1 flex flex-col p-4 min-h-0">

                {/* 镜头标题 */}
                <div className="text-sm text-gray-300 font-semibold mb-3 shrink-0">
                  镜头 #{selectedRow.index + 1} · {selectedRow.time} · {selectedRow.shotType}
                </div>

                {/* 提示词编辑：flex-1 让文本框撑满剩余高度 */}
                <div className="flex-1 flex flex-col min-h-0 mb-3">
                  <div className="flex items-center justify-between mb-1.5 shrink-0">
                    <label className="text-xs text-gray-400">提示词（可编辑）</label>
                    <button
                      onClick={() => {
                        setEditedPrompt(originalPrompt)
                        setError('')
                        if (selectedRow) {
                          shotStore.setEditedPrompt(selectedRow.index, originalPrompt)
                          void persistShotPrompt(selectedRow.index, originalPrompt)
                        }
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300"
                    >
                      ↺ 恢复原始
                    </button>
                  </div>
                  <textarea
                    value={editedPrompt}
                    onChange={e => {
                      setEditedPrompt(e.target.value)
                      if (selectedRow) shotStore.setEditedPrompt(selectedRow.index, e.target.value)
                    }}
                    onBlur={() => {
                      if (!selectedRow) return
                      void persistShotPrompt(selectedRow.index, editedPrompt)
                    }}
                    className="flex-1 min-h-0 w-full bg-surface-2 border border-divider text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand-500/40 focus:border-brand-500/60 resize-none"
                  />
                </div>

                {/* 参考图区域 */}
                <div className="shrink-0 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400">参考图</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setShowRefPicker(true)}
                        className="text-xs text-indigo-500 hover:text-indigo-400 px-2 py-0.5 rounded border border-indigo-800 hover:border-indigo-600 transition-colors"
                      >
                        + 素材库
                      </button>
                      <button
                        onClick={() => localUploadInputRef.current?.click()}
                        className="text-xs text-indigo-400 hover:text-indigo-300 px-2 py-0.5 rounded border border-indigo-800 hover:border-indigo-600 transition-colors"
                      >
                        + 本地上传
                      </button>
                      <input
                        ref={localUploadInputRef}
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={e => {
                          const files = Array.from(e.target.files ?? [])
                          files.forEach(file => {
                            const reader = new FileReader()
                            reader.onload = ev => {
                              const dataUrl = ev.target?.result as string
                              const [header, base64] = dataUrl.split(',')
                              const mimeType = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
                              setLocalUploads(prev => [...prev, {
                                id: `local_${Date.now()}_${Math.random()}`,
                                base64,
                                mimeType,
                                name: file.name,
                              }])
                            }
                            reader.readAsDataURL(file)
                          })
                          e.target.value = ''
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 overflow-x-auto pb-1 min-h-[44px] items-start">
                    {currentDisplayRefs.map(ref => ref.kind === 'material' ? (
                      <div key={ref.key} className={`relative flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs shrink-0 ${
                        ref.source === '自动'
                          ? 'bg-surface-2'
                          : 'bg-indigo-900/30 border border-indigo-800/50'
                      }`}>
                        {ref.source === '自动' && ref.tag ? (
                          <input
                            type="checkbox"
                            checked={refImageChecks[ref.tag] !== false}
                            onChange={e => setRefImageChecks(prev => ({ ...prev, [ref.tag!]: e.target.checked }))}
                          />
                        ) : null}
                        <img
                          src={ref.imageUrl}
                          alt={ref.name}
                          className="w-8 h-8 object-cover rounded cursor-zoom-in"
                          onClick={() => setLightboxSrc(ref.imageUrl)}
                        />
                        <div>
                          <div className="text-gray-200 leading-tight">{ref.name}</div>
                          <div className={`text-[10px] ${ref.source === '自动' ? 'text-gray-500' : 'text-indigo-600'}`}>
                            {ref.typeLabel} · {ref.source}
                          </div>
                        </div>
                        {ref.source === '手动' ? (
                          <button
                            onClick={() => setManualRefs(prev => prev.filter(item => item.imageFileId !== ref.imageFileId))}
                            className="absolute -top-1 -right-1 w-4 h-4 bg-surface-3 hover:bg-red-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-[9px]"
                          >✕</button>
                        ) : null}
                      </div>
                    ) : (
                      <div key={ref.key} className="relative flex items-center gap-1.5 bg-indigo-900/30 border border-indigo-800/50 rounded-lg px-2 py-1.5 text-xs shrink-0">
                        <img
                          src={ref.imageUrl}
                          alt={ref.name}
                          className="w-8 h-8 object-cover rounded cursor-zoom-in"
                          onClick={() => setLightboxSrc(ref.imageUrl)}
                        />
                        <div>
                          <div className="text-gray-200 leading-tight truncate max-w-[60px]">{ref.name}</div>
                          <div className="text-indigo-400 text-[10px]">{ref.source}</div>
                        </div>
                        <button
                          onClick={() => setLocalUploads(prev => prev.filter(item => item.id !== ref.id))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-surface-3 hover:bg-red-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-[9px]"
                        >✕</button>
                      </div>
                    ))}
                    {currentDisplayRefs.length === 0 && (
                      <p className="text-xs text-gray-600 self-center">未匹配到 @标签素材，可手动添加</p>
                    )}
                  </div>
                </div>

                {error && <p className="text-xs text-red-400 mb-2 shrink-0">{error}</p>}

                {/* 操作按钮 */}
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={handleRefine}
                    disabled={refining || !!generating[selectedRow.index]}
                    className="flex-1 py-2 bg-surface-2 hover:bg-surface-3 text-gray-200 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {refining ? '✨ 精炼中...' : '✨ AI 精炼'}
                  </button>
                  <button
                    onClick={() => handleGenerate(selectedRow.index)}
                    disabled={!!generating[selectedRow.index] || refining}
                    className="btn-press flex-1 py-2 bg-brand-600 hover:bg-brand-500 text-white text-sm font-medium rounded-lg transition-colors shadow-sm shadow-brand-600/20 disabled:opacity-50"
                  >
                    {generating[selectedRow.index] ? '🎨 生成中...' : '🎨 开始生图'}
                  </button>
                </div>
              </div>

              {/* 预览区：固定宽度 */}
              <div className="w-72 bg-surface-1 flex flex-col p-4 shrink-0">
                <div className="text-xs text-gray-400 mb-2">预览</div>
                {generatedImages[selectedRow.index] ? (
                  <div className="flex flex-col gap-2">
                    <img
                      src={generatedImages[selectedRow.index]}
                      alt="生成结果"
                      className="w-full rounded-lg cursor-pointer"
                      onClick={() => setLightboxSrc(generatedImages[selectedRow.index])}
                    />
                    <a
                      href={generatedImages[selectedRow.index]}
                      download={`shot_${selectedRow.index + 1}.jpg`}
                      className="text-center text-xs py-1.5 bg-surface-2 hover:bg-surface-3 text-gray-300 rounded-lg"
                    >
                      ⬇ 下载
                    </a>
                    <button
                      onClick={() => handleGenerate(selectedRow.index)}
                      disabled={!!generating[selectedRow.index] || refining}
                      className="text-xs py-1.5 bg-surface-2 hover:bg-surface-3 text-gray-300 rounded-lg disabled:opacity-50"
                    >
                      🔄 重生成
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-700 text-xs border border-dashed border-divider rounded-lg gap-1">
                    <span className="text-2xl">🖼</span>
                    <span>待生成</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 底部画廊 */}
      {(Object.keys(generatedImages).length > 0 || dbImages.length > 0) && (
        <div className="border-t border-divider bg-surface-1 p-3 shrink-0">
          {/* 分镜图 */}
          <div className="flex items-center gap-1 mb-2">
            {(() => {
              const shotImageEntries = Object.entries(useShotStore.getState().shotImages)
              const count = shotImageEntries.length
              return (
                <button
                  type="button"
                  className="px-2 py-0.5 text-xs rounded-full border transition-colors bg-indigo-600 border-indigo-600 text-white"
                >
                  分镜图（{count}）
                </button>
              )
            })()}
            <button
              onClick={() => {
                const rec = history.find(h => h.id === selectedHistoryId)
                if (rec?.projectId) loadGalleryImages(rec.projectId, rec.episodeId)
              }}
              className="ml-auto text-xs text-gray-500 hover:text-gray-300"
              title="刷新画廊"
            >
              ↻
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {/* 每个镜头只显示最新的一张图 */}
            {Object.entries(shotStore.shotImages)
              .sort(([a], [b]) => Number(a) - Number(b))
              .map(([idx, info]) => (
                <div key={`shot-${idx}`} className="relative shrink-0 group">
                  <img
                    src={info.url}
                    alt={`镜头${Number(idx) + 1}`}
                    className="h-20 w-20 object-cover rounded-lg cursor-pointer"
                    onClick={() => setLightboxSrc(info.url)}
                  />
                  <div className="absolute top-0 left-0 text-xs px-1 rounded-tl-lg bg-black/60 text-white">
                    #{Number(idx) + 1}
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 灯箱 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="放大" className="max-h-full max-w-full rounded-lg" />
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">✕</button>
        </div>
      )}

      {/* 宫格生成 Modal */}
      {showGridModal && (() => {
        const rec = history.find(h => h.id === selectedHistoryId)
        return (
          <GridModal
            open={showGridModal}
            shots={rows.map(r => ({
              time: r.time, shotType: r.shotType, camera: '',
              scene: r.scene, lighting: '', drama: '', prompt: r.prompt,
            }))}
            styleKey={styleKey}
            projectId={rec?.projectId}
            episodeId={rec?.episodeId}
            onClose={handleCloseGridModal}
            onGridSaved={(url) => {
              setDbImages(prev => [...prev, { id: Date.now(), url, refType: 'grid' }])
            }}
          />
        )
      })()}

      {/* 素材库参考图选择弹窗 */}
      <RefImagePickerModal
        open={showRefPicker}
        onClose={() => setShowRefPicker(false)}
        selectedRefs={manualRefs}
        onConfirm={refs => setManualRefs(refs)}
      />
        </>
      </div>
    </div>
  )
}

export default ImageGenPage
