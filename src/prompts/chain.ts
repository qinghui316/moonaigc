// 链式引擎 Prompts

// 原著保真切分 Prompt（STC关闭时使用）
export const buildFaithfulSplitPrompt = (plot: string, sceneCount: number, scenesJson: string): string =>
  `你是专业影视分镜编辑，当前任务是【原著保真切分】——严禁改变原著叙事结构，只做内容分段。

【核心原则】：
- 不强加任何戏剧节拍
- 完全忠实原著情节边界
- 若原著有对话台词，必须原文保留在对应摘要中

【任务】：将剧本切分为 ${sceneCount} 段，为每段提取 contentSummary（30-100字）。

【分段结构】：
[${scenesJson}]

只输出纯JSON：{"scenes":[{"id":1,"title":"...","contentSummary":"..."}]}

原始剧本：
${plot}`

// BS2节拍切分 Prompt（STC开启时使用）
export const buildChainSplitPrompt = (params: {
  plot: string
  narrativeMode: string
  modeLabel: string
  sceneCount: number
  scenesJson: string
  isShort: boolean
  directorCategory?: string
}): string => {
  const { plot, modeLabel, sceneCount, scenesJson, isShort } = params

  const expandHint = isShort
    ? `\n⚠️ 剧本内容较短，请适当脑补细节，确保每段摘要内容丰富（20-80字）`
    : ''

  return `你是《救猫咪》节拍切分专家。

【叙事规模】：${modeLabel}

我已将故事切分为 ${sceneCount} 个节拍场次（时长已固定，不得修改）。

任务：为每个节拍提取/脑补对应的 contentSummary（情节摘要），要求：
- 每段摘要 20–80 字
- 每个节拍摘要内容必须唯一
- 根据叙事模式对摘要聚焦不同${expandHint}

⚠️【台词强制提取规则】：原始情节中的引号台词必须原文保留在对应摘要中。

【节拍结构】：
[${scenesJson}]

只输出纯JSON：
{"scenes":[{"id":1,"contentSummary":"..."}]}

原始情节：${plot}`
}

