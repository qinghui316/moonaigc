import React, { useState, useEffect, useCallback, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
}

const AnimatedOverlay: React.FC<Props> = ({ open, onClose, children }) => {
  const [mounted, setMounted] = useState(false)
  const [closing, setClosing] = useState(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      setClosing(false)
    } else if (mounted) {
      setClosing(true)
      const timer = setTimeout(() => {
        setMounted(false)
        setClosing(false)
      }, 200)
      return () => clearTimeout(timer)
    }
  }, [open])

  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose()
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div
      className={`fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 ${
        closing ? 'animate-fade-out' : 'animate-fade-in'
      }`}
      onClick={handleBackdropClick}
    >
      <div className={closing ? 'animate-scale-out' : 'animate-scale-in'}>
        {children}
      </div>
    </div>,
    document.body
  )
}

export default AnimatedOverlay
