import type { ImageGenSettings } from '../types'

interface RefImageData {
  base64: string
  mimeType: string
}

interface ImageGenResult {
  url?: string
  b64?: string
}

// 通过后端代理调用图片生成 API
export async function callImageGenAPI(
  settings: ImageGenSettings,
  prompt: string,
  refImages?: RefImageData[],
  negativePrompt?: string,
  refImageIds?: number[],
  signal?: AbortSignal,
): Promise<ImageGenResult> {
  const resp = await fetch('/api/ai/image', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ settings, prompt, refImages, negativePrompt, refImageIds }),
    signal,
  })
  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`图片生成失败 ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = await resp.json() as Record<string, unknown>

  // 统一解析响应格式
  if (data.data && Array.isArray(data.data) && (data.data as Record<string, unknown>[])[0]) {
    const first = (data.data as Record<string, unknown>[])[0]
    return {
      url: first.url as string | undefined,
      b64: first.b64_json as string | undefined,
    }
  }
  // Nano Banana / Gemini generateContent 响应格式
  if (data.candidates && Array.isArray(data.candidates)) {
    const candidate = (data.candidates as Record<string, unknown>[])[0]
    const content = candidate?.content as Record<string, unknown> | undefined
    const parts = content?.parts as Record<string, unknown>[] | undefined
    if (parts) {
      for (const part of parts) {
        // 兼容 camelCase (inlineData) 和 snake_case (inline_data)
        const imgData = (part.inlineData ?? part.inline_data) as Record<string, unknown> | undefined
        if (imgData) return { b64: imgData.data as string }
      }
    }
  }
  // RunningHub 直接返回 results 数组（后端轮询完成后统一转换为此格式）
  if (data.results && Array.isArray(data.results) && (data.results as Record<string, unknown>[])[0]) {
    const first = (data.results as Record<string, unknown>[])[0]
    if (first.url) return { url: first.url as string }
  }
  throw new Error('无法解析图片生成响应')
}

// 将外部图片 URL 交给后端下载并存入数据库（避免浏览器 CORS 限制）
export async function uploadExternalImageUrl(
  externalUrl: string,
  opts: { refType?: string; refId?: string; filename?: string; projectId?: string; episodeId?: string } = {},
  signal?: AbortSignal,
): Promise<{ url: string; id: number; base64?: string; mimeType?: string } | null> {
  try {
    const uploadResp = await fetch('/api/media/upload-from-url', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: externalUrl, ...opts }),
      signal,
    })
    if (!uploadResp.ok) return null
    return await uploadResp.json() as { url: string; id: number; base64?: string; mimeType?: string }
  } catch {
    return null
  }
}

// 从 /api/media/:id/file 获取资产图片并转为 base64
export async function fetchAssetImageAsBase64(imageUrl: string): Promise<RefImageData> {
  const resp = await fetch(imageUrl)
  if (!resp.ok) throw new Error(`获取参考图失败: ${resp.status}`)
  const blob = await resp.blob()
  const mimeType = blob.type || 'image/jpeg'
  const arrayBuf = await blob.arrayBuffer()
  const uint8 = new Uint8Array(arrayBuf)
  let binary = ''
  for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
  return { base64: btoa(binary), mimeType }
}
