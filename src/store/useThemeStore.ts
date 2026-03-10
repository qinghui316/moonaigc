import { create } from 'zustand'

type Theme = 'dark' | 'light'

const STORAGE_KEY = 'moonaigc_theme'

interface ThemeState {
  theme: Theme
  toggle: () => void
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: (localStorage.getItem(STORAGE_KEY) as Theme) || 'dark',
  toggle: () => {
    const next = get().theme === 'dark' ? 'light' : 'dark'
    localStorage.setItem(STORAGE_KEY, next)
    set({ theme: next })
  },
}))
