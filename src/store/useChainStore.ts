import { create } from 'zustand'
import type { Scene, ChatMessage, BridgeState } from '../types'

interface ChainState {
  scenes: Scene[]
  sceneContents: Record<number, string>
  sceneChatHistory: Record<number, ChatMessage[]>
  sceneBridges: Record<number, BridgeState | null>
  isRunning: boolean
  isCancelled: boolean
  currentSceneId: number | null
  totalDuration: number
  globalOffset: number
  cleanPlot: string
  abortController: AbortController | null

  setScenes: (scenes: Scene[]) => void
  updateScene: (id: number, update: Partial<Scene>) => void
  setSceneContent: (id: number, content: string) => void
  appendSceneContent: (id: number, token: string) => void
  setSceneChatHistory: (id: number, history: ChatMessage[]) => void
  setSceneBridge: (id: number, bridge: BridgeState | null) => void
  setRunning: (val: boolean) => void
  setCancelled: (val: boolean) => void
  setCurrentSceneId: (id: number | null) => void
  setTotalDuration: (sec: number) => void
  setGlobalOffset: (sec: number) => void
  setCleanPlot: (plot: string) => void
  setAbortController: (ctrl: AbortController | null) => void
  cancel: () => void
  reset: () => void
}

export const useChainStore = create<ChainState>((set, get) => ({
  scenes: [],
  sceneContents: {},
  sceneChatHistory: {},
  sceneBridges: {},
  isRunning: false,
  isCancelled: false,
  currentSceneId: null,
  totalDuration: 120,
  globalOffset: 0,
  cleanPlot: '',
  abortController: null,

  setScenes: (scenes) => set({ scenes }),
  updateScene: (id, update) =>
    set(state => ({
      scenes: state.scenes.map(s => (s.id === id ? { ...s, ...update } : s)),
    })),
  setSceneContent: (id, content) =>
    set(state => ({ sceneContents: { ...state.sceneContents, [id]: content } })),
  appendSceneContent: (id, token) =>
    set(state => ({
      sceneContents: {
        ...state.sceneContents,
        [id]: (state.sceneContents[id] ?? '') + token,
      },
    })),
  setSceneChatHistory: (id, history) =>
    set(state => ({ sceneChatHistory: { ...state.sceneChatHistory, [id]: history } })),
  setSceneBridge: (id, bridge) =>
    set(state => ({ sceneBridges: { ...state.sceneBridges, [id]: bridge } })),
  setRunning: (val) => set({ isRunning: val }),
  setCancelled: (val) => set({ isCancelled: val }),
  setCurrentSceneId: (id) => set({ currentSceneId: id }),
  setTotalDuration: (sec) => set({ totalDuration: sec }),
  setGlobalOffset: (sec) => set({ globalOffset: sec }),
  setCleanPlot: (plot) => set({ cleanPlot: plot }),
  setAbortController: (ctrl) => set({ abortController: ctrl }),
  cancel: () => {
    get().abortController?.abort()
    set({ isCancelled: true, isRunning: false, currentSceneId: null, abortController: null })
  },
  reset: () =>
    set({
      scenes: [],
      sceneContents: {},
      sceneChatHistory: {},
      sceneBridges: {},
      isRunning: false,
      isCancelled: false,
      currentSceneId: null,
      abortController: null,
    }),
}))
