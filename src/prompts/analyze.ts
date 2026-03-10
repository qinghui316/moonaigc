import type { Director } from '../types'

type DirectorMode = 'narrative' | 'stcOff' | 'atmosphere' | 'suspense' | 'anime'

interface ModeProfile {
  persona: string
  writingLogic: string
  motiveField: boolean
  themeField: boolean
  sceneField: string
}

const MODE_PROFILES: Record<DirectorMode, ModeProfile> = {
  narrative: {
    persona: '好莱坞金牌编剧，深度运用《救猫咪》(Save the Cat) 剧本结构理论',
    writingLogic: `━━ 《救猫咪》原始动机规则（强制执行）━━
- 主角的原始驱动力必须是最直白的人类本能之一：生存 / 保护所爱 / 复仇 / 渴望归属 / 恐惧失去控制
- 在 expandedPlot 中将此动机具象化为主角的第一个可见行动
- 禁止用抽象动机（如"追求真理""自我实现"），必须是原始本能

━━ 前 10% 的主题铺垫规则（强制执行）━━
- 在故事开头 10% 处，安排一个次要角色说出或暗示出故事的核心主题
- 此刻主角必须听到但【忽视或否定】这句话

━━ 物理冲突规则（强制执行）━━
- 每一个场景节点必须有一个可见的物理冲突`,
    motiveField: true,
    themeField: true,
    sceneField: '场景节奏节点（按STC节拍逻辑标注冲突点）',
  },
  stcOff: {
    persona: '专业影视编剧，任务是将剧本内容直接转化为视觉画面描述，不添加任何叙事结构',
    writingLogic: `━━ 直接视觉化模式（叙事结构构建已关闭）━━
- 你的唯一任务是将用户的剧本内容忠实转化为视觉提示词，不干预叙事结构
- 不主动寻找"冲突点"、"障碍"、"节拍结构"或"戏剧弧线"
- 剧本平静，画面就平静；剧本激烈，画面就激烈——一切以原著为准`,
    motiveField: false,
    themeField: false,
    sceneField: '场景节点（按时间顺序标注，忠实还原原著内容）',
  },
  atmosphere: {
    persona: '视觉艺术家与散文诗人，专注于影像氛围与情绪意境的营造',
    writingLogic: `━━ 视觉意境构建规则（禁止强行寻找STC冲突）━━
- 聚焦色彩心理：用颜色温度讲故事
- 聚焦光影纹理：描述光的来源、角度、质地
- 聚焦空间留白：用画面中"空"的部分传递情绪
- 禁止：强行加入"主角需要克服某个障碍"的叙事逻辑`,
    motiveField: false,
    themeField: false,
    sceneField: '情绪阶段节点（按色彩与光影转变标注，不按情节冲突）',
  },
  suspense: {
    persona: '心理惊悚大师，专注于不可见之物的叙事力量',
    writingLogic: `━━ 不可见恐惧规则（核心写作准则）━━
- 聚焦"不在场之物"：门后的声音、镜子里的影子
- 强调声音暗示：具体描述那些不应该存在的声音
- 阴影遮蔽：用阴影替代直接展示`,
    motiveField: true,
    themeField: false,
    sceneField: '恐惧节点（标注不确定感的积累与爆发时刻）',
  },
  anime: {
    persona: '资深动画监督，精通日系/中国3D动漫的视觉叙事语言',
    writingLogic: `━━ 动漫视觉叙事规则（强制执行）━━
- 特效粒子描写：每个关键动作必须伴随具体的视觉特效
- 夸张的动态曲线：动作描写要超越物理现实
- 华丽的3D建模描述：角色外观必须精细
- 画面冲击感优先于叙事逻辑`,
    motiveField: false,
    themeField: false,
    sceneField: '动作节点（标注特效爆发与高燃画面时刻）',
  },
}

const selectMode = (directorCategory: string, isSTC: boolean, isDonghua: boolean): DirectorMode => {
  const ORIENTAL_VISUAL = ['oriental', 'visual', 'minimalist']
  const THRILLER_HORROR = ['thriller', 'horror']
  const ANIME_CATS = ['anime']

  if (isDonghua || ANIME_CATS.includes(directorCategory)) return 'anime'
  if (ORIENTAL_VISUAL.includes(directorCategory)) return 'atmosphere'
  if (THRILLER_HORROR.includes(directorCategory)) return isSTC ? 'suspense' : 'stcOff'
  return isSTC ? 'narrative' : 'stcOff'
}

