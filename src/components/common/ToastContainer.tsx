import React from 'react'
import { useToastStore, type ToastVariant } from '../../store/useToastStore'

const ICONS: Record<ToastVariant, string> = {
  success: '\u2705',
  error: '\u274C',
  warning: '\u26A0\uFE0F',
  info: '\u2139\uFE0F',
}

const BG: Record<ToastVariant, string> = {
  success: 'border-emerald-500/40 bg-emerald-950/80',
  error: 'border-red-500/40 bg-red-950/80',
  warning: 'border-amber-500/40 bg-amber-950/80',
  info: 'border-indigo-500/40 bg-indigo-950/80',
}

const ToastContainer: React.FC = () => {
  const toasts = useToastStore(s => s.toasts)
  const markExiting = useToastStore(s => s.markExiting)

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div
          key={t.id}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border backdrop-blur-sm shadow-lg text-sm text-gray-200 max-w-sm ${BG[t.variant]} ${
            t.exiting ? 'animate-toast-out' : 'animate-toast-in'
          }`}
          onClick={() => markExiting(t.id)}
        >
          <span>{ICONS[t.variant]}</span>
          <span className="flex-1">{t.message}</span>
        </div>
      ))}
    </div>
  )
}

export default ToastContainer
