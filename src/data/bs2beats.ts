export interface BS2Beat {
  key: string
  name: string
  nameZh: string
  task: string
  pct: number
  colorClass: string
  modes: ('burst' | 'mini' | 'full' | 'mood' | 'plain')[]
}

// 完整BS2节拍定义（对齐V5.1键名）
export const BS2_BEATS: BS2Beat[] = [
  {
    key: 'opening',
    name: 'Opening Image',
    nameZh: '开场画面',
    task: '用一个静止的画面/镜头，立刻传达出故事的情绪基调和主角所处的世界状态，视觉上要能回应结局画面。',
    pct: 0,
    colorClass: 'bg-indigo-400',
    modes: ['full'],
  },
  {
    key: 'setup',
    name: 'Setup',
    nameZh: '铺垫',
    task: '展示主角在旧世界的日常，埋下将在高潮被呼应的道具/话语/关系；救猫咪时刻必须在这里出现——主角做一件让观众立刻喜欢他的事。',
    pct: 1,
    colorClass: 'bg-indigo-500',
    modes: ['mini', 'full'],
  },
  {
    key: 'catalyst',
    name: 'Catalyst',
    nameZh: '催化剂',
    task: '一个外部事件砸向主角，彻底打破旧世界的平衡。这个事件必须直接针对主角的原始驱动力，让他别无选择。',
    pct: 10,
    colorClass: 'bg-indigo-500',
    modes: ['mini', 'full'],
  },
  {
    key: 'debate',
    name: 'Debate',
    nameZh: '争执',
    task: '主角犹豫、抗拒、试图找到不改变的理由；必须呈现改变的代价，观众需要感受到跨越门槛的危险性。',
    pct: 12,
    colorClass: 'bg-yellow-500',
    modes: ['full'],
  },
  {
    key: 'act2in',
    name: 'Break Into Two',
    nameZh: '进入第二幕',
    task: '主角主动做出选择，踏入新世界，再也无法回头。必须是主角的主动决策而非被迫推入。',
    pct: 20,
    colorClass: 'bg-green-500',
    modes: ['full'],
  },
  {
    key: 'bstory',
    name: 'B Story',
    nameZh: 'B故事',
    task: '引入B故事（通常是爱情线/导师/对立角色），此人将在后续传递故事主题；B故事第一幕必须与A故事形成反差或镜像。',
    pct: 22,
    colorClass: 'bg-indigo-400',
    modes: ['full'],
  },
  {
    key: 'fun',
    name: 'Fun & Games',
    nameZh: '游戏与乐趣',
    task: '展示主角在新世界中探索规则、尝试解决问题；这是观众购票想看的核心画面，需兑现类型片承诺，节奏轻快但持续积累压力。',
    pct: 25,
    colorClass: 'bg-lime-500',
    modes: ['mini', 'full'],
  },
  {
    key: 'midpoint',
    name: 'Midpoint',
    nameZh: '中点',
    task: '伪胜利（以为赢了但更大危险来临）或伪失败（遭受打击但内心燃起真正欲望）；必须是主角命运的转折点。',
    pct: 50,
    colorClass: 'bg-emerald-600',
    modes: ['mini', 'full'],
  },
  {
    key: 'badclose',
    name: 'Bad Guys Close In',
    nameZh: '坏蛋逼近',
    task: '反派/障碍重新集结全力压制；主角团队出现内部矛盾或信任危机；节奏加速，每场比上一场压力更大。',
    pct: 55,
    colorClass: 'bg-red-500',
    modes: ['mini', 'full'],
  },
  {
    key: 'allis',
    name: 'All Is Lost',
    nameZh: '一无所有',
    task: '主角跌入最低谷：失去最重要的人/物/信念；必须有象征性死亡（旧自我死去）；让观众感到一切真的完了。',
    pct: 75,
    colorClass: 'bg-rose-600',
    modes: ['full'],
  },
  {
    key: 'dark',
    name: 'Dark Night of Soul',
    nameZh: '灵魂黑夜',
    task: '主角独自面对黑暗，重新审视真正想要的是什么；必须发生内在转化；主题在此刻由主角自己领悟。',
    pct: 78,
    colorClass: 'bg-violet-600',
    modes: ['full'],
  },
  {
    key: 'act3in',
    name: 'Break Into Three',
    nameZh: '进入第三幕',
    task: '主角获得新的解决方案（通常来自B故事线索或被忽视的主题台词），重新集结力量，主动出击。',
    pct: 80,
    colorClass: 'bg-indigo-500',
    modes: ['full'],
  },
  {
    key: 'finale',
    name: 'Finale',
    nameZh: '结局',
    task: '高塔攻克五步：聚集盟友→执行计划→计划失败靠内在成长解决→挖掘道德前提→建立新世界；必须呼应开场画面形成视觉闭环。',
    pct: 85,
    colorClass: 'bg-indigo-500',
    modes: ['mini', 'full'],
  },
]

// burst 模式节拍（独立，不在 BS2_BEATS 中）
export const BURST_BEATS: BS2Beat[] = [
  {
    key: 'hook',
    name: 'Hook',
    nameZh: '开场/钩子',
    task: '用一个极强视觉钩子在 0.5 秒内抓住眼球——奇异的构图、反预期的动作、强烈的色彩冲击；不需要交代背景，直接引爆好奇心。',
    pct: 0,
    colorClass: 'bg-indigo-500',
    modes: ['burst'],
  },
  {
    key: 'action',
    name: 'Core Action',
    nameZh: '核心动作',
    task: '呈现视频的核心视觉内容：一个连贯的、有张力的动作序列或情绪积累过程；每一帧都必须服务于最终的反转/奇观，节奏紧绷，不留废镜。',
    pct: 20,
    colorClass: 'bg-emerald-500',
    modes: ['burst'],
  },
  {
    key: 'spectacle',
    name: 'Spectacle',
    nameZh: '视觉奇观/反转',
    task: '爆发式收尾：一个让观众想二刷的视觉奇观或情节反转；必须呼应开场钩子，给观众"原来如此"或"完全没想到"的强烈后劲。',
    pct: 80,
    colorClass: 'bg-indigo-500',
    modes: ['burst'],
  },
]

// 情绪阶段节拍（mood模式，东方/视觉/极简风格时使用）
export const MOOD_BEATS: BS2Beat[] = [
  {
    key: 'qi',
    name: 'Qi (Rise)',
    nameZh: '起',
    task: '建立视觉基调与情绪锚点：用色彩、光影、空间构图传达核心情绪氛围。',
    pct: 0,
    colorClass: 'bg-indigo-400',
    modes: ['mood'],
  },
  {
    key: 'cheng',
    name: 'Cheng (Development)',
    nameZh: '承',
    task: '深化情绪积累：展开核心意象的变奏与延伸，光影与空间发生微妙变化。',
    pct: 25,
    colorClass: 'bg-indigo-400',
    modes: ['mood'],
  },
  {
    key: 'zhuan',
    name: 'Zhuan (Turn)',
    nameZh: '转',
    task: '情绪转折或意象反转：色彩温度明显偏移，画面构图打破前段节奏。',
    pct: 55,
    colorClass: 'bg-indigo-500',
    modes: ['mood'],
  },
  {
    key: 'he',
    name: 'He (Conclusion)',
    nameZh: '合',
    task: '意境收束：画面回归或升华至静止状态，与开场情绪呼应或深化，留下余韵。',
    pct: 80,
    colorClass: 'bg-indigo-500',
    modes: ['mood'],
  },
]
