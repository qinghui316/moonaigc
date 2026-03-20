import { generate, streamGenerate } from './api'
import {
  buildSplitScriptSystemPrompt,
  buildSplitScriptUserPrompt,
  buildImportCreativePlanSystemPrompt,
  buildImportCreativePlanUserPrompt,
  buildImportCharacterDocSystemPrompt,
  buildImportCharacterDocUserPrompt,
} from '../prompts/drama/importScript'
import type { Episode, ApiSettings, ChatMessage } from '../types'

export interface SplitEpisode {
  episodeNumber: number
  title: string
  summary: string
  hookType: string
  mark: string
  sourceText: string
  status: 'outline'
}

function runTextGeneration(
  messages: ChatMessage[],
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  return onChunk
    ? streamGenerate(messages, settings, onChunk)
    : generate(messages, settings)
}

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
    if (matches.length < 2) continue

    const episodes: SplitEpisode[] = []
    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index ?? 0
      const end = i < matches.length - 1 ? (matches[i + 1].index ?? text.length) : text.length
      const content = text.slice(start, end).trim()
      episodes.push({
        episodeNumber: parseInt(matches[i][1], 10),
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

  return null
}

export async function aiSplitScript(
  sourceText: string,
  totalEpisodes: number,
  adaptMode: 'faithful' | 'blockbuster',
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<SplitEpisode[]> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildSplitScriptSystemPrompt() },
    { role: 'user', content: buildSplitScriptUserPrompt(sourceText, totalEpisodes, adaptMode) },
  ]
  const result = await runTextGeneration(messages, settings, onChunk)
  const cleaned = result.replace(/```json\n?|```/g, '').trim()
  const parsed = JSON.parse(cleaned) as SplitEpisode[]
  return parsed.map(episode => ({ ...episode, status: 'outline' as const }))
}

export async function generateImportCreativePlan(
  sourceText: string,
  adaptMode: 'faithful' | 'blockbuster',
  totalEpisodes: number,
  episodes: SplitEpisode[],
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const summaries = episodes
    .map(episode => `第${episode.episodeNumber}集《${episode.title}》：${episode.summary}`)
    .join('\n')
  const messages: ChatMessage[] = [
    { role: 'system', content: buildImportCreativePlanSystemPrompt() },
    { role: 'user', content: buildImportCreativePlanUserPrompt(sourceText, adaptMode, totalEpisodes, summaries) },
  ]
  return runTextGeneration(messages, settings, onChunk)
}

export async function generateImportCharacterDoc(
  sourceText: string,
  creativePlan: string,
  adaptMode: 'faithful' | 'blockbuster',
  settings: ApiSettings,
  onChunk?: (chunk: string) => void
): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: buildImportCharacterDocSystemPrompt() },
    { role: 'user', content: buildImportCharacterDocUserPrompt(sourceText, creativePlan, adaptMode) },
  ]
  return runTextGeneration(messages, settings, onChunk)
}

export function normalizeAssetName(name: string): string {
  return name.trim().replace(/\s+/g, '').toLowerCase()
}

export function extractCharactersFromDoc(
  characterDoc: string
): Array<{ name: string; desc: string }> {
  const results: Array<{ name: string; desc: string }> = []
  const namePattern = /(?:^|\n)\s*[-*•]?\s*\*{0,2}姓名[:：]\*{0,2}\s*(.+)/gm
  const descPattern = /外貌特征[:：]\s*([^\n]+)/gm
  const names = [...characterDoc.matchAll(namePattern)].map(match => match[1].trim())
  const descs = [...characterDoc.matchAll(descPattern)].map(match => match[1].trim())

  for (let i = 0; i < names.length; i++) {
    if (names[i]) results.push({ name: names[i], desc: descs[i] ?? '' })
  }

  return results
}

export function extractScenesFromDoc(
  creativePlan: string
): Array<{ name: string; desc: string }> {
  const results: Array<{ name: string; desc: string }> = []
  const bgMatch = creativePlan.match(/时空背景[^\n]*\n([\s\S]{0,500}?)(?=\n###|$)/)
  if (!bgMatch) return results

  const lines = bgMatch[1].split('\n').filter(line => line.trim())
  lines.slice(0, 3).forEach((line, index) => {
    const text = line.replace(/^[-*•\d.]\s*/, '').trim()
    if (text.length > 4) results.push({ name: `主场景${index + 1}`, desc: text })
  })

  return results
}

export function splitEpisodesToPartial(
  projectId: string,
  episodes: SplitEpisode[]
): Omit<Episode, 'id'>[] {
  return episodes.map(episode => ({
    projectId,
    episodeNumber: episode.episodeNumber,
    title: episode.title,
    summary: episode.summary,
    hookType: episode.hookType,
    mark: episode.mark,
    script: '',
    status: 'outline' as const,
    sourceText: episode.sourceText,
  }))
}
