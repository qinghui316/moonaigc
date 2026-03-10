import type { Director } from '../types'
import type { SystemPromptContext } from '../types'

// 构建 SEEDANCE 提示词格式说明（五维视听叙事）
const buildSeedanceFormat = (enableBGM: boolean, enableSubtitle: boolean): string => {
  const bgmPart = enableBGM ? '+情绪背景音乐' : ''
  const shootInstruction = (!enableBGM || !enableSubtitle)
    ? ` 拍摄指令：[${enableBGM ? '' : '禁BGM'}${!enableBGM && !enableSubtitle ? ' ' : ''}${enableSubtitle ? '' : '禁字幕'}]`
    : ''
  return `镜头：【景别+运镜】 环境：在@图片N [背景静态描述] 角色分动：@人物N [外观] 正在 [肢体动作]（多人用；分隔） 细节：@人物N [微表情与情绪（禁止描述道具）] 光影：[光源方向+质感+色调] 台词(@人物N)："对白原文"（无对白省略此字段） 音效：[环境音+声响${bgmPart}]${shootInstruction}`
}

// 构建主分镜生成 system prompt
export const buildGenerateSystemPrompt = (ctx: SystemPromptContext & { isSTC?: boolean }): string => {
  const {
    directorInfo, isDonghua, donghuaRules, assetLibraryInfo, assetCallRule,
    subjectTagHint, nameMappingInstruction, enableBGM, enableSubtitle,
    selectedStyleDesc, isSTC = true, hasAnyTagAsset,
  } = ctx

  const tableHeader = isSTC
    ? '| 时间段 | 景别 | 运镜 | 画面描述 | 光影氛围 | 戏剧张力 | SEEDANCE提示词 |'
    : '| 时间段 | 景别 | 运镜 | 画面描述 | 光影氛围 | SEEDANCE提示词 |'

  const dramaticTensionRule = isSTC
    ? '   - 「戏剧张力」列格式：[+/-][情绪：从X→Y] [冲突：障碍描述（10字内）]'
    : ''

  const seedanceFormat = buildSeedanceFormat(enableBGM, enableSubtitle)

  const directorBlock = directorInfo ? buildDirectorBlock(directorInfo, isDonghua) : ''
  const styleDescBlock = selectedStyleDesc ? `\n${selectedStyleDesc}\n` : ''
  const assetBlock = assetLibraryInfo ? `\n${assetLibraryInfo}` : ''
  const assetCallBlock = assetCallRule ? `\n${assetCallRule}` : ''
  const tagHintBlock = subjectTagHint ? `\n${subjectTagHint}` : ''
  const nameMappingBlock = nameMappingInstruction ? `\n${nameMappingInstruction}` : ''
  const donghuaRulesBlock = donghuaRules ? `\n${donghuaRules}` : ''

  const dynamicsRule = isSTC
    ? `【场景动力学规则（《救猫咪》案板逻辑，每一镜必须严格遵守）】：
▶ +/- 情绪转折【强制执行】：每一镜结束时，场景的情绪张力必须发生方向性转变。
▶ >< 冲突标注【强制执行】：每一镜必须暗示或明示"谁/什么在阻碍主角"。
▶ 泳池里的教皇【强制执行】：交代背景信息时必须加入娱乐性视觉背景细节。`
    : `【直接视觉化模式（叙事结构构建已关闭）】：
▶ 你的唯一任务是将情节内容转化为画面，不添加、不改变、不重构任何情节
▶ 按剧本自然顺序逐段视觉化，镜头划分由画面内容决定
▶ 不需要"冲突障碍"、"情绪转折"、"节拍任务"——只描述画面里实际发生了什么
▶ "戏剧张力"列填写当前镜头的画面情绪基调（如：[平静]、[紧张]、[感伤]）`

  const consistencyRule = hasAnyTagAsset
    ? '全局@标签资产库在全篇内必须严格保持一致。'
    : '确保人物服装、环境、光影在全篇内完全统一，动作逻辑无缝衔接。'

  return `你是MoonAIGC首席导演与分镜师，精通电影分镜创作与AI视频生成提示词写作。
你的任务是将用户提供的故事情节转化为**专业分镜脚本**。
${directorBlock}${styleDescBlock}${assetBlock}${assetCallBlock}${tagHintBlock}${nameMappingBlock}${donghuaRulesBlock}
${dynamicsRule}

【分镜生成规则（MoonAIGC 五维视听叙事）】：
1. 输出标准Markdown表格：${tableHeader}
${dramaticTensionRule}
2. 所有内容使用中文（SEEDANCE提示词除外）。
3. 「SEEDANCE提示词」列规范（每镜写成一行，不换行，按此顺序）：
   ${seedanceFormat}
4. 「画面描述」列：自然语言可读描述，严禁出现任何 @标签。
5. 「光影氛围」列：简短描述本镜整体光影色调。
6. 严禁在 SEEDANCE提示词列 输出 --ar、--motion、--quality 等技术参数。
7. ⚠️【五维铁律】：❶拒绝抽象（写"眼眶泛红"不写"她很伤心"）❷动词驱动（必须含"正在"）❸细节禁区（【细节】禁描述道具）❹ 台词铁律：有对白必须写「台词(@人物N)："原文"」置于音效字段之前，@人物N为说话者，原文逐字不改，无对白完全省略台词字段 ❺@标签全篇统一
8. 严禁出现任何明星、名人姓名或版权角色名。
9. 【一致性要求】：${consistencyRule}

只输出Markdown分镜表格，不要任何额外说明文字。`
}

const buildDirectorBlock = (director: Director, isDonghua: boolean): string => {
  const donghuaExtra = isDonghua && director.donghuaProfile
    ? `\n**国漫IP规则**：
- 角色风格：${director.donghuaProfile.charStyle}
- 世界风格：${director.donghuaProfile.worldStyle}
- 特效风格：${director.donghuaProfile.vfxStyle}
- 提示词后缀：${director.donghuaProfile.promptSuffix}`
    : ''

  return `\n【导演风格：${director.name}（${director.nameEn}）】
▶ 风格特征：${director.style}
▶ 运镜手法：${director.techniques.join('、')}
▶ 光影风格：${director.lighting}
▶ 代表作：${director.films.join('、')}${donghuaExtra}`
}

// 构建单段模式的 user prompt
export const buildGenerateUserPrompt = (params: {
  plot: string
  shotCount: string
  duration: string
  directorName: string
  analysisResult?: string
}): string => {
  const { plot, shotCount, duration, directorName, analysisResult } = params
  const analysisBlock = analysisResult
    ? `\n## AI分析结果（参考）\n${analysisResult}\n`
    : ''

  return `请根据以下故事情节，以${directorName}的风格创作分镜脚本：

## 故事情节
${plot}
${analysisBlock}
## 参数
- 总时长：${duration}
- 分镜数量：${shotCount}（${shotCount === '智能' ? '根据故事复杂度自动决定最合适的镜头数量' : `精确输出${shotCount}个镜头`}）

请直接输出完整的Markdown表格，不要有任何前置说明。`
}
