import type { ApiSettings, ChatMessage } from '../types'

const PROXY_BASE = '/api/ai'

// 从响应中提取文本内容 (非流式)
export const extractContent = (data: unknown, mode: ApiSettings['mode']): string => {
  if (!data || typeof data !== 'object') return ''
  const d = data as Record<string, unknown>
  if (mode === 'anthropic') {
    const content = d.content as Array<Record<string, unknown>> | undefined
    return (content?.[0]?.text as string) ?? ''
  }
  const choices = d.choices as Array<Record<string, unknown>> | undefined
  const msg = choices?.[0]?.message as Record<string, unknown> | undefined
  return (msg?.content as string) ?? ''
}

// 解析 SSE delta 文本
const parseDelta = (line: string, mode: ApiSettings['mode']): string => {
  if (!line.startsWith('data: ')) return ''
  const payload = line.slice(6).trim()
  if (payload === '[DONE]') return ''
  try {
    const obj = JSON.parse(payload)
    if (mode === 'anthropic') {
      if (obj.type === 'content_block_delta') {
        return obj.delta?.text ?? ''
      }
      return ''
    }
    return obj.choices?.[0]?.delta?.content ?? ''
  } catch {
    return ''
  }
}

// 流式生成，回调每个 token
export const streamGenerate = async (
  messages: ChatMessage[],
  settings: ApiSettings,
  onToken: (token: string) => void,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(`${PROXY_BASE}/stream`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, settings }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error ${response.status}: ${text}`)
  }

  const reader = response.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()
  let fullText = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const delta = parseDelta(line.trim(), settings.mode)
      if (delta) {
        fullText += delta
        onToken(delta)
      }
    }
  }

  return fullText
}

// 非流式生成
export const generate = async (
  messages: ChatMessage[],
  settings: ApiSettings,
  signal?: AbortSignal
): Promise<string> => {
  const response = await fetch(`${PROXY_BASE}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages, settings }),
    signal,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`API error ${response.status}: ${text}`)
  }

  const data = await response.json()
  return extractContent(data, settings.mode)
}
