import { Router, Request, Response } from 'express'
import { prisma } from '../index'
import fs from 'fs'
import path from 'path'

const router = Router()

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'
const IMAGES_DIR = path.resolve(UPLOAD_DIR, 'images')

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
}

// POST /api/media/upload — 上传 base64 图片，保存到磁盘，创建 MediaFile 记录
router.post('/upload', async (req: Request, res: Response) => {
  try {
    const {
      base64, mimeType = 'image/jpeg', refType, refId,
      userId = 'default-user', filename,
      projectId, episodeId, assetType, assetSlot,
    } = req.body as {
      base64: string
      mimeType?: string
      refType?: string
      refId?: string
      userId?: string
      filename?: string
      projectId?: string
      episodeId?: string
      assetType?: string
      assetSlot?: string
    }

    ensureDir(IMAGES_DIR)

    const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
    const fname = filename ?? `img_${Date.now()}${ext}`
    const filePath = path.join(IMAGES_DIR, fname)

    const buffer = Buffer.from(base64, 'base64')
    fs.writeFileSync(filePath, buffer)

    const record = await prisma.mediaFile.create({
      data: {
        userId,
        fileName: fname,
        mimeType,
        fileSize: buffer.length,
        filePath,
        refType: refType ?? 'image',
        refId: refId ?? '0',
        ...(projectId ? { projectId } : {}),
        ...(episodeId ? { episodeId } : {}),
        ...(assetType ? { assetType } : {}),
        ...(assetSlot ? { assetSlot } : {}),
      },
    })

    res.json({ id: record.id, filePath: record.filePath, url: `/api/media/${record.id}/file` })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// POST /api/media/upload-from-url — 后端下载外部图片 URL 并存入数据库（避免浏览器 CORS 限制）
router.post('/upload-from-url', async (req: Request, res: Response) => {
  try {
    const {
      url: externalUrl, mimeType: hintMime, refType, refId,
      userId = 'default-user', filename,
      projectId, episodeId, assetType, assetSlot,
    } = req.body as {
      url: string
      mimeType?: string
      refType?: string
      refId?: string
      userId?: string
      filename?: string
      projectId?: string
      episodeId?: string
      assetType?: string
      assetSlot?: string
    }

    const imgResp = await fetch(externalUrl)
    if (!imgResp.ok) { res.status(502).json({ error: `下载外部图片失败: ${imgResp.status}` }); return }

    const contentType = imgResp.headers.get('content-type') ?? hintMime ?? 'image/jpeg'
    const mimeType = contentType.split(';')[0].trim()
    const ext = mimeType === 'image/png' ? '.png' : mimeType === 'image/webp' ? '.webp' : '.jpg'
    const buffer = Buffer.from(await imgResp.arrayBuffer())

    ensureDir(IMAGES_DIR)
    const fname = filename ?? `img_${Date.now()}${ext}`
    const filePath = path.join(IMAGES_DIR, fname)
    fs.writeFileSync(filePath, buffer)

    const record = await prisma.mediaFile.create({
      data: {
        userId,
        fileName: fname,
        mimeType,
        fileSize: buffer.length,
        filePath,
        refType: refType ?? 'image',
        refId: refId ?? '0',
        ...(projectId ? { projectId } : {}),
        ...(episodeId ? { episodeId } : {}),
        ...(assetType ? { assetType } : {}),
        ...(assetSlot ? { assetSlot } : {}),
      },
    })

    res.json({ id: record.id, filePath: record.filePath, url: `/api/media/${record.id}/file` })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/media — 列表查询（用于画廊）
router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, episodeId, refType, page = '1', limit = '50', userId = 'default-user' } = req.query as Record<string, string>
    const pageNum = Math.max(1, parseInt(page))
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)))
    const where: Record<string, unknown> = { userId }
    if (projectId) where.projectId = projectId
    if (episodeId) where.episodeId = episodeId
    if (refType) where.refType = refType

    const [items, total] = await Promise.all([
      prisma.mediaFile.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
      }),
      prisma.mediaFile.count({ where }),
    ])
    res.json({ items: items.map(i => ({ ...i, url: `/api/media/${i.id}/file` })), total })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/media/:id/file — 返回图片文件
router.get('/:id/file', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.mediaFile.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Not found' }); return }
    if (!fs.existsSync(record.filePath)) { res.status(404).json({ error: 'File not found' }); return }
    res.setHeader('Content-Type', record.mimeType)
    res.sendFile(path.resolve(record.filePath))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/media/:id — 获取媒体文件元信息
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.mediaFile.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Not found' }); return }
    res.json(record)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// DELETE /api/media/:id — 删除文件和记录
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const record = await prisma.mediaFile.findUnique({ where: { id } })
    if (!record) { res.status(404).json({ error: 'Not found' }); return }
    if (fs.existsSync(record.filePath)) {
      fs.unlinkSync(record.filePath)
    }
    await prisma.mediaFile.delete({ where: { id } })
    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
