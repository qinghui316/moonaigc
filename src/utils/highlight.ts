// @标签高亮 & 五维字段着色
const TAG_COLORS = [
  'text-amber-400', 'text-sky-400', 'text-emerald-400',
  'text-rose-400', 'text-purple-400', 'text-cyan-400',
  'text-orange-400', 'text-teal-400', 'text-pink-400', 'text-indigo-400',
]

const tagColorMap = new Map<string, string>()
let colorIndex = 0

export const getTagColor = (tag: string): string => {
  if (!tagColorMap.has(tag)) {
    tagColorMap.set(tag, TAG_COLORS[colorIndex % TAG_COLORS.length])
    colorIndex++
  }
  return tagColorMap.get(tag)!
}

// 将 @标签 转为 span 高亮 HTML（在表格单元格中使用）
export const highlightAtTags = (text: string): string => {
  return text.replace(/@([\w\u4e00-\u9fa5]+)/g, (_, tag) => {
    const color = getTagColor(tag)
    return `<span class="tag-highlight ${color} font-semibold px-0.5 rounded">@${tag}</span>`
  })
}

// 解析分镜表格行 -> 结构化数据
export const parseTableRow = (row: string): string[] => {
  return row.split('|').filter((_, i, arr) => i > 0 && i < arr.length - 1).map(c => c.trim())
}

// 检测是否是表格行（数据行，非分隔行）
export const isTableDataRow = (line: string): boolean => {
  return line.startsWith('|') && !line.includes('---')
}

// 检测是否是表格头行
export const isTableHeaderRow = (line: string): boolean => {
  return isTableDataRow(line) && (line.includes('时长') || line.includes('景别'))
}
