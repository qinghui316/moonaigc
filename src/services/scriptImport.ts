import { generate } from './api'
import {
  buildSplitScriptSystemPrompt,
  buildSplitScriptUserPrompt,
  buildImportCreativePlanSystemPrompt,
  buildImportCreativePlanUserPrompt,
  buildImportCharacterDocSystemPrompt,
  buildImportCharacterDocUserPrompt,
} from '../prompts/drama/importScript'
import type { Episode, ApiSettings } from '../types'

export interface SplitEpisode {
  episodeNumber: number
  title: string
  summary: string
  hookType: string
  mark: string
  sourceText: string
  status: 'outline'
}

/** 规则识别分集标记（第X集/Chapter X/[X]等），成功返回分集数组，否则返回 null */
export function tryRuleSplit(text: string): SplitEpisode[] | null {
  const patterns = [
    /第\s*(\d+)\s*[集章节话回]/g,
    /Chapter\s*(\d+)/gi,
    /Episode\s*(\d+)/gi,
    /【第(\d+)集】/g,
    /\[(\d+)\]/g,
  ]

  for (const pattern of patterns) {
    const matches = [...text.matchAll(pattern)]
    if (matches.length >= 2) {
      const episodes: SplitEpisode[] = []
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index!
        const end = i < matches.length - 1 ? matches[i + 1].index! : text.length
        const content = text.slice(start, end).trim()
        episodes.push({
          episodeNumber: parseInt(matches[i][1]),
          title: content.split('\n')[0].slice(0, 30),
          summary: content.slice(0, 200),
          hookType: '',
          mark: '',
          sourceText: content,
          status: 'outline',
        })
      }
      return episodes
    }
  }
  return null
}

/** AI 拆集：调用 prompt 输出 JSON */
export async function aiSplitScript(
  sourceText: string,
  totalEpisodes: number,
  adaptMode: 'faithful' | 'blockbuster',
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<SplitEpisode[]> {
  const result = await generate(
    [
      { role: 'system', content: buildSplitScriptSystemPrompt() },
      { role: 'user', content: buildSplitScriptUserPrompt(sourceText, totalEpisodes, adaptMode) },
    ],
    settings,
    onChunk
  )
  const cleaned = result.replace(/```json\n?|```/g, '').trim()
  const parsed = JSON.parse(cleaned) as SplitEpisode[]
  return parsed.map(e => ({ ...e, status: 'outline' as const }))
}

/** 生成导入版创作方案（基于原文 + 已拆集摘要） */
export async function generateImportCreativePlan(
  sourceText: string,
  adaptMode: 'faithful' | 'blockbuster',
  totalEpisodes: number,
  episodes: SplitEpisode[],
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const summaries = episodes.map(e => `第${e.episodeNumber}集《${e.title}》：${e.summary}`).join('\n')
  return generate(
    [
      { role: 'system', content: buildImportCreativePlanSystemPrompt() },
      { role: 'user', content: buildImportCreativePlanUserPrompt(sourceText, adaptMode, totalEpisodes, summaries) },
    ],
    settings,
    onChunk
  )
}

/** 生成导入版角色档案（基于原文 + 创作方案） */
export async function generateImportCharacterDoc(
  sourceText: string,
  creativePlan: string,
  adaptMode: 'faithful' | 'blockbuster',
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  return generate(
    [
      { role: 'system', content: buildImportCharacterDocSystemPrompt() },
      { role: 'user', content: buildImportCharacterDocUserPrompt(sourceText, creativePlan, adaptMode) },
    ],
    settings,
    onChunk
  )
}

/** 素材去重：归一化名字后检查是否已存在相似名称 */
export function normalizeAssetName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase()
}

/** 从角色档案中提取角色名和描述，用于写入素材库 */
export function extractCharactersFromDoc(
  characterDoc: string
): Array<{ name: string; desc: string }> {
  const results: Array<{ name: string; desc: string }> = []
  // 匹配"姓名："或"**姓名**"等格式
  const namePattern = /(?:^|\n)\s*[-*•]?\s*\*{0,2}姓名[:：]\*{0,2}\s*(.+)/gm
  const descPattern = /外貌特征[:：]\s*([^\n]+)/gm
  const names = [...characterDoc.matchAll(namePattern)].map(m => m[1].trim())
  const descs = [...characterDoc.matchAll(descPattern)].map(m => m[1].trim())
  for (let i = 0; i < names.length; i++) {
    if (names[i]) {
      results.push({ name: names[i], desc: descs[i] ?? '' })
    }
  }
  return results
}

/** 从角色档案中提取场景名和描述 */
export function extractScenesFromDoc(
  creativePlan: string
): Array<{ name: string; desc: string }> {
  const results: Array<{ name: string; desc: string }> = []
  // 匹配时空背景部分
  const bgMatch = creativePlan.match(/时空背景[^\n]*\n([\s\S]{0,500}?)(?=\n###|$)/)
  if (bgMatch) {
    const lines = bgMatch[1].split('\n').filter(l => l.trim())
    lines.slice(0, 3).forEach((line, i) => {
      const text = line.replace(/^[-*•\d.]\s*/, '').trim()
      if (text.length > 4) {
        results.push({ name: `主场景${i + 1}`, desc: text })
      }
    })
  }
  return results
}

/** 转换 SplitEpisode 为 Episode（部分字段，剩余由 store 补全） */
export function splitEpisodesToPartial(
  projectId: string,
  episodes: SplitEpisode[]
): Omit<Episode, 'id'>[] {
  return episodes.map(e => ({
    projectId,
    episodeNumber: e.episodeNumber,
    title: e.title,
    summary: e.summary,
    hookType: e.hookType,
    mark: e.mark,
    script: '',
    status: 'outline' as const,
    sourceText: e.sourceText,
  }))
}
