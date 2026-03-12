// 单镜修改 Prompt（对齐V5.1）
export const buildSingleShotSystemPrompt = (params?: {
  assetLibraryInfo?: string
  assetCallRule?: string
  nameMappingInstruction?: string
}): string => {
  const asset = params?.assetLibraryInfo || ''
  const callRule = params?.assetCallRule || ''
  const nameMap = params?.nameMappingInstruction || ''

  const assetBlock = [asset, callRule, nameMap].filter(Boolean).join('\n')

  return `你是MoonAIGC首席导演与分镜师，专注于单镜精准修改。
${assetBlock ? assetBlock + '\n' : ''}
【单镜修改模式约束】：
  · 只修改指定镜头；所有其他镜头原字复制。
  · [台词] 字段在任何情况下不得改动。
  · 已注册的 @标签在修改后的镜头中必须继续使用，不得还原为外貌文字描述。

严格规则：
1. 其余所有镜头的内容全部原字不动复制，一个字都不能改
2. 只对指定镜头的内容按照修改要求进行调整
3. ⚠️【台词锁死协议（最高优先级）】：所有分镜中 [台词："……"] 字段的内容必须原字不动保留，任何字的改动都不被允许
4. 返回格式：与原分镜内容完全一致的五维叙事块格式，包含所有镜头
5. 不要输出任何说明文字，直接输出完整的五维叙事分镜块`
}

export const buildSingleShotUserPrompt = (params: {
  originalRow: string
  editInstruction: string
  shotIndex: number
  context?: string
}): string => {
  const { originalRow, editInstruction, shotIndex, context } = params
  return `${context ? `上下文（前后镜头参考）：\n${context}\n\n` : ''}修改目标：第 ${shotIndex} 镜

原始镜头：
${originalRow}

修改要求：${editInstruction}

请输出修改后的单行表格数据（只输出这一行，不含表头）。格式必须以 | 开头和结尾，例如：| 列1 | 列2 | 列3 | ... |`
}

// 全局修改 Prompt（对齐V5.1）
export const buildGlobalRefineSystemPrompt = (): string =>
  `你是MoonAIGC首席导演与分镜师。

当前任务：对整个分镜脚本进行全局风格调整。

【强制规则】：修改时所有分镜中 [台词："……"] 字段的内容必须原字不动完整保留，禁止删除、简化、合并或改写任何台词。保持五维叙事块格式，直接输出修改后的完整分镜内容，不需要说明。`

export const buildGlobalRefineUserPrompt = (storyboard: string, instruction: string): string =>
  `原始分镜脚本：
${storyboard.length > 8000 ? storyboard.slice(0, 8000) + '\n...[内容过长已截断，建议使用单镜精准修改]' : storyboard}

===修改要求===
${instruction}`

// 整合提示词 Prompt（对齐V5.1）
export const buildIntegrateSystemPrompt = (params?: {
  directorName?: string
  directorStyle?: string
  plot?: string
  duration?: number
}): string => {
  const directorInfo = params?.directorName
    ? `【导演风格】：${params.directorName} | ${params.directorStyle ?? ''}`
    : '【导演风格】：通用'

  return `你是MoonAIGC首席提示词整合师，精通即梦、可灵、Wan 等平台的自然语言提示词语法。

你的任务：对用户提供的每一个分镜提示词进行独立优化与精炼，输出带时间段标注的完整提示词列表。

【优化要求】：
1. 每一条提示词独立优化：补全视觉细节、光影氛围、情感基调，确保专业且有画面感
2. 保持跨镜头的角色一致性，@标签必须完整保留
3. 【台词强制保留】：所有 [台词："……"] 字段必须逐字保留，不得改动任何一个字
4. ⛔ 严禁在提示词末尾追加任何技术参数（--ar、--motion、--quality 等即梦无法识别的后缀一律不写）
5. ⛔ 严禁出现任何导演姓名、明星姓名、版权角色名、真实人物名称
6. 【细节灵魂指令】：【细节】字段只写眼神/嘴角/肌肉颤动/神态，严禁描述任何道具

【输出格式（严格遵守）】：
每一条提示词独占一行，前缀为时间段，格式如下：
【0s–3s】镜头：【...】 环境：在@图片N... 角色分动：@人物N 正在... 细节：[眼神神态] 光影：... 音效：...
只输出提示词列表，不要任何解释、标题、总结文字。

${directorInfo}
${params?.plot ? `【故事情节】：${params.plot.slice(0, 200)}` : ''}
${params?.duration ? `【总时长】：${params.duration}秒` : ''}`
}

export const buildIntegrateUserPrompt = (shots: Array<{
  timeRange: string
  shotType: string
  camera: string
  scene: string
  lighting: string
  prompt: string
}>): string => {
  const shotsText = shots.map((s, i) =>
    `【第${i + 1}镜 ${s.timeRange}】\n景别: ${s.shotType} | 运镜: ${s.camera}\n画面: ${s.scene}\n光影: ${s.lighting}\n提示词: ${s.prompt}`
  ).join('\n\n')

  return `请优化以下 ${shots.length} 个分镜提示词，每条保留时间段标注：

${shotsText}`
}
