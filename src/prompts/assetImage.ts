// 素材资产图生成默认提示词模板
// 用于角色三视图、场景概念图、道具参考图

export const ASSET_IMAGE_PROMPTS = {
  character: (name: string, desc: string) =>
    `White background, character design reference sheet, front view, three-quarter view, and back view arranged horizontally on a single image, full body, ${desc}, detailed outfit and accessories, clean lineart, concept art style, professional character turnaround sheet, high quality`,

  image: (name: string, desc: string) =>
    `Wide establishing shot, environment concept art, ${desc}, detailed architecture and props, atmospheric lighting, cinematic composition, matte painting style, high detail, concept art`,

  props: (name: string, desc: string) =>
    `White background, centered product photography style, ${desc}, studio lighting, detailed texture and material rendering, clean background, reference illustration, orthographic view, high quality`,
}

export type AssetImageType = keyof typeof ASSET_IMAGE_PROMPTS

export const ASSET_IMAGE_TYPE_LABELS: Record<AssetImageType, string> = {
  character: '角色三视图',
  image: '场景概念图',
  props: '道具参考图',
}
