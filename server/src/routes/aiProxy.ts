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

export default router
