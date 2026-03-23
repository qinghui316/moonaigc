import { create } from 'zustand'

/* ── Toast ── */
export type ToastVariant = 'success' | 'error' | 'warning' | 'info'

interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
  exiting?: boolean
}

interface ToastState {
  toasts: ToastItem[]
  addToast: (message: string, variant: ToastVariant) => void
  removeToast: (id: number) => void
  markExiting: (id: number) => void
}

let nextId = 0

export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  addToast: (message, variant) => {
    const id = ++nextId
    set(s => ({ toasts: [...s.toasts, { id, message, variant }] }))
    setTimeout(() => {
      set(s => ({
        toasts: s.toasts.map(t => t.id === id ? { ...t, exiting: true } : t)
      }))
      setTimeout(() => {
        set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
      }, 200)
    }, 3000)
  },
  removeToast: (id) => set(s => ({ toasts: s.toasts.filter(t => t.id !== id) })),
  markExiting: (id) => {
    set(s => ({
      toasts: s.toasts.map(t => t.id === id ? { ...t, exiting: true } : t)
    }))
    setTimeout(() => {
      set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }))
    }, 200)
  },
}))

export const toast = {
  success: (msg: string) => useToastStore.getState().addToast(msg, 'success'),
  error:   (msg: string) => useToastStore.getState().addToast(msg, 'error'),
  warning: (msg: string) => useToastStore.getState().addToast(msg, 'warning'),
  info:    (msg: string) => useToastStore.getState().addToast(msg, 'info'),
}

/* ── Confirm Dialog ── */
interface ConfirmConfig {
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  variant?: 'danger' | 'default'
}

interface ConfirmState {
  config: (ConfirmConfig & { resolve: (ok: boolean) => void }) | null
  show: (config: ConfirmConfig) => Promise<boolean>
  respond: (ok: boolean) => void
}

export const useConfirmStore = create<ConfirmState>((set, get) => ({
  config: null,
  show: (config) => new Promise<boolean>(resolve => {
    set({ config: { ...config, resolve } })
  }),
  respond: (ok) => {
    const c = get().config
    if (c) {
      c.resolve(ok)
      set({ config: null })
    }
  },
}))

export const confirmDialog = (config: ConfirmConfig) =>
  useConfirmStore.getState().show(config)
