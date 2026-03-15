import { Router, Request, Response } from 'express'

const router = Router()

interface ProxySettings {
  endpoint: string
  model: string
  mode: 'openai' | 'gemini' | 'anthropic'
  key: string
}

interface ProxyBody {
  messages: Array<{ role: string; content: unknown }>
  settings: ProxySettings
  stream?: boolean
}

function buildHeaders(settings: ProxySettings): Record<string, string> {
  if (settings.mode === 'anthropic') {
    return {
      'x-api-key': settings.key,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    }
  }
  if (settings.mode === 'gemini') {
    return { 'content-type': 'application/json' }
  }
  return {
    Authorization: `Bearer ${settings.key}`,
    'content-type': 'application/json',
  }
}

function buildUrl(settings: ProxySettings): string {
  if (settings.mode === 'gemini') {
    return `${settings.endpoint}?key=${settings.key}`
  }
  return settings.endpoint
}

function buildBody(settings: ProxySettings, messages: unknown[], stream: boolean): string {
  if (settings.mode === 'anthropic') {
    const systemMsg = (messages as Array<{ role: string; content: unknown }>).find(m => m.role === 'system')
    const userMsgs = (messages as Array<{ role: string; content: unknown }>).filter(m => m.role !== 'system')
    return JSON.stringify({
      model: settings.model,
      max_tokens: 8192,
      stream,
      system: systemMsg?.content ?? '',
      messages: userMsgs.map(m => ({ role: m.role, content: m.content })),
    })
  }
  const isGemini = settings.mode === 'gemini'
  return JSON.stringify({
    model: settings.model,
    messages: (messages as Array<{ role: string; content: unknown }>).map(m => ({
      role: isGemini && m.role === 'assistant' ? 'model' : m.role,
      content: m.content,
    })),
    stream,
    max_tokens: 8192,
  })
}

// POST /api/ai/generate - non-streaming
router.post('/generate', async (req: Request, res: Response) => {
  try {
    const { messages, settings } = req.body as ProxyBody
    const url = buildUrl(settings)
    const headers = buildHeaders(settings)
    const body = buildBody(settings, messages, false)

    const upstream = await fetch(url, { method: 'POST', headers, body })
    if (!upstream.ok) {
      const text = await upstream.text()
      res.status(upstream.status).send(text)
      return
    }
    const data = await upstream.json()
    res.json(data)
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: String(err) })
    }
  }
})

// POST /api/ai/stream - SSE streaming proxy
router.post('/stream', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')

  try {
    const { messages, settings } = req.body as ProxyBody
    const url = buildUrl(settings)
    const headers = buildHeaders(settings)
    const body = buildBody(settings, messages, true)

    const upstream = await fetch(url, { method: 'POST', headers, body })

    if (!upstream.ok) {
      const text = await upstream.text()
      res.write(`data: ${JSON.stringify({ error: text })}\n\n`)
      res.end()
      return
    }

    if (!upstream.body) {
      res.end()
      return
    }

    const reader = upstream.body.getReader()
    const decoder = new TextDecoder()

    req.on('close', () => {
      reader.cancel().catch(() => {})
    })

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      res.write(decoder.decode(value, { stream: true }))
    }

    res.end()
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: String(err) })
    } else if (!res.writableEnded) {
      res.end()
    }
  }
})

