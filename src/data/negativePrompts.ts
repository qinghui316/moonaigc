// 全局负向提示词（对齐 6.5）
export const GLOBAL_NEGATIVE_PROMPT =
  'ugly, deformed, disfigured, poor quality, low quality, blurry, out of focus, bad anatomy, ' +
  'extra limbs, missing limbs, floating limbs, disconnected limbs, mutated hands, malformed hands, ' +
  'bad proportions, gross proportions, text, watermark, signature, username, ' +
  'speech bubbles, dialogue bubbles, chinese characters, japanese characters, korean characters, ' +
  'subtitles, captions, labels, typography, words, letters, numbers on image, ' +
  'cropped, out of frame, worst quality, jpeg artifacts, noisy, pixelated, ' +
  'nsfw, nude, naked, sexual content, violence, gore, disturbing content'

// 用于拼接到正向 prompt 末尾（Gemini/Custom 平台无独立负向词字段）
export const GLOBAL_NEGATIVE_PROMPT_INLINE =
  ', no text, no watermark, no signature, no speech bubbles, no chinese characters, ' +
  'no subtitles, no captions, no typography, no deformation, no ugly face, no bad anatomy, ' +
  'no extra limbs, no missing limbs, no blurry, no low quality, no nsfw'

// 风格特有负向词
export const STYLE_NEGATIVE_PROMPTS: Record<string, string> = {
  cinematic: 'cartoon, anime, flat lighting, overexposed, underexposed, toy, plastic',
  anime: 'realistic, photorealistic, 3d render, ugly, bad proportions, bad face',
  cyberpunk: 'daylight, natural, countryside, clean, minimal, bright pastel',
  oil_painting: 'photo, digital, 3d render, smooth, plastic',
  '3d_render': 'flat, 2d, sketch, hand-drawn, watercolor, low poly',
  vintage: 'sharp, vivid colors, digital, modern, neon',
  watercolor: 'hard edges, sharp, digital, photorealistic, dark',
  pixel_art: 'smooth, anti-aliased, realistic, photograph',
  comic: 'realistic, soft, photographic, blurry, gradient',
  claymation: 'photorealistic, 2d, digital, flat, smooth',
  ukiyoe: '3d, photorealistic, western, modern, digital art',
  surreal: 'realistic, mundane, boring, plain',
  minimalist: 'cluttered, busy, complex, detailed, noisy',
  noir: 'color, bright, cheerful, vivid, saturated',
  fantasy: 'realistic, modern, mundane, dark, gritty',
  steampunk: 'digital, modern, plastic, futuristic, clean',
  donghua_xianxia: 'western art, realistic, photographic, low quality, bad anatomy',
  ink_wash: 'digital, photorealistic, bright colors, sharp edges, western art',
  pixar_3d: 'photorealistic, 2d, flat, dark, horror, gritty',
  kdrama: 'anime, cartoon, harsh lighting, ugly, low quality',
  documentary: 'posed, studio lighting, cartoon, animated, unrealistic',
  concept_art: 'photo, low poly, cartoon, blurry, unfinished',
  french_illus: 'photorealistic, 3d, dark, gritty, complex',
  paper_cut: 'photorealistic, 3d, soft edges, gradient, complex texture',
}
