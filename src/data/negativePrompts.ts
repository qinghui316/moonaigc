// 全局负向提示词（对齐 6.5）
export const GLOBAL_NEGATIVE_PROMPT =
  '不含文字, 不含水印, 不含字幕, 不含对话气泡, 不含变形, 不含模糊, 不含不雅内容'

// 用于拼接到正向 prompt 末尾（Gemini/Custom 平台无独立负向词字段）
export const GLOBAL_NEGATIVE_PROMPT_INLINE =
  '，不含文字，不含水印，不含字幕，不含对话气泡，不含变形，不含模糊，不含不雅内容'

// 风格特有负向词
export const STYLE_NEGATIVE_PROMPTS: Record<string, string> = {
  cinematic: '卡通, 动漫, 塑料感',
  anime: '写实, 3D渲染, 面部崩坏',
  cyberpunk: '自然光, 田园, 明亮粉彩',
  oil_painting: '照片, 3D渲染, 塑料感',
  '3d_render': '平面, 手绘, 水彩',
  vintage: '数字感, 霓虹, 鲜艳色彩',
  watercolor: '硬边缘, 写实, 暗色',
  pixel_art: '平滑, 写实, 照片',
  comic: '写实, 照片, 渐变',
  claymation: '写实, 平面, 数字感',
  ukiyoe: '3D, 写实, 数字艺术',
  surreal: '写实, 平淡, 单调',
  minimalist: '杂乱, 复杂, 噪点',
  noir: '彩色, 鲜艳, 高饱和',
  fantasy: '写实, 现代, 灰暗',
  steampunk: '数字感, 现代, 塑料感',
  donghua_xianxia: '西方画风, 写实, 低质量',
  ink_wash: '数字感, 写实, 鲜艳色彩',
  pixar_3d: '写实, 平面, 恐怖',
  kdrama: '动漫, 卡通, 低质量',
  documentary: '摆拍, 棚拍, 卡通',
  concept_art: '照片, 卡通, 模糊',
  french_illus: '写实, 3D, 灰暗',
  paper_cut: '写实, 3D, 渐变',
}
