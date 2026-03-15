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
router.put('/', async (req, res) => {
  const data = req.body
  const common = {
    textSettings: data.textSettings ?? {},
    visionSettings: data.visionSettings ?? {},
    imageSettings: data.imageSettings ?? {},
    platformKeys: data.platformKeys ?? {},
    visionPlatformKeys: data.visionPlatformKeys ?? {},
    imagePlatformKeys: data.imagePlatformKeys ?? {},
    platformModels: data.platformModels ?? {},
    visionPlatformModels: data.visionPlatformModels ?? {},
    imagePlatformModels: data.imagePlatformModels ?? {},
    platformEndpoints: data.platformEndpoints ?? {},
    visionPlatformEndpoints: data.visionPlatformEndpoints ?? {},
    imagePlatformEndpoints: data.imagePlatformEndpoints ?? {},
    autoSafety: data.autoSafety ?? false,
    autoSound: data.autoSound ?? true,
    enableWordFilter: data.enableWordFilter ?? true,
    autoSaveHistory: data.autoSaveHistory ?? true,
  }
  const settings = await prisma.userSettings.upsert({
    where: { userId: req.userId },
    update: common,
    create: { userId: req.userId, ...common },
  })
  res.json(settings)
})

export default router
