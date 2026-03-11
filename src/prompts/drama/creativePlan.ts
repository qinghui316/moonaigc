import { GENRE_GUIDE } from '../../data/drama/genreGuide'
import { RHYTHM_CURVE } from '../../data/drama/rhythmCurve'
import { PAYWALL_DESIGN } from '../../data/drama/paywallDesign'
import { SATISFACTION_MATRIX } from '../../data/drama/satisfactionMatrix'

interface CreativePlanInput {
  genre: string[]
  audience: string
  tone: string
  endingType: string
  totalEpisodes: number
  worldSetting: string
}

export const buildCreativePlanSystemPrompt = (): string => {
  return `你是一位专业的微短剧编剧，精通短视频平台的爆款短剧创作方法论。

以下是你的创作参考知识库，请在生成创作方案时严格遵循这些规则：

${GENRE_GUIDE}

---

${RHYTHM_CURVE}

---

${PAYWALL_DESIGN}

---

${SATISFACTION_MATRIX}`
}

export const buildCreativePlanUserPrompt = (input: CreativePlanInput, editInstruction?: string): string => {
  const genreStr = input.genre.join(' + ')
  return `请根据以下创作配置，生成一份完整的微短剧创作方案。

## 创作配置
- **题材组合：** ${genreStr}
- **目标受众：** ${input.audience}
- **故事基调：** ${input.tone}
- **结局类型：** ${input.endingType}
- **集数规模：** ${input.totalEpisodes}集
- **世界观/背景设定：** ${input.worldSetting}

## 请输出以下内容（Markdown格式）：

### 一、剧名备选
提供3个备选剧名，每个附一句话说明

### 二、时空背景
时代、地点、社会环境、阶层关系

### 三、故事核心
一句话故事线 + 核心冲突

### 四、三幕结构
- **第一幕（建置）：** 集数范围、核心事件、人物关系建立
- **第二幕（对抗）：** 集数范围、冲突升级、转折点
- **第三幕（高潮/结局）：** 集数范围、终极对决、结局处理

### 五、全剧节奏规划
按四阶段模型（起势/攀升/风暴/决战），标注各阶段的高潮点和卡点位置

### 六、付费卡点规划
列出 ${Math.round(input.totalEpisodes / 10)} 至 ${Math.round(input.totalEpisodes / 7)} 个卡点（集数 + 卡点类型 + 悬念设计）

### 七、爽点矩阵
按5大爽点类型，规划全剧的爽点分布和强度递进

### 八、结局设计
主线结局 + 感情线结局 + 伏笔回收${editInstruction ? `\n\n## 特别修改要求\n${editInstruction}` : ''}`
}
