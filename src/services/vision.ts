import type { ApiSettings, VisionResult } from '../types'
import { buildImageAnalysisSystemPrompt, buildVideoAnalysisSystemPrompt } from '../prompts/vision'
import { generate } from './api'

// 图片转base64
export const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

// 视频抽帧 (均匀抽取N帧)
export const extractVideoFrames = (file: File, frameCount = 8): Promise<string[]> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video')
    const url = URL.createObjectURL(file)
    video.src = url
    video.muted = true
    video.preload = 'auto'

    video.onloadedmetadata = async () => {
      const duration = video.duration
      const interval = duration / (frameCount + 1)
      const frames: string[] = []

      for (let i = 1; i <= frameCount; i++) {
        const time = interval * i
        await new Promise<void>((res) => {
          video.currentTime = time
          video.onseeked = () => {
            const canvas = document.createElement('canvas')
            canvas.width = 640
            canvas.height = Math.round((640 / video.videoWidth) * video.videoHeight)
            const ctx = canvas.getContext('2d')!
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
            frames.push(canvas.toDataURL('image/jpeg', 0.7).split(',')[1])
            res()
          }
        })
      }

      URL.revokeObjectURL(url)
      resolve(frames)
    }
    video.onerror = reject
  })
}

// 图片分析
export const analyzeImage = async (
  imageBase64: string,
  mimeType: string,
  settings: ApiSettings,
  signal?: AbortSignal
): Promise<VisionResult> => {
  const content: unknown[] = [
    {
      type: 'image_url',
      image_url: { url: `data:${mimeType};base64,${imageBase64}` },
    },
    {
      type: 'text',
      text: '请分析这张图片，按照系统指令格式输出JSON结果。',
    },
  ]

  const text = await generate(
    [
      { role: 'system', content: buildImageAnalysisSystemPrompt() },
      { role: 'user', content: JSON.stringify(content) },
    ],
    settings,
    signal
  )

  return parseVisionResult(text)
}

// 视频分析
export const analyzeVideo = async (
  frames: string[],
  settings: ApiSettings,
  signal?: AbortSignal
): Promise<VisionResult> => {
  const imageContents = frames.map((frame) => ({
    type: 'image_url',
    image_url: { url: `data:image/jpeg;base64,${frame}` },
  }))

  const content = [
    ...imageContents,
    {
      type: 'text',
      text: `这是视频中均匀抽取的${frames.length}帧画面，请按照系统指令格式进行逐镜分析，输出JSON结果。`,
    },
  ]

  const text = await generate(
    [
      { role: 'system', content: buildVideoAnalysisSystemPrompt(frames.length, 0) },
      { role: 'user', content: JSON.stringify(content) },
    ],
    settings,
    signal
  )

  const result = parseVisionResult(text)
  result.frameCount = frames.length
  return result
}

const parseVisionResult = (text: string): VisionResult => {
  try {
    const clean = text.replace(/```json\n?|```/g, '').trim()
    return JSON.parse(clean) as VisionResult
  } catch {
    return {
      characters: [],
      scenes: [],
      props: [],
      plot_summary: text.substring(0, 200),
      story_tone: '',
      director_style: '',
    }
  }
}
