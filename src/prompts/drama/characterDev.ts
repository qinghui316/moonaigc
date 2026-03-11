import { VILLAIN_DESIGN } from '../../data/drama/villainDesign'

export const buildCharacterDevSystemPrompt = (): string => {
  return `你是一位专业的微短剧编剧，擅长塑造有记忆点的角色体系。

以下是反派设计参考，请在生成角色档案时严格遵循反派设计体系：

${VILLAIN_DESIGN}`
}

export const buildCharacterDevUserPrompt = (creativePlan: string, editInstruction?: string): string => {
  return `请根据以下创作方案，生成完整的角色体系档案。

## 创作方案
${creativePlan}

## 请输出以下内容（Markdown格式）：

### 一、主要角色档案
为每个主要角色（至少男女主 + 1-2个反派）生成：
- 姓名、年龄、外貌特征（2-3句）
- 性格关键词（3-5个）
- 公开身份 vs 真实身份
- 核心动机
- 最大冲突点
- 爽点功能（这个角色在故事中承担什么爽点）
- 口头禅或语言特征

### 二、角色关系
用文字描述主要角色之间的关系网络（爱情线、对立线、盟友线）

### 三、角色弧线设计
每个主要角色从第一集到最后一集的变化轨迹（3-5个关键节点）

### 四、感情线弧线
男女主关系发展的关键节点（标注集数）：
初遇 → 误会/冲突 → 暧昧 → 转折 → 确认关系 → 最大考验 → 大结局

### 五、反派体系（按四层结构）
- **小反派（炮灰级）：** 出场时段、核心恶行、退场方式
- **中反派（主要对手级）：** 出场时段、能力来源、三段式被击败过程
- **大反派（终极Boss级）：** 出场时机、终极动机、与主角的命运冲突
- **隐藏反派（可选）：** 角色身份、三处伏笔位置、揭露时机

### 六、素材库提取
**请在最后单独输出以下JSON，供系统自动填入素材库：**

\`\`\`json
{
  "characters": [
    {"name": "角色名", "visual_desc": "外貌视觉描述，用于AI绘图提示词"},
    ...
  ],
  "scenes": [
    {"name": "场景名", "visual_desc": "场景视觉描述"},
    ...
  ]
}
\`\`\`${editInstruction ? `\n\n## 特别修改要求\n${editInstruction}` : ''}`
}
