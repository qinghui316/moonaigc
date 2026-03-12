import { Router } from 'express'
import { prisma } from '../index'

const router = Router()

// GET /api/settings
router.get('/', async (req, res) => {
  const settings = await prisma.userSettings.findUnique({
    where: { userId: req.userId },
  })
  if (!settings) {
    res.json(null)
    return
  }
  res.json(settings)
})

// PUT /api/settings
// TODO: encrypt API keys before storing to DB (AES-256-GCM when multi-user is added)
router.put('/', async (req, res) => {
  const data = req.body
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId },
    update: {
      textSettings: data.textSettings ?? {},
      visionSettings: data.visionSettings ?? {},
      platformKeys: data.platformKeys ?? {},
      visionPlatformKeys: data.visionPlatformKeys ?? {},
      platformModels: data.platformModels ?? {},
      visionPlatformModels: data.visionPlatformModels ?? {},
      platformEndpoints: data.platformEndpoints ?? {},
      visionPlatformEndpoints: data.visionPlatformEndpoints ?? {},
      autoSafety: data.autoSafety ?? false,
      autoSound: data.autoSound ?? true,
      enableWordFilter: data.enableWordFilter ?? true,
      autoSaveHistory: data.autoSaveHistory ?? true,
    },
    create: {
      userId: req.userId,
      textSettings: data.textSettings ?? {},
      visionSettings: data.visionSettings ?? {},
      platformKeys: data.platformKeys ?? {},
      visionPlatformKeys: data.visionPlatformKeys ?? {},
      platformModels: data.platformModels ?? {},
      visionPlatformModels: data.visionPlatformModels ?? {},
      platformEndpoints: data.platformEndpoints ?? {},
      visionPlatformEndpoints: data.visionPlatformEndpoints ?? {},
      autoSafety: data.autoSafety ?? false,
      autoSound: data.autoSound ?? true,
      enableWordFilter: data.enableWordFilter ?? true,
      autoSaveHistory: data.autoSaveHistory ?? true,
    },
  })
  res.json(settings)
})

export default router