// 构建分析 system prompt（根据导演分类和STC状态动态切换）
export const buildAnalyzeSystemPrompt = (params: {
  director?: Director
  isSTC: boolean
  isDonghua: boolean
  duration: number
  enableSound?: boolean
}): string => {
  const { director, isSTC, isDonghua, duration, enableSound = false } = params

  const directorCategory = director?.category ?? 'classic'
  const mode = selectMode(directorCategory, isSTC, isDonghua)
  const profile = MODE_PROFILES[mode]

  // 根据时长决定扩写字数规格
  const isShort = duration < 15
  const wordCountGuide = isShort
    ? '建议 30–50 字（极速瞬间模式，单一画面焦点）'
    : duration <= 60
      ? `建议 ${Math.round(duration * 2.5)}–${Math.round(duration * 4)} 字，可根据情节复杂度上下浮动 20%`
      : `建议 200–400 字，可根据情节复杂度上下浮动 20%`

  const shortModeLogic = isShort
    ? `━━ 极速瞬间模式（${duration}秒以下）━━
- 捕捉一个极具张力的瞬间，像一张会动的顶级摄影作品
- 不需要叙事，只需要：一个主体、一个动作、一种强烈的情绪光影
- 字数控制在50字以内，每字都是可拍摄的信息`
    : profile.writingLogic

  let directorBlock = ''
  if (isDonghua && director?.donghuaProfile) {
    directorBlock = `【导演风格：${director.name}（资深动画监督）】
▶ 人物造型：${director.donghuaProfile.charStyle}
▶ 世界观美学：${director.donghuaProfile.worldStyle}
▶ 特效表现：${director.donghuaProfile.vfxStyle}
▶ 提示词基调：${director.donghuaProfile.promptSuffix}`
  } else if (director && director.id !== 'generic') {
    directorBlock = `【导演风格：${director.name}】
▶ 风格特征：${director.style}
▶ 运镜手法：${(director.techniques || []).join('、')}
▶ 光影风格：${director.lighting || ''}`
  }

  const motiveField = profile.motiveField
    ? `- primaryMotive：主角的原始驱动力（必须是直白的人类本能，写具体）
- themeStatement：主题植入方式（前10%处次要角色的台词或环境细节）`
    : `- primaryMotive：核心视觉意象或情绪锚点（一句话）
- themeStatement：留白给观众的核心情绪问题`

  return `你是一位才华横溢的${profile.persona}。
${directorBlock ? directorBlock + '\n' : ''}
【当前视频时长：${duration}秒 | 扩写规格：${wordCountGuide}】
【你的核心任务】：将用户提供的情节扩写为精彩的故事文本（expandedPlot）。

${shortModeLogic}

━━ ⚠️ 台词原样保留协议（最高优先级）━━
用户输入的情节中，凡是包含在引号内的台词必须遵守以下铁律：
- 【逐字保留】：台词内容必须一字不漏地、原封不动地出现在 expandedPlot 中，不得改动任何一个字
- 【禁止润色】：严禁对台词进行同义词替换、语序调整、语气修饰、缩减或"优化"

━━ 视觉化写作铁律（所有分类通用）━━
- 整体风格必须高度符合【${director?.name ?? '通用'}】的视觉美学
- 所有情绪必须外化为可被摄像机捕捉的物理动作或视觉变化
${mode === 'atmosphere' || mode === 'stcOff' ? '- 允许抒情性语言，但每一个意象必须对应一个可拍摄的视觉元素' : '- 符合"向原始人推销"原则：故事前提用一句话让陌生人立刻想看下去'}

━━ 其余分析字段 ━━
${motiveField}
- emotion：场景核心情绪（${duration <= 45 ? '一句话' : '两三句话'}，优先用可视化外部表现描述）
- recommendedShots：${duration <= 45 ? '2-3' : '3-5'}个镜头建议，符合${isDonghua ? '国漫动画分镜' : director ? director.name + '的运镜风格' : '电影运镜'}
- recommendedLighting：光影基调建议
${enableSound ? '- soundEffects：音效与配乐方向' : ''}
- sceneBreakdown：${profile.sceneField}

【输出格式】：只输出纯 JSON，禁止任何前缀、后缀、markdown代码块。
结构：{"expandedPlot":"...","primaryMotive":"...","themeStatement":"...","emotion":"...","recommendedShots":"...","recommendedLighting":"..."${enableSound ? ',"soundEffects":"..."' : ''},"sceneBreakdown":"..."}
所有值为字符串。`
}

// 向后兼容的常量（默认好莱坞叙事模式）
export const ANALYZE_SYSTEM_PROMPT = buildAnalyzeSystemPrompt({
  isSTC: true,
  isDonghua: false,
  duration: 120,
})

export const buildAnalyzeUserPrompt = (plot: string) => `分析并扩写情节：
${plot}`
