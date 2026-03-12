import { create } from 'zustand'
import type { ApiSettings } from '../types'
import { TEXT_PLATFORMS, VISION_PLATFORMS } from '../data/platforms'
import { settingsGet, settingsSave } from '../services/db'

type PlatformDict = Record<string, string>

interface SettingsState {
  textSettings: ApiSettings
  visionSettings: ApiSettings
  platformKeys: PlatformDict
  visionPlatformKeys: PlatformDict
  platformModels: PlatformDict
  visionPlatformModels: PlatformDict
  platformEndpoints: PlatformDict
  visionPlatformEndpoints: PlatformDict
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
  clearAllKeys: () => void
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

function applyPlatformSwitch(
  state: { platformId: string; key: string; model: string; endpoint: string },
  incoming: Partial<ApiSettings>,
  keys: PlatformDict,
  models: PlatformDict,
  endpoints: PlatformDict,
) {
  const newSettings = { ...state, ...incoming }
  const nk = { ...keys }
  const nm = { ...models }
  const ne = { ...endpoints }

  if (incoming.key !== undefined) nk[newSettings.platformId] = incoming.key

  const isSwitching = incoming.platformId && incoming.platformId !== state.platformId

  if (isSwitching) {
    // 切换前：保存当前平台的 model 和 endpoint
    nm[state.platformId] = state.model
    ne[state.platformId] = state.endpoint
    // 切换后：回填
    newSettings.key = nk[incoming.platformId!] ?? ''
    const savedModel = nm[incoming.platformId!]
    if (savedModel) newSettings.model = savedModel
    const savedEndpoint = ne[incoming.platformId!]
    if (savedEndpoint) newSettings.endpoint = savedEndpoint
  } else {
    if (incoming.model !== undefined) nm[newSettings.platformId] = incoming.model
    if (incoming.endpoint !== undefined) ne[newSettings.platformId] = incoming.endpoint
  }

  return { settings: newSettings as ApiSettings, keys: nk, models: nm, endpoints: ne }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  textSettings: defaultTextSettings,
  visionSettings: defaultVisionSettings,
  platformKeys: {},
  visionPlatformKeys: {},
  platformModels: {},
  visionPlatformModels: {},
  platformEndpoints: {},
  visionPlatformEndpoints: {},
  autoSafety: false,
  autoSound: true,
  enableWordFilter: true,
  autoSaveHistory: true,
  isLoaded: false,

  setTextSettings: (s) => {
    set(state => {
      const r = applyPlatformSwitch(
        state.textSettings, s,
        state.platformKeys, state.platformModels, state.platformEndpoints,
      )
      return {
        textSettings: r.settings,
        platformKeys: r.keys,
        platformModels: r.models,
        platformEndpoints: r.endpoints,
      }
    })
    get().persist()
  },

  setVisionSettings: (s) => {
    set(state => {
      const r = applyPlatformSwitch(
        state.visionSettings, s,
        state.visionPlatformKeys, state.visionPlatformModels, state.visionPlatformEndpoints,
      )
      return {
        visionSettings: r.settings,
        visionPlatformKeys: r.keys,
        visionPlatformModels: r.models,
        visionPlatformEndpoints: r.endpoints,
      }
    })
    get().persist()
  },

  setFlag: (key, val) => {
    set({ [key]: val })
    get().persist()
  },

  load: async () => {
    try {
      const saved = await settingsGet<{
        textSettings?: ApiSettings
        visionSettings?: ApiSettings
        platformKeys?: PlatformDict
        visionPlatformKeys?: PlatformDict
        platformModels?: PlatformDict
        visionPlatformModels?: PlatformDict
        platformEndpoints?: PlatformDict
        visionPlatformEndpoints?: PlatformDict
        autoSafety?: boolean
        autoSound?: boolean
        enableWordFilter?: boolean
        autoSaveHistory?: boolean
      }>()
      if (saved) {
        const pk = saved.platformKeys ?? {}
        const vpk = saved.visionPlatformKeys ?? {}
        const pm = saved.platformModels ?? {}
        const vpm = saved.visionPlatformModels ?? {}
        const pe = saved.platformEndpoints ?? {}
        const vpe = saved.visionPlatformEndpoints ?? {}

        const ts = { ...defaultTextSettings, ...saved.textSettings }
        if (ts.key && !pk[ts.platformId]) pk[ts.platformId] = ts.key
        if (ts.model && !pm[ts.platformId]) pm[ts.platformId] = ts.model
        if (ts.endpoint && !pe[ts.platformId]) pe[ts.platformId] = ts.endpoint

        const vs = { ...defaultVisionSettings, ...saved.visionSettings }
        if (vs.key && !vpk[vs.platformId]) vpk[vs.platformId] = vs.key
        if (vs.model && !vpm[vs.platformId]) vpm[vs.platformId] = vs.model
        if (vs.endpoint && !vpe[vs.platformId]) vpe[vs.platformId] = vs.endpoint

        set({
          textSettings: ts,
          visionSettings: vs,
          platformKeys: pk,
          visionPlatformKeys: vpk,
          platformModels: pm,
          visionPlatformModels: vpm,
          platformEndpoints: pe,
          visionPlatformEndpoints: vpe,
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
    await settingsSave({
      textSettings: state.textSettings,
      visionSettings: state.visionSettings,
      platformKeys: state.platformKeys,
      visionPlatformKeys: state.visionPlatformKeys,
      platformModels: state.platformModels,
      visionPlatformModels: state.visionPlatformModels,
      platformEndpoints: state.platformEndpoints,
      visionPlatformEndpoints: state.visionPlatformEndpoints,
      autoSafety: state.autoSafety,
      autoSound: state.autoSound,
      enableWordFilter: state.enableWordFilter,
      autoSaveHistory: state.autoSaveHistory,
    })
  },

  clearAllKeys: () => {
    set(state => ({
      textSettings: { ...state.textSettings, key: '' },
      visionSettings: { ...state.visionSettings, key: '' },
      platformKeys: {},
      visionPlatformKeys: {},
    }))
    get().persist()
  },

  getActiveTextSettings: () => get().textSettings,
  getActiveVisionSettings: () => get().visionSettings,
}))
