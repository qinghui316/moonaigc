// 中文风格词自动识别映射表（对齐 soullens 6.5 qa 表）
// 仅在图片生成时触发，不参与分镜故事板生成
// 输入：导演 style 文案或分镜场景描述（中文）
// 输出：对应英文风格描述，追加到图片生成 prompt 末尾

export const STYLE_AUTO_MAP: [string, string][] = [
  // 黑色/悬疑
  ['黑色电影', 'film noir, dramatic shadows, chiaroscuro, venetian blind shadows'],
  ['悬疑', 'suspense atmosphere, dramatic shadows, tense composition'],
  ['惊悚', 'thriller atmosphere, dramatic low-key lighting, tight framing'],
  ['犯罪', 'crime drama, urban realism, gritty aesthetic'],

  // 科幻/未来
  ['赛博朋克', 'cyberpunk, neon lights, rain reflections, futuristic dystopia'],
  ['科幻', 'science fiction, futuristic environment, clean or gritty sci-fi aesthetic'],
  ['末日', 'post-apocalyptic, wasteland aesthetic, desaturated tones'],
  ['废土', 'post-apocalyptic wasteland, rust and decay, desolate landscape'],
  ['机甲', 'mecha design, metallic sheen, industrial detail, epic scale'],
  ['星际', 'outer space, starfield, cosmic nebula, zero-gravity environment'],

  // 东方/古代
  ['古装', 'ancient Chinese aesthetics, hanfu, traditional costume, imperial palace'],
  ['古风', 'classical Chinese style, ink wash brushwork, traditional ornaments'],
  ['武侠', 'wuxia martial arts, flowing robes, sword energy trails, bamboo forest'],
  ['修仙', 'Chinese xianxia 3D, flowing celestial robes, qi energy light particles, immortal floating mountain'],
  ['仙侠', 'Chinese xianxia, ethereal immortal realm, spiritual energy glow, ancient cultivator aesthetic'],
  ['宫廷', 'imperial court aesthetics, elaborate Chinese costume, palace architecture, formal composition'],
  ['水墨', 'ink wash painting style, Chinese ink aesthetics, brushstroke texture, monochrome elegance'],
  ['国风', 'Chinese cultural aesthetic, traditional motifs, red and gold palette, auspicious symbolism'],
  ['禅意', 'Zen aesthetics, minimal composition, negative space, tranquil natural elements'],
  ['禅意武侠', 'King Hu style, bamboo forest dappled light, temple shadow geometry, ink painting silhouette'],
  ['东方意境', 'sweeping Chinese epic, bold color symbolism, ink-wash inspired composition, vast panoramic scale'],

  // 日本/动漫
  ['吉卜力', 'Studio Ghibli style, hand-drawn animation, lush green nature, soft watercolor background, whimsical organic shapes, warm golden natural light, detailed grass and leaves'],
  ['动漫', 'anime style, cel shading, vibrant colors, expressive character design'],
  ['日系', 'Japanese aesthetic, clean composition, soft pastel tones, everyday beauty'],
  ['新海诚', 'Makoto Shinkai style, ultra-detailed sky, god rays, hyper-saturated colors, cinematic lens'],
  ['天空云彩', 'Makoto Shinkai style, ultra-detailed sky, dramatic clouds, god rays, cinematic atmosphere'],
  ['少女漫画', 'shojo manga aesthetic, soft pink tones, sparkle effects, emotional close-ups'],

  // 欧美/西方
  ['写实', 'photorealistic, sharp focus, natural light, high detail'],
  ['电影感', 'cinematic film still, professional lighting, shallow depth of field, movie quality'],
  ['好莱坞', 'Hollywood blockbuster aesthetic, epic scale, professional color grade, commercial lighting'],
  ['西部', 'western frontier aesthetic, golden hour dust, weathered texture, wide open landscape'],
  ['哥特', 'gothic aesthetic, dark cathedral, dramatic shadows, ornate dark architecture'],
  ['维多利亚', 'Victorian era aesthetic, ornate details, sepia tones, period costume'],
  ['蒸汽朋克', 'steampunk aesthetic, brass gears, Victorian machinery, amber tones, industrial ornate'],

  // 现代/都市
  ['都市', 'modern urban environment, city lights, contemporary architecture, street photography'],
  ['现代', 'contemporary setting, clean modern design, neutral tones, present-day'],
  ['商业', 'commercial photography style, bright clean lighting, polished aesthetic'],
  ['街拍', 'street photography, candid moment, urban texture, documentary style'],

  // 艺术风格
  ['印象派', 'impressionist painting style, visible brushstrokes, soft edges, dappled light'],
  ['超现实', 'surrealism, dreamlike atmosphere, impossible geometry, symbolic imagery'],
  ['极简', 'minimalist aesthetic, clean negative space, essential forms, pure composition'],
  ['复古', 'vintage aesthetic, retro color grading, film grain, nostalgic tones'],
  ['胶片', 'film grain texture, analog photography, slightly faded colors, 35mm aesthetic'],
  ['油画', 'oil painting texture, rich brushwork, classical painting quality, chiaroscuro lighting'],

  // 自然/地域
  ['热带', 'tropical environment, lush vegetation, vibrant colors, dappled sunlight'],
  ['北欧', 'Nordic aesthetic, cold blue tones, minimalist architecture, grey sky'],
  ['沙漠', 'desert landscape, golden sand dunes, harsh sunlight, heat haze'],
  ['雪景', 'winter snow scene, pure white landscape, cold blue shadows, breath vapor'],
  ['樱花', 'sakura cherry blossom, soft pink petals, spring Japan aesthetic, pastel tones'],

  // 情绪/氛围
  ['治愈', 'warm healing atmosphere, soft golden light, gentle and peaceful, cozy environment'],
  ['忧郁', 'melancholic mood, desaturated blues, overcast sky, quiet solitude'],
  ['热血', 'action energy, dynamic pose, vibrant warm colors, motion blur effects'],
  ['恐怖', 'horror atmosphere, dark shadows, unsettling composition, eerie lighting'],
  ['浪漫', 'romantic atmosphere, warm soft lighting, bokeh background, golden hour'],
]

/**
 * 检测文本中的中文风格词，返回匹配到的英文风格描述拼接串
 * 与 6.5 不同：匹配所有命中词（不只是第一个），去重后拼接
 * @param text 待检测的中文文本（导演 style 或场景描述）
 * @param baseStyle 已有的英文风格基础（用于去重，避免重复）
 */
export function detectStyleFromText(text: string, baseStyle: string): string {
  if (!text) return ''
  const additions: string[] = []
  for (const [keyword, styleEN] of STYLE_AUTO_MAP) {
    if (text.includes(keyword)) {
      // 过滤掉 baseStyle 中已有的部分
      const parts = styleEN.split(', ').filter(p => !baseStyle.includes(p))
      if (parts.length > 0) {
        additions.push(...parts)
      }
    }
  }
  // 去重
  const unique = [...new Set(additions)]
  return unique.join(', ')
}
