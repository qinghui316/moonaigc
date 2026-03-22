import React, { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import TabNav from './components/layout/TabNav'
import Footer from './components/layout/Footer'
import SettingsPanel from './components/settings/SettingsPanel'
import CreatePage from './components/create/CreatePage'
import ImageGenPage from './components/imagegen/ImageGenPage'
import MaterialPage from './components/materials/MaterialPage'
import ProjectPage from './components/projects/ProjectPage'
import ScriptWorkPage from './components/scriptwork/ScriptWorkPage'
import GalleryPage from './components/gallery/GalleryPage'
import type { TabId } from './components/layout/TabNav'
import type { Episode } from './types'
import { useSettingsStore } from './store/useSettingsStore'
import { useMaterialStore } from './store/useMaterialStore'
import { useThemeStore } from './store/useThemeStore'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('projects')
  const [showSettings, setShowSettings] = useState(false)
  const [loadedEpisode, setLoadedEpisode] = useState<Episode | null>(null)
  const { load: loadSettings } = useSettingsStore()
  const { load: loadMaterials } = useMaterialStore()
  const theme = useThemeStore(s => s.theme)

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  useEffect(() => {
    loadSettings()
    loadMaterials()

    // Ctrl+Enter 快捷键全局绑定
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault()
        document.querySelector<HTMLButtonElement>('[data-action="generate"]')?.click()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler) as void
  }, [])

  const handleLoadEpisode = (episode: Episode) => {
    setLoadedEpisode(episode)
    setActiveTab('create')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-200 overflow-hidden">
      <Header onSettingsClick={() => setShowSettings(true)} />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <main className="flex-1 overflow-hidden relative">
        <div className="h-full" style={{ display: activeTab === 'projects' ? 'block' : 'none' }}>
          <ProjectPage onNavigate={setActiveTab} />
        </div>
        <div className="h-full" style={{ display: activeTab === 'scriptwork' ? 'block' : 'none' }}>
          <ScriptWorkPage onNavigate={setActiveTab} onLoadEpisode={handleLoadEpisode} />
        </div>
        <div className="h-full" style={{ display: activeTab === 'create' ? 'block' : 'none' }}>
          <CreatePage
            key={loadedEpisode?.id ?? 'create'}
            loadedEpisode={loadedEpisode}
          />
        </div>
        <div className="h-full" style={{ display: activeTab === 'imagegen' ? 'block' : 'none' }}>
          <ImageGenPage />
        </div>
        <div className="h-full" style={{ display: activeTab === 'materials' ? 'block' : 'none' }}>
          <MaterialPage />
        </div>
        <div className="h-full" style={{ display: activeTab === 'gallery' ? 'block' : 'none' }}>
          <GalleryPage />
        </div>
      </main>

      <Footer />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
