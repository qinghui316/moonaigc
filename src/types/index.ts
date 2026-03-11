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

// ===== Material / Asset Types =====
export interface MaterialItem {
  name: string
  desc: string
  file: File | null
  url: string | null
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
  charPosition: string
  lightPhase: string
  environment: string
  keyProp: string
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
  table: string
  markdown: string
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
  detectedRedZone: string[]
  detectedYellowZone: string[]
  detectedCelebrity: string[]
  detectedIP: string[]
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
