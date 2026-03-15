import { RHYTHM_CURVE } from '../../data/drama/rhythmCurve'
import { HOOK_DESIGN } from '../../data/drama/hookDesign'
import { PAYWALL_DESIGN } from '../../data/drama/paywallDesign'

export const buildEpisodeDirSystemPrompt = (): string => {
  return `你是一位专业的微短剧编剧，精通分集目录规划。

以下是节奏和钩子设计参考：

${RHYTHM_CURVE}

---

${HOOK_DESIGN}

---

${PAYWALL_DESIGN}`
}

function calcMarkQuota(totalEpisodes: number) {
  const fireMin = Math.ceil(totalEpisodes * 0.25)
  const fireMax = Math.ceil(totalEpisodes * 0.35)
  const moneyMin = Math.ceil(totalEpisodes * 0.10)
  const moneyMax = Math.ceil(totalEpisodes * 0.15)
  // earlyCount 取前 35% 集数，确保早期要求随总集数等比例增长
  const earlyCount = Math.max(3, Math.ceil(totalEpisodes * 0.35))
  const earlyFire = Math.max(1, Math.ceil(earlyCount * 0.25))
  const earlyMoney = Math.max(1, Math.ceil(earlyCount * 0.15))
  return { fireMin, fireMax, moneyMin, moneyMax, earlyCount, earlyFire, earlyMoney }
}

function getBatchStage(batchStart: number, totalEpisodes: number): string {
  const progress = batchStart / totalEpisodes
  if (progress <= 0.25) return '起势阶段（建立世界观、引入主要矛盾，适当设置钩子，避免过度集中标记）'
  if (progress <= 0.5) return '攀升阶段（矛盾升级、角色成长，保持紧张感）'
  if (progress <= 0.75) return '风暴阶段（节奏最快、高潮密集，每集必须有爆点）'
  return '决战阶段（终极对决、情感爆发、收束所有伏笔）'
}

export const buildEpisodeDirUserPrompt = (
  creativePlan: string,
  characterDoc: string,
  totalEpisodes: number,
  editInstruction?: string
): string => {
  const q = calcMarkQuota(totalEpisodes)
  return `请根据以下创作方案和角色档案，生成完整的分集目录。

## 创作方案
${creativePlan}

## 角色档案摘要
${characterDoc.slice(0, 2000)}

## 分集目录要求

请生成全部 ${totalEpisodes} 集的目录，**必须同时输出两个部分**：

### 第一部分：分集目录文本（供用户阅读）
格式：第N集：{集标题} —— {核心冲突或爽点一句话描述} {标记}

标记说明：
- 🔥 关键剧情集（重大转折、高潮、揭秘）
- 💰 付费卡点集
- 无标记 = 常规推进集

**硬性要求（必须严格遵守）**：
- ⚡ **第1集必须标记🔥**（开场钩子，立即抓住观众，不可例外）
- ⚡ **前3集内必须有至少1个💰**（早期付费卡点，先让观众上瘾再设门槛）
- 🔥标记：全剧必须有 ${q.fireMin}-${q.fireMax} 个🔥集，不能少于 ${q.fireMin} 个
- 💰标记：全剧必须有 ${q.moneyMin}-${q.moneyMax} 个💰集，不能少于 ${q.moneyMin} 个
- 前${q.earlyCount}集必须包含至少 ${q.earlyFire} 个🔥和 ${q.earlyMoney} 个💰
- 💰集通常放在重大悬念未解、剧情高潮前夕的位置（如第3-5集、中段转折前、大结局前一集）
- 不能所有集都标🔥，也不能没有💰，两种标记必须共存
- 目录必须体现四阶段节奏变化

### 第二部分：结构化JSON（供系统解析，紧跟文本后输出）

\`\`\`json
[
  {
    "episodeNumber": 1,
    "title": "集标题",
    "summary": "核心剧情一句话摘要",
    "hookType": "悬念钩|反转钩|情绪钩|信息钩|危机钩|无",
    "mark": "fire|money|"
  }
]
\`\`\`

注意：JSON数组必须包含全部${totalEpisodes}集，不能省略。${editInstruction ? `\n\n## 特别修改要求\n${editInstruction}` : ''}`
}

export interface PrevEpisodeBrief {
  episodeNumber: number
  title: string
  summary: string
  hookType: string
  mark: string
}

export const buildEpisodeDirBatchUserPrompt = (
  creativePlan: string,
  characterDoc: string,
  batchStart: number,
  batchEnd: number,
  totalEpisodes: number,
  prevEpisodes: PrevEpisodeBrief[],
  editInstruction?: string
): string => {
  const q = calcMarkQuota(totalEpisodes)
  const stage = getBatchStage(batchStart, totalEpisodes)
  const prevList = prevEpisodes.length > 0
    ? prevEpisodes.map(ep => {
        const markStr = ep.mark === 'fire' ? ' 🔥' : ep.mark === 'money' ? ' 💰' : ''
        return `第${ep.episodeNumber}集：${ep.title} —— ${ep.summary} [${ep.hookType}]${markStr}`
      }).join('\n')
    : '（无，这是第一批）'

  return `请根据以下创作方案，继续生成分集目录的第 ${batchStart}-${batchEnd} 集。

## 创作方案
${creativePlan}

## 角色档案摘要
${characterDoc.slice(0, 1500)}

## 已完成的分集目录（保持故事连贯性）
${prevList}

## 本批次生成要求

请生成第 **${batchStart}-${batchEnd}** 集（共${batchEnd - batchStart + 1}集），当前处于「${stage}」。

**标记配额（硬性要求）**：全剧🔥必须 ${q.fireMin}-${q.fireMax} 集，💰必须 ${q.moneyMin}-${q.moneyMax} 集。本批次按比例分配，🔥和💰必须共存，💰放在悬念高潮前夕。${batchStart === 1 ? '\n- ⚡ **第1集必须标记🔥**（开场钩子，不可例外）\n- ⚡ **前3集内必须有至少1个💰**（早期付费卡点）' : ''}

**必须同时输出两个部分**：

### 第一部分：本批分集目录文本
格式：第N集：{集标题} —— {核心冲突或爽点一句话描述} {标记}

### 第二部分：结构化JSON（供系统解析）

\`\`\`json
[
  {
    "episodeNumber": ${batchStart},
    "title": "集标题",
    "summary": "核心剧情一句话摘要",
    "hookType": "悬念钩|反转钩|情绪钩|信息钩|危机钩|无",
    "mark": "fire|money|"
  }
]
\`\`\`

注意：JSON数组只包含第${batchStart}-${batchEnd}集（${batchEnd - batchStart + 1}条），结尾钩子须与下一批衔接。${editInstruction && batchStart === 1 ? `\n\n## 特别修改要求\n${editInstruction}` : ''}`
}
