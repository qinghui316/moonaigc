# MoonAIGC

> 导演级分镜生成引擎 — AI 驱动的影视分镜脚本生成工具

使用 **Vite + React 19 + TypeScript + TailwindCSS 4** 构建的现代化单页应用，支持打包为单文件 HTML 离线使用。

---

## 功能特性

### 剧本工作台（新）

完整的微短剧从零到分镜的 AI 创作流水线：

- **项目管理**：创建/切换/删除项目，每个项目独立管理多集内容和专属素材库
- **AI 创作方案**：根据题材、受众、基调、集数、世界观，AI 一键生成包含三幕结构、节奏规划、付费卡点的完整创作方案，可编辑
- **AI 角色体系**：基于创作方案自动生成主角/反派完整档案（外貌、动机、弧线、关系网络），同步预填至素材库
- **分集目录生成**：支持**流式（一次生成全部集数）**和**链式（5集一批，保证连贯性）**两种模式，自动标注🔥关键剧情集和💰付费卡点
- **单集剧本生成**：基于分集目录逐集生成完整剧本，携带上一集结尾钩子保证连贯
- **链式生成全部剧本**：一键按序生成所有未完成集的剧本
- **重新生成指令弹窗**：重新生成任意内容时，可输入修改要求（如"加强反转节奏""结局改为开放式"），AI 按需定向调整
- **直通分镜**：任意集完成剧本后，一键进入现有分镜生成流程，面包屑标注当前项目/集数，历史记录自动关联

### 核心创作

- **链式分镜生成**：将剧本按叙事节拍（Burst / Mini / Full / Mood）自动切分为多个场次，逐场流式生成分镜表格
- **单次直出模式**：一次性生成完整分镜表，适合短篇剧本
- **Save the Cat（STC）节拍引擎**：可开关，开启后按经典编剧结构（开场画面→主题陈述→B故事→…→终幕画面）组织叙事；关闭后切换为原著保真直通模式
- **导演风格系统**：内置 20+ 知名导演（诺兰、王家卫、宫崎骏等）+ 国漫专属风格，影响提示词生成策略

### 提示词工程

- **五维 SEEDANCE 提示词格式**：主体描述 · 场景环境 · 运镜手法 · 光影情绪 · 音效/对白
- **整合提示词**：将整张分镜表一键整合为带时间戳的优化提示词列表，可直接投喂外部 AI 视频平台
- **全局润色**：对整张分镜表进行统一风格修改
- **单镜精准修改**：针对单条分镜行进行 AI 辅助修改

### 剧本与素材

- **剧本导入**：支持 `.txt` / `.md` 文件上传或直接粘贴
- **AI 资产提取**：从剧本中自动提取人物、场景、道具并同步到素材库（`bulkFill`）
- **素材库**：管理角色、场景、道具三类素材，生成时自动注入提示词；支持 @标签模式（用于 LoRA 等图像生成工具）

### 视觉反推（Vision）

- **图片分析**：上传图片，AI 反推素材信息或剧情摘要
- **视频分析**：上传视频，逐帧抽样后 AI 生成分镜分析报告

### 内容安全

- **STC 质量检验**：检查分镜是否符合 Save the Cat 节拍结构
- **违禁词过滤**：自动检测并替换红线词汇、涉及真实人名 / IP 的内容
- **安全审核**：生成前自动运行内容安全检查

### 数据管理

- **历史记录**：支持自动保存 + 手动保存，可从历史重新载入项目；分镜记录自动关联项目/集数，再次进入该集可恢复上次生成结果
- **多格式导出**：导出为 `.txt`、`.xlsx`（Excel）、`.docx`（Word）
- **本地持久化**：所有数据（设置、历史、素材、项目、剧集）存储在 IndexedDB，无需服务端
- **暗/亮模式**：支持深色/浅色界面切换，偏好持久保存

---

## 技术栈


| 层级    | 技术                                            |
| ----- | --------------------------------------------- |
| 框架    | React 19 + TypeScript                         |
| 构建    | Vite 7 + `vite-plugin-singlefile`（输出单文件 HTML） |
| 样式    | TailwindCSS 4 + `@tailwindcss/postcss`        |
| 状态    | Zustand 5                                     |
| 持久化   | IndexedDB（封装在 `services/db.ts`）               |
| AI 接入 | OpenAI 兼容接口（流式 + 非流式）                         |


---

## 快速开始

### 环境要求

- **Node.js** >= 18（推荐 20+）
- **npm** >= 9

### 克隆与安装

```bash
git clone https://github.com/qinghui316/moonaigc.git
cd moonaigc
npm install
```

### 开发模式

```bash
npm run dev
```

浏览器访问 `http://localhost:5173`

### 生产构建

```bash
npm run build
```

输出为 `dist/index.html` 单文件，可直接双击打开离线使用，无需任何服务器。

### 本地预览构建产物

```bash
npm run preview
```

浏览器访问 `http://localhost:4173`，用于验证构建结果是否正常。

### API 配置

本项目**不内置任何 API Key**，首次使用需点击右上角 ⚙️ 设置，选择 AI 平台并填入你自己的 API Key。支持所有 OpenAI 兼容接口。

---

## 目录结构

