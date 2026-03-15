import type { Materials, AssetType } from '../types'

export interface RefImageInfo {
  tag: string           // 如 "@林默"
  type: AssetType
  name: string          // 如 "林默"
  desc: string
  imageUrl: string
  imageFileId: number
}

// 从 SEEDANCE 文本中提取所有 @标签，匹配素材库中有资产图的项
export function collectRefImages(seedanceText: string, materials: Materials): RefImageInfo[] {
  const tagRe = /@([^\s[\]（()]+)/g
  const tags = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = tagRe.exec(seedanceText)) !== null) {
    tags.add(m[1])
  }

  const results: RefImageInfo[] = []
  const types: AssetType[] = ['character', 'image', 'props']
  for (const tag of tags) {
    for (const type of types) {
      const slot = materials[type].find(s => s.name === tag)
      if (slot && slot.imageUrl && slot.imageFileId) {
        results.push({
          tag: `@${tag}`,
          type,
          name: slot.name,
          desc: slot.desc,
          imageUrl: slot.imageUrl,
          imageFileId: slot.imageFileId,
        })
        break
      }
    }
  }
  return results
}

// 将 RefImageInfo[] 转为 AI 精炼用的描述列表
export function buildRefImageDescs(refs: RefImageInfo[]): string[] {
  return refs.map(r => {
    const typeLabel = r.type === 'character' ? '角色' : r.type === 'image' ? '场景' : '道具'
    return `${typeLabel}「${r.name}」— ${r.desc.slice(0, 50)}${r.desc.length > 50 ? '…' : ''}（${typeLabel === '角色' ? '三视图' : typeLabel === '场景' ? '概念图' : '参考图'}）`
  })
}

// 内存缓存：按 imageFileId 去重，批量生图时不重复 fetch
const _refImageCache = new Map<number, { base64: string; mimeType: string }>()

// 将 RefImageInfo[] 转为 base64 数组（含内存缓存）
export async function loadRefImageBase64s(
  refs: RefImageInfo[]
): Promise<{ base64: string; mimeType: string }[]> {
  const results: { base64: string; mimeType: string }[] = []
  for (const ref of refs) {
    if (_refImageCache.has(ref.imageFileId)) {
      results.push(_refImageCache.get(ref.imageFileId)!)
      continue
    }
    try {
      const resp = await fetch(ref.imageUrl)
      const blob = await resp.blob()
      const mimeType = blob.type || 'image/jpeg'
      const arrayBuf = await blob.arrayBuffer()
      const uint8 = new Uint8Array(arrayBuf)
      let binary = ''
      for (let i = 0; i < uint8.length; i++) binary += String.fromCharCode(uint8[i])
      const base64 = btoa(binary)
      const entry = { base64, mimeType }
      _refImageCache.set(ref.imageFileId, entry)
      results.push(entry)
    } catch {
      // 跳过获取失败的参考图
    }
  }
  return results
}

// 清除批量操作结束后的缓存
export function clearRefImageCache(): void {
  _refImageCache.clear()
}
