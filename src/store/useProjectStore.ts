import { create } from 'zustand'
import type { Project, Episode } from '../types'
import {
  projectAdd, projectUpdate, projectGetAll, projectDelete,
  episodeAdd, episodeBatchAdd, episodeUpdate, episodesByProject, episodeDelete,
  materialsSave,
} from '../services/db'
import { createEmptyMaterials, DEFAULT_TAG_MODE } from './useMaterialStore'

type ProjectInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt'>

interface ProjectState {
  projects: Project[]
  currentProject: Project | null
  episodes: Episode[]
  currentEpisode: Episode | null

  loadProjects: () => Promise<void>
  addProject: (p: ProjectInput) => Promise<Project>
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

function withProjectDefaults(data: ProjectInput): ProjectInput {
  return {
    ...data,
    sourceMode: data.sourceMode ?? 'ai',
    adaptMode: data.adaptMode ?? '',
    sourceScript: data.sourceScript ?? '',
    episodeCountMode: data.episodeCountMode ?? 'manual',
    importStatus: data.importStatus ?? 'idle',
    currentStep: data.currentStep ?? 0,
    lastCompletedStep: data.lastCompletedStep ?? 0,
    importError: data.importError ?? '',
  }
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
      ...withProjectDefaults(data),
    }
    await projectAdd(p)
    await materialsSave(p.id, {
      materials: createEmptyMaterials(),
      tagMode: DEFAULT_TAG_MODE,
    })
    set(state => ({ projects: [p, ...state.projects] }))
    return p
  },

  updateProject: async (id, data) => {
    await projectUpdate(id, data)
    set(state => ({
      projects: state.projects.map(project => project.id === id ? { ...project, ...data, updatedAt: Date.now() } : project),
      currentProject: state.currentProject?.id === id
        ? { ...state.currentProject, ...data, updatedAt: Date.now() }
        : state.currentProject,
    }))
  },

  deleteProject: async (id) => {
    await projectDelete(id)
    set(state => ({
      projects: state.projects.filter(project => project.id !== id),
      currentProject: state.currentProject?.id === id ? null : state.currentProject,
      episodes: state.currentProject?.id === id ? [] : state.episodes,
      currentEpisode: state.currentProject?.id === id ? null : state.currentEpisode,
    }))
    const { useMaterialStore } = await import('./useMaterialStore')
    useMaterialStore.getState().loadForProject(undefined)
  },

  selectProject: async (id) => {
    const project = get().projects.find(item => item.id === id) ?? null
    set({ currentProject: project, currentEpisode: null })
    if (project) {
      const episodes = await episodesByProject(id)
      set({ episodes })
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
    const eps: Episode[] = dataList.map(data => ({ id: crypto.randomUUID(), ...data }))
    await episodeBatchAdd(eps)
    set(state => ({
      episodes: [...state.episodes, ...eps].sort((a, b) => a.episodeNumber - b.episodeNumber),
    }))
  },

  updateEpisode: async (id, data) => {
    await episodeUpdate(id, data)
    set(state => ({
      episodes: state.episodes.map(episode => episode.id === id ? { ...episode, ...data } : episode),
      currentEpisode: state.currentEpisode?.id === id
        ? { ...state.currentEpisode, ...data }
        : state.currentEpisode,
    }))
  },

  deleteEpisode: async (id) => {
    await episodeDelete(id)
    set(state => ({
      episodes: state.episodes.filter(episode => episode.id !== id),
      currentEpisode: state.currentEpisode?.id === id ? null : state.currentEpisode,
    }))
  },

  selectEpisode: (id) => {
    const ep = id ? get().episodes.find(episode => episode.id === id) ?? null : null
    set({ currentEpisode: ep })
  },

  updateEpisodeStatus: async (id, status) => {
    await episodeUpdate(id, { status })
    set(state => ({
      episodes: state.episodes.map(episode => episode.id === id ? { ...episode, status } : episode),
      currentEpisode: state.currentEpisode?.id === id
        ? { ...state.currentEpisode, status }
        : state.currentEpisode,
    }))
  },
}))
