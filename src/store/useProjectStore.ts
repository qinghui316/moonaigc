import { create } from 'zustand'
import type { Project, Episode } from '../types'
import {
  projectAdd, projectUpdate, projectGetAll, projectDelete,
  episodeAdd, episodeBatchAdd, episodeUpdate, episodesByProject, episodeDelete,
} from '../services/db'

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  episodes: Episode[]
  currentEpisode: Episode | null

  loadProjects: () => Promise<void>
  addProject: (p: Omit<Project, 'id' | 'createdAt' | 'updatedAt'>) => Promise<Project>
  updateProject: (id: string, data: Partial<Project>) => Promise<void>
  deleteProject: (id: string) => Promise<void>
  selectProject: (id: string) => Promise<void>
  deselectProject: () => void

  loadEpisodes: (projectId: string) => Promise<void>
  addEpisode: (ep: Omit<Episode, 'id'>) => Promise<Episode>
  batchAddEpisodes: (eps: Omit<Episode, 'id'>[]) => Promise<void>
  updateEpisode: (id: string, data: Partial<Episode>) => Promise<void>
  deleteEpisode: (id: string) => Promise<void>
  selectEpisode: (id: string | null) => void
  updateEpisodeStatus: (id: string, status: Episode['status']) => Promise<void>
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  projects: [],
  currentProject: null,
  episodes: [],
  currentEpisode: null,

  loadProjects: async () => {
    const projects = await projectGetAll()
    set({ projects })
  },

  addProject: async (data) => {
    const now = Date.now()
    const p: Project = {
      id: crypto.randomUUID(),
      createdAt: now,
      updatedAt: now,
      ...data,
    }
    await projectAdd(p)
    set(state => ({ projects: [p, ...state.projects] }))
    return p
  },

  updateProject: async (id, data) => {
    await projectUpdate(id, data)
    set(state => ({
      projects: state.projects.map(p => p.id === id ? { ...p, ...data, updatedAt: Date.now() } : p),
      currentProject: state.currentProject?.id === id
        ? { ...state.currentProject, ...data, updatedAt: Date.now() }
        : state.currentProject,
    }))
  },

  deleteProject: async (id) => {
    await projectDelete(id)
    set(state => ({
      projects: state.projects.filter(p => p.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
      episodes: state.currentProject?.id === id ? [] : state.episodes,
      currentEpisode: state.currentProject?.id === id ? null : state.currentEpisode,
    }))
    // 卸载该项目的素材库（延迟导入避免循环依赖）
    const { useMaterialStore } = await import('./useMaterialStore')
    useMaterialStore.getState().loadForProject(undefined)
  },

  selectProject: async (id) => {
    const project = get().projects.find(p => p.id === id) ?? null
    set({ currentProject: project, currentEpisode: null })
    if (project) {
      const episodes = await episodesByProject(id)
      set({ episodes })
      // 切换项目素材库
      const { useMaterialStore } = await import('./useMaterialStore')
      await useMaterialStore.getState().loadForProject(id)
    }
  },

  deselectProject: () => {
    set({ currentProject: null, episodes: [], currentEpisode: null })
    import('./useMaterialStore').then(({ useMaterialStore }) => {
      useMaterialStore.getState().loadForProject(undefined)
    })
  },

  loadEpisodes: async (projectId) => {
    const episodes = await episodesByProject(projectId)
    set({ episodes })
  },

  addEpisode: async (data) => {
    const ep: Episode = { id: crypto.randomUUID(), ...data }
    await episodeAdd(ep)
    set(state => ({ episodes: [...state.episodes, ep].sort((a, b) => a.episodeNumber - b.episodeNumber) }))
    return ep
  },

  batchAddEpisodes: async (dataList) => {
    const eps: Episode[] = dataList.map(d => ({ id: crypto.randomUUID(), ...d }))
    await episodeBatchAdd(eps)
    set(state => ({
      episodes: [...state.episodes, ...eps].sort((a, b) => a.episodeNumber - b.episodeNumber),
    }))
  },

  updateEpisode: async (id, data) => {
    await episodeUpdate(id, data)
    set(state => ({
      episodes: state.episodes.map(e => e.id === id ? { ...e, ...data } : e),
      currentEpisode: state.currentEpisode?.id === id
        ? { ...state.currentEpisode, ...data }
        : state.currentEpisode,
    }))
  },

  deleteEpisode: async (id) => {
    await episodeDelete(id)
    set(state => ({
      episodes: state.episodes.filter(e => e.id !== id),
      currentEpisode: state.currentEpisode?.id === id ? null : state.currentEpisode,
    }))
  },

  selectEpisode: (id) => {
    const ep = id ? get().episodes.find(e => e.id === id) ?? null : null
    set({ currentEpisode: ep })
  },

  updateEpisodeStatus: async (id, status) => {
    await episodeUpdate(id, { status })
    set(state => ({
      episodes: state.episodes.map(e => e.id === id ? { ...e, status } : e),
      currentEpisode: state.currentEpisode?.id === id
        ? { ...state.currentEpisode, status }
        : state.currentEpisode,
    }))
  },
}))