```
src/
├── components/
│   ├── common/          # 公共组件（ChainProgressBar 等）
│   ├── create/          # 主创作页（CreatePage、DirectorGrid、ParamPanel 等）
│   ├── history/         # 历史记录页
│   ├── layout/          # Header、TabNav、Footer
│   ├── materials/       # 素材库页
│   ├── modals/          # 弹窗（单镜修改、安全审核、STC检验、视觉反推、重新生成等）
│   ├── projects/        # 项目管理页
│   ├── scriptwork/      # 剧本工作台页
│   └── settings/        # 设置面板
├── data/
│   ├── directors.ts     # 导演风格数据（20+）
│   ├── bs2beats.ts      # STC 节拍定义（Burst/Mini/Full/Mood 模式）
│   ├── cameraTechs.ts   # 运镜技法列表（20项）
│   ├── lightingTechs.ts # 光影风格列表（17项）
│   ├── platforms.ts     # AI 平台配置（通义、豆包、DeepSeek、Claude 等）
│   └── drama/           # 微短剧知识库（题材指南、节奏曲线、钩子设计等）
├── prompts/
│   ├── generate.ts      # 单次分镜生成提示词
│   ├── analyze.ts       # 剧本叙事分析提示词
│   ├── chain.ts         # 链式引擎提示词（切分 + 场次生成）
│   ├── extract.ts       # 资产提取提示词
│   ├── singleShot.ts    # 单镜修改 / 全局润色 / 整合提示词
│   ├── stcCheck.ts      # STC 质量检验提示词
│   ├── vision.ts        # 视觉反推提示词（图片 + 视频）
│   └── drama/           # 剧本工作台提示词（创作方案、角色体系、分集目录、单集剧本）
├── services/
│   ├── api.ts           # AI 接口封装（流式 streamGenerate + 标准 generate）
│   ├── chainEngine.ts   # 链式生成引擎（splitScript、generateScene）
│   ├── db.ts            # IndexedDB 封装（含 projects / episodes 表）
│   └── vision.ts        # 视觉分析服务
├── store/               # Zustand 状态管理（含 useProjectStore）
├── types/               # TypeScript 类型定义（含 Project、Episode）
└── utils/               # 工具函数（导出、sanitize、shotDataExtractor 等）
```

---

## 推荐模型：豆包 Doubao-Seed-2.0-pro

，推荐使用 `Doubao-Seed-2.0-pro` 模型，已完全跑通过整体流程。

### 配置步骤

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/overview) 注册/登录
2. 进入 **模型推理 → 接入点管理**，创建推理接入点，选择 `Doubao-Seed-2.0-pro` 模型
3. 在 **API Key 管理** 页面创建 API Key
4. 打开本项目，点击右上角 ⚙️ **API设置**：
  - 平台选择：**豆包**
  - API Key：填入火山引擎 API Key
  - 模型：填入推理接入点 ID（格式为 `ep-xxxxxxxx-xxxxx`）
  - API 地址：`https://ark.cn-beijing.volces.com/api/v3`

---

## 支持的 AI 平台

**文字生成**（支持 OpenAI 兼容接口）

| 平台 | 默认/推荐模型 | 说明 |
| --- | --- | --- |
| **豆包（推荐）** | `doubao-seed-2-0-pro-260215` | 模型填推理接入点 ID（ep-xxx） |
| 通义千问 | `qwen-max` | 阿里云百炼 |
| DeepSeek | `deepseek-chat`（V3） | 性价比首选 |
| Kimi | `moonshot-v1-128k` | 月之暗面，长文本 |
| 智谱 AI | `glm-4.7-flash`（免费） | 旗舰 GLM-5，高性价比 GLM-4.5-Air |
| Gemini | `gemini-2.5-flash` | Google AI Studio 免费额度 |
| OpenAI | `gpt-4o` | 需境外网络 |
| SiliconFlow | `deepseek-ai/DeepSeek-V3` | 国内多模型聚合，有免费额度 |
| OpenRouter | `anthropic/claude-sonnet-4-5` | 聚合 Claude / GPT / Gemini 等 |
| 自定义端点 | — | 任意兼容 OpenAI 格式的接口 |

**视觉分析**（需支持多模态输入）

| 平台 | 默认/推荐模型 |
| --- | --- |
| Claude | `claude-sonnet-4-5-20251001` |
| GPT-4o | `gpt-4o` |
| Gemini | `gemini-2.5-flash`（支持视频） |
| OpenRouter | `anthropic/claude-sonnet-4-5` |
| 自定义端点 | — |

---

## 使用说明

### 方式一：剧本工作台（从零开始）

1. **配置 API Key**：点击右上角⚙️设置，选择 AI 平台，填入 API Key
2. **新建项目**：进入「项目管理」，填写题材、受众、集数等基本信息
3. **生成创作方案**：在「剧本工作台」依次点击「生成创作方案」→「生成角色体系」→「生成分集目录」
4. **生成剧本**：选中某集，点击「AI 生成剧本」；或点击「链式生成全部剧本」一键完成
5. **进入分镜**：剧本完成后点击「进入分镜生成 →」，自动携带剧本内容和项目素材
6. **导出使用**：导出为 Excel/Word，或使用「整合提示词」功能

### 方式二：直接生成分镜

1. **配置 API Key**：点击右上角⚙️设置，选择 AI 平台，填入 API Key
2. **输入剧情**：在左侧文本框输入故事梗概（50字以上效果更佳）
3. **选择导演风格**：在导演列表中选择匹配的风格（支持拖拽横向滚动）
4. **调整参数**：
   - 开启/关闭 STC 节拍引擎
   - 选择叙事模式（Burst/Mini/Full/Mood）
   - 多选运镜偏好和光影风格
   - 设置视频时长
5. **生成分镜**：点击「生成分镜」或按 `Ctrl+Enter`
6. **导出使用**：导出为 Excel/Word，或使用「整合提示词」功能生成可直接投喂 AI 视频平台的提示词列表

---

## 开发说明

- 所有 AI 提示词经过精心调优，保持高质量的生成策略和输出格式
- 构建产物为单个 HTML 文件（约 400KB gzip 后约 120KB），可直接本地运行
- 无任何服务端依赖，所有数据存储在用户本地浏览器

