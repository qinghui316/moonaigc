import React from 'react'
import { useThemeStore } from '../../store/useThemeStore'
import { useSettingsStore } from '../../store/useSettingsStore'
import { TEXT_PLATFORMS } from '../../data/platforms'

interface HeaderProps {
  onSettingsClick: () => void
}

const Header: React.FC<HeaderProps> = ({ onSettingsClick }) => {
  const { theme, toggle: toggleTheme } = useThemeStore()
  const { textSettings } = useSettingsStore()
  const activePlatform = TEXT_PLATFORMS.find(p => p.id === textSettings.platformId)

  const modelShort = textSettings.model.length > 24
    ? textSettings.model.slice(0, 22) + '…'
    : textSettings.model

  return (
    <header className="bg-gray-950 border-b border-amber-900/30 px-4 py-3 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-slate-700 to-slate-900 rounded-lg flex items-center justify-center text-lg shadow-lg shadow-slate-900/40">
          🌙
        </div>
        <div>
          <h1 className="text-amber-400 font-bold text-base leading-tight tracking-wide">
            MoonAIGC
          </h1>
          <p className="text-gray-500 text-xs leading-tight">导演级分镜生成引擎</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <span className="hidden sm:inline text-gray-600 text-xs">Save the Cat BS2 · 五维视听叙事</span>

        {activePlatform && (
          <button
            onClick={onSettingsClick}
            className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-400 bg-gray-800/60 border border-gray-700/50 rounded-lg hover:border-amber-800/50 hover:text-gray-300 transition-colors cursor-pointer"
            title={`当前平台：${activePlatform.name}\n模型：${textSettings.model}\n点击修改`}
          >
            <span>{activePlatform.icon}</span>
            <span className="font-medium">{activePlatform.name}</span>
            {modelShort && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500 max-w-[140px] truncate">{modelShort}</span>
              </>
            )}
            {textSettings.key ? (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" title="Key 已配置" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" title="未配置 Key" />
            )}
          </button>
        )}

        <button
          onClick={toggleTheme}
          className="p-1.5 text-gray-400 hover:text-amber-400 bg-gray-900/60 hover:bg-gray-800/80 border border-gray-800/50 rounded-lg transition-colors"
          title={theme === 'dark' ? '切换到亮色模式' : '切换到暗色模式'}
        >
          {theme === 'dark' ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
            </svg>
          )}
        </button>
        <button
          onClick={onSettingsClick}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-amber-400 bg-amber-900/20 hover:bg-amber-900/40 border border-amber-800/50 rounded-lg transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="hidden sm:inline">API设置</span>
        </button>
      </div>
    </header>
  )
}

export default Header
