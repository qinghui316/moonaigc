import { GENRE_GUIDE } from '../../data/drama/genreGuide'
import { RHYTHM_CURVE } from '../../data/drama/rhythmCurve'
import { PAYWALL_DESIGN } from '../../data/drama/paywallDesign'
import { VILLAIN_DESIGN } from '../../data/drama/villainDesign'

/** Prompt 1: 将任意文本拆分为分集结构 */
export const buildSplitScriptSystemPrompt = (): string =>
  `你是专业微短剧编剧，精通将各类原始文本（大纲/故事梗概/小说/完整剧本）解析为标准分集结构。`

export const buildSplitScriptUserPrompt = (
  sourceText: string,
  totalEpisodes: number,
  adaptMode: 'faithful' | 'blockbuster'
): string => {
  const modeDesc = adaptMode === 'faithful'
    ? '【忠于原文模式】尽量保留原文的故事脉络、人物设定和关键情节，仅做必要的结构整理和补全。'
    : `【爆款改编模式】在保留原文核心人物和基本故事线的基础上，按照微短剧爆款结构大幅改编：强化钩子、付费卡点、爽感节奏，使其符合短视频平台传播规律。\n\n参考节奏规律：\n${RHYTHM_CURVE}\n\n参考付费设计：\n${PAYWALL_DESIGN}`

  return `请将以下原始文本解析为${totalEpisodes}集的微短剧分集结构。

## 适配模式
${modeDesc}

## 原始文本
${sourceText}

## 输出格式（严格JSON数组，不要任何额外文字）
输出一个JSON数组，每个元素格式如下：
\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "第X集标题",
    "summary": "本集剧情摘要（80-150字）",
    "hookType": "钩子类型（如：悬念钩/冲突钩/反转钩/爽点钩）",
    "mark": "本集关键标记（如：付费卡点/高潮/转折/收尾）",
    "sourceText": "本集对应的原文片段（如能对应则引用，否则填空字符串）",
    "status": "outline"
  }
]
\`\`\`

要求：
1. 必须输出恰好${totalEpisodes}集
2. summary 要有故事感，体现本集核心冲突和情感张力
3. 若原文较短（字数 < 集数×200），则在忠于核心的基础上适当扩写和补全每集内容
4. 仅输出JSON，不要代码块标记以外的任何文字`
}

/** Prompt 2: 根据原文反推创作方案（导入模式） */
export const buildImportCreativePlanSystemPrompt = (): string =>
  `你是一位专业的微短剧编剧，精通短视频平台的爆款短剧创作方法论。

以下是你的创作参考知识库：

${GENRE_GUIDE}

---

${RHYTHM_CURVE}

---

${PAYWALL_DESIGN}`

export const buildImportCreativePlanUserPrompt = (
  sourceText: string,
  adaptMode: 'faithful' | 'blockbuster',
  totalEpisodes: number,
  episodeSummaries: string
): string => {
  const modeDesc = adaptMode === 'faithful'
    ? '**忠于原文模式**：尽量还原原文的故事世界观、人物设定和情节脉络。'
    : '**爆款改编模式**：在保留原文核心IP的基础上，按照微短剧爆款结构重新规划，强化商业价值。'

  return `请根据以下原始文本和已生成的分集摘要，反推并生成完整的微短剧创作方案。

## 适配模式
${modeDesc}

## 原始文本（节选/全文）
${sourceText.slice(0, 3000)}${sourceText.length > 3000 ? '\n...[原文已截取前3000字]' : ''}

## 已拆分的分集摘要（${totalEpisodes}集）
${episodeSummaries}

## 请输出以下内容（Markdown格式）：

### 一、剧名备选
提供3个备选剧名，每个附一句话说明

### 二、时空背景
时代、地点、社会环境（来自原文或合理推断）

### 三、故事核心
一句话故事线 + 核心冲突（忠实还原原文）

### 四、三幕结构
- **第一幕（建置）：** 集数范围、核心事件
- **第二幕（对抗）：** 集数范围、冲突升级
- **第三幕（高潮/结局）：** 集数范围、结局处理

### 五、全剧节奏规划
按四阶段模型，标注各阶段高潮点和卡点位置

### 六、付费卡点规划
列出关键卡点（集数 + 类型 + 悬念）

### 七、爽点矩阵
主要爽点类型和分布

### 八、结局设计
主线结局 + 感情线结局`
}

/** Prompt 3: 根据原文反推角色档案（导入模式） */
export const buildImportCharacterDocSystemPrompt = (): string =>
  `你是一位专业的微短剧编剧，擅长从原始文本中提取和还原角色体系。

以下是角色设计参考：

${VILLAIN_DESIGN}`

