import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

// GET /api/materials?projectId=xxx (omit for global)
router.get('/', async (req, res) => {
  const projectId = req.query.projectId ? String(req.query.projectId) : null
  const set = await prisma.materialSet.findFirst({
    where: {
      userId: req.userId,
      projectId: projectId,
    },
  })
  res.json(set?.data ?? null)
})

// PUT /api/materials
router.put('/', async (req, res) => {
  const { projectId, data } = req.body
  const pId = projectId ?? null
  await prisma.materialSet.upsert({
    where: {
      userId_projectId: {
        userId: req.userId,
        projectId: pId,
      },
    },
    update: { data: data ?? {} },
    create: {
      userId: req.userId,
      projectId: pId,
      data: data ?? {},
    },
  })
  res.json({ ok: true })
})

export default router
