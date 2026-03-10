import { create } from 'zustand'
import type { ApiSettings } from '../types'
import { TEXT_PLATFORMS, VISION_PLATFORMS } from '../data/platforms'
import { kvGet, kvSet } from '../services/db'

interface SettingsState {
  textSettings: ApiSettings
  visionSettings: ApiSettings
  autoSafety: boolean
  autoSound: boolean
  enableWordFilter: boolean
  autoSaveHistory: boolean
  isLoaded: boolean
  setTextSettings: (s: Partial<ApiSettings>) => void
  setVisionSettings: (s: Partial<ApiSettings>) => void
  setFlag: (key: 'autoSafety' | 'autoSound' | 'enableWordFilter' | 'autoSaveHistory', val: boolean) => void
  load: () => Promise<void>
  persist: () => Promise<void>
  getActiveTextSettings: () => ApiSettings
  getActiveVisionSettings: () => ApiSettings
}

const defaultTextSettings: ApiSettings = {
  platformId: TEXT_PLATFORMS[0].id,
  endpoint: TEXT_PLATFORMS[0].endpoint,
  model: TEXT_PLATFORMS[0].defaultModel,
  mode: TEXT_PLATFORMS[0].mode,
  key: '',
}

const defaultVisionSettings: ApiSettings = {
  platformId: VISION_PLATFORMS[0].id,
  endpoint: VISION_PLATFORMS[0].endpoint,
  model: VISION_PLATFORMS[0].defaultModel,
  mode: VISION_PLATFORMS[0].mode,
  key: '',
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  textSettings: defaultTextSettings,
  visionSettings: defaultVisionSettings,
  autoSafety: false,
  autoSound: true,
  enableWordFilter: true,
  autoSaveHistory: true,
  isLoaded: false,

  setTextSettings: (s) => {
    set(state => ({ textSettings: { ...state.textSettings, ...s } }))
    get().persist()
  },

  setVisionSettings: (s) => {
    set(state => ({ visionSettings: { ...state.visionSettings, ...s } }))
    get().persist()
  },

  setFlag: (key, val) => {
    set({ [key]: val })
    get().persist()
  },

  load: async () => {
    try {
      const saved = await kvGet<{
        textSettings?: ApiSettings
        visionSettings?: ApiSettings
        autoSafety?: boolean
        autoSound?: boolean
        enableWordFilter?: boolean
        autoSaveHistory?: boolean
      }>('settings')
      if (saved) {
        set({
          textSettings: { ...defaultTextSettings, ...saved.textSettings },
          visionSettings: { ...defaultVisionSettings, ...saved.visionSettings },
          autoSafety: saved.autoSafety ?? false,
          autoSound: saved.autoSound ?? true,
          enableWordFilter: saved.enableWordFilter ?? true,
          autoSaveHistory: saved.autoSaveHistory ?? true,
        })
      }
    } catch {
      // ignore
    }
    set({ isLoaded: true })
  },

  persist: async () => {
    const state = get()
    await kvSet('settings', {
      textSettings: state.textSettings,
      visionSettings: state.visionSettings,
      autoSafety: state.autoSafety,
      autoSound: state.autoSound,
      enableWordFilter: state.enableWordFilter,
      autoSaveHistory: state.autoSaveHistory,
    })
  },

  getActiveTextSettings: () => get().textSettings,
  getActiveVisionSettings: () => get().visionSettings,
}))