// 场次生成 Prompt（system）
export const buildSceneSystemPrompt = (params: {
  directorBlock: string
  assetInfo: string
  assetCallRule: string
  tagHint: string
  nameMappingInstruction: string
  aspectRatio: string
  quality: string
  enableBGM: boolean
  enableSubtitle: boolean
  selectedStyleDesc: string
  isSTC: boolean
  isMoodMode: boolean
  hasAnyTagAsset: boolean
  sceneId: number
  totalScenes: number
  globalOffset: number
  estimatedDuration: number
  beatTask: string
  shotMin: number
  shotMax: number
  shotCountInstruction: string
  bridgeInstruction: string
}): string => {
  const {
    directorBlock, assetInfo, assetCallRule, tagHint, nameMappingInstruction,
    enableBGM, enableSubtitle, isSTC, isMoodMode, hasAnyTagAsset,
    sceneId, totalScenes, globalOffset, estimatedDuration,
    beatTask, shotMin, shotMax, shotCountInstruction, bridgeInstruction,
  } = params

  const bgmPart = enableBGM ? '+情绪背景音乐' : ''
  const shootInstruction = (!enableBGM || !enableSubtitle)
    ? ` 拍摄指令：[${enableBGM ? '' : '禁BGM'}${!enableBGM && !enableSubtitle ? ' ' : ''}${enableSubtitle ? '' : '禁字幕'}]`
    : ''

  const seedanceFormat = `镜头：【景别+运镜】 环境：在@图片N [背景静态描述] 角色分动：@人物N [外观] 正在 [肢体动作]（多人用；分隔） 细节：@人物N [微表情与情绪（禁止描述道具）] 光影：[光源方向+质感+色调] 台词(@人物N)："对白原文"（无对白省略此字段） 音效：[环境音+声响${bgmPart}]${shootInstruction}`

  const tableHeader = isSTC
    ? '| 时间段 | 景别 | 运镜 | 画面描述 | 光影氛围 | 戏剧张力 | SEEDANCE提示词 |'
    : '| 时间段 | 景别 | 运镜 | 画面描述 | 光影氛围 | SEEDANCE提示词 |'

  const dramaticTensionRule = isSTC
    ? isMoodMode
      ? '   - 「戏剧张力」列格式：[情绪微变：从X→Y]（只写情绪偏移）'
      : '   - 「戏剧张力」列格式：[+/-][情绪：从X→Y] [冲突：障碍描述（10字内）]'
    : ''

  const dynamicsRule = isSTC
    ? isMoodMode
      ? `【情绪意象规则（情绪阶段模式，禁止强行寻找冲突障碍）】：
▶ 聚焦视觉意象的延展：每一镜延伸或变奏上一镜的核心意象（光线、材质、空间、色彩温度）
▶ 色彩光影的呼吸感：镜头间的色彩需有可感知的"呼吸"——或收紧或舒展
▶ 情绪的微妙起伏：每一镜在"戏剧张力"列只需标注情绪的细微偏移
▶ 严禁：出现"谁在阻碍主角"、"原始动机"、"STC节拍"等叙事逻辑描写`
      : `【场景动力学规则（《救猫咪》案板逻辑，每一镜必须严格遵守）】：
▶ +/- 情绪转折【强制执行】：每一镜结束时，场景的情绪张力必须发生方向性转变。
▶ >< 冲突标注【强制执行】：每一镜必须暗示或明示"谁/什么在阻碍主角"。
▶ 泳池里的教皇【强制执行】：交代背景信息时必须加入娱乐性视觉背景细节。`
    : `【直接视觉化模式（叙事结构构建已关闭）】：
▶ 你的唯一任务是将本场次剧本内容转化为画面，不添加、不改变、不重构任何情节
▶ 按剧本自然顺序逐段视觉化，镜头划分由画面内容决定
▶ 不需要"冲突障碍"、"情绪转折"、"节拍任务"——只描述画面里实际发生了什么
▶ "戏剧张力"列填写当前镜头的画面情绪基调（如：[平静]、[紧张]、[感伤]）`

  const consistencyRule = hasAnyTagAsset
    ? '全局@标签资产库在本场次内必须严格保持一致。'
    : '确保人物服装、环境、光影在本场次内完全统一。'

  const endTime = globalOffset + estimatedDuration

  return `你是MoonAIGC首席导演与分镜师。这是【${isMoodMode ? '情绪意境' : '链式叙事'}分段生成】任务中的第 ${sceneId}/${totalScenes} 个场次。

${directorBlock}
${assetInfo}
${assetCallRule}
${nameMappingInstruction}
${tagHint}
${bridgeInstruction}
【本场次时间段】：${globalOffset}s 到 ${endTime}s（场次内时长 ${estimatedDuration}s）
【时间轴规则（铁律）】：
- 第一镜时间戳从 ${globalOffset}s 开始，最后一镜结束时刻精确等于 ${endTime}s
- 所有镜头时长之和必须精确等于 ${estimatedDuration}s，不允许偏差
${shotCountInstruction}
【镜头数量（强制下限）】：本场次必须生成 ${shotMin}–${shotMax} 镜，不得少于 ${shotMin} 镜。

【节奏控制】：
✦ 动作/过渡镜头 → 时长 2–4 秒
✦ 叙事/情绪/反应镜头 → 时长 5–8 秒
✦ 超过 10 秒仅允许：大范围环境建立镜、高潮前极度静止镜、片头片尾仪式性构图
${dynamicsRule}

【分镜生成规则（MoonAIGC 五维视听叙事）】：
1. 输出标准Markdown表格：${tableHeader}
${dramaticTensionRule}
2. 所有内容使用中文。
3. 「SEEDANCE提示词」列规范（每镜写成一行，不换行，按此顺序）：
   ${seedanceFormat}
4. 「画面描述」列：自然语言可读描述，严禁出现任何 @标签。
5. 「光影氛围」列：简短描述本镜整体光影色调。
6. 严禁在 SEEDANCE提示词列 输出 --ar、--motion、--quality 等技术参数。
7. ⚠️【五维铁律】：❶拒绝抽象（写"眼眶泛红"不写"她很伤心"）❷动词驱动（必须含"正在"）❸细节禁区（【细节】禁描述道具）❹ 台词铁律：有对白必须写「台词(@人物N)："原文"」置于音效字段之前，@人物N为说话者，原文逐字不改，无对白完全省略台词字段 ❺@标签全篇统一
8. 严禁出现任何明星、名人姓名或版权角色名。
9. 【节拍任务】：${beatTask ? '本场次任务是：' + beatTask : '完成本场次的叙事目标。'}
10. 【资产一致性】：${consistencyRule}

只输出Markdown分镜表格，不要任何额外说明文字。`
}

// 场次生成 user prompt
export const buildSceneUserPrompt = (params: {
  beatName: string
  beatTask: string
  contentSummary: string
  narrativeMode: string
  estimatedDuration: number
  bridgeContext: string
  chatHistory: string
  sceneIndex: number
  totalScenes: number
}): string => {
  const { contentSummary } = params
  return `【本场次剧本（唯一依据，不得超出此范围）】
${contentSummary}`
}

// 向后兼容（旧版链式引擎使用）
export const buildChainSplitSystemPrompt = (): string => ''
export const buildChainSplitUserPrompt = (plot: string, mode: string, beatsInfo: string): string =>
  `叙事模式：${mode}\n可用节拍：${beatsInfo}\n\n故事情节：\n${plot}`
