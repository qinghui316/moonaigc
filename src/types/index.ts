// ===== API / Platform Types =====
export interface PlatformModel {
  value: string
  label: string
}

export interface Platform {
  id: string
  name: string
  sub: string
  icon: string
  endpoint: string
  keyHint: string
  keyLink?: string
  models: PlatformModel[]
  defaultModel: string
  mode: 'openai' | 'gemini' | 'anthropic'
  modelNote?: string
  badge?: string
}

export interface ApiSettings {
  platformId: string
  endpoint: string
  model: string
  mode: 'openai' | 'gemini' | 'anthropic'
  key: string
  autoSafety?: boolean
  autoSound?: boolean
  autoPreview?: boolean
  enableWordFilter?: boolean
}

// ===== Image Generation Settings =====
export interface ImageGenSettings {
  platformId: string
  endpoint: string
  model: string
  key: string
  mode: 'openai' | 'gemini' | 'custom'
  aspectRatio: '1:1' | '16:9' | '9:16' | '4:3' | '3:4' | '3:2' | '2:3' | '4:5' | '5:4' | '21:9' | '1:4' | '4:1' | '8:1' | '1:8'
  imageResolution: '512px' | '1K' | '2K' | '4K'
}

// ===== Material / Asset Types =====
export interface MaterialItem {
  name: string
  desc: string
  file: File | null
  url: string | null
  imageFileId?: number     // 关联的 MediaFile ID（AI 生成的资产参考图）
  imageUrl?: string        // 资产参考图的访问 URL（从 /api/media/:id/file 获取）
}

export interface Materials {
  character: MaterialItem[]
  image: MaterialItem[]
  props: MaterialItem[]
  video: { name: string }[]
  audio: { name: string }[]
}

export type AssetType = 'character' | 'image' | 'props'
export type AssetTagMode = { character: boolean; image: boolean; props: boolean }

export interface AssetMapEntry {
  tag: string
  desc: string
  type: AssetType
}

// ===== Director Types =====
export interface DonghuaSourceWork {
  title: string
  keywords: string[]
  characters: { name: string; role: string; traits: string }[]
  locations: string[]
  terms: string[]
}

export interface DonghuaProfile {
  charStyle: string
  worldStyle: string
  vfxStyle: string
  promptSuffix: string
  sourceWorks?: DonghuaSourceWork[]
  ipCharacters?: { name: string; source: string; role: string; traits: string }[]
}

export interface Director {
  id: string
  name: string
  nameEn: string
  style: string
  techniques: string[]
  lighting: string
  films: string[]
  color: string
  category: string
  donghuaProfile?: DonghuaProfile
}

// ===== Chain Engine Types =====
export type NarrativeMode = 'burst' | 'mini' | 'full' | 'mood' | 'plain'
export type SceneStatus = 'waiting' | 'loading' | 'done' | 'error'

export interface Scene {
  id: number
  title: string
  beatKey: string
  beatName: string
  beatTask: string
  beatColorClass: string
  narrativeMode: NarrativeMode
  estimatedDuration: number
  contentSummary: string | null
  content?: string
  error?: string
  bridgeState?: BridgeState | null
}

export interface BridgeState {
  lastShotDesc: string     // 最后一镜的完整画面动作描述
  charState: string        // 角色精确位置/动作/神态/持有道具
  environment: string      // 光影/天气/背景关键元素
  cameraState: string      // 景别与运镜趋势
  visualMomentum: string   // 动作动量
}

export interface ChainEngineState {
  scenes: Scene[]
  totalDuration: number
  globalOffset: number
  isCancelled: boolean
  isRunning: boolean
  sceneContents: Record<number, string>
  sceneChatHistory: Record<number, ChatMessage[]>
  currentSceneId: number | null
  cleanPlot: string
}

// ===== Chat Types =====
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// ===== History Types =====
export interface HistoryRecord {
  id: number
  createdAt: number
  plot: string
  fullPlot: string
  director: string
  directorId: string
  storyboard: string
  time: string
  projectId?: string
  episodeId?: string
}

// ===== Project / Episode Types =====
export interface Project {
  id: string
  name: string
  genre: string[]
  audience: string
  tone: string
  endingType: string
  totalEpisodes: number
  worldSetting: string
  creativePlan: string
  characterDoc: string
  createdAt: number
  updatedAt: number
  // 导入剧本相关
  sourceMode: 'ai' | 'imported'
  adaptMode: '' | 'faithful' | 'blockbuster'
  sourceScript: string
  episodeCountMode: 'manual' | 'auto'
  importStatus: 'idle' | 'splitting' | 'split_done' | 'plan_done' | 'character_done' | 'failed'
  currentStep: number
  lastCompletedStep: number
  importError: string
}

export interface Episode {
  id: string
  projectId: string
  episodeNumber: number
  title: string
  summary: string
  hookType: string
  mark: string
  script: string
  status: 'outline' | 'scripted' | 'storyboarded'
  sourceText: string
}

// ===== Shot Data Types =====
export interface ShotData {
  time: string
  shotType: string
  camera: string
  scene: string
  lighting: string
  drama: string
  prompt: string
}

// ===== Safety Types =====
export interface SafetyResult {
  text: string
  replaced: { bad: string; good: string }[]
  replacedRedZone: { bad: string; good: string }[]
  replacedYellowZone: { bad: string; good: string }[]
  replacedCelebrity: { bad: string; good: string }[]
  replacedIP: { bad: string; good: string }[]
  detectedRedZone: string[]
  detectedYellowZone: string[]
  detectedCelebrity: string[]
  detectedIP: string[]
  detectedBrand: string[]
}

// ===== Vision Types =====
export interface VisionResult {
  characters: { name: string; visual_desc: string }[]
  scenes: { name: string; visual_desc: string }[]
  props: { name: string; visual_desc: string }[]
  plot_summary: string
  story_tone: string
  director_style: string
  imageCount?: number
  duration?: number
  frameCount?: number
  shots?: VideoShot[]
  camera_habits?: string
  color_tone?: string
}

export interface VideoShot {
  frame_index: number
  time: string
  shot_scale: string
  camera_move: string
  scene_desc: string
  characters: string
  lighting: string
}

// ===== Analysis Result =====
export interface AnalysisResult {
  expandedPlot: string
  primaryMotive: string
  themeStatement: string
  emotion: string
  recommendedShots: string
  recommendedLighting: string
  soundEffects?: string
  sceneBreakdown: string
}

// ===== Storyboard System Prompt Context =====
export interface SystemPromptContext {
  styleContext: string
  donghuaRules: string
  assetLibraryInfo: string
  assetCallRule: string
  subjectTagHint: string
  nameMappingInstruction: string
  hasAnyTagAsset: boolean
  aspectRatio: string
  quality: string
  enableBGM: boolean
  enableSubtitle: boolean
  selectedStyleDesc: string
  directorInfo: Director | undefined
  isDonghua: boolean
  isSTC?: boolean
  cameraTechs?: string[]
  lightingTechs?: string[]
  continuityIronRule?: string
  consistencyAnchor?: string
}

// ===== STC QA =====
export interface StcQaResult {
  saveCat: { status: 'pass' | 'warn' | 'fail'; detail: string; suggestion?: string }
  doubleMagic: { status: 'pass' | 'warn' | 'fail'; detail: string; settings: string[] }
  cliches: { original: string; direction: string }[]
}

// ===== Extraction Result =====
export interface ExtractionResult {
  characters: { name: string; visual_desc: string }[]
  scenes: { name: string; visual_desc: string }[]
  props: { name: string; visual_desc: string }[]
}
