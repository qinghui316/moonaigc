import React, { useState, useCallback, useEffect, useMemo } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { useMaterialStore } from '../../store/useMaterialStore'
import { useHistoryStore } from '../../store/useHistoryStore'
import { useShotStore } from '../../store/useShotStore'
import { useProjectStore } from '../../store/useProjectStore'
import { parseTableRows } from '../../utils/parseTable'
import { parseSeedanceFields, buildStructuredInput, buildDirectImagePrompt, refinePromptViaAI } from '../../services/imagePrompt'
import { callImageGenAPI, uploadExternalImageUrl } from '../../services/imageGen'
import { collectRefImages, buildRefImageDescs, loadRefImageBase64s, clearRefImageCache } from '../../services/refImageCollector'
import { STYLE_MAP } from '../../data/styleMap'
import { IMAGE_PLATFORMS } from '../../data/platforms'
import { GLOBAL_NEGATIVE_PROMPT, GLOBAL_NEGATIVE_PROMPT_INLINE, STYLE_NEGATIVE_PROMPTS } from '../../data/negativePrompts'
import GridModal from './GridModal'
import type { ShotData, ImageGenSettings } from '../../types'

interface ShotRow {
  index: number
  time: string
  shotType: string
  scene: string
  prompt: string
  cells: string[]
}

