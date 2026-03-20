import type { Materials, AssetType, MaterialItem } from '../types'

export interface RefImageInfo {
  tag: string
  type: AssetType
  name: string
  desc: string
  imageUrl: string
  imageFileId: number
}

const DEFAULT_REF_LIMIT = 6

interface CollectRefImageOptions {
  includeWeakMatch?: boolean
  includeFallback?: boolean
}

type AssetWithImage = MaterialItem & { imageUrl: string; imageFileId: number }

type AssetRecord = {
  type: AssetType
  item: AssetWithImage
}

function normalizeText(text: string): string {
  return String(text || '')
    .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 65248))
    .replace(/\s+/g, '')
    .toLowerCase()
}

function hasImage(item: MaterialItem): item is AssetWithImage {
  return Boolean(item.name && item.imageUrl && item.imageFileId)
}

function listAssets(materials: Materials): AssetRecord[] {
  const result: AssetRecord[] = []
  ;(['character', 'image', 'props'] as AssetType[]).forEach(type => {
    materials[type].forEach(item => {
      if (hasImage(item)) result.push({ type, item })
    })
  })
  return result
}

function toRefInfo(type: AssetType, item: AssetWithImage): RefImageInfo {
  return {
    tag: `@${item.name}`,
    type,
    name: item.name,
    desc: item.desc || '',
    imageUrl: item.imageUrl,
    imageFileId: item.imageFileId,
  }
}

function pushUnique(
  results: RefImageInfo[],
  seen: Set<number>,
  ref: RefImageInfo,
  limit: number,
): void {
  if (results.length >= limit) return
  if (seen.has(ref.imageFileId)) return
  seen.add(ref.imageFileId)
  results.push(ref)
}

function extractTags(seedanceText: string): string[] {
  const tags = new Set<string>()
  const tagRe = /@([^\s[\]（）()，。,:：]+)/g
  let match: RegExpExecArray | null

  while ((match = tagRe.exec(seedanceText)) !== null) {
    const tag = match[1]?.trim()
    if (tag) tags.add(tag)
  }

  return [...tags]
}

function weakMatchAssets(seedanceText: string, materials: Materials): RefImageInfo[] {
  const normalizedSeedance = normalizeText(seedanceText)
  if (!normalizedSeedance) return []

  const results: RefImageInfo[] = []
  const seen = new Set<number>()

  for (const { type, item } of listAssets(materials)) {
    const normalizedName = normalizeText(item.name)
    if (!normalizedName || normalizedName.length < 2) continue
    if (!normalizedSeedance.includes(normalizedName)) continue
    pushUnique(results, seen, toRefInfo(type, item), DEFAULT_REF_LIMIT)
  }

  return results
}

function fallbackAssets(materials: Materials, limit: number): RefImageInfo[] {
  const results: RefImageInfo[] = []
  const seen = new Set<number>()

  const pushFromType = (type: AssetType) => {
    for (const item of materials[type]) {
      if (!hasImage(item)) continue
      pushUnique(results, seen, toRefInfo(type, item), limit)
      if (results.length >= limit) return
    }
  }

  pushFromType('character')
  if (results.length < limit) pushFromType('image')
  if (results.length < limit) pushFromType('props')

  return results
}

export function collectRefImages(
  seedanceText: string,
  materials: Materials,
  limit = DEFAULT_REF_LIMIT,
  options: CollectRefImageOptions = {},
): RefImageInfo[] {
  const {
    includeWeakMatch = true,
    includeFallback = true,
  } = options
  const tags = extractTags(seedanceText)
  const results: RefImageInfo[] = []
  const seen = new Set<number>()
  const types: AssetType[] = ['character', 'image', 'props']

  for (const tag of tags) {
    for (const type of types) {
      const slot = materials[type].find(item => item.name === tag)
      if (!slot || !hasImage(slot)) continue
      pushUnique(results, seen, toRefInfo(type, slot), limit)
      break
    }
  }

  if (includeWeakMatch && results.length < limit) {
    for (const ref of weakMatchAssets(seedanceText, materials)) {
      pushUnique(results, seen, ref, limit)
    }
  }

  if (includeFallback && results.length === 0) {
    for (const ref of fallbackAssets(materials, limit)) {
      pushUnique(results, seen, ref, limit)
    }
  }

  return results
}

export function buildRefImageDescs(refs: RefImageInfo[]): string[] {
  return refs.map(ref => {
    const typeLabel = ref.type === 'character' ? '角色' : ref.type === 'image' ? '场景' : '道具'
    const snippet = ref.desc ? ref.desc.replace(/\s+/g, ' ').trim().slice(0, 60) : '以参考图外观为准'
    return `${typeLabel}-${ref.name}：${snippet}`
  })
}

const refImageCache = new Map<number, { base64: string; mimeType: string }>()

export async function loadRefImageBase64s(
  refs: RefImageInfo[]
): Promise<{ base64: string; mimeType: string }[]> {
  const results: { base64: string; mimeType: string }[] = []

  for (const ref of refs) {
    if (refImageCache.has(ref.imageFileId)) {
      results.push(refImageCache.get(ref.imageFileId)!)
      continue
    }

    try {
      const resp = await fetch(ref.imageUrl)
      if (!resp.ok) continue
      const blob = await resp.blob()
      const mimeType = blob.type || 'image/jpeg'
      const arrayBuf = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const entry = { base64: btoa(binary), mimeType }
      refImageCache.set(ref.imageFileId, entry)
      results.push(entry)
    } catch {
      // Ignore broken reference images and continue with the rest.
    }
  }

  return results
}

export function clearRefImageCache(): void {
  refImageCache.clear()
}
