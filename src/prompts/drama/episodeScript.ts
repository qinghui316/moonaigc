import { OPENING_RULES } from '../../data/drama/openingRules'
import { HOOK_DESIGN } from '../../data/drama/hookDesign'
import { SATISFACTION_MATRIX } from '../../data/drama/satisfactionMatrix'

interface EpisodeScriptInput {
  episodeNumber: number
  title: string
  summary: string
  hookType: string
  mark: string
  characterDoc: string
  creativePlan: string
  prevEpisodeHook?: string
  prevEpisodeScript?: string
  nextEpisodeBrief?: string
  totalEpisodes: number
}

export const buildEpisodeScriptSystemPrompt = (isFirstEpisode: boolean): string => {
  const openingSection = isFirstEpisode
    ? `\n以下是第一集的开篇规则，请严格遵循：\n\n${OPENING_RULES}\n\n---\n`
    : ''

  return `你是一位专业的微短剧编剧，能够写出节奏紧凑、爽点密集的单集剧本。
${openingSection}
以下是钩子设计和爽点参考：

${HOOK_DESIGN}

---

${SATISFACTION_MATRIX}`
}

export const buildEpisodeScriptUserPrompt = (input: EpisodeScriptInput): string => {
  const isPaywall = input.mark === 'money'
  const isKeyEpisode = input.mark === 'fire'

  // 叙事阶段
  const progress = input.episodeNumber / input.totalEpisodes
  const storyStage = progress <= 0.25 ? '起势阶段（建立世界观、引入主要矛盾）'
    : progress <= 0.5 ? '攀升阶段（矛盾升级、角色成长）'
    : progress <= 0.75 ? '风暴阶段（节奏最快、高潮密集）'
    : '决战阶段（终极对决、情感爆发、收束伏笔）'

  // 前一集信息
  let prevSection: string
  if (input.prevEpisodeScript) {
    const trimmed = input.prevEpisodeScript.length > 3000
      ? '...（前文省略）\n' + input.prevEpisodeScript.slice(-2000)
      : input.prevEpisodeScript
    prevSection = `## 前一集完整剧本（请衔接对白风格、情绪和伏笔）\n${trimmed}`
  } else if (input.prevEpisodeHook) {
    prevSection = `**上集结尾钩子：** ${input.prevEpisodeHook}`
  } else {
    prevSection = '（本集为第一集）'
  }

  // 下一集预告
  const nextSection = input.nextEpisodeBrief
    ? `\n## 下一集预告（请在结尾为此埋下伏笔）\n${input.nextEpisodeBrief}`
    : ''

  return `请根据以下信息，生成第${input.episodeNumber}集的完整剧本。

## 本集信息
- **集数：** 第${input.episodeNumber}集（共${input.totalEpisodes}集）
- **标题：** ${input.title}
- **本集摘要：** ${input.summary}
- **钩子类型：** ${input.hookType}
- **叙事阶段：** ${storyStage}
- **集数标记：** ${isPaywall ? '💰 付费卡点集（结尾必须制造强悬念，不付费看不到下集）' : isKeyEpisode ? '🔥 关键剧情集（必须有重大转折或揭秘）' : '常规推进集'}

${prevSection}
${nextSection}

## 角色档案（参考）
${input.characterDoc.slice(0, 1500)}

## 创作方案摘要（参考）
${input.creativePlan.slice(0, 800)}

## 剧本格式要求

请按以下格式输出完整剧本：

\`\`\`
# 第${input.episodeNumber}集：${input.title}

> 本集关键词：{3个关键词}
> 本集爽点：{爽点类型}
> 前情提要：{上集结尾悬念，1-2句}

---

## 场次一

**场景：** 内景/外景 · {地点} · 日/夜
**出场人物：** {人物列表}

△ （全景）{场景描写，交代环境}

△ （中景）{人物动作描写}

**{角色名}**（{语气/动作指示}）："{台词}"

**{角色名}**："{台词}"

△ （特写）{关键细节描写}

♪ 音乐提示：{音乐氛围描述}

---

## 场次二
...（以此类推，共3-5个场次）

---

> 🎣 本集钩子：{悬念描述}
> 📺 下集预告：{下一集核心看点，1句}
\`\`\`

## 质量要求
- 每集3-5个场次，每集800字以上
- 景别提示至少使用3种（全景、中景、近景、特写）
- 台词带语气或动作指示
- 结尾必须有${isPaywall ? '【极强悬念钩子，在最关键时刻切断】' : `【${input.hookType}钩子】`}
- ${input.episodeNumber === 1 ? '第1集前30秒（约前3段）必须抓住观众' : '开头5秒必须承接上集悬念，立刻制造新张力'}`
}
