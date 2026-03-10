// STC质量自检 Prompt（对齐V5.1）

export const buildStcCheckPrompt = (params: {
  originalPlot: string
  storyboardContent: string
}): string => {
  const { originalPlot, storyboardContent } = params
  return `你是《救猫咪》剧本结构专家，请对以下分镜脚本进行三项质量自检，输出诊断报告。

【原始情节】：
${originalPlot.slice(0, 600)}

【生成的分镜脚本（节选）】：
${storyboardContent.slice(0, 1500)}

━━ 三项检测任务 ━━

① 救猫咪时刻（Save-the-Cat Moment）
检查主角在开场（前10-15%时间段）是否有让观众心生好感的行为。
输出：✅通过 / ⚠️不足 / ❌缺失，并说明原因（30字内）。若不足，给出具体改写建议（1句话）。

② 双重魔法检测（Double Mumbo Jumbo）
检查故事中是否存在两种以上独立的超自然/科幻/奇幻规则同时生效。
输出：✅安全 / ⚠️风险 / ❌危险，并列举检测到的设定。

③ 陈词滥调剥离（似而不同）
找出脚本中最套路的1-2处描写，给出"似而不同"的改写方向（不超过2句话）。

只输出纯 JSON，禁止任何前缀/后缀/markdown代码块：
{"saveCat":{"status":"pass|warn|fail","detail":"...","suggestion":"..."},"doubleMagic":{"status":"pass|warn|fail","detail":"...","settings":[]},"cliches":[{"original":"...","direction":"..."}]}`
}

// 向后兼容
export const STC_CHECK_SYSTEM_PROMPT = ''

export const buildStcCheckUserPrompt = (storyboardContent: string, originalPlot?: string): string =>
  buildStcCheckPrompt({
    originalPlot: originalPlot ?? '',
    storyboardContent,
  })
