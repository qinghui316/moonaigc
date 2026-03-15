// 共享工具：解析分镜 Markdown 表格
// 被 StoryboardTable.tsx 和 useShotStore.ts 共同使用

export const parseTableRows = (markdown: string): { headers: string[]; rows: string[][] } => {
  const lines = markdown.split('\n').filter(l => l.trim().startsWith('|'))
  let headers: string[] = []
  const rows: string[][] = []

  for (const line of lines) {
    if (line.includes('---')) continue
    const cells = line.split('|').filter(Boolean).map(c => c.trim())
    if (!headers.length) {
      headers = cells
    } else {
      if (cells.length >= 2) rows.push(cells)
    }
  }
  return { headers, rows }
}

export const highlightAtTags = (text: string): string => {
  const TAG_COLORS = ['#F59E0B', '#38BDF8', '#34D399', '#FB7185', '#A78BFA', '#22D3EE', '#FB923C', '#2DD4BF', '#F472B6', '#818CF8']
  const tagMap = new Map<string, string>()
  let idx = 0
  return text.replace(/@([\w\u4e00-\u9fa5]+)/g, (_, tag) => {
    if (!tagMap.has(tag)) { tagMap.set(tag, TAG_COLORS[idx % TAG_COLORS.length]); idx++ }
    return `<span style="color:${tagMap.get(tag)};font-weight:600">@${tag}</span>`
  })
}
