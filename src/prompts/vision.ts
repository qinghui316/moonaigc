// 视觉反推 Prompts（对齐V5.1）

export type VisionMode = 'asset' | 'plot' | 'both'

// 图片分析 system prompt（根据模式动态生成）
export const buildImageAnalysisSystemPrompt = (mode: VisionMode = 'both', imageCount = 1): string => {
  const includeAsset = mode === 'asset' || mode === 'both'
  const includePlot = mode === 'plot' || mode === 'both'

  return `你是一名专业影视视觉分析师。请仔细分析这${imageCount}张图片，按以下要求输出结构化分析结果。

${includeAsset ? `【素材提取】：
从图片中识别所有可见的人物、场景/背景、重要道具，填入对应数组。
- characters：人物角色（识别外貌特征、服装、年龄等视觉特征）
- scenes：场景/背景环境（室内/室外、氛围、光线、主要视觉元素）
- props：关键道具（对故事有意义的物品）` : ''}

${includePlot ? `【剧情推断】：
根据图片中的视觉线索（人物表情、肢体语言、场景氛围、道具含义），推断可能的故事情节。
- plot_summary：100-200字的剧情简介
- story_tone：故事基调（如：温情、悬疑、热血、浪漫等）
- director_style：最接近的导演风格（如：王家卫式、诺兰式等，若无明显风格可填"通用"）` : ''}

【输出格式】（严格 JSON，不要任何其他文字）：
{
  ${includeAsset ? `"characters": [{"name": "人物1", "visual_desc": "详细外貌描述，包含面部特征、发型、服装颜色款式等"}, ...],
  "scenes": [{"name": "场景1", "visual_desc": "详细环境描述，包含空间类型、光线氛围、色调、主要视觉元素等"}, ...],
  "props": [{"name": "道具1", "visual_desc": "道具的外观、颜色、用途描述"}],` : '"characters":[],"scenes":[],"props":[],'}
  ${includePlot ? `"plot_summary": "...",
  "story_tone": "...",
  "director_style": "..."` : '"plot_summary":"","story_tone":"","director_style":""'}
}`
}

// 视频分析 system prompt
export const buildVideoAnalysisSystemPrompt = (frameCount: number, duration: number): string =>
  `你是一名专业影视分镜分析师。我提供了一段视频的 ${frameCount} 个关键帧截图（视频总时长约 ${Math.round(duration)} 秒）。

请依次分析每一帧，输出完整的视频分镜分析报告。

【分析要求】：
1. 逐帧识别：景别（全景/中景/近景/特写等）、运镜方向、画面主要内容
2. 人物识别：出现的角色外貌特征
3. 场景识别：背景环境特征
4. 整体叙事：根据帧序列推断故事走向
5. 导演风格：色调偏好、运镜习惯、叙事节奏

【输出格式】（严格 JSON，不要任何其他文字）：
{
  "shots": [
    {
      "frame_index": 1,
      "time": "0.0s",
      "shot_scale": "景别，如：全景/中景/近景/特写",
      "camera_move": "运镜，如：固定/慢推/摇镜/跟随",
      "scene_desc": "画面内容简述（30字内）",
      "characters": "出现的人物简述",
      "lighting": "光影特征"
    }
  ],
  "characters": [{"name": "人物1", "visual_desc": "外貌描述"}],
  "scenes": [{"name": "场景1", "visual_desc": "环境描述"}],
  "plot_summary": "根据视频推断的故事情节（100-200字）",
  "story_tone": "故事基调",
  "director_style": "导演风格特征",
  "camera_habits": "运镜习惯总结（如：偏好近景固定、慢推为主等）",
  "color_tone": "色调特征（如：暖橙冷蓝、高饱和度等）"
}`
