import { SAFETY_REPLACEMENTS, SAFETY_ZONES } from '../data/safetyWords'
import type { SafetyResult } from '../types'

export const sanitizeText = (text: string, enableWordFilter = true): SafetyResult => {
  if (!enableWordFilter) {
    return {
      text,
      replaced: [],
      replacedRedZone: [],
      replacedYellowZone: [],
      detectedRedZone: [],
      detectedYellowZone: [],
      detectedCelebrity: [],
      detectedIP: [],
    }
  }

  let result = text
  const replaced: { bad: string; good: string }[] = []
  const replacedRedZone: { bad: string; good: string }[] = []
  const replacedYellowZone: { bad: string; good: string }[] = []

  // 执行替换
  for (const [bad, good] of Object.entries(SAFETY_REPLACEMENTS)) {
    if (result.includes(bad)) {
      const isRed = SAFETY_ZONES.redZone.some(w => bad.includes(w) || w.includes(bad))
      const entry = { bad, good }
      replaced.push(entry)
      if (isRed) replacedRedZone.push(entry)
      else replacedYellowZone.push(entry)
      result = result.split(bad).join(good)
    }
  }

  // 检测剩余违禁词（未替换的）
  const detectedRedZone = SAFETY_ZONES.redZone.filter(w => result.includes(w))
  const detectedYellowZone = SAFETY_ZONES.yellowZone.filter(w => result.includes(w))
  const detectedCelebrity = SAFETY_ZONES.celebrity.filter(w => result.includes(w))
  const detectedIP = SAFETY_ZONES.ip.filter(w => result.includes(w))

  return {
    text: result,
    replaced,
    replacedRedZone,
    replacedYellowZone,
    detectedRedZone,
    detectedYellowZone,
    detectedCelebrity,
    detectedIP,
  }
}

// 快速检测（只判断是否有违禁词，不替换）
export const hasUnsafeContent = (text: string): boolean => {
  return [...SAFETY_ZONES.redZone, ...SAFETY_ZONES.yellowZone].some(w => text.includes(w))
}
