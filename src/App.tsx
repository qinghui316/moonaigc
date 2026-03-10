import React, { useState, useEffect } from 'react'
import Header from './components/layout/Header'
import TabNav from './components/layout/TabNav'
import Footer from './components/layout/Footer'
import SettingsPanel from './components/settings/SettingsPanel'
import CreatePage from './components/create/CreatePage'
import MaterialPage from './components/materials/MaterialPage'
import HistoryPage from './components/history/HistoryPage'
import type { TabId } from './components/layout/TabNav'
import type { HistoryRecord } from './types'
import { useSettingsStore } from './store/useSettingsStore'
import { useMaterialStore } from './store/useMaterialStore'
import { useThemeStore } from './store/useThemeStore'

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>('create')
  const [showSettings, setShowSettings] = useState(false)
  const [loadedRecord, setLoadedRecord] = useState<HistoryRecord | null>(null)
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

  const handleLoadHistory = (record: HistoryRecord) => {
    setLoadedRecord(record)
    setActiveTab('create')
  }

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-gray-200 overflow-hidden">
      <Header onSettingsClick={() => setShowSettings(true)} />
      <TabNav activeTab={activeTab} onChange={setActiveTab} />

      <main className="flex-1 overflow-hidden">
        {activeTab === 'create' && (
          <CreatePage key={loadedRecord?.id} loadedRecord={loadedRecord} />
        )}
        {activeTab === 'materials' && <MaterialPage />}
        {activeTab === 'history' && <HistoryPage onLoad={handleLoadHistory} />}
      </main>

      <Footer />

      {showSettings && <SettingsPanel onClose={() => setShowSettings(false)} />}
    </div>
  )
}

export default App
