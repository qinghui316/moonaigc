import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

// GET /api/projects - newest first
router.get('/', async (req, res) => {
  const projects = await prisma.project.findMany({
    where: { userId: req.userId },
    orderBy: { createdAt: 'desc' },
  })
  // Convert DateTime -> number for frontend
  const result = projects.map(p => ({
    ...p,
    genre: p.genre as string[],
    createdAt: p.createdAt.getTime(),
    updatedAt: p.updatedAt.getTime(),
  }))
  res.json(result)
})

// POST /api/projects
router.post('/', async (req, res) => {
  const data = req.body
  const project = await prisma.project.create({
    data: {
      id: data.id,
      userId: req.userId,
      name: data.name,
      genre: data.genre ?? [],
      audience: data.audience ?? '',
      tone: data.tone ?? '',
      endingType: data.endingType ?? '',
      totalEpisodes: data.totalEpisodes ?? 0,
      worldSetting: data.worldSetting ?? '',
      creativePlan: data.creativePlan ?? '',
      characterDoc: data.characterDoc ?? '',
      createdAt: new Date(data.createdAt),
      updatedAt: new Date(data.updatedAt),
      sourceMode: data.sourceMode ?? 'ai',
      adaptMode: data.adaptMode ?? '',
      sourceScript: data.sourceScript ?? '',
      episodeCountMode: data.episodeCountMode ?? 'manual',
      importStatus: data.importStatus ?? 'idle',
      currentStep: data.currentStep ?? 0,
      lastCompletedStep: data.lastCompletedStep ?? 0,
      importError: data.importError ?? '',
    },
  })
  res.json({ ...project, createdAt: project.createdAt.getTime(), updatedAt: project.updatedAt.getTime() })
})

// PUT /api/projects/:id
router.put('/:id', async (req, res) => {
  const { id } = req.params
  const data = req.body
  const project = await prisma.project.update({
    where: { id, userId: req.userId },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.genre !== undefined && { genre: data.genre }),
      ...(data.audience !== undefined && { audience: data.audience }),
      ...(data.tone !== undefined && { tone: data.tone }),
      ...(data.endingType !== undefined && { endingType: data.endingType }),
      ...(data.totalEpisodes !== undefined && { totalEpisodes: data.totalEpisodes }),
      ...(data.worldSetting !== undefined && { worldSetting: data.worldSetting }),
      ...(data.creativePlan !== undefined && { creativePlan: data.creativePlan }),
      ...(data.characterDoc !== undefined && { characterDoc: data.characterDoc }),
      ...(data.sourceMode !== undefined && { sourceMode: data.sourceMode }),
      ...(data.adaptMode !== undefined && { adaptMode: data.adaptMode }),
      ...(data.sourceScript !== undefined && { sourceScript: data.sourceScript }),
      ...(data.episodeCountMode !== undefined && { episodeCountMode: data.episodeCountMode }),
      ...(data.importStatus !== undefined && { importStatus: data.importStatus }),
      ...(data.currentStep !== undefined && { currentStep: data.currentStep }),
      ...(data.lastCompletedStep !== undefined && { lastCompletedStep: data.lastCompletedStep }),
      ...(data.importError !== undefined && { importError: data.importError }),
      updatedAt: new Date(),
    },
  })
  res.json({ ...project, createdAt: project.createdAt.getTime(), updatedAt: project.updatedAt.getTime() })
})

// DELETE /api/projects/:id - Prisma cascade handles episodes + materialSets
router.delete('/:id', async (req, res) => {
  const { id } = req.params
  await prisma.project.delete({ where: { id, userId: req.userId } })
  res.json({ ok: true })
})

export default router
