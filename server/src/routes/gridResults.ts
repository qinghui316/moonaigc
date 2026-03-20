import { Router, Request, Response } from 'express'
import { Prisma } from '@prisma/client'
import { prisma } from '../index'
import fs from 'fs'

const router = Router()

type GridPanelInput = {
  panelOrder: number
  timeRange?: string
  seedancePrompt?: string
  sourceSeedancePrompts?: Array<{
    sourceShotRef?: string
    prompt?: string
  }>
  imagePromptText?: string
  sourceShotRefs?: string[]
}

const asStringArray = (value: unknown): string[] => Array.isArray(value)
  ? value.map(item => String(item)).filter(Boolean)
  : []

const asSourceSeedancePrompts = (
  value: unknown,
): Array<{ sourceShotRef: string; prompt: string }> => Array.isArray(value)
  ? value
    .map(item => {
      if (!item || typeof item !== 'object') return null
      const record = item as Record<string, unknown>
      const sourceShotRef = String(record.sourceShotRef ?? '').trim()
      const prompt = String(record.prompt ?? '').trim()
      if (!sourceShotRef || !prompt) return null
      return { sourceShotRef, prompt }
    })
    .filter((item): item is { sourceShotRef: string; prompt: string } => item !== null)
  : []

router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      projectId,
      episodeId,
      historyId,
      mediaFileId,
      layout = '3x3',
      aspectRatio = '16:9',
      sourceShotRefs = [],
      usedReferenceImages = [],
      rawModelOutput = '',
      validationPassed = true,
      panels = [],
    } = req.body as {
      projectId?: string
      episodeId?: string
      historyId?: number
      mediaFileId?: number
      layout?: string
      aspectRatio?: string
      sourceShotRefs?: string[]
      usedReferenceImages?: Array<Record<string, unknown>>
      rawModelOutput?: string
      validationPassed?: boolean
      panels?: GridPanelInput[]
    }

    const created = await prisma.gridResult.create({
      data: {
        userId: req.userId,
        ...(projectId ? { projectId } : {}),
        ...(episodeId ? { episodeId } : {}),
        ...(historyId ? { historyId } : {}),
        ...(mediaFileId ? { mediaFileId } : {}),
        layout,
        aspectRatio,
        sourceShotRefs,
        usedReferenceImages: usedReferenceImages as Prisma.InputJsonValue,
        rawModelOutput,
        validationPassed,
        panels: {
          create: panels.map(panel => ({
            panelOrder: panel.panelOrder,
            timeRange: panel.timeRange ?? '',
            seedancePrompt: panel.seedancePrompt ?? '',
            sourceSeedancePrompts: (panel.sourceSeedancePrompts ?? []) as Prisma.InputJsonValue,
            imagePromptText: panel.imagePromptText ?? '',
            sourceShotRefs: panel.sourceShotRefs ?? [],
          })),
        },
      },
      include: {
        mediaFile: true,
        panels: { orderBy: { panelOrder: 'asc' } },
      },
    })

    res.json({
      ...created,
      sourceShotRefs: asStringArray(created.sourceShotRefs),
      usedReferenceImages: Array.isArray(created.usedReferenceImages) ? created.usedReferenceImages : [],
      panels: created.panels.map(panel => ({
        ...panel,
        sourceShotRefs: asStringArray(panel.sourceShotRefs),
        sourceSeedancePrompts: asSourceSeedancePrompts(panel.sourceSeedancePrompts),
      })),
      mediaUrl: created.mediaFile ? `/api/media/${created.mediaFile.id}/file` : null,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.get('/', async (req: Request, res: Response) => {
  try {
    const { projectId, episodeId } = req.query as Record<string, string>
    const where: Record<string, unknown> = { userId: req.userId }
    if (projectId) where.projectId = projectId
    if (episodeId) where.episodeId = episodeId

    const results = await prisma.gridResult.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        mediaFile: true,
        panels: {
          orderBy: { panelOrder: 'asc' },
          select: { id: true },
        },
      },
    })

    res.json(results.map(result => ({
      id: result.id,
      projectId: result.projectId,
      episodeId: result.episodeId,
      historyId: result.historyId,
      layout: result.layout,
      aspectRatio: result.aspectRatio,
      validationPassed: result.validationPassed,
      createdAt: result.createdAt,
      updatedAt: result.updatedAt,
      panelCount: result.panels.length,
      sourceShotRefs: asStringArray(result.sourceShotRefs),
      usedReferenceImages: Array.isArray(result.usedReferenceImages) ? result.usedReferenceImages : [],
      mediaFileId: result.mediaFileId,
      mediaUrl: result.mediaFile ? `/api/media/${result.mediaFile.id}/file` : null,
    })))
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await prisma.gridResult.findFirst({
      where: { id, userId: req.userId },
      include: {
        mediaFile: true,
        panels: { orderBy: { panelOrder: 'asc' } },
      },
    })

    if (!result) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({
      ...result,
      sourceShotRefs: asStringArray(result.sourceShotRefs),
      usedReferenceImages: Array.isArray(result.usedReferenceImages) ? result.usedReferenceImages : [],
      panels: result.panels.map(panel => ({
        ...panel,
        sourceShotRefs: asStringArray(panel.sourceShotRefs),
        sourceSeedancePrompts: asSourceSeedancePrompts(panel.sourceSeedancePrompts),
      })),
      mediaUrl: result.mediaFile ? `/api/media/${result.mediaFile.id}/file` : null,
    })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.put('/:id/media', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const { mediaFileId } = req.body as { mediaFileId?: number }
    const existing = await prisma.gridResult.findFirst({
      where: { id, userId: req.userId },
      include: { mediaFile: true },
    })

    if (!existing) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    const updated = await prisma.gridResult.update({
      where: { id },
      data: {
        ...(mediaFileId !== undefined ? { mediaFileId } : {}),
      },
      include: {
        mediaFile: true,
        panels: { orderBy: { panelOrder: 'asc' } },
      },
    })

    res.json({
      ...updated,
      sourceShotRefs: asStringArray(updated.sourceShotRefs),
      usedReferenceImages: Array.isArray(updated.usedReferenceImages) ? updated.usedReferenceImages : [],
      panels: updated.panels.map(panel => ({
        ...panel,
        sourceShotRefs: asStringArray(panel.sourceShotRefs),
        sourceSeedancePrompts: asSourceSeedancePrompts(panel.sourceSeedancePrompts),
      })),
      mediaUrl: updated.mediaFile ? `/api/media/${updated.mediaFile.id}/file` : null,
    })

    if (
      existing.mediaFile
      && mediaFileId !== undefined
      && existing.mediaFile.id !== mediaFileId
    ) {
      try {
        if (fs.existsSync(existing.mediaFile.filePath)) {
          fs.unlinkSync(existing.mediaFile.filePath)
        }
      } catch {
        // ignore file removal errors and continue removing DB record
      }
      await prisma.mediaFile.delete({ where: { id: existing.mediaFile.id } })
    }
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = Number(req.params.id)
    const result = await prisma.gridResult.findFirst({
      where: { id, userId: req.userId },
      include: { mediaFile: true },
    })

    if (!result) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    await prisma.gridResult.delete({ where: { id: result.id } })

    if (result.mediaFile) {
      try {
        if (fs.existsSync(result.mediaFile.filePath)) {
          fs.unlinkSync(result.mediaFile.filePath)
        }
      } catch {
        // ignore file removal errors and continue removing DB record
      }
      await prisma.mediaFile.delete({ where: { id: result.mediaFile.id } })
    }

    res.json({ success: true })
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

export default router
