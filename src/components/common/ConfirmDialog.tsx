import React from 'react'
import { useConfirmStore } from '../../store/useToastStore'
import AnimatedOverlay from './AnimatedOverlay'

const ConfirmDialog: React.FC = () => {
  const config = useConfirmStore(s => s.config)
  const respond = useConfirmStore(s => s.respond)

  return (
    <AnimatedOverlay open={!!config} onClose={() => respond(false)}>
      {config && (
        <div className="bg-surface-1 border border-divider-strong rounded-xl w-full max-w-md shadow-2xl">
          <div className="p-5">
            <h3 className="text-lg font-semibold text-gray-100 mb-2">{config.title}</h3>
            <p className="text-sm text-gray-400 leading-relaxed">{config.message}</p>
          </div>
          <div className="flex gap-3 p-4 pt-0 justify-end">
            <button
              onClick={() => respond(false)}
              className="px-4 py-2 text-sm text-gray-300 bg-surface-2 hover:bg-surface-3 rounded-lg transition-colors btn-press"
            >
              {config.cancelText ?? '取消'}
            </button>
            <button
              onClick={() => respond(true)}
              className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors btn-press ${
                config.variant === 'danger'
                  ? 'bg-red-600 hover:bg-red-500'
                  : 'bg-brand-600 hover:bg-brand-500'
              }`}
            >
              {config.confirmText ?? '确认'}
            </button>
          </div>
        </div>
      )}
    </AnimatedOverlay>
  )
}

export default ConfirmDialog
