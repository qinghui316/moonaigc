import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import path from 'path'
import { config } from 'dotenv'
import { PrismaClient } from '@prisma/client'
import { authMiddleware } from './middleware/auth'
import settingsRouter from './routes/settings'
import projectsRouter from './routes/projects'
import episodesRouter from './routes/episodes'
import historyRouter from './routes/history'
import materialsRouter from './routes/materials'
import aiProxyRouter from './routes/aiProxy'
import mediaRouter from './routes/media'
import shotsRouter from './routes/shots'
import gridResultsRouter from './routes/gridResults'
config()

export const prisma = new PrismaClient()

const app = express()
const PORT = Number(process.env.PORT) || 3001
const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads'

app.use(helmet({ contentSecurityPolicy: false }))
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:4173'] }))
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Serve uploaded media files
app.use('/uploads', express.static(path.resolve(UPLOAD_DIR)))

// Auth middleware for all API routes
app.use('/api', authMiddleware)

// API Routes
app.use('/api/settings', settingsRouter)
app.use('/api/projects', projectsRouter)
app.use('/api', episodesRouter)
app.use('/api/history', historyRouter)
app.use('/api/materials', materialsRouter)
app.use('/api/ai', aiProxyRouter)
app.use('/api/media', mediaRouter)
app.use('/api/shots', shotsRouter)
app.use('/api/grid-results', gridResultsRouter)
// Production: serve built frontend
if (process.env.NODE_ENV === 'production') {
  const distPath = path.resolve(__dirname, '../../dist')
  app.use(express.static(distPath))
  app.get('*', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'))
  })
}

// Auto-create default user on startup
async function ensureDefaultUser() {
  await prisma.user.upsert({
    where: { id: 'default-user' },
    update: {},
    create: { id: 'default-user', name: 'Default User' },
  })
}

async function main() {
  await ensureDefaultUser()
  app.listen(PORT, () => {
    console.log(`MoonAIGC server running on http://localhost:${PORT}`)
  })
}

main().catch(console.error)
