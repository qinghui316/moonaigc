// 共享工具：解析分镜 Markdown 表格
// 被 StoryboardTable.tsx 和 useShotStore.ts 共同使用

const parseCells = (line: string): string[] =>
  line
    .split('|')
    .slice(1, -1)
    .map(cell => cell.trim())

const isSeparatorRow = (cells: string[]): boolean =>
  cells.length > 0 && cells.every(cell => /^:?-{3,}:?$/.test(cell.replace(/\s+/g, '')))

const isHeaderRow = (cells: string[]): boolean => {
  if (cells.length < 4) return false

  const hasTime = cells.some(cell => cell.includes('时间'))
  const hasShotType = cells.some(cell => cell.includes('景别'))
  const hasCamera = cells.some(cell => cell.includes('运镜'))
  const lastCell = cells[cells.length - 1] ?? ''

  return hasTime && hasShotType && hasCamera && lastCell.includes('SEEDANCE')
}

export const parseTableRows = (markdown: string): { headers: string[]; rows: string[][] } => {
  const lines = markdown
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.startsWith('|'))

  let headers: string[] = []
  const rows: string[][] = []

  for (const line of lines) {
    const cells = parseCells(line)
    if (cells.length === 0) continue
    if (isSeparatorRow(cells)) continue

    if (isHeaderRow(cells)) {
      if (!headers.length) {
        headers = cells
      }
      continue
    }

    if (!headers.length) continue
    if (cells.length !== headers.length) continue

    rows.push(cells)
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
