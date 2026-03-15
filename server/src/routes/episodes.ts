import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

// GET /api/projects/:pid/episodes - sorted by episodeNumber ASC
router.get('/projects/:pid/episodes', async (req, res) => {
  const episodes = await prisma.episode.findMany({
    where: { projectId: req.params.pid },
    orderBy: { episodeNumber: 'asc' },
  })
  res.json(episodes)
})

// POST /api/projects/:pid/episodes - single or batch
router.post('/projects/:pid/episodes', async (req, res) => {
  const { pid } = req.params
  const body = req.body

  // Batch: array of episodes
  if (Array.isArray(body)) {
    await prisma.episode.createMany({
      data: body.map((ep: Record<string, unknown>) => ({
        id: ep.id as string,
        projectId: pid,
        episodeNumber: ep.episodeNumber as number,
        title: (ep.title as string) ?? '',
        summary: (ep.summary as string) ?? '',
        hookType: (ep.hookType as string) ?? '',
        mark: (ep.mark as string) ?? '',
        script: (ep.script as string) ?? '',
        status: (ep.status as string) ?? 'outline',
        sourceText: (ep.sourceText as string) ?? '',
      })),
      skipDuplicates: true,
    })
    res.json({ ok: true })
    return
  }

  // Single episode
  const ep = await prisma.episode.create({
    data: {
      id: body.id,
      projectId: pid,
      episodeNumber: body.episodeNumber,
      title: body.title ?? '',
      summary: body.summary ?? '',
      hookType: body.hookType ?? '',
      mark: body.mark ?? '',
      script: body.script ?? '',
      status: body.status ?? 'outline',
      sourceText: body.sourceText ?? '',
    },
  })
  res.json(ep)
})

// PUT /api/episodes/:id
router.put('/episodes/:id', async (req, res) => {
  const data = req.body
  const ep = await prisma.episode.update({
    where: { id: req.params.id },
    data: {
      ...(data.title !== undefined && { title: data.title }),
      ...(data.summary !== undefined && { summary: data.summary }),
      ...(data.hookType !== undefined && { hookType: data.hookType }),
      ...(data.mark !== undefined && { mark: data.mark }),
      ...(data.script !== undefined && { script: data.script }),
      ...(data.status !== undefined && { status: data.status }),
      ...(data.episodeNumber !== undefined && { episodeNumber: data.episodeNumber }),
      ...(data.sourceText !== undefined && { sourceText: data.sourceText }),
    },
  })
  res.json(ep)
})

// DELETE /api/episodes/:id
router.delete('/episodes/:id', async (req, res) => {
  await prisma.episode.delete({ where: { id: req.params.id } })
  res.json({ ok: true })
})

export default router
