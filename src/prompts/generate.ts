import type { Director } from '../types'
import type { SystemPromptContext } from '../types'

// 构建 SEEDANCE 提示词格式说明（共享函数，chain.ts 同步 import）
export const buildSeedanceFormat = (enableBGM: boolean, _enableSubtitle: boolean): string => {
  const bgmPart = enableBGM ? '+情绪背景音乐' : ''
  // 标记铁律：禁BGM/禁字幕作为行末标记，不作为内联字段
  return `镜头：【景别+运镜】 环境：在@图片N [背景静态描述；场景内正在使用的道具必须用[状态]标注其动态状态，例：旧电视[屏幕亮着显示游戏画面]、游戏机[连着手柄通电中]、蜡烛[火焰燃烧中]、水杯[盛着液体]] 叙事目的：[本镜推动故事的核心目标，5-12字] 衔接：[与上一镜的连接方式，如承接动作末态/由视线切入/由声音切入] 角色分动：@人物N [外观] 正在 [肢体动作]（多人用；分隔） 细节：@人物N [微表情与情绪状态（禁止描述道具）] 光影：[光源方向+质感+色调] 台词(@人物N,第Xs开口):"台词原文"（X必须替换为实际秒数整数，如第3s开口、第2s开口，禁止写字母X；@人物N替换为实际说话角色@标签；无台词时完全省略此字段，禁止空引号；多人说话写多个台词字段） 音效：[环境音+声响${bgmPart}]`
}

// 从剧本中提取台词，对齐 V6 的 vt() 函数
export const extractDialogues = (plot: string): string[] => {
  if (!plot) return []
  // 预处理：剥离资产映射行和标题行
  let text = plot
  text = text.replace(/·\s*"[^"\n]{1,30}"\s*→\s*@[^\n]*/g, '')
  text = text.replace(/【[^】\n]{0,60}】：[^\n]*/g, '')

  const found = new Set<string>()
  // 5种引号正则
  const patterns = [
    /「([^」]{1,200})」/g,
    /『([^』]{1,200})』/g,
    /"([^"]{1,200})"/g,
    /'([^']{1,200})'/g,
    /"([^"]{1,200})"/g,
  ]
  for (const re of patterns) {
    let m: RegExpExecArray | null
    while ((m = re.exec(text)) !== null) {
      const s = m[1].trim()
      if (s.length >= 3 && /[\u4e00-\u9fa5]/.test(s)) found.add(s)
    }
  }
  // 语气词检测
  const verbRe = /(?:说|道|问|答|叫|哭|笑|嘟囔|低声|大声|轻声|沉声|怒道|冷道|笑道|苦笑道)[：:]["「『"'"']([^"」』"'"']{1,200})["」』"'"']/g
  let r: RegExpExecArray | null
  while ((r = verbRe.exec(text)) !== null) {
    const s = r[1].trim()
    if (s.length >= 3 && /[\u4e00-\u9fa5]/.test(s)) found.add(s)
  }
  return [...found]
}

// 构建台词锁定块
const buildDialogueLockBlock = (dialogues: string[]): string => {
  if (dialogues.length === 0) return ''
  return `\n🔒【台词原文锁定（最高优先级）】：
以下台词必须一字不差地出现在对应镜头的台词字段中，禁止任何改写、省略或意译：
${dialogues.map((d, i) => `  ${i + 1}. "${d}"`).join('\n')}
↑ 以上每一句台词都必须原文照搬，如有台词未出现在分镜中视为严重错误。`
}

