export const ASSET_IMAGE_PROMPTS = {
  character: (_name: string, desc: string, style = '概念艺术风格') =>
    `纯白背景，角色设计三视图参考表，同一画面水平并排三张全身图，从左到右依次为正面图、侧面图、背面图，以头顶和脚底为基准严格等高对齐，三图大小比例一致，角色保持自然直立站姿，双手自然下垂，不持任何道具，${desc}，服装细节与配饰完整，${style}，高质量`,

  image: (_name: string, desc: string, style = '概念艺术') =>
    `宽景建立镜头，环境概念图，平视人眼视角，摄影机高度接近站立人物胸口到眼平，${desc}，建筑与道具细节丰富，氛围光影，电影构图，${style}，精绘背景板风格，高细节`,

  props: (_name: string, desc: string, style = '概念艺术风格') =>
    `纯白背景，居中产品摄影风格，${desc}，专业棚拍光照，材质与纹理精细渲染，${style}，干净背景，参考插图，正交视角，高质量`,
}

export type AssetImageType = keyof typeof ASSET_IMAGE_PROMPTS

export const ASSET_IMAGE_TYPE_LABELS: Record<AssetImageType, string> = {
  character: '角色三视图',
  image: '场景概念图',
  props: '道具参考图',
}
