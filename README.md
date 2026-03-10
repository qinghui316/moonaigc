# MoonAIGC

> 导演级分镜生成引擎 — AI 驱动的影视分镜脚本生成工具

使用 **Vite + React 19 + TypeScript + TailwindCSS 4** 构建的现代化单页应用，支持打包为单文件 HTML 离线使用。

---

## 功能特性

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
- **素材库**：管理角色、场景、道具三类素材，生成时自动注入提示词

### 视觉反推（Vision）
- **图片分析**：上传图片，AI 反推素材信息或剧情摘要
- **视频分析**：上传视频，逐帧抽样后 AI 生成分镜分析报告

### 内容安全
- **STC 质量检验**：检查分镜是否符合 Save the Cat 节拍结构
- **违禁词过滤**：自动检测并替换红线词汇、涉及真实人名 / IP 的内容
- **安全审核**：生成前自动运行内容安全检查

### 数据管理
- **历史记录**：支持自动保存 + 手动保存，可从历史重新载入项目
- **多格式导出**：导出为 `.txt`、`.xlsx`（Excel）、`.docx`（Word）
- **本地持久化**：所有数据（设置、历史、素材）存储在 IndexedDB，无需服务端

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 框架 | React 19 + TypeScript |
| 构建 | Vite 7 + `vite-plugin-singlefile`（输出单文件 HTML） |
| 样式 | TailwindCSS 4 + `@tailwindcss/postcss` |
| 状态 | Zustand 5 |
| 持久化 | IndexedDB（封装在 `services/db.ts`） |
| AI 接入 | OpenAI 兼容接口（流式 + 非流式） |

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
│   ├── create/          # 主创作页（CreatePage、DirectorGrid、ParamPanel 等）
│   ├── history/         # 历史记录页
│   ├── layout/          # Header、TabNav、Footer
│   ├── materials/       # 素材库页
│   ├── modals/          # 弹窗（单镜修改、安全审核、STC检验、视觉反推等）
│   └── settings/        # 设置面板
├── data/
│   ├── directors.ts     # 导演风格数据（20+）
│   ├── bs2beats.ts      # STC 节拍定义（Burst/Mini/Full/Mood 模式）
│   ├── cameraTechs.ts   # 运镜技法列表（20项）
│   ├── lightingTechs.ts # 光影风格列表（17项）
│   └── platforms.ts     # AI 平台配置（通义、豆包、DeepSeek、Claude 等）
├── prompts/
│   ├── generate.ts      # 单次分镜生成提示词
│   ├── analyze.ts       # 剧本叙事分析提示词
│   ├── chain.ts         # 链式引擎提示词（切分 + 场次生成）
│   ├── extract.ts       # 资产提取提示词
│   ├── singleShot.ts    # 单镜修改 / 全局润色 / 整合提示词
│   ├── stcCheck.ts      # STC 质量检验提示词
│   └── vision.ts        # 视觉反推提示词（图片 + 视频）
├── services/
│   ├── api.ts           # AI 接口封装（流式 streamGenerate + 标准 generate）
│   ├── chainEngine.ts   # 链式生成引擎（splitScript、generateScene）
│   ├── db.ts            # IndexedDB 封装
│   └── vision.ts        # 视觉分析服务
├── store/               # Zustand 状态管理
├── types/               # TypeScript 类型定义
└── utils/               # 工具函数（导出、sanitize、shotDataExtractor 等）
```

---

## 支持的 AI 平台

**文字生成**（支持 OpenAI 兼容接口）

| 平台 | 推荐模型 |
|------|---------|
| 通义千问 | qwen-max |
| 豆包 | doubao-pro-32k |
| DeepSeek | deepseek-chat |
| Moonshot（月之暗面） | moonshot-v1-32k |
| 智谱 GLM | glm-4-flash |
| Gemini | gemini-2.0-flash |
| Claude | claude-3-5-sonnet |
| OpenAI | gpt-4o |
| Grok | grok-3 |
| 自定义端点 | — |

**视觉分析**（需支持多模态）

通义千问VL、豆包视觉、GPT-4o、Claude 3.5、Gemini 等

---

## 使用说明

1. **配置 API Key**：点击右上角⚙️设置，选择 AI 平台，填入 API Key
2. **输入剧情**：在左侧文本框输入故事梗概（50字以上效果更佳）
3. **选择导演风格**：在导演列表中选择匹配的风格（支持拖拽横向滚动）
4. **调整参数**：
   - 开启/关闭 STC 节拍引擎
   - 选择叙事模式（Burst/Mini/Full/Mood）
   - 多选运镜偏好和光影风格
   - 设置视频时长
5. **生成分镜**：点击"生成分镜"或按 `Ctrl+Enter`
6. **导出使用**：导出为 Excel/Word，或使用"整合提示词"功能生成可直接投喂 AI 视频平台的提示词列表

---

## 开发说明

- 所有 AI 提示词经过精心调优，保持高质量的生成策略和输出格式
- 构建产物为单个 HTML 文件（约 400KB gzip 后约 120KB），可直接本地运行
- 无任何服务端依赖，所有数据存储在用户本地浏览器
