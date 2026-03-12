import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

// GET /api/history - newest first, supports ?episodeId=xxx&projectId=xxx
router.get('/', async (req, res) => {
  const { episodeId, projectId } = req.query
  const records = await prisma.historyRecord.findMany({
    where: {
      userId: req.userId,
      ...(episodeId ? { episodeId: String(episodeId) } : {}),
      ...(projectId ? { projectId: String(projectId) } : {}),
    },
    orderBy: { createdAt: 'desc' },
  })
  const result = records.map(r => ({
    ...r,
    createdAt: r.createdAt.getTime(),
  }))
  res.json(result)
})

// POST /api/history - returns { id: number }
router.post('/', async (req, res) => {
  const data = req.body
  const record = await prisma.historyRecord.create({
    data: {
      userId: req.userId,
      projectId: data.projectId ?? null,
      episodeId: data.episodeId ?? null,
      createdAt: new Date(data.createdAt),
      plot: data.plot ?? '',
      fullPlot: data.fullPlot ?? '',
      director: data.director ?? '',
      directorId: data.directorId ?? '',
      storyboard: data.storyboard ?? '',
      time: data.time ?? '',
    },
  })
  res.json({ id: record.id })
})

// DELETE /api/history/:id
router.delete('/:id', async (req, res) => {
  await prisma.historyRecord.delete({
    where: { id: Number(req.params.id), userId: req.userId },
  })
  res.json({ ok: true })
})

// DELETE /api/history (clear all)
router.delete('/', async (req, res) => {
  await prisma.historyRecord.deleteMany({ where: { userId: req.userId } })
  res.json({ ok: true })
})

export default router
