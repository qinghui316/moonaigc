import { Router, Request, Response } from 'express'
import { prisma } from '../index'

const router = Router()

// POST /api/shots/parse — 解析并批量存储 shots
router.post('/parse', async (req: Request, res: Response) => {
  try {
    const { historyId, shots } = req.body as {
      historyId: number
      shots: Array<{
        time?: string
        shotType?: string
        camera?: string
        scene?: string
        lighting?: string
        drama?: string
        prompt?: string
      }>
    }

    await prisma.shot.deleteMany({ where: { historyId } })

    const created = await prisma.shot.createMany({
      data: shots.map((s, idx) => ({
        historyId,
        sortOrder: idx,
        timeRange: s.time ?? '',
        shotType: s.shotType ?? '',
        camera: s.camera ?? '',
        scene: s.scene ?? '',
        lighting: s.lighting ?? '',
        drama: s.drama ?? '',
        prompt: s.prompt ?? '',
      })),
    })
    res.json({ count: created.count })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// GET /api/shots?historyId=xxx — 获取某条历史记录的所有 shots
router.get('/', async (req: Request, res: Response) => {
  try {
    const historyId = Number(req.query.historyId)
    if (!historyId) { res.status(400).json({ error: 'historyId required' }); return }
    const shots = await prisma.shot.findMany({
      where: { historyId },
      orderBy: { sortOrder: 'asc' },
      include: { imageFile: true },
    })
    res.json(shots)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

// PUT /api/shots/:id — 更新 shot 字段（含 imageFileId）
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { imageFileId, prompt } = req.body as { imageFileId?: number; prompt?: string }
    const updated = await prisma.shot.update({
      where: { id },
      data: { ...(imageFileId !== undefined ? { imageFileId } : {}), ...(prompt !== undefined ? { prompt } : {}) },
    })
    res.json(updated)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
