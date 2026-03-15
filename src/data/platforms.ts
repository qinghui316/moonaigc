import type { Platform } from '../types'

// 文字生成平台 (10个)
export const TEXT_PLATFORMS: Platform[] = [
  {
    id: 'qwen',
    name: '通义千问',
    sub: '阿里云 · 国内稳定',
    icon: '🌐',
    endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions',
    keyHint: '在阿里云百炼控制台获取 API Key',
    keyLink: 'https://bailian.console.aliyun.com/',
    models: [
      { value: 'qwen-max', label: 'Qwen-Max · 最强推理（推荐）' },
      { value: 'qwen-plus', label: 'Qwen-Plus · 均衡速度' },
      { value: 'qwen-turbo', label: 'Qwen-Turbo · 最快响应' },
      { value: 'qwen-long', label: 'Qwen-Long · 超长上下文' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'qwen-max',
    mode: 'openai',
  },
  {
    id: 'doubao',
    name: '豆包',
    sub: '字节跳动 · 国内',
    icon: '🫘',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    keyHint: '在火山引擎控制台获取 API Key，模型填推理接入点 ID（ep-xxx）',
    keyLink: 'https://console.volcengine.com/ark',
    models: [
      { value: 'doubao-seed-2-0-pro-260215', label: 'Doubao-Seed-2.0-Pro（最新旗舰）' },
      { value: 'custom', label: '自定义接入点 ep-xxx...' },
    ],
    defaultModel: 'doubao-seed-2-0-pro-260215',
    modelNote: '⚠️ 豆包模型填推理接入点 ID（ep-xxx）',
    mode: 'openai',
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    sub: '深度求索 · 性价比',
    icon: '🔍',
    endpoint: 'https://api.deepseek.com/v1/chat/completions',
    keyHint: '在 platform.deepseek.com 获取 API Key',
    keyLink: 'https://platform.deepseek.com/',
    models: [
      { value: 'deepseek-chat', label: 'DeepSeek-V3（推荐）' },
      { value: 'deepseek-reasoner', label: 'DeepSeek-R1 · 深度推理' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'deepseek-chat',
    mode: 'openai',
  },
  {
    id: 'gemini',
    name: 'Gemini',
    sub: 'Google · 兼容模式',
    icon: '♊',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyHint: '在 Google AI Studio 获取免费 API Key',
    keyLink: 'https://aistudio.google.com/app/apikey',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash（推荐）' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · 强推理' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash · 6月关停' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'gemini-2.5-flash',
    mode: 'gemini',
  },
  {
    id: 'openai',
    name: 'OpenAI',
    sub: 'GPT · 全球',
    icon: '🤖',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyHint: '在 platform.openai.com 获取 API Key',
    keyLink: 'https://platform.openai.com/api-keys',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o（推荐）' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini · 低成本' },
      { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
      { value: 'o3-mini', label: 'o3-mini · 深度推理' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'gpt-4o',
    mode: 'openai',
  },
  {
    id: 'kimi',
    name: 'Kimi',
    sub: '月之暗面 · 长文本',
    icon: '🌙',
    endpoint: 'https://api.moonshot.cn/v1/chat/completions',
    keyHint: '在 platform.moonshot.cn 获取 API Key',
    keyLink: 'https://platform.moonshot.cn/',
    models: [
      { value: 'moonshot-v1-128k', label: 'Moonshot-128k（推荐）' },
      { value: 'moonshot-v1-32k', label: 'Moonshot-32k' },
      { value: 'moonshot-v1-8k', label: 'Moonshot-8k · 快速' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'moonshot-v1-128k',
    mode: 'openai',
  },
  {
    id: 'siliconflow',
    name: 'SiliconFlow',
    sub: '硅基流动 · 多模型',
    icon: '⚡',
    endpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    keyHint: '在 siliconflow.cn 注册获取免费额度',
    keyLink: 'https://cloud.siliconflow.cn/',
    models: [
      { value: 'deepseek-ai/DeepSeek-V3', label: 'DeepSeek-V3（推荐）' },
      { value: 'Qwen/Qwen2.5-72B-Instruct', label: 'Qwen2.5-72B' },
      { value: 'meta-llama/Meta-Llama-3.1-70B-Instruct', label: 'Llama-3.1-70B' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'deepseek-ai/DeepSeek-V3',
    mode: 'openai',
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    sub: '聚合平台 · 含Claude',
    icon: '🔀',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyHint: '统一接入 Claude、GPT、Gemini 等，openrouter.ai 获取 Key',
    keyLink: 'https://openrouter.ai/keys',
    models: [
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5（推荐）' },
      { value: 'anthropic/claude-opus-4', label: 'Claude Opus 4 · 最强' },
      { value: 'openai/gpt-4o', label: 'GPT-4o' },
      { value: 'google/gemini-2.0-flash-001', label: 'Gemini 2.0 Flash' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'anthropic/claude-sonnet-4-5',
    mode: 'openai',
    badge: '推荐',
  },
  {
    id: 'zhipu',
    name: '智谱 AI',
    sub: 'GLM · 清华系',
    icon: '🧠',
    endpoint: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
    keyHint: '在 open.bigmodel.cn 获取 API Key',
    keyLink: 'https://open.bigmodel.cn/usercenter/proj-mgmt/apikeys',
    models: [
      { value: 'glm-5', label: 'GLM-5（最新旗舰）' },
      { value: 'glm-4.7', label: 'GLM-4.7 · 高智能' },
      { value: 'glm-4.6', label: 'GLM-4.6 · 超强性能' },
      { value: 'glm-4.5-air', label: 'GLM-4.5-Air · 高性价比' },
      { value: 'glm-4.7-flash', label: 'GLM-4.7-Flash · 免费' },
      { value: 'glm-4-flash-250414', label: 'GLM-4-Flash-250414 · 免费' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'glm-4.7-flash',
    mode: 'openai',
  },
  {
    id: 'custom',
    name: '自定义',
    sub: '任意兼容端点',
    icon: '🔧',
    endpoint: '',
    keyHint: '填写任何兼容 OpenAI 格式的 API 端点',
    models: [{ value: 'custom', label: '手动输入模型名...' }],
    defaultModel: '',
    mode: 'openai',
  },
]

// 图片生成平台
export interface ImageModelDef {
  value: string
  label: string
  /** 覆盖平台级别的支持比例（可选，未设置则使用平台默认） */
  aspectRatios?: string[]
  /** 覆盖平台级别的支持清晰度（可选，未设置则使用平台默认） */
  resolutions?: { value: string; label: string }[]
}

export interface ImagePlatform {
  id: string
  name: string
  sub: string
  icon: string
  endpoint: string
  keyHint: string
  keyLink?: string
  models: ImageModelDef[]
  defaultModel: string
  mode: 'openai' | 'gemini' | 'custom'
  aspectRatios: string[]
  resolutions: { value: string; label: string }[]
}

export const IMAGE_PLATFORMS: ImagePlatform[] = [
  {
    id: 'doubao-image',
    name: '豆包 Seedream',
    sub: '字节跳动 · 支持参考图',
    icon: '🫘',
    endpoint: 'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    keyHint: '在火山引擎控制台获取 API Key；新版模型（5.0/4.5/4.0）直接填模型名，旧版填接入点 ID（ep-xxx）',
    keyLink: 'https://console.volcengine.com/ark',
    models: [
      { value: 'doubao-seedream-5-0-lite', label: 'Seedream 5.0 Lite（推荐·最新）' },
      { value: 'doubao-seedream-4-5', label: 'Seedream 4.5 · 高质量' },
      { value: 'doubao-seedream-4-0', label: 'Seedream 4.0' },
      { value: 'doubao-seedream-3-0-t2i-250415', label: 'Seedream 3.0 · 旧版' },
      { value: 'custom', label: '自定义模型/接入点...' },
    ],
    defaultModel: 'doubao-seedream-5-0-lite',
    mode: 'openai',
    // 来自火山引擎官方文档的支持比例
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '21:9'],
    // 5.0-lite 支持 2K/3K，4.5 支持 2K/4K，4.0 支持 1K/2K/4K；后端按模型自动降档
    resolutions: [
      { value: '1K', label: '1K 标准（4.0 专属）' },
      { value: '2K', label: '2K 高清（推荐）' },
      { value: '4K', label: '4K 超清（4.0/4.5）' },
    ],
  },
  {
    id: 'gemini-image',
    name: 'Gemini 生图',
    sub: 'Google · Nano Banana 系列',
    icon: '♊',
    // 后端会自动拼接 /{model}:generateContent
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    keyHint: '在 Google AI Studio 获取免费 API Key（Bearer Token 鉴权）',
    keyLink: 'https://aistudio.google.com/app/apikey',
    models: [
      { value: 'gemini-3.1-flash-image-preview', label: 'Nano Banana 2（推荐·2026最新）' },
      { value: 'gemini-3-pro-image-preview', label: 'Nano Banana Pro · 专业级4K' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'gemini-3.1-flash-image-preview',
    mode: 'gemini',
    // 来自 Gemini 官方文档支持的宽高比
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4'],
    resolutions: [
      { value: '1K', label: '1K 标准' },
      { value: '2K', label: '2K 高清（推荐）' },
      { value: '4K', label: '4K 超清' },
    ],
  },
  {
    id: 'runninghub',
    name: 'RunningHub',
    sub: '图生图 · 异步任务',
    icon: '🏃',
    // 基础域名，后端根据模型选择路径
    endpoint: 'https://www.runninghub.cn',
    keyHint: '在 runninghub.cn 注册获取 API Key（Bearer Token 鉴权）',
    keyLink: 'https://www.runninghub.cn',
    models: [
      {
        value: 'rhart-image-n-g31-flash',
        label: '全能图片V2（Nano Banana 2 同款·低价）',
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
        resolutions: [
          { value: '1K', label: '1K 标准' },
          { value: '2K', label: '2K 高清（推荐）' },
          { value: '4K', label: '4K 超清' },
        ],
      },
      {
        value: 'rhart-image-n-pro',
        label: '全能图片PRO（Nano Banana Pro 同款·低价）',
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9'],
        resolutions: [
          { value: '1K', label: '1K 标准' },
          { value: '2K', label: '2K 高清（推荐）' },
          { value: '4K', label: '4K 超清' },
        ],
      },
    ],
    defaultModel: 'rhart-image-n-g31-flash',
    mode: 'openai',
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '5:4', '4:5', '21:9', '1:4', '4:1', '1:8', '8:1'],
    resolutions: [
      { value: '1K', label: '1K 标准' },
      { value: '2K', label: '2K 高清（推荐）' },
      { value: '4K', label: '4K 超清' },
    ],
  },
  {
    id: 'image-custom',
    name: '贞贞的AI工坊',
    sub: '第三方 · Nano Banana 代理',
    icon: '🏮',
    // 固定端点，OpenAI DALL-E 兼容格式
    endpoint: 'https://ai.t8star.cn/v1/images/generations',
    keyHint: '在贞贞的AI工坊注册获取 API Key（ai.t8star.cn），Bearer Token 鉴权',
    keyLink: 'https://ai.t8star.cn',
    models: [
      {
        value: 'nano-banana-2',
        label: 'Nano Banana Pro（推荐）',
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9'],
        resolutions: [
          { value: '1K', label: '1K 标准' },
          { value: '2K', label: '2K 高清（推荐）' },
          { value: '4K', label: '4K 超清' },
        ],
      },
      {
        value: 'gemini-3.1-flash-image-preview',
        label: 'Nano Banana 2（最新）',
        aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '1:4', '4:1', '8:1', '1:8'],
        resolutions: [
          { value: '512px', label: '512px 预览' },
          { value: '1K', label: '1K 标准' },
          { value: '2K', label: '2K 高清（推荐）' },
          { value: '4K', label: '4K 超清' },
        ],
      },
    ],
    defaultModel: 'nano-banana-2',
    mode: 'openai',
    // 平台级默认（兜底）：取最大集合
    aspectRatios: ['1:1', '16:9', '9:16', '4:3', '3:4', '3:2', '2:3', '4:5', '5:4', '21:9', '1:4', '4:1', '8:1', '1:8'],
    resolutions: [
      { value: '512px', label: '512px 预览' },
      { value: '1K', label: '1K 标准' },
      { value: '2K', label: '2K 高清（推荐）' },
      { value: '4K', label: '4K 超清' },
    ],
  },
]

// 视觉分析平台 (5个)
export const VISION_PLATFORMS: Platform[] = [
  {
    id: 'claude',
    name: 'Claude',
    sub: 'Anthropic · 图像理解强',
    icon: '🧬',
    endpoint: 'https://api.anthropic.com/v1/messages',
    keyHint: '在 console.anthropic.com 获取 API Key',
    keyLink: 'https://console.anthropic.com/',
    models: [
      { value: 'claude-sonnet-4-5-20251001', label: 'Claude Sonnet 4.5（推荐）' },
      { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 · 最强' },
      { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 · 快速' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'claude-sonnet-4-5-20251001',
    mode: 'anthropic',
  },
  {
    id: 'openai-vision',
    name: 'GPT-4o',
    sub: 'OpenAI · 视觉全能',
    icon: '🤖',
    endpoint: 'https://api.openai.com/v1/chat/completions',
    keyHint: '在 platform.openai.com 获取 API Key',
    keyLink: 'https://platform.openai.com/api-keys',
    models: [
      { value: 'gpt-4o', label: 'GPT-4o（推荐）' },
      { value: 'gpt-4o-mini', label: 'GPT-4o mini · 低成本' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'gpt-4o',
    mode: 'openai',
  },
  {
    id: 'gemini-vision',
    name: 'Gemini',
    sub: 'Google · 支持视频',
    icon: '♊',
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions',
    keyHint: '在 Google AI Studio 获取免费 API Key（视频反推推荐）',
    keyLink: 'https://aistudio.google.com/app/apikey',
    models: [
      { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash · 视觉（推荐）' },
      { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro · 支持视频' },
      { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash · 6月关停' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'gemini-2.5-flash',
    mode: 'gemini',
  },
  {
    id: 'openrouter-vision',
    name: 'OpenRouter',
    sub: '聚合 · 多模型',
    icon: '🔀',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    keyHint: '通过 OpenRouter 统一接入多个视觉模型',
    keyLink: 'https://openrouter.ai/keys',
    models: [
      { value: 'anthropic/claude-sonnet-4-5', label: 'Claude Sonnet 4.5 Vision' },
      { value: 'openai/gpt-4o', label: 'GPT-4o Vision' },
      { value: 'google/gemini-1.5-pro', label: 'Gemini 1.5 Pro Vision' },
      { value: 'custom', label: '自定义模型...' },
    ],
    defaultModel: 'anthropic/claude-sonnet-4-5',
    mode: 'openai',
  },
  {
    id: 'vision-custom',
    name: '自定义',
    sub: '任意 Vision 端点',
    icon: '🔧',
    endpoint: '',
    keyHint: '填写支持图片输入的 OpenAI 兼容端点',
    models: [{ value: 'custom', label: '手动输入模型名...' }],
    defaultModel: '',
    mode: 'openai',
  },
]