// POST /api/ai/image - 图片生成代理
router.post('/image', async (req: Request, res: Response) => {
  try {
    const { settings, prompt, refImages, negativePrompt, refImageIds } = req.body as {
      settings: {
        platformId: string
        endpoint: string
        model: string
        key: string
        mode: 'openai' | 'gemini' | 'custom'
        aspectRatio: string
        imageResolution: string
      }
      prompt: string
      refImages?: Array<{ base64: string; mimeType: string }>
      negativePrompt?: string
      refImageIds?: number[]
    }

    let url = settings.endpoint
    const headers: Record<string, string> = {
      'content-type': 'application/json',
      'Authorization': `Bearer ${settings.key}`,
    }

    // 豆包官方像素映射表（来源：火山引擎官方文档）
    // 包含 1K/2K/3K/4K 四档，覆盖全部宽高比
    const DOUBAO_PIXEL_MAP: Record<string, Record<string, string>> = {
      '1:1':  { '1K': '1024x1024',  '2K': '2048x2048',  '3K': '3072x3072',  '4K': '4096x4096'  },
      '16:9': { '1K': '1280x720',   '2K': '2848x1600',  '3K': '4096x2304',  '4K': '5504x3040'  },
      '9:16': { '1K': '720x1280',   '2K': '1600x2848',  '3K': '2304x4096',  '4K': '3040x5504'  },
      '4:3':  { '1K': '1152x864',   '2K': '2304x1728',  '3K': '3456x2592',  '4K': '4704x3520'  },
      '3:4':  { '1K': '864x1152',   '2K': '1728x2304',  '3K': '2592x3456',  '4K': '3520x4704'  },
      '3:2':  { '1K': '1248x832',   '2K': '2496x1664',  '3K': '3744x2496',  '4K': '4992x3328'  },
      '2:3':  { '1K': '832x1248',   '2K': '1664x2496',  '3K': '2496x3744',  '4K': '3328x4992'  },
      '21:9': { '1K': '1512x648',   '2K': '3136x1344',  '3K': '4704x2016',  '4K': '6240x2656'  },
      '4:5':  { '1K': '912x1140',   '2K': '1824x2276',  '3K': '2736x3420',  '4K': '3648x4560'  },
      '5:4':  { '1K': '1140x912',   '2K': '2276x1824',  '3K': '3420x2736',  '4K': '4560x3648'  },
    }

    let body: Record<string, unknown> = {}

    if (settings.platformId === 'doubao-image') {
      const modelName = settings.model
      let res = settings.imageResolution  // '1K' | '2K' | '4K'

      // 按模型版本约束实际分辨率档位
      // 5.0-lite: 仅支持 2K/3K（像素范围 [3686400, 10404496]）
      // 4.5: 支持 2K/4K（像素范围 [3686400, 16777216]）
      // 4.0: 支持 1K/2K/4K（像素范围 [921600, 16777216]）
      // 3.0-t2i: 仅支持像素值 [512, 2048]，最大 2048x2048
      if (modelName.includes('5-0') || modelName.includes('5.0')) {
        if (res === '1K') res = '2K'
        if (res === '4K') res = '3K'
      } else if (modelName.includes('4-5') || modelName.includes('4.5')) {
        if (res === '1K') res = '2K'
      }

      const pixelSize = DOUBAO_PIXEL_MAP[settings.aspectRatio]?.[res] ?? '2048x2048'

      // 3.0-t2i 不支持 sequential_image_generation 和参考图
      const is3dot0 = modelName.includes('3-0') || modelName.includes('3.0')
      body = {
        model: modelName,
        prompt,
        size: pixelSize,
        watermark: false,
        response_format: 'b64_json',
        ...(is3dot0 ? {} : { sequential_image_generation: 'disabled' }),
        // 豆包支持独立 negative_prompt 字段
        ...(negativePrompt ? { negative_prompt: negativePrompt } : {}),
      }
      if (!is3dot0 && refImages && refImages.length > 0) {
        body['image'] = refImages.map(img => `data:${img.mimeType};base64,${img.base64}`)
      }
    } else if (settings.platformId === 'gemini-image') {
      // Google Nano Banana 官方格式（generateContent 原生格式）
      // Gemini 无独立负向词字段，将负向词拼接到 prompt 末尾
      const finalPrompt = negativePrompt ? `${prompt}${negativePrompt}` : prompt
      const parts: unknown[] = []
      if (refImages && refImages.length > 0) {
        for (const img of refImages) {
          parts.push({ inlineData: { data: img.base64, mimeType: img.mimeType } })
        }
      }
      parts.push({ text: finalPrompt })

      body = {
        contents: [{ parts, role: 'user' }],
        generationConfig: {
          imageConfig: {
            aspectRatio: settings.aspectRatio,
            imageSize: settings.imageResolution,
          },
          responseModalities: ['IMAGE'],
        },
      }
      // 后端自动拼接 /{model}:generateContent
      url = `${settings.endpoint}/${settings.model}:generateContent`
    } else if (settings.platformId === 'runninghub') {
      // RunningHub：有参考图 → 图生图，无参考图 → 文生图，自动切换路径
      const serverBase = `${req.protocol}://${req.get('host')}`
      const imageUrls: string[] = (refImageIds ?? []).map(id => `${serverBase}/api/media/${id}/file`)
      const hasRefImages = imageUrls.length > 0

      // 路径映射：每个模型各有文生图和图生图两条路径
      const MODEL_PATHS: Record<string, { t2i: string; i2i: string }> = {
        'rhart-image-n-g31-flash': {
          t2i: '/openapi/v2/rhart-image-n-g31-flash/text-to-image',
          i2i: '/openapi/v2/rhart-image-n-g31-flash/image-to-image',
        },
        'rhart-image-n-pro': {
          t2i: '/openapi/v2/rhart-image-n-pro/text-to-image',
          i2i: '/openapi/v2/rhart-image-n-pro/edit',
        },
      }
      const paths = MODEL_PATHS[settings.model] ?? {
        t2i: `/openapi/v2/${settings.model}/text-to-image`,
        i2i: `/openapi/v2/${settings.model}/image-to-image`,
      }
      const submitUrl = `https://www.runninghub.cn${hasRefImages ? paths.i2i : paths.t2i}`

      // resolution 转为小写（RunningHub 接受 1k/2k/4k）
      const resolution = (settings.imageResolution ?? '2K').toLowerCase()

      const submitBody: Record<string, unknown> = {
        ...(hasRefImages ? { imageUrls } : {}),
        prompt,
        aspectRatio: settings.aspectRatio,
        resolution,
      }

      const rhHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.key}`,
      }

      // Step1: 提交任务
      console.log('[RunningHub] 提交任务:', submitUrl, JSON.stringify({ ...submitBody, prompt: submitBody.prompt?.toString().slice(0, 50) }))
      const submitResp = await fetch(submitUrl, { method: 'POST', headers: rhHeaders, body: JSON.stringify(submitBody) })
      console.log('[RunningHub] 提交状态码:', submitResp.status)
      if (!submitResp.ok) {
        const text = await submitResp.text()
        console.log('[RunningHub] 提交失败:', text)
        res.status(submitResp.status).send(text)
        return
      }
      const submitData = await submitResp.json() as { taskId: string; status: string; errorCode?: string; errorMessage?: string }
      console.log('[RunningHub] 提交结果:', JSON.stringify(submitData))
      // errorCode 非空 或 status=FAILED 均视为失败
      if (submitData.errorCode || submitData.status === 'FAILED' || !submitData.taskId) {
        res.status(500).json({ error: `RunningHub 任务提交失败 [${submitData.errorCode}]: ${submitData.errorMessage}` })
        return
      }

      // Step2: 轮询 /openapi/v2/query 直到 SUCCESS/FAILED（最多 5min，5s/次）
      const queryUrl = 'https://www.runninghub.cn/openapi/v2/query'
      const taskId = submitData.taskId
      const maxRetries = 60
      let attempt = 0
      while (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, 5000))
        attempt++
        const queryResp = await fetch(queryUrl, {
          method: 'POST',
          headers: rhHeaders,
          body: JSON.stringify({ taskId }),
        })
        if (!queryResp.ok) continue
        const queryData = await queryResp.json() as {
          taskId: string
          status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
          results: Array<{ url: string; outputType: string }> | null
          errorMessage?: string
        }
        console.log(`[RunningHub] 轮询 #${attempt} 状态:`, queryData.status)
        if (queryData.status === 'SUCCESS' && queryData.results && queryData.results.length > 0) {
          // 统一返回格式：results[0].url
          res.json({ results: queryData.results })
          return
        }
        if (queryData.status === 'FAILED') {
          res.status(500).json({ error: `RunningHub 任务失败: ${queryData.errorMessage}` })
          return
        }
      }
      res.status(504).json({ error: 'RunningHub 任务超时（5min），请稍后重试' })
      return
    } else if (settings.platformId === 'image-custom') {
      // 贞贞的AI工坊（OpenAI DALL-E 兼容格式）
      // 无独立负向词字段，将负向词拼接到 prompt 末尾
      const finalPrompt = negativePrompt ? `${prompt}${negativePrompt}` : prompt
      body = {
        model: settings.model,
        prompt: finalPrompt,
        aspect_ratio: settings.aspectRatio,
        image_size: settings.imageResolution,
        response_format: 'b64_json',
      }
      if (refImages && refImages.length > 0) {
        body['image'] = refImages.map(img => `data:${img.mimeType};base64,${img.base64}`)
      }
    }

    const upstream = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    })
    if (!upstream.ok) {
      const text = await upstream.text()
      res.status(upstream.status).send(text)
      return
    }
    const data = await upstream.json()
    res.json(data)
  } catch (err) {
    if (!res.headersSent) {
      res.status(502).json({ error: String(err) })
    }
  }
})

export default router
