import React, { useState } from 'react'
import { useSettingsStore } from '../../store/useSettingsStore'
import { TEXT_PLATFORMS, VISION_PLATFORMS, IMAGE_PLATFORMS } from '../../data/platforms'
import { generate } from '../../services/api'
import type { Platform } from '../../types'

interface SettingsPanelProps {
  onClose: () => void
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onClose }) => {
  const {
    textSettings, visionSettings, imageSettings,
    autoSafety, autoSound, enableWordFilter, autoSaveHistory,
    setTextSettings, setVisionSettings, setImageSettings, setFlag,
  } = useSettingsStore()
  const [activeTab, setActiveTab] = useState<'text' | 'vision' | 'image'>('text')
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)

  const isImageTab = activeTab === 'image'
  const platforms = activeTab === 'text' ? TEXT_PLATFORMS : activeTab === 'vision' ? VISION_PLATFORMS : IMAGE_PLATFORMS
  const settings = activeTab === 'text' ? textSettings : activeTab === 'vision' ? visionSettings : imageSettings
  const setSetting = activeTab === 'text' ? setTextSettings : activeTab === 'vision' ? setVisionSettings : (setImageSettings as (s: Record<string, unknown>) => void)

  const selectedPlatform = platforms.find(p => p.id === settings.platformId) ?? platforms[0]

  const handlePlatformSelect = (platform: Platform | typeof IMAGE_PLATFORMS[0]) => {
    if (isImageTab) {
      setImageSettings({
        platformId: platform.id,
        endpoint: platform.endpoint,
        model: platform.defaultModel,
        mode: (platform as typeof IMAGE_PLATFORMS[0]).mode,
      })
    } else {
      (setSetting as (s: Partial<typeof textSettings>) => void)({
        platformId: platform.id,
        endpoint: platform.endpoint,
        model: platform.defaultModel,
        mode: (platform as Platform).mode,
      })
    }
  }

  const handleModelChange = (value: string) => {
    if (value === 'custom') {
      setSetting({ model: '' } as Record<string, unknown>)
    } else {
      setSetting({ model: value } as Record<string, unknown>)
    }
  }

  const handleTest = async () => {
    if (!settings.key) { setTestResult('❌ 请先填写 API Key'); return }
    setTesting(true)
    setTestResult(null)
    try {
      if (isImageTab) {
        setTestResult('✅ API Key 已填写（图片生成需实际调用验证）')
      } else {
        const result = await generate(
          [{ role: 'user', content: 'Reply with exactly: OK' }],
          settings as typeof textSettings
        )
        setTestResult(result.toLowerCase().includes('ok') ? '✅ 连接成功' : `✅ 已响应: ${result.slice(0, 50)}`)
      }
    } catch (e) {
      setTestResult(`❌ ${String(e)}`)
    }
    setTesting(false)
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-800">
          <h2 className="text-indigo-400 font-bold text-lg">⚙️ API 配置</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-800 transition-colors">✕</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-800 mx-4 mt-4 rounded-lg p-1 gap-1">
          {(['text', 'vision', 'image'] as const).map(t => (
            <button key={t} onClick={() => { setActiveTab(t); setTestResult(null) }}
              className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-colors ${
                activeTab === t ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}>
              {t === 'text' ? '🔤 文字生成' : t === 'vision' ? '👁️ 视觉分析' : '🎨 图片生成'}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          {/* Platform Grid */}
          <div>
            <label className="text-xs text-gray-500 mb-2 block">选择平台</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {platforms.map(platform => (
                <button
                  key={platform.id}
                  onClick={() => handlePlatformSelect(platform)}
                  className={`p-2.5 rounded-lg border text-left transition-colors ${
                    settings.platformId === platform.id
                      ? 'border-indigo-500 bg-indigo-900/30 text-indigo-300'
                      : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="text-lg">{platform.icon}</span>
                    <div>
                      <div className="text-xs font-semibold">{platform.name}</div>
                      <div className="text-xs text-gray-500">{platform.sub}</div>
                    </div>
                    {'badge' in platform && platform.badge && (
                      <span className="ml-auto text-xs bg-indigo-600 text-white px-1 rounded">
                        {platform.badge}
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Endpoint */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">API 端点</label>
            {selectedPlatform.endpoint ? (
              <div className="w-full bg-gray-800/50 border border-gray-700/50 text-gray-400 text-sm px-3 py-2 rounded-lg select-all truncate">
                {selectedPlatform.endpoint}
              </div>
            ) : (
              <input
                type="text"
                value={settings.endpoint}
                onChange={e => setSetting({ endpoint: e.target.value } as Record<string, unknown>)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                placeholder="https://api.example.com/v1/..."
              />
            )}
          </div>


          {/* Model */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 block">模型</label>
            {'modelNote' in selectedPlatform && selectedPlatform.modelNote && (
              <p className="text-xs text-indigo-400 mb-1.5">{selectedPlatform.modelNote}</p>
            )}
            <select
              value={selectedPlatform.models.some(m => m.value === settings.model) ? settings.model : 'custom'}
              onChange={e => handleModelChange(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
            >
              {selectedPlatform.models.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            {(!selectedPlatform.models.some(m => m.value === settings.model) || settings.model === '') && (
              <input
                type="text"
                value={settings.model}
                onChange={e => setSetting({ model: e.target.value } as Record<string, unknown>)}
                className="w-full mt-1.5 bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
                placeholder="输入自定义模型名..."
              />
            )}
          </div>


          {/* API Key */}
          <div>
            <label className="text-xs text-gray-500 mb-1.5 flex items-center gap-2">
              API Key
              {selectedPlatform.keyLink && (
                <a href={selectedPlatform.keyLink} target="_blank" rel="noreferrer"
                  className="text-indigo-500 hover:text-indigo-400 text-xs">
                  获取 Key →
                </a>
              )}
            </label>
            <p className="text-xs text-gray-600 mb-1.5">{selectedPlatform.keyHint}</p>
            <input
              type="password"
              value={settings.key}
              onChange={e => setSetting({ key: e.target.value } as Record<string, unknown>)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm px-3 py-2 rounded-lg focus:outline-none focus:border-indigo-500"
              placeholder="sk-..."
            />
          </div>

          {/* Test Connection */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleTest}
              disabled={testing}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
            >
              {testing ? '测试中...' : '🔌 测试连接'}
            </button>
            {testResult && (
              <span className={`text-sm ${testResult.startsWith('✅') ? 'text-green-400' : 'text-red-400'}`}>
                {testResult}
              </span>
            )}
          </div>

          {/* Global Flags */}
          {activeTab === 'text' && (
            <div className="border-t border-gray-800 pt-4 space-y-3">
              <div className="text-xs text-gray-500 mb-2">全局功能开关</div>
              {[
                { key: 'autoSafety', label: '🛡️ 生成前自动安全审核', val: autoSafety },
                { key: 'enableWordFilter', label: '🔍 启用违禁词替换过滤', val: enableWordFilter },
                { key: 'autoSound', label: '🔔 生成完成播放提示音', val: autoSound },
                { key: 'autoSaveHistory', label: '💾 生成完成自动保存历史', val: autoSaveHistory },
              ].map(({ key, label, val }) => (
                <label key={key} className="flex items-center justify-between cursor-pointer">
                  <span className="text-sm text-gray-300">{label}</span>
                  <div
                    onClick={() => setFlag(key as never, !val)}
                    className={`w-10 h-5 rounded-full transition-colors cursor-pointer relative ${val ? 'bg-indigo-500' : 'bg-gray-700'}`}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${val ? 'translate-x-5' : 'translate-x-0.5'}`} />
                  </div>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 pt-0 space-y-2">
          <button
            onClick={() => {
              if (!confirm('⚠️ 确认清除所有已保存的 API Key 和设置？\n\n此操作将清除所有平台的 Key，不可恢复。')) return
              useSettingsStore.getState().clearAllKeys()
              alert('✅ 已清除所有平台的 API Key')
            }}
            className="w-full py-2 text-sm text-red-400 border border-red-800/30 bg-red-900/10 hover:bg-red-900/20 font-medium rounded-lg transition-colors"
          >
            🗑 清除所有 Key
          </button>
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg transition-colors"
          >
            保存并关闭
          </button>
        </div>
      </div>
    </div>
  )
}

export default SettingsPanel