// 构建主分镜生成 system prompt
export const buildGenerateSystemPrompt = (ctx: SystemPromptContext & { isSTC?: boolean }): string => {
  const {
    directorInfo, isDonghua, donghuaRules, assetLibraryInfo, assetCallRule,
    subjectTagHint, nameMappingInstruction, enableBGM, enableSubtitle,
    selectedStyleDesc, isSTC = true, hasAnyTagAsset,
    continuityIronRule, consistencyAnchor,
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

  // 视觉风格描述（用于规则6和风格植入规范）
  const styleName = selectedStyleDesc || ''
  const styleBaseToneRule = styleName
    ? `6. 视觉基调：全片必须深度体现「${styleName}」的视觉风格特征，每一镜的光影、色调、构图都须体现该风格。`
    : ''

  // 视觉风格植入规范（非国漫时生效）
  const isDonghuaDirector = isDonghua && directorInfo?.donghuaProfile
  const promptSuffix = isDonghuaDirector ? directorInfo!.donghuaProfile!.promptSuffix : styleName
  const styleInjectionRule = promptSuffix
    ? `\n【视觉风格植入规范（必须遵守）】：每条「SEEDANCE提示词」末尾必须追加以下风格标识（中文，直接附加在音效字段之后${(!enableBGM || !enableSubtitle) ? '、[禁BGM][禁字幕]标记之前' : ''}）：${promptSuffix}。不得省略，不得改写。`
    : ''

  // 标记铁律（仅当BGM或字幕关闭时生效）
  const hasMarker = !enableBGM || !enableSubtitle
  const markerStr = (!enableBGM && !enableSubtitle) ? ' [禁BGM][禁字幕]' : (!enableBGM ? ' [禁BGM]' : ' [禁字幕]')
  const markerRule = hasMarker
    ? ` ❾【标记铁律】每条SEEDANCE提示词全部字段写完后在整行最末尾追加${markerStr}，不得插入字段中间，不得提前，不得省略`
    : ''

  // 动态铁律维度数（新增叙事目的❻和衔接❼，原资产一致升为❽）
  const ironLawLabel = hasMarker ? '九维铁律' : '八维铁律'

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
${directorBlock}${styleDescBlock}${assetBlock}${assetCallBlock}${tagHintBlock}${nameMappingBlock}${donghuaRulesBlock}${styleInjectionRule}
${dynamicsRule}

【分镜生成规则（MoonAIGC ${ironLawLabel}视听叙事）】：
1. 输出标准Markdown表格：${tableHeader}
${dramaticTensionRule}
2. 所有内容使用中文（SEEDANCE提示词除外）。
3. 「SEEDANCE提示词」列规范（每镜写成一行，不换行，按此顺序）：
   ${seedanceFormat}
4. 「画面描述」列：自然语言可读描述，严禁出现任何 @标签。
5. 「光影氛围」列：简短描述本镜整体光影色调。
${styleBaseToneRule ? styleBaseToneRule + '\n' : ''}6. 严禁在 SEEDANCE提示词列 输出 --ar、--motion、--quality 等技术参数。
7. ⚠️【${ironLawLabel}】：❶拒绝抽象（写"眼眶泛红"不写"她很伤心"）❷动词驱动（必须含"正在"）❸细节禁区（【细节】禁描述道具）❹台词铁律：有台词填原文并标注开口时机（第Xs开口，X为整数秒），无台词省略整个字段（禁止空引号）；多人说话写多个台词字段 ❹-附【台词开口时机铁律】按本镜时长确定X值：≤5s→X=1, 6-8s→X=2, 9-12s→X=3, 13-20s→X=4, >20s→X=5；爆发型台词X-1；独白推迟至镜头40-50%处；对话接续X=1；最终校验：X+说话时长+1s余韵≤镜头总时长 ❺物体状态铁律（场景内正在使用的道具必须在【环境】字段注明当前物理状态，禁止将道具写为默认关闭状态） ❻叙事目的铁律（每镜必须写明推动情节的核心目标，5-12字，不得空填） ❼衔接铁律（每镜必须说明与上一镜的连接逻辑：承接动作末态/由视线切入/由声音切入等） ❽资产一致：全篇 @人物N/@图片N/@道具N 标签严格统一，不得忽而标签忽而文字描述${markerRule}
8. 严禁出现任何明星、名人姓名或版权角色名。
9. 【一致性要求】：${consistencyRule}
${continuityIronRule ? '\n' + continuityIronRule : ''}${consistencyAnchor ? '\n' + consistencyAnchor : ''}
只输出Markdown分镜表格，不要任何额外说明文字。`
}

// 极速瞬间模式（<15s），对齐 V6 line 1055-1066
export const buildExtremeShortSystemPrompt = (ctx: SystemPromptContext & { isSTC?: boolean }, duration: number): string => {
  const {
    directorInfo, isDonghua, donghuaRules, assetLibraryInfo, assetCallRule,
    subjectTagHint, nameMappingInstruction, enableBGM, enableSubtitle,
    selectedStyleDesc, hasAnyTagAsset, continuityIronRule,
  } = ctx

  const seedanceFormat = buildSeedanceFormat(enableBGM, enableSubtitle)
  const directorBlock = directorInfo ? buildDirectorBlock(directorInfo, isDonghua) : ''
  const assetBlock = assetLibraryInfo ? `\n${assetLibraryInfo}` : ''
  const assetCallBlock = assetCallRule ? `\n${assetCallRule}` : ''
  const tagHintBlock = subjectTagHint ? `\n${subjectTagHint}` : ''
  const nameMappingBlock = nameMappingInstruction ? `\n${nameMappingInstruction}` : ''
  const donghuaRulesBlock = donghuaRules ? `\n${donghuaRules}` : ''

  const isDonghuaDirector = isDonghua && directorInfo?.donghuaProfile
  const promptSuffix = isDonghuaDirector ? directorInfo!.donghuaProfile!.promptSuffix : selectedStyleDesc
  const styleInjectionRule = promptSuffix
    ? `\n【视觉风格植入规范】：每条「SEEDANCE提示词」末尾追加：${promptSuffix}。`
    : ''

  const hasMarker = !enableBGM || !enableSubtitle
  const markerStr = (!enableBGM && !enableSubtitle) ? ' [禁BGM][禁字幕]' : (!enableBGM ? ' [禁BGM]' : ' [禁字幕]')
  const markerRule = hasMarker
    ? ` ❾【标记铁律】整行最末尾追加${markerStr}，不得省略`
    : ''
  const ironLawLabel = hasMarker ? '九维铁律' : '八维铁律'

  return `你是MoonAIGC首席导演与分镜师，专注极短视频（${duration}秒）的视觉瞬间设计。
${directorBlock}${assetBlock}${assetCallBlock}${tagHintBlock}${nameMappingBlock}${donghuaRulesBlock}${styleInjectionRule}

⚡【极速瞬间模式（≤${duration}s）】：
⚡ 捕捉一个极具张力的瞬间，1–3 镜，每镜都是强视觉冲击画面。
⚡ 只需要：一个主体、一个动作、一种强烈的情绪光影——仅此三要素。
⚡ 完全关闭叙事模式：无起承转合、无人物弧线、无STC逻辑，直接输出视觉奇观。
⚡ 生成 1–3 镜，每镜都是独立的强视觉冲击画面，总时长精确等于 ${duration}s。

【分镜生成规则（${ironLawLabel}）】：
1. 输出标准Markdown表格：| 时间段 | 景别 | 运镜 | 画面描述 | 光影氛围 | SEEDANCE提示词 |
2. 「SEEDANCE提示词」列规范（每镜写成一行，按此顺序）：
   ${seedanceFormat}
3. ⚠️【${ironLawLabel}】：❶拒绝抽象❷动词驱动（必须含"正在"）❸细节禁区（【细节】禁描述道具）❹台词铁律：有台词填原文并标注开口时机（第Xs开口，X为整数秒），无台词省略（禁止空引号）；X值：≤5s→X=1, 6-8s→X=2, 9-12s→X=3 ❺物体状态铁律（道具需标注当前物理状态） ❻叙事目的铁律（每镜必须写明推动情节的核心目标） ❼衔接铁律（每镜必须说明与上一镜的连接逻辑） ❽资产一致（@标签全篇统一）${markerRule}
4. 严禁出现任何 --ar、--motion 等技术参数。
5. ${hasAnyTagAsset ? '已开启@标签模式的素材类别，标签必须优先于任何外貌描写。' : '确保画面视觉风格与整体一致。'}
${continuityIronRule ? '\n' + continuityIronRule : ''}
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

// 构建单段模式的 user prompt（含台词锁定块）
export const buildGenerateUserPrompt = (params: {
  plot: string
  shotCount: string
  duration: string
  directorName: string
  analysisResult?: string
  dialogues?: string[]
}): string => {
  const { plot, shotCount, duration, directorName, analysisResult, dialogues = [] } = params
  const analysisBlock = analysisResult
    ? `\n## AI分析结果（参考）\n${analysisResult}\n`
    : ''
  const dialogueLockBlock = buildDialogueLockBlock(dialogues)

  return `请根据以下故事情节，以${directorName}的风格创作分镜脚本：

## 故事情节
${plot}
${analysisBlock}
## 参数
- 总时长：${duration}
- 分镜数量：${shotCount}（${shotCount === '智能' ? '根据故事复杂度自动决定最合适的镜头数量' : `精确输出${shotCount}个镜头`}）
${dialogueLockBlock}
请直接输出完整的Markdown表格，不要有任何前置说明。`
}