const ImageGenPage: React.FC<{ selectedRowIndex?: number | null }> = ({ selectedRowIndex }) => {
  const { textSettings, imageSettings } = useSettingsStore()
  const materialStore = useMaterialStore()
  const { records: history } = useHistoryStore()
  const shotStore = useShotStore()
  const { projects, episodes, loadProjects, selectProject } = useProjectStore()

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
  const [showGridModal, setShowGridModal] = useState(false)

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
    // 从 store 恢复已生成的图片（loadShotsFromDB 已更新 shotImages）
    const imgs: Record<number, string> = {}
    const latestImages = useShotStore.getState().shotImages
    for (const [k, v] of Object.entries(latestImages)) {
      imgs[Number(k)] = v.url
    }
    setGeneratedImages(imgs)
  }, [history, shotStore])

  const handleSelectRow = useCallback((row: ShotRow) => {
    setSelectedRow(row)
    setError('')
    // 自动构建结构化提示词
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
    const structured = buildStructuredInput(fields, styleName, row.scene)
    setEditedPrompt(structured)
    setOriginalPrompt(structured)  // 保存原始，供"恢复原始"使用

    // 自动联动参考图
    const materials = materialStore.materials
    const refs = collectRefImages(row.prompt, materials)
    const checks: Record<string, boolean> = {}
    refs.forEach(r => { checks[r.tag] = true })
    setRefImageChecks(checks)
  }, [selectedHistoryId, history, styleKey, materialStore.materials])

  // AI精炼：将当前提示词精炼后写回文本框，供用户预览/修改
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
      const refs = collectRefImages(row.prompt, materials).filter(r => refImageChecks[r.tag] !== false)
      const finalPrompt = customPrompt ?? editedPrompt

      const refBase64s = await loadRefImageBase64s(refs)
      const refImageIds = refs.map(r => r.imageFileId)
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
        const uploadResp = await fetch('/api/media/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            base64: result.b64, mimeType: 'image/jpeg', refType: 'shot',
            ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
          }),
        })
        if (uploadResp.ok) {
          const uploadData = await uploadResp.json() as { id: number; url: string }
          imgUrl = uploadData.url
          mediaFileId = uploadData.id
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt, mediaFileId })
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
        const uploaded = await uploadExternalImageUrl(imgUrl, {
          refType: 'shot',
          ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
        })
        if (uploaded) {
          imgUrl = uploaded.url
          mediaFileId = uploaded.id
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt, mediaFileId })
          if (shotId) {
            fetch(`/api/shots/${shotId}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageFileId: mediaFileId, prompt: finalPrompt }),
            }).catch(() => {/* ignore */})
          }
        } else {
          shotStore.setShotImage(rowIndex, { url: imgUrl, prompt: finalPrompt })
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
      const refs = collectRefImages(row.prompt, materials)
      const refDescs = buildRefImageDescs(refs)
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
      let structured = buildStructuredInput(fields, styleName, row.scene)

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
        const refBase64s = await loadRefImageBase64s(refs)
        const refImageIds = refs.map(r => r.imageFileId)
        // 将前一镜图片插入参考图最前
        const chainRefs = prevImageB64
          ? [{ base64: prevImageB64, mimeType: 'image/jpeg' }, ...refBase64s]
          : refBase64s
        const result = await callImageGenAPI(imageSettings, structured, chainRefs, negativePrompt, refImageIds)
        clearRefImageCache()

        let imgUrl = result.url
        let curB64 = result.b64

        const shotId = useShotStore.getState().shotIds[idx]

        if (!imgUrl && curB64) {
          const uploadResp = await fetch('/api/media/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              base64: curB64, mimeType: 'image/jpeg', refType: 'shot',
              ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
            }),
          })
          if (uploadResp.ok) {
            const uploadData = await uploadResp.json() as { id: number; url: string }
            imgUrl = uploadData.url
            shotStore.setShotImage(idx, { url: imgUrl, prompt: structured, mediaFileId: uploadData.id })
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
          const uploaded = await uploadExternalImageUrl(imgUrl, {
            refType: 'shot',
            ...(selectedHistoryId ? { refId: String(selectedHistoryId) } : {}),
          })
          if (uploaded) {
            imgUrl = uploaded.url
            shotStore.setShotImage(idx, { url: imgUrl, prompt: structured, mediaFileId: uploaded.id })
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
          // 取 b64 供下一镜链式参考
          try {
            const { fetchAssetImageAsBase64 } = await import('../../services/imageGen')
            const asB64 = await fetchAssetImageAsBase64(imgUrl)
            curB64 = asB64.base64
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
      const recs = history.filter(h => h.episodeId === ep.id)
      const latest = recs.length > 0 ? recs.reduce((a, b) => (b.id > a.id ? b : a)) : null
      return { episode: ep, record: latest }
    })
  }, [episodes, history, selectedProjectId])

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

  return (
    <div className="flex flex-col h-full bg-gray-950 text-white">
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
                className="bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg focus:outline-none focus:border-amber-500 flex-1 max-w-xs"
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
                    onChange={e => setEditedPrompt(e.target.value)}
                    className="flex-1 min-h-0 w-full bg-gray-800 border border-gray-700 text-gray-200 text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-amber-500 resize-none"
                  />
                </div>

                {/* 参考图：固定高度，超出可横向滚动 */}
                <div className="shrink-0 mb-3">
                  <div className="text-xs text-gray-400 mb-1.5">参考图（自动从素材库匹配）</div>
                  {allMatchedRefs.length === 0 ? (
                    <div className="flex gap-2 h-14 items-center">
                      <div className="w-10 h-10 rounded bg-gray-800 border border-dashed border-gray-700 flex items-center justify-center text-gray-600 text-lg shrink-0">+</div>
                      <p className="text-xs text-gray-600">当前镜头未匹配到素材库中的角色/场景/道具</p>
                    </div>
                  ) : (
                    <div className="flex gap-2 overflow-x-auto pb-1">
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
                            <div className="text-gray-500 text-[10px]">{ref.typeLabel}</div>
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
                    </div>
                  )}
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
      {Object.keys(generatedImages).length > 0 && (
        <div className="border-t border-gray-800 p-3 shrink-0">
          <div className="text-xs text-gray-400 mb-2">图片画廊（{Object.keys(generatedImages).length} 张）</div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {Object.entries(generatedImages).map(([idx, url]) => (
              <div key={idx} className="relative shrink-0 group">
                <img
                  src={url}
                  alt={`镜头${Number(idx) + 1}`}
                  className="h-20 w-20 object-cover rounded-lg cursor-pointer"
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
      {showGridModal && (
        <GridModal
          shots={rows.map(r => ({
            time: r.time, shotType: r.shotType, camera: '',
            scene: r.scene, lighting: '', drama: '', prompt: r.prompt,
          }))}
          styleKey={styleKey}
          onClose={() => setShowGridModal(false)}
        />
      )}
    </div>
  )
}

export default ImageGenPage