export const buildImportCharacterDocUserPrompt = (
  sourceText: string,
  creativePlan: string,
  adaptMode: 'faithful' | 'blockbuster'
): string => {
  const modeDesc = adaptMode === 'faithful'
    ? '**忠于原文模式**：必须严格还原原文中的角色外貌、性格、关系，不得自行创造。'
    : '**爆款改编模式**：在原文角色基础上强化戏剧张力，允许对次要角色进行合理改编。'

  return `请根据以下原始文本和创作方案，生成完整的角色体系档案。

## 适配模式
${modeDesc}

## 原始文本（节选）
${sourceText.slice(0, 2000)}${sourceText.length > 2000 ? '\n...[原文已截取前2000字]' : ''}

## 创作方案
${creativePlan.slice(0, 2000)}${creativePlan.length > 2000 ? '\n...[已截取]' : ''}

## 请输出以下内容（Markdown格式）：

### 一、主要角色档案
为每个主要角色生成：
- 姓名（原文名称，不得改动）、年龄（原文或合理推断）
- 外貌特征（2-3句，来自原文描述或合理推断）
- 性格关键词（3-5个）
- 核心动机
- 与其他角色的主要关系

### 二、角色关系图
文字描述主要角色之间的关系网络

### 三、视觉设计建议
每个主要角色的服装/造型风格建议（用于后续生图参考）`
}

/** Prompt 4: 忠于原文模式 — 将 outline 转为完整剧本 */
export const buildFaithfulEpisodeSystemPrompt = (): string =>
  `你是专业微短剧编剧，擅长将剧情摘要扩写为完整的分集剧本，同时严格忠于原始文本的世界观和人物设定。`

export const buildFaithfulEpisodeUserPrompt = (
  episodeNumber: number,
  episodeTitle: string,
  episodeSummary: string,
  sourceText: string,
  characterDoc: string,
  prevEpisodeBrief?: string
): string => {
  return `请将以下剧情摘要扩写为完整的第${episodeNumber}集剧本。

## 本集信息
- **集数：** 第${episodeNumber}集
- **标题：** ${episodeTitle}
- **剧情摘要：** ${episodeSummary}

## 本集对应原文
${sourceText || '（本集为原文扩写内容，参考整体故事逻辑）'}

## 角色档案（保持一致）
${characterDoc.slice(0, 1500)}

${prevEpisodeBrief ? `## 上集衔接\n${prevEpisodeBrief}\n` : ''}

## 输出要求
1. 忠于原文人物性格、名称、关系，不得改动原文设定
2. 每集字数1500-2500字
3. 格式：场景标题 + 场景描述 + 角色对话 + 动作描写
4. 结尾必须有自然的"上集结尾/下集引子"衔接
5. 保留并强化原文中的情感张力`
}

/** Prompt 5: 爆款改编模式 — 将 outline 改编为爆款剧本 */
export const buildBlockbusterEpisodeSystemPrompt = (): string =>
  `你是专业微短剧编剧，精通短视频平台爆款改编，擅长在保留原IP核心的基础上强化商业价值。

${PAYWALL_DESIGN}`

export const buildBlockbusterEpisodeUserPrompt = (
  episodeNumber: number,
  episodeTitle: string,
  episodeSummary: string,
  creativePlan: string,
  characterDoc: string,
  totalEpisodes: number,
  prevEpisodeBrief?: string,
  nextEpisodeBrief?: string
): string => {
  const narrativeStage =
    episodeNumber <= Math.ceil(totalEpisodes * 0.25) ? '建置期（勾引+设悬）' :
    episodeNumber <= Math.ceil(totalEpisodes * 0.6) ? '攀升期（升级+紧张）' :
    episodeNumber <= Math.ceil(totalEpisodes * 0.85) ? '风暴期（爽感+高潮）' :
    '决战期（反转+收尾）'

  return `请将以下剧情摘要改编为爆款微短剧第${episodeNumber}集剧本。

## 本集信息
- **集数：** 第${episodeNumber}/${totalEpisodes}集
- **标题：** ${episodeTitle}
- **叙事阶段：** ${narrativeStage}
- **剧情摘要：** ${episodeSummary}

## 创作方案（节奏规划参考）
${creativePlan.slice(0, 1000)}

## 角色档案
${characterDoc.slice(0, 1200)}

${prevEpisodeBrief ? `## 上集衔接\n${prevEpisodeBrief}\n` : ''}
${nextEpisodeBrief ? `## 下集预告（注意为下集埋钩）\n${nextEpisodeBrief}\n` : ''}

## 输出要求
1. 每集字数1500-2500字
2. 开头3句内必须制造冲突或悬念（钩子）
3. 中间穿插1-2个爽点
4. 结尾制造强烈悬念（"付费卡点"效果）
5. 台词要口语化、有张力，适合短视频观众
6. 格式：场景标题 + 描述 + 对话 + 动作`
}
