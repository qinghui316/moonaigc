import { create } from 'zustand'
import type { ApiSettings, ImageGenSettings } from '../types'
import { TEXT_PLATFORMS, VISION_PLATFORMS, IMAGE_PLATFORMS } from '../data/platforms'
import { settingsGet, settingsSave } from '../services/db'

type PlatformDict = Record<string, string>

interface SettingsState {
  textSettings: ApiSettings
  visionSettings: ApiSettings
  imageSettings: ImageGenSettings
  imageStyleKey: string
  assetStyleKey: string
  platformKeys: PlatformDict
  visionPlatformKeys: PlatformDict
  imagePlatformKeys: PlatformDict
  platformModels: PlatformDict
  visionPlatformModels: PlatformDict
  imagePlatformModels: PlatformDict
  platformEndpoints: PlatformDict
  visionPlatformEndpoints: PlatformDict
  imagePlatformEndpoints: PlatformDict
  autoSafety: boolean
  autoSound: boolean
  enableWordFilter: boolean
  autoSaveHistory: boolean
  isLoaded: boolean
  setTextSettings: (s: Partial<ApiSettings>) => void
  setVisionSettings: (s: Partial<ApiSettings>) => void
  setImageSettings: (s: Partial<ImageGenSettings>) => void
  setImageStyleKey: (styleKey: string) => void
  setAssetStyleKey: (styleKey: string) => void
  setFlag: (key: 'autoSafety' | 'autoSound' | 'enableWordFilter' | 'autoSaveHistory', val: boolean) => void
  load: () => Promise<void>
  persist: () => Promise<void>
  getActiveTextSettings: () => ApiSettings
  getActiveVisionSettings: () => ApiSettings
  getActiveImageSettings: () => ImageGenSettings
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

const defaultImageSettings: ImageGenSettings = {
  platformId: IMAGE_PLATFORMS[0].id,
  endpoint: IMAGE_PLATFORMS[0].endpoint,
  model: IMAGE_PLATFORMS[0].defaultModel,
  mode: IMAGE_PLATFORMS[0].mode,
  key: '',
  aspectRatio: '1:1',
  imageResolution: '2K',
}

const IMAGE_STYLE_STORAGE_KEY = 'moonaigc.imageStyleKey'
const ASSET_STYLE_STORAGE_KEY = 'moonaigc.assetStyleKey'

function readLocalStyle(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}

function writeLocalStyle(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value)
  } catch {
    // ignore
  }
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
  imageSettings: defaultImageSettings,
  imageStyleKey: readLocalStyle(IMAGE_STYLE_STORAGE_KEY, 'cinematic'),
  assetStyleKey: readLocalStyle(ASSET_STYLE_STORAGE_KEY, 'cinematic'),
  platformKeys: {},
  visionPlatformKeys: {},
  imagePlatformKeys: {},
  platformModels: {},
  visionPlatformModels: {},
  imagePlatformModels: {},
  platformEndpoints: {},
  visionPlatformEndpoints: {},
  imagePlatformEndpoints: {},
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
    if (get().isLoaded) get().persist()
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
    if (get().isLoaded) get().persist()
  },

  setImageSettings: (s) => {
    set(state => {
      const cur = state.imageSettings
      const nk = { ...state.imagePlatformKeys }
      const nm = { ...state.imagePlatformModels }
      const ne = { ...state.imagePlatformEndpoints }
      const newSettings = { ...cur, ...s }
      if (s.key !== undefined) nk[newSettings.platformId] = s.key
      const isSwitching = s.platformId && s.platformId !== cur.platformId
      if (isSwitching) {
        nm[cur.platformId] = cur.model
        ne[cur.platformId] = cur.endpoint
        newSettings.key = nk[s.platformId!] ?? ''
        if (nm[s.platformId!]) newSettings.model = nm[s.platformId!]
        if (ne[s.platformId!]) newSettings.endpoint = ne[s.platformId!]
      } else {
        if (s.model !== undefined) nm[newSettings.platformId] = s.model
        if (s.endpoint !== undefined) ne[newSettings.platformId] = s.endpoint
      }
      return { imageSettings: newSettings, imagePlatformKeys: nk, imagePlatformModels: nm, imagePlatformEndpoints: ne }
    })
    if (get().isLoaded) get().persist()
  },

  setImageStyleKey: (styleKey) => {
    set({ imageStyleKey: styleKey })
    writeLocalStyle(IMAGE_STYLE_STORAGE_KEY, styleKey)
    if (get().isLoaded) get().persist()
  },

  setAssetStyleKey: (styleKey) => {
    set({ assetStyleKey: styleKey })
    writeLocalStyle(ASSET_STYLE_STORAGE_KEY, styleKey)
    if (get().isLoaded) get().persist()
  },

  setFlag: (key, val) => {
    set({ [key]: val })
    if (get().isLoaded) get().persist()
  },

  load: async () => {
    try {
      const saved = await settingsGet<{
        textSettings?: ApiSettings
        visionSettings?: ApiSettings
        imageSettings?: ImageGenSettings
        imageStyleKey?: string
        assetStyleKey?: string
        platformKeys?: PlatformDict
        visionPlatformKeys?: PlatformDict
        imagePlatformKeys?: PlatformDict
        platformModels?: PlatformDict
        visionPlatformModels?: PlatformDict
        imagePlatformModels?: PlatformDict
        platformEndpoints?: PlatformDict
        visionPlatformEndpoints?: PlatformDict
        imagePlatformEndpoints?: PlatformDict
        autoSafety?: boolean
        autoSound?: boolean
        enableWordFilter?: boolean
        autoSaveHistory?: boolean
      }>()
      if (saved) {
        const pk = saved.platformKeys ?? {}
        const vpk = saved.visionPlatformKeys ?? {}
        const ipk = saved.imagePlatformKeys ?? {}
        const pm = saved.platformModels ?? {}
        const vpm = saved.visionPlatformModels ?? {}
        const ipm = saved.imagePlatformModels ?? {}
        const pe = saved.platformEndpoints ?? {}
        const vpe = saved.visionPlatformEndpoints ?? {}
        const ipe = saved.imagePlatformEndpoints ?? {}

        const ts = { ...defaultTextSettings, ...saved.textSettings }
        if (!ts.key && pk[ts.platformId]) ts.key = pk[ts.platformId]
        if (ts.key && !pk[ts.platformId]) pk[ts.platformId] = ts.key
        if (ts.model && !pm[ts.platformId]) pm[ts.platformId] = ts.model
        if (ts.endpoint && !pe[ts.platformId]) pe[ts.platformId] = ts.endpoint

        const vs = { ...defaultVisionSettings, ...saved.visionSettings }
        if (!vs.key && vpk[vs.platformId]) vs.key = vpk[vs.platformId]
        if (vs.key && !vpk[vs.platformId]) vpk[vs.platformId] = vs.key
        if (vs.model && !vpm[vs.platformId]) vpm[vs.platformId] = vs.model
        if (vs.endpoint && !vpe[vs.platformId]) vpe[vs.platformId] = vs.endpoint

        const is = { ...defaultImageSettings, ...saved.imageSettings }
        if (!is.key && ipk[is.platformId]) is.key = ipk[is.platformId]
        if (is.key && !ipk[is.platformId]) ipk[is.platformId] = is.key
        if (is.model && !ipm[is.platformId]) ipm[is.platformId] = is.model
        if (is.endpoint && !ipe[is.platformId]) ipe[is.platformId] = is.endpoint

        set({
          textSettings: ts,
          visionSettings: vs,
          imageSettings: is,
          imageStyleKey: saved.imageStyleKey ?? readLocalStyle(IMAGE_STYLE_STORAGE_KEY, 'cinematic'),
          assetStyleKey: saved.assetStyleKey ?? readLocalStyle(ASSET_STYLE_STORAGE_KEY, 'cinematic'),
          platformKeys: pk,
          visionPlatformKeys: vpk,
          imagePlatformKeys: ipk,
          platformModels: pm,
          visionPlatformModels: vpm,
          imagePlatformModels: ipm,
          platformEndpoints: pe,
          visionPlatformEndpoints: vpe,
          imagePlatformEndpoints: ipe,
          autoSafety: saved.autoSafety ?? false,
          autoSound: saved.autoSound ?? true,
          enableWordFilter: saved.enableWordFilter ?? true,
          autoSaveHistory: saved.autoSaveHistory ?? true,
        })
      } else {
        set({
          imageStyleKey: readLocalStyle(IMAGE_STYLE_STORAGE_KEY, 'cinematic'),
          assetStyleKey: readLocalStyle(ASSET_STYLE_STORAGE_KEY, 'cinematic'),
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
      imageSettings: state.imageSettings,
      imageStyleKey: state.imageStyleKey,
      assetStyleKey: state.assetStyleKey,
      platformKeys: state.platformKeys,
      visionPlatformKeys: state.visionPlatformKeys,
      imagePlatformKeys: state.imagePlatformKeys,
      platformModels: state.platformModels,
      visionPlatformModels: state.visionPlatformModels,
      imagePlatformModels: state.imagePlatformModels,
      platformEndpoints: state.platformEndpoints,
      visionPlatformEndpoints: state.visionPlatformEndpoints,
      imagePlatformEndpoints: state.imagePlatformEndpoints,
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
      imageSettings: { ...state.imageSettings, key: '' },
      platformKeys: {},
      visionPlatformKeys: {},
      imagePlatformKeys: {},
    }))
    get().persist()
  },

  getActiveTextSettings: () => get().textSettings,
  getActiveVisionSettings: () => get().visionSettings,
  getActiveImageSettings: () => get().imageSettings,
}))
