import { SAFETY_REPLACEMENTS, SAFETY_ZONES, CELEBRITY_REPLACEMENTS, IP_REPLACEMENTS } from '../data/safetyWords'
import type { SafetyResult } from '../types'

export const sanitizeText = (text: string, enableWordFilter = true): SafetyResult => {
  if (!enableWordFilter) {
    return {
      text,
      replaced: [],
      replacedRedZone: [],
      replacedYellowZone: [],
      replacedCelebrity: [],
      replacedIP: [],
      detectedRedZone: [],
      detectedYellowZone: [],
      detectedCelebrity: [],
      detectedIP: [],
      detectedBrand: [],
    }
  }

  // Step 1：先检测名人/IP（在原始文本上），用于 UI 警告
  const detectedCelebrity = SAFETY_ZONES.celebrity.filter(w => text.includes(w))
  const detectedIP = SAFETY_ZONES.ip.filter(w => text.includes(w))

  let result = text
  const replaced: { bad: string; good: string }[] = []
  const replacedRedZone: { bad: string; good: string }[] = []
  const replacedYellowZone: { bad: string; good: string }[] = []

  // Step 2：执行暴力/色情/政治等常规替换
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

  // Step 3：名人气质化替换
  const replacedCelebrity: { bad: string; good: string }[] = []
  for (const [bad, good] of Object.entries(CELEBRITY_REPLACEMENTS)) {
    if (result.includes(bad)) {
      replacedCelebrity.push({ bad, good })
      result = result.split(bad).join(good)
    }
  }

  // Step 4：IP 气质化替换
  const replacedIP: { bad: string; good: string }[] = []
  for (const [bad, good] of Object.entries(IP_REPLACEMENTS)) {
    if (result.includes(bad)) {
      replacedIP.push({ bad, good })
      result = result.split(bad).join(good)
    }
  }

  // Step 5：检测替换后剩余的违禁词
  const detectedRedZone = SAFETY_ZONES.redZone.filter(w => result.includes(w))
  const detectedYellowZone = SAFETY_ZONES.yellowZone.filter(w => result.includes(w))
  const detectedBrand = (SAFETY_ZONES.brandZone ?? []).filter(w => result.includes(w))

  return {
    text: result,
    replaced,
    replacedRedZone,
    replacedYellowZone,
    replacedCelebrity,
    replacedIP,
    detectedRedZone,
    detectedYellowZone,
    detectedCelebrity,
    detectedIP,
    detectedBrand,
  }
}

// 快速检测（只判断是否有违禁词，不替换）
export const hasUnsafeContent = (text: string): boolean => {
  return [...SAFETY_ZONES.redZone, ...SAFETY_ZONES.yellowZone].some(w => text.includes(w))
}
