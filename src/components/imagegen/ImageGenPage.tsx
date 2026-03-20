import React, { useState, useCallback, useEffect, useMemo } from 'react'
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

interface ShotRow {
  index: number
  time: string
  shotType: string
  scene: string
  prompt: string
  cells: string[]
}

const ImageGenPage: React.FC<{ selectedRowIndex?: number | null }> = ({ selectedRowIndex = null }) => {
  const { textSettings, imageSettings } = useSettingsStore()
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
  const [styleKey, setStyleKey] = useState('cinematic')
  const [selectedItems, setSelectedItems] = useState<Set<number>>(new Set())
  const [batchGenerating, setBatchGenerating] = useState(false)
  const [batchStatus, setBatchStatus] = useState('')
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null)
  const [pageMode, setPageMode] = useState<'shots' | 'grid'>('shots')
  const [showGridModal, setShowGridModal] = useState(false)
  useEffect(() => {
    if (pageMode !== 'grid') return
    const updates: Partial<ImageGenSettings> = {}
    if (effectiveAspectRatios.includes('16:9') && imageSettings.aspectRatio !== '16:9') updates.aspectRatio = '16:9'
    if (effectiveResolutions.some(item => item.value === '4K') && imageSettings.imageResolution !== '4K') updates.imageResolution = '4K'
    if (Object.keys(updates).length > 0) useSettingsStore.getState().setImageSettings(updates)
  }, [pageMode, effectiveAspectRatios, effectiveResolutions, imageSettings.aspectRatio, imageSettings.imageResolution])
  // 手动参考图管理
  const [manualRefs, setManualRefs] = useState<ManualRefItem[]>([])
  const [localUploads, setLocalUploads] = useState<{ id: string; base64: string; mimeType: string; name: string }[]>([])
  const [showRefPicker, setShowRefPicker] = useState(false)
  const localUploadInputRef = React.useRef<HTMLInputElement>(null)
  // 底部画廊
  const [galleryTab, setGalleryTab] = useState<'all' | 'shot' | 'grid'>('all')
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
    setDbImages(data.items.filter(d => d.refType === 'shot' || d.refType === 'grid'))
  }, [])

  const loadHistory = useCallback(async (id: number) => {
    setSelectedHistoryId(id)
    const rec = history.find(h => h.id === id)
    if (!rec) return
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
    // 切换历史记录时清空旧的提示词缓存
    shotStore.clearEditedPrompts()
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

  useEffect(() => {
    if (!selectedRow) return
    const autoRefs = collectRefImages(selectedRow.prompt, materialStore.materials)
      .filter(ref => refImageChecks[ref.tag] !== false)
      .map(ref => ({
        name: ref.name,
        type: ref.type,
        desc: ref.desc,
        imageUrl: ref.imageUrl,
        imageFileId: ref.imageFileId,
      }))
    const seenIds = new Set(autoRefs.map(ref => ref.imageFileId))
    const mergedMaterialRefs = [
      ...autoRefs,
      ...manualRefs.filter(ref => !seenIds.has(ref.imageFileId)),
    ]
    setSelectedMaterialRefs(selectedRow.index, mergedMaterialRefs)
    setSelectedLocalRefs(selectedRow.index, localUploads)
  }, [selectedRow, materialStore.materials, refImageChecks, manualRefs, localUploads, setSelectedLocalRefs, setSelectedMaterialRefs])

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
    } catch (e) {
      setError(`AI精炼失败：${String(e)}`)
    }
    setRefining(false)
  }, [selectedRow, editedPrompt, textSettings, materialStore.materials, refImageChecks])

  const handleGenerate = useCallback(async (rowIndex: number, customPrompt?: string) => {
    if (!imageSettings.key) { setError('请在设置中配置图片生成 API Key'); return }
    setError('')
    setGenerating(prev => ({ ...prev, [rowIndex]: true }))
    try {
      const row = rows[rowIndex]
      if (!row) return

      const materials = materialStore.materials
      const autoRefs = collectRefImages(row.prompt, materials).filter(r => refImageChecks[r.tag] !== false)
      // 合并自动匹配 + 手动添加的素材库参考图（按 imageFileId 去重）
      const seenIds = new Set(autoRefs.map(r => r.imageFileId))
      const extraRefs = manualRefs.filter(r => !seenIds.has(r.imageFileId))
      const allMaterialRefs = [...autoRefs, ...extraRefs.map(r => ({ ...r, tag: `@${r.name}` }))]
      const finalPrompt = customPrompt ?? editedPrompt

      const refBase64s = [
        ...await loadRefImageBase64s(allMaterialRefs),
        ...localUploads.map(u => ({ base64: u.base64, mimeType: u.mimeType })),
      ]
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
  }, [rows, imageSettings, editedPrompt, refImageChecks, materialStore.materials, shotStore, selectedHistoryId])

  const handleBatchGenerate = useCallback(async () => {
    if (selectedItems.size === 0) { setError('请先选择要生成的镜头'); return }
    setBatchGenerating(true)
    setError('')
    const total = selectedItems.size
    let done = 0
    let prevImageB64: string | undefined

    for (const idx of [...selectedItems].sort((a, b) => a - b)) {
      const row = rows[idx]
      if (!row) continue
      done++
      const materials = materialStore.materials
      const autoRefs = collectRefImages(row.prompt, materials)
      // 合并手动添加参考图（去重）
      const seenIds2 = new Set(autoRefs.map(r => r.imageFileId))
      const refs = [...autoRefs, ...manualRefs.filter(r => !seenIds2.has(r.imageFileId)).map(r => ({ ...r, tag: `@${r.name}` }))]
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

      // 每张图先 AI 精炼
      if (textSettings.key) {
        setBatchStatus(`✨ AI精炼提示词 (${done}/${total})`)
        try {
          structured = await refinePromptViaAI(structured, textSettings, buildRefImageDescs(refs))
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
        const materialBase64s = await loadRefImageBase64s(refs)
        const refImageIds = refs.map(r => r.imageFileId)
        // 将前一镜图片插入参考图最前，本地上传追加到末尾
        const chainRefs = [
          ...(prevImageB64 ? [{ base64: prevImageB64, mimeType: 'image/jpeg' }] : []),
          ...materialBase64s,
          ...localUploads.map(u => ({ base64: u.base64, mimeType: u.mimeType })),
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
          // 取 b64 供下一镜链式参考（同时作为 DB 存储的 fallback）
          try {
            const { fetchAssetImageAsBase64 } = await import('../../services/imageGen')
            const asB64 = await fetchAssetImageAsBase64(imgUrl)
            curB64 = asB64.base64
            // 若 uploadExternalImageUrl 失败，用 base64 兜底入库
            if (!uploaded && curB64) {
              const fallbackResp = await fetch('/api/media/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  base64: curB64, mimeType: asB64.mimeType, refType: 'shot',
                  ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
                  ...(batchRec?.projectId ? { projectId: batchRec.projectId } : {}),
                  ...(batchRec?.episodeId ? { episodeId: batchRec.episodeId } : {}),
                }),
              })
              if (fallbackResp.ok) {
                const fd = await fallbackResp.json() as { id: number; url: string }
                imgUrl = fd.url
                shotStore.setShotImage(idx, { url: imgUrl, prompt: structured, mediaFileId: fd.id })
                setDbImages(prev => [...prev, { id: fd.id, url: fd.url, refType: 'shot' }])
              }
            }
          } catch { curB64 = undefined }
        }

        if (imgUrl) setGeneratedImages(prev => ({ ...prev, [idx]: imgUrl! }))
        // 缓存本镜 b64 作为下一镜参考
        prevImageB64 = curB64
      } catch (e) {
        setError(String(e))
        prevImageB64 = undefined
      }
    }
    clearRefImageCache()
    setBatchGenerating(false)
    setBatchStatus('')
  }, [selectedItems, rows, materialStore.materials, selectedHistoryId, history, styleKey, textSettings, imageSettings, shotStore])

  // 进入项目模式时加载项目列表
  useEffect(() => {
    if (sourceMode === 'project') loadProjects()
  }, [sourceMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (sourceMode !== 'project') return
    if (currentProject?.id && selectedProjectId !== currentProject.id) {
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
    if (!currentProject?.id || !currentEpisode?.id) return
    if (selectedProjectId !== currentProject.id) return
    const latest = latestRecordForEpisode(currentEpisode.id)
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

  // 有资产图的参考图（可勾选传给 API）
  const currentRefs = selectedRow
    ? collectRefImages(selectedRow.prompt, materialStore.materials)
    : []

  // 所有匹配到的 @标签素材（含无图的，用于展示）
  const allMatchedRefs = useMemo(() => {
    if (!selectedRow) return []
    const tagRe = /@([^\s[\]（()]+)/g
    const tags = new Set<string>()
    let m: RegExpExecArray | null
    while ((m = tagRe.exec(selectedRow.prompt)) !== null) tags.add(m[1])
    const result: { tag: string; name: string; typeLabel: string; imageUrl?: string; hasImage: boolean }[] = []
    const typeLabels: Record<string, string> = { character: '角色', image: '场景', props: '道具' }
    for (const tag of tags) {
      for (const t of ['character', 'image', 'props'] as const) {
        const slot = materialStore.materials[t].find(s => s.name === tag)
        if (slot) {
          result.push({
            tag: `@${tag}`,
            name: slot.name,
            typeLabel: typeLabels[t],
            imageUrl: slot.imageUrl,
            hasImage: !!(slot.imageUrl && slot.imageFileId),
          })
          break
        }
      }
    }
    return result
  }, [selectedRow, materialStore.materials])

  const handleCloseGridModal = useCallback(() => {
    setShowGridModal(false)
    if (!selectedRow) return
    const saved = useShotStore.getState().editedPrompts[selectedRow.index]
    if (saved) setEditedPrompt(saved)
  }, [selectedRow])

  void currentRefs

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800 shrink-0">
        <button
          onClick={() => setPageMode('shots')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            pageMode === 'shots' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          普通镜头生图
        </button>
        <button
          onClick={() => setPageMode('grid')}
          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
            pageMode === 'grid' ? 'bg-purple-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'
          }`}
        >
          宫格生图模式
        </button>
      </div>

      {pageMode === 'grid' ? (
        <GridResultWorkspace styleKey={styleKey} onStyleChange={setStyleKey} />
      ) : (
        <>
      {/* 顶部：选择分镜来源 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 shrink-0 flex-wrap">
        {/* 来源模式切换 */}
        <div className="flex rounded-lg overflow-hidden border border-gray-700 shrink-0">
          <button
            onClick={() => setSourceMode('project')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === 'project' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
          >
            项目剧集
          </button>
          <button
            onClick={() => setSourceMode('history')}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${sourceMode === 'history' ? 'bg-amber-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-gray-200'}`}
          >
            历史记录
          </button>
        </div>

        {sourceMode === 'history' ? (
          /* 历史记录模式 */
          <select
            value={selectedHistoryId ?? ''}
            onChange={e => e.target.value && loadHistory(Number(e.target.value))}
            className="bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 flex-1 max-w-xs"
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
              disabled={!!currentProject}
              className="bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 max-w-[160px]"
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
                disabled={!!currentEpisode}
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 flex-1 max-w-xs disabled:opacity-60"
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
          onChange={e => setStyleKey(e.target.value)}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {Object.entries(STYLE_MAP).map(([k, v]) => (
            <option key={k} value={k}>{v.slice(0, 12)}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">比例：</span>
        <select
          value={imageSettings.aspectRatio}
          onChange={e => useSettingsStore.getState().setImageSettings({ aspectRatio: e.target.value as ImageGenSettings['aspectRatio'] })}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {effectiveAspectRatios.map(r => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <span className="text-xs text-gray-500">清晰度：</span>
        <select
          value={imageSettings.imageResolution}
          onChange={e => useSettingsStore.getState().setImageSettings({ imageResolution: e.target.value as ImageGenSettings['imageResolution'] })}
          className="bg-gray-800 border border-gray-700 text-gray-200 text-xs px-2 py-1.5 rounded-lg focus:outline-none"
        >
          {effectiveResolutions.map(r => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 左侧：镜头列表 */}
        <div className="w-64 border-r border-gray-800 flex flex-col overflow-hidden shrink-0">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-800 shrink-0">
            <button
              onClick={() => setSelectedItems(rows.length > 0 ? new Set(rows.map(r => r.index)) : new Set())}
              className="text-xs text-amber-400 hover:text-amber-300"
            >全选</button>
            <button onClick={() => setSelectedItems(new Set())} className="text-xs text-gray-500 hover:text-gray-300">清除</button>
            <button
              onClick={handleBatchGenerate}
              disabled={batchGenerating || selectedItems.size === 0}
              className="ml-auto text-xs bg-amber-600 hover:bg-amber-500 text-white px-2 py-1 rounded disabled:opacity-50"
            >
              {batchGenerating ? (batchStatus || '生成中...') : `批量生图(${selectedItems.size})`}
            </button>
            <button
              onClick={() => setShowGridModal(true)}
              disabled={rows.length === 0}
              className="text-xs bg-purple-700 hover:bg-purple-600 text-white px-2 py-1 rounded disabled:opacity-50"
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
                className={`flex items-start gap-2 p-2.5 cursor-pointer border-b border-gray-800 hover:bg-gray-800/60 transition-colors ${
                  selectedRow?.index === row.index ? 'bg-gray-800/80 border-l-2 border-l-amber-500' : ''
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
                    <span className="text-xs text-amber-500/80">{row.shotType}</span>
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
                    <div className="text-xs text-amber-400 animate-pulse mt-1">生成中...</div>
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
                <div className="text-sm text-gray-300 font-medium mb-3 shrink-0">
                  镜头 #{selectedRow.index + 1} · {selectedRow.time} · {selectedRow.shotType}
                </div>

                {/* 提示词编辑：flex-1 让文本框撑满剩余高度 */}
                <div className="flex-1 flex flex-col min-h-0 mb-3">
                  <div className="flex items-center justify-between mb-1.5 shrink-0">
                    <label className="text-xs text-gray-400">提示词（可编辑）</label>
                    <button
                      onClick={() => { setEditedPrompt(originalPrompt); setError('') }}
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
                    className="flex-1 min-h-0 w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* 参考图区域 */}
                <div className="shrink-0 mb-3">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs text-gray-400">参考图</span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setShowRefPicker(true)}
                        className="text-xs text-amber-500 hover:text-amber-400 px-2 py-0.5 rounded border border-amber-800 hover:border-amber-600 transition-colors"
                      >
                        + 素材库
                      </button>
                      <button
                        onClick={() => localUploadInputRef.current?.click()}
                        className="text-xs text-blue-400 hover:text-blue-300 px-2 py-0.5 rounded border border-blue-800 hover:border-blue-600 transition-colors"
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
                    {/* 自动匹配的 @标签素材 */}
                    {allMatchedRefs.map(ref => ref.hasImage ? (
                      <label key={ref.tag} className="flex items-center gap-1.5 bg-gray-800 rounded-lg px-2 py-1.5 cursor-pointer text-xs shrink-0">
                        <input
                          type="checkbox"
                          checked={refImageChecks[ref.tag] !== false}
                          onChange={e => setRefImageChecks(prev => ({ ...prev, [ref.tag]: e.target.checked }))}
                        />
                        <img
                          src={ref.imageUrl}
                          alt={ref.name}
                          className="w-8 h-8 object-cover rounded cursor-zoom-in"
                          onClick={e => { e.preventDefault(); setLightboxSrc(ref.imageUrl!) }}
                        />
                        <div>
                          <div className="text-gray-200 leading-tight">{ref.name}</div>
                          <div className="text-gray-500 text-[10px]">{ref.typeLabel} · 自动</div>
                        </div>
                      </label>
                    ) : (
                      <div key={ref.tag} className="flex items-center gap-1.5 bg-gray-800/40 rounded-lg px-2 py-1.5 text-xs shrink-0 opacity-50">
                        <div className="w-8 h-8 rounded bg-gray-700 flex items-center justify-center text-gray-500">?</div>
                        <div>
                          <div className="text-gray-400 leading-tight">{ref.name}</div>
                          <div className="text-gray-600 text-[10px]">{ref.typeLabel} · 暂无图</div>
                        </div>
                      </div>
                    ))}
                    {/* 手动添加的素材库参考图 */}
                    {manualRefs.map(ref => (
                      <div key={`manual_${ref.imageFileId}`} className="relative flex items-center gap-1.5 bg-amber-900/30 border border-amber-800/50 rounded-lg px-2 py-1.5 text-xs shrink-0">
                        <img
                          src={ref.imageUrl}
                          alt={ref.name}
                          className="w-8 h-8 object-cover rounded cursor-zoom-in"
                          onClick={() => setLightboxSrc(ref.imageUrl)}
                        />
                        <div>
                          <div className="text-gray-200 leading-tight">{ref.name}</div>
                          <div className="text-amber-600 text-[10px]">手动</div>
                        </div>
                        <button
                          onClick={() => setManualRefs(prev => prev.filter(r => r.imageFileId !== ref.imageFileId))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 hover:bg-red-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-[9px]"
                        >✕</button>
                      </div>
                    ))}
                    {/* 本地上传的临时参考图 */}
                    {localUploads.map(up => (
                      <div key={up.id} className="relative flex items-center gap-1.5 bg-blue-900/30 border border-blue-800/50 rounded-lg px-2 py-1.5 text-xs shrink-0">
                        <img
                          src={`data:${up.mimeType};base64,${up.base64}`}
                          alt={up.name}
                          className="w-8 h-8 object-cover rounded cursor-zoom-in"
                          onClick={() => setLightboxSrc(`data:${up.mimeType};base64,${up.base64}`)}
                        />
                        <div>
                          <div className="text-gray-200 leading-tight truncate max-w-[60px]">{up.name}</div>
                          <div className="text-blue-400 text-[10px]">本地</div>
                        </div>
                        <button
                          onClick={() => setLocalUploads(prev => prev.filter(u => u.id !== up.id))}
                          className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 hover:bg-red-700 rounded-full flex items-center justify-center text-gray-400 hover:text-white text-[9px]"
                        >✕</button>
                      </div>
                    ))}
                    {allMatchedRefs.length === 0 && manualRefs.length === 0 && localUploads.length === 0 && (
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
                    className="flex-1 py-2 bg-purple-700 hover:bg-purple-600 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {refining ? '✨ 精炼中...' : '✨ AI 精炼'}
                  </button>
                  <button
                    onClick={() => handleGenerate(selectedRow.index)}
                    disabled={!!generating[selectedRow.index] || refining}
                    className="flex-1 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generating[selectedRow.index] ? '🎨 生成中...' : '🎨 开始生图'}
                  </button>
                </div>
              </div>

              {/* 预览区：固定宽度 */}
              <div className="w-72 border-l border-gray-800 flex flex-col p-4 shrink-0">
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
                      className="text-center text-xs py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg"
                    >
                      ⬇ 下载
                    </a>
                    <button
                      onClick={() => handleGenerate(selectedRow.index)}
                      disabled={!!generating[selectedRow.index] || refining}
                      className="text-xs py-1.5 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg disabled:opacity-50"
                    >
                      🔄 重生成
                    </button>
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-700 text-xs border border-dashed border-gray-800 rounded-lg gap-1">
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
        <div className="border-t border-gray-800 p-3 shrink-0">
          {/* 标签页 */}
          <div className="flex items-center gap-1 mb-2">
            {(['all', 'shot', 'grid'] as const).map(tab => {
              const localShotCount = Object.values(generatedImages).filter(url => !dbImages.some(d => d.url === url)).length
              const dbCount = tab === 'all'
                ? dbImages.length
                : dbImages.filter(d => d.refType === tab).length
              const count = (tab === 'all' || tab === 'shot') ? dbCount + localShotCount : dbCount
              const label = tab === 'all' ? '全部' : tab === 'shot' ? '分镜图' : '宫格图'
              return (
                <button
                  key={tab}
                  onClick={() => setGalleryTab(tab)}
                  className={`px-2 py-0.5 text-xs rounded-full border transition-colors ${galleryTab === tab ? 'bg-amber-600 border-amber-600 text-white' : 'bg-transparent border-gray-700 text-gray-400 hover:text-gray-200'}`}
                >
                  {label}（{count}）
                </button>
              )
            })}
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
            {/* DB 图片（分镜图 + 宫格图） */}
            {dbImages
              .filter(d => galleryTab === 'all' || d.refType === galleryTab)
              .map(d => (
                <div key={`db-${d.id}`} className="relative shrink-0 group">
                  <img
                    src={d.url}
                    alt={d.refType === 'grid' ? '宫格图' : '分镜图'}
                    className={`object-cover rounded-lg cursor-pointer ${d.refType === 'grid' ? 'h-20 w-32' : 'h-20 w-20'}`}
                    onClick={() => setLightboxSrc(d.url)}
                  />
                  <div className={`absolute top-0 left-0 text-xs px-1 rounded-tl-lg ${d.refType === 'grid' ? 'bg-amber-700/80 text-white' : 'bg-black/60 text-white'}`}>
                    {d.refType === 'grid' ? '宫' : '镜'}
                  </div>
                </div>
              ))}
            {/* 本次会话新生成但未持久化的图（用于提示用户已生成） */}
            {galleryTab !== 'grid' && Object.entries(generatedImages)
              .filter(([, url]) => !dbImages.some(d => d.url === url))
              .map(([idx, url]) => (
                <div key={`local-${idx}`} className="relative shrink-0 group">
                  <img
                    src={url}
                    alt={`镜头${Number(idx) + 1}`}
                    className="h-20 w-20 object-cover rounded-lg cursor-pointer opacity-70"
                    onClick={() => setLightboxSrc(url)}
                  />
                  <div className="absolute top-0 left-0 text-xs bg-black/60 text-white px-1 rounded-tl-lg">
                    #{Number(idx) + 1}
                  </div>
                  <button
                    onClick={() => {
                      setGeneratedImages(prev => { const n = { ...prev }; delete n[Number(idx)]; return n })
                      shotStore.clearShotImage(Number(idx))
                    }}
                    className="absolute top-0 right-0 text-xs bg-red-600/80 text-white px-1 rounded-tr-lg opacity-0 group-hover:opacity-100"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      {/* 灯箱 */}
      {lightboxSrc && (
        <div
          className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
          onClick={() => setLightboxSrc(null)}
        >
          <img src={lightboxSrc} alt="放大" className="max-h-full max-w-full rounded-xl" />
          <button className="absolute top-4 right-4 text-white text-2xl hover:text-gray-300">✕</button>
        </div>
      )}

      {/* 宫格生成 Modal */}
      {showGridModal && (() => {
        const rec = history.find(h => h.id === selectedHistoryId)
        return (
          <GridModal
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
      )}
    </div>
  )
}

export default ImageGenPage
