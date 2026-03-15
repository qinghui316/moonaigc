# MoonAIGC

> 导演级分镜生成引擎 — AI 驱动的微短剧从大纲到分镜全流水线创作工具

使用 **Vite + React 19 + TypeScript + TailwindCSS 4** 构建的现代化 Web 应用，后端使用 **Node.js + Express + Prisma + PostgreSQL** 持久化存储。

---

## 功能特性

### 剧本工作台（ProjectPage + ScriptWorkPage）

完整的微短剧从零到分镜的 AI 创作流水线：

- **项目管理**：创建/切换/删除项目，每个项目独立管理多集内容与专属素材库
- **两种创建模式**：
  - **AI 原创**：输入题材/世界观，AI 完整生成创作方案→角色体系→分集目录→逐集剧本
  - **导入已有剧本**：粘贴任意文本（完整剧本/小说/大纲/故事梗概），AI 自动拆集并提供两种改编方向：
    - **忠于原剧本**：保留原有台词、角色关系、故事走向
    - **按爆款结构改编**：自由重组，强制钩子/付费卡点配额
- **AI 创作方案**：AI 一键生成包含三幕结构、节奏规划、付费卡点、爽点矩阵的完整创作方案
- **AI 角色体系**：生成主角/反派完整档案（外貌、动机、弧线、关系网络），同步预填素材库
- **分集目录**：支持**流式（一次生成全部集数）**和**链式（5集一批，附带上下文保证连贯）**两种模式；集数支持自定义（5-30集）或 AI 自动判断
- **单集剧本生成**：逐集生成完整剧本，携带前一集剧本内容保证台词风格连贯
- **链式生成全部剧本**：一键按序生成所有未完成集，每集自动引入前集成品作为上下文
- **重新生成指令弹窗**：重新生成任意内容时可输入修改要求，AI 按需定向调整
- **直通分镜**：任意集完成剧本后一键进入分镜生成，历史记录自动关联项目和集数

### 核心分镜创作（CreatePage）

- **九维 SEEDANCE 提示词格式**：镜头 · 环境 · 叙事目的 · 衔接 · 角色分动 · 细节 · 光影 · 台词（含开口时机） · 音效
- **台词开口时机系统**：`台词(@人物N,第Xs开口):"原文"` 格式，根据镜头时长自动计算合理开口秒数（≤5s→X=1, 6-8s→X=2, 9-12s→X=3, 13-20s→X=4, >20s→X=5），支持特殊情绪修正
- **链式分镜生成**：按叙事节拍（Burst / Mini / Full / Mood）自动切分剧本，逐场流式生成，携带视觉连续性桥接状态（5字段：画面描述/角色状态/环境光影/镜头位置/动作动量）
- **单次直出模式**：一次性生成完整分镜表，适合短篇剧本
- **极速瞬间模式**：≤15s 内容专用，1-3镜极致视觉冲击画面
- **Save the Cat（STC）节拍引擎**：按经典编剧结构组织叙事，链式完成后**自动触发三维自检**（救猫咪结构/双主题魔法/陈词滥调）
- **台词锁定机制**：从剧本自动提取对白，注入分镜生成 prompt，确保台词原文一字不差
- **保真直通模式**：导入型项目可选择 1:1 视觉化，严禁增删情节
- **视觉流连贯性铁律**：5 条防跳跃感规则（动作连续性/环境稳定性/景别逻辑/视轴守恒/衔接顺滑）贯穿所有生成模式
- **导演风格系统**：内置 20+ 知名导演风格
- **运镜/光影偏好**：可选择特定运镜手法和光影风格注入提示词
- **单段生成 + 单镜精准修改**

### AI 生图系统（ImageGenPage）

- **多平台生图支持**：豆包 Seedream（1K/2K/4K）、Gemini Nano Banana 系列、贞贞的AI工坊（OpenAI 兼容代理）、RunningHub（图生图异步接口，低价渠道）
- **动态宽高比/分辨率**：根据选择的平台/模型自动更新可用选项（豆包支持 8 种宽高比，贞贞支持含 1:4/4:1/8:1/1:8 等极端比例）
- **AI 精炼按钮**：将结构化 SEEDANCE 描述转为优化图片 prompt（200词中文输出），可编辑后再生成；支持"恢复原始"
- **参考图预览**：素材库中有图的自动识别为参考图，无图的显示灰色占位；支持多张参考图
- **批量生图 + 链式参考传递**：批量时自动将上一镜已生成图传给下一镜作参考，保证全剧视觉连续性
- **全局负向提示词系统**：通用负向词 + 风格专属负向词，豆包原生 `negative_prompt` 字段，Gemini/自定义拼接到 prompt
- **中文风格词自动映射**：检测导演 style 文案中的中文关键词（赛博朋克/吉卜力/修仙/水墨等 50+ 种），自动追加对应英文风格描述
- **项目剧集 / 历史记录**双源切换：左侧默认展示当前项目各集最新分镜，右侧为历史记录
- **九宫格分镜系统**：2×2/2×3/3×3 三种格式；单次直出（拼接英文 prompt 一张出图）和逐格合成（Canvas 拼图）两种模式；自动补帧；宫格专用负向词（no text/typography/dialogue bubbles 等）

### 素材管理（MaterialPage）

- **三类素材库**：角色、场景、道具，每个项目独立管理
- **@标签模式**：为各类别独立开关，开启后 AI 生成时以 `@标签` 引用素材（适配 LoRA 等工作流）
- **素材图片生成**：为角色/场景/道具生成白底三视图或场景概念图，自动归档到数据库
- **AI 反推描述**：上传图片后一键调用 Vision AI 反推素材文字描述，自动填入 desc 字段
- **道具一致性铁律**：已注册道具在所有分镜生成中强制出现 @标签，含完整正反示例
- **标签替换铁律**：独立命名块，说明正确/错误写法对照
- **视觉一致性锚点**：有素材标签时，自动注入角色/场景/道具的全剧一致性锚点到 prompt

### 图片画廊（GalleryPage）

- 按项目/类型（镜头图/素材图）筛选查看所有已生成图片
- 瀑布流/网格布局，Lightbox 放大查看，支持下载和删除
- 分页滚动加载，删除时同步清理数据库关联

### 安全审核系统

- **五区联动过滤**：红区拦截（暴力/色情/政治）、黄区警告、名人气质化替换（30-40条：成龙→功夫巨星气质等）、IP 安全替换（30+条：蜘蛛侠→超级英雄等）、品牌商标检测
- **先检测后替换**：名人和 IP 在原始文本上完成检测记录，替换后 UI 展示完整替换明细
- **SafetyModal**：展示替换的红区词/名人气质化/IP 安全词明细，用户确认后继续

### 视觉分析（Vision）

- 支持图片/视频上传，AI 分析并反推素材信息或生成分镜分析报告
- 多平台支持：Claude（图像理解首选）、GPT-4o、Gemini（支持视频）、OpenRouter

### 数据与导出

- **PostgreSQL 后端存储**：项目/集数/历史/镜头/素材/图片文件全部持久化，支持未来多用户扩展
- **多格式导出**：`.txt`、`.xlsx`（Excel）、`.docx`（Word）
- **暗/亮模式**：深色/浅色界面切换

---

## 技术栈


| 层级   | 技术                                     |
| ---- | -------------------------------------- |
| 前端框架 | React 19 + TypeScript                  |
| 构建   | Vite 7                                 |
| 样式   | TailwindCSS 4                          |
| 状态   | Zustand 5                              |
| 后端   | Node.js + Express + TypeScript         |
| ORM  | Prisma 5                               |
| 数据库  | PostgreSQL 14+                         |
| AI接入 | 后端代理转发（OpenAI / Gemini / Anthropic 格式） |
| 画布合成 | HTML Canvas（九宫格图片合成）                   |


---

## 部署指南

### Windows 部署

#### 1. 安装依赖环境

**Node.js**（推荐 v20+）：[nodejs.org](https://nodejs.org) 下载 LTS 版本安装包，一路默认即可。

**PostgreSQL**：[enterprisedb.com/downloads/postgres-postgresql-downloads](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads) 下载 Windows x86-64，安装时记住你设置的密码，其余默认。

安装完成后将 PostgreSQL bin 目录加入 PATH（`Win+S` 搜索「环境变量」，在 Path 里添加 `C:\Program Files\PostgreSQL\18\bin` 或你实际安装的路径）。

#### 2. 创建数据库

```powershell
psql -U postgres
```

```sql
CREATE DATABASE moonaigc;
\q
```

#### 3. 克隆项目

```powershell
git clone https://github.com/qinghui316/moonaigc.git
cd moonaigc
```

#### 4. 安装依赖

```powershell
# 前端依赖
npm install

# 后端依赖
cd server
npm install
cd ..
```

#### 5. 配置环境变量

```powershell
copy server\.env.example server\.env
```

编辑 `server\.env`，填入你的数据库密码：

```
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/moonaigc
PORT=3001
UPLOAD_DIR=./uploads
NODE_ENV=development
```

#### 6. 初始化数据库

```powershell
cd server
npx prisma migrate dev --name init
cd ..
```

#### 7. 启动

**开发模式**（需要两个 PowerShell 窗口）：

```powershell
# 窗口1 - 后端
cd server
npm run dev

# 窗口2 - 前端
npm run dev
```

浏览器访问 `http://localhost:5173`

**生产模式**：

```powershell
# 构建前端
npm run build

# 构建并启动后端（同时托管前端静态文件）
cd server
npm run build
$env:NODE_ENV="production"
npm start
```

浏览器访问 `http://localhost:3001`

---

### Linux / macOS 部署

#### 1. 安装依赖环境

**Ubuntu / Debian：**

```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PostgreSQL
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**macOS（Homebrew）：**

```bash
brew install node postgresql@16
brew services start postgresql@16
```

**CentOS / RHEL：**

```bash
# Node.js 20
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs

# PostgreSQL
sudo dnf install -y postgresql-server postgresql-contrib
sudo postgresql-setup --initdb
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

#### 2. 创建数据库

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE moonaigc;
\q
```

#### 3. 克隆项目

```bash
git clone https://github.com/qinghui316/moonaigc.git
cd moonaigc
```

#### 4. 安装依赖

```bash
npm install
cd server && npm install && cd ..
```

#### 5. 配置环境变量

```bash
cp server/.env.example server/.env
nano server/.env   # 或使用 vim / 任意编辑器
```

填写内容：

```
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/moonaigc
PORT=3001
UPLOAD_DIR=./uploads
NODE_ENV=development
```

> Linux 默认 PostgreSQL 用户可能使用 peer 认证，无需密码，连接串可写为：
> `DATABASE_URL=postgresql://postgres@localhost:5432/moonaigc`

#### 6. 初始化数据库

```bash
cd server
npx prisma migrate dev --name init
cd ..
```

#### 7. 启动

**开发模式：**

```bash
# 终端1 - 后端
cd server && npm run dev

# 终端2 - 前端
npm run dev
```

浏览器访问 `http://localhost:5173`

**生产模式：**

```bash
# 构建前端
npm run build

# 构建并启动后端
cd server
npm run build
NODE_ENV=production npm start
```

浏览器访问 `http://服务器IP:3001`

**使用 PM2 守护进程（推荐生产环境）：**

```bash
npm install -g pm2

cd server
NODE_ENV=production pm2 start dist/index.js --name moonaigc
pm2 save
pm2 startup   # 设置开机自启
```

---

## 推荐模型：豆包 Doubao-Seed-2.0-pro

推荐使用 `Doubao-Seed-2.0-pro` 模型，已完整跑通整体流程。

### 配置步骤

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/overview) 注册/登录
2. 进入 **模型推理 → 接入点管理**，创建推理接入点，选择 `Doubao-Seed-2.0-pro` 模型
3. 在 **API Key 管理** 页面创建 API Key
4. 打开本项目，点击右上角 ⚙️ **API设置**：
  - 平台选择：**豆包**
  - API Key：填入火山引擎 API Key
  - 模型：填入推理接入点 ID（格式为 `ep-xxxxxxxx-xxxxx`）

---

## 支持的 AI 平台

### 文字生成（10个平台）


| 平台          | 推荐模型                          | 说明                     |
| ----------- | ----------------------------- | ---------------------- |
| **豆包（推荐）**  | `doubao-seed-2-0-pro-260215`  | 模型填推理接入点 ID（ep-xxx）    |
| 通义千问        | `qwen-max`                    | 阿里云百炼                  |
| DeepSeek    | `deepseek-chat`               | 性价比首选                  |
| Kimi        | `moonshot-v1-128k`            | 长文本场景                  |
| 智谱 AI       | `glm-4.7-flash`（免费）/`glm-5`   | GLM 系列                 |
| Gemini      | `gemini-2.5-flash`            | Google AI Studio 有免费额度 |
| OpenAI      | `gpt-4o`                      | 需境外网络                  |
| SiliconFlow | `deepseek-ai/DeepSeek-V3`     | 国内多模型聚合                |
| OpenRouter  | `anthropic/claude-sonnet-4-5` | 聚合 Claude/GPT/Gemini 等 |
| 自定义端点       | —                             | 任意 OpenAI 兼容接口         |


### 图片生成（4个平台）


| 平台                  | 推荐模型                                            | 参考图 | 说明                                   |
| ------------------- | ----------------------------------------------- | --- | ------------------------------------ |
| **豆包 Seedream**     | `doubao-seedream-5-0-lite`                      | ✅   | 1K/2K/4K，8种宽高比，4.0+ 支持参考图            |
| Gemini 生图           | `gemini-3.1-flash-image-preview`（Nano Banana 2） | ✅   | Google 生图，免费额度，inlineData 传参          |
| 贞贞的AI工坊            | `nano-banana-2`                                 | ✅   | OpenAI 兼容代理，支持极端宽高比（1:4/4:1/8:1/1:8） |
| **RunningHub（低价）** | `全能图片V2` / `全能图片PRO`                            | ✅可选 | 有参考图自动走图生图，无参考图走文生图，异步任务，价格低于官方  |


### 视觉分析（5个平台）


| 平台         | 推荐模型                         | 说明             |
| ---------- | ---------------------------- | -------------- |
| Claude     | `claude-sonnet-4-5-20251001` | 图像理解首选         |
| GPT-4o     | `gpt-4o`                     | 全能视觉           |
| Gemini     | `gemini-2.5-flash`           | 支持视频输入         |
| OpenRouter | 多种                           | 聚合多家视觉模型       |
| 自定义        | —                            | 任意 Vision 兼容端点 |


---

## 24 种视觉风格

电影写实 · 日式动漫 · 赛博朋克 · 油画质感 · 3D渲染 · 复古胶片 · 水彩手绘 · 像素艺术 · 美式漫画 · 黏土动画 · 浮世绘 · 超现实 · 极简主义 · 黑色电影 · 奇幻魔幻 · 蒸汽朋克 · 中国修仙国漫 · 中国水墨 · 皮克斯3D · 韩式偶像剧 · 纪录片写实 · 科幻概念艺术 · 法式插画 · 中国皮影剪纸

---

## 目录结构

```
moonaigc/
├── src/                           # 前端源码
│   ├── components/
│   │   ├── create/                # 分镜创作（CreatePage + ParamPanel + StoryboardTable 等）
│   │   ├── scriptwork/            # 剧本工作台（ScriptWorkPage）
│   │   ├── projects/              # 项目管理（ProjectPage）
│   │   ├── imagegen/              # AI 生图（ImageGenPage + GridModal）
│   │   ├── gallery/               # 图片画廊（GalleryPage）
│   │   ├── materials/             # 素材管理（MaterialPage + AssetImageGenModal）
│   │   ├── history/               # 历史记录（HistoryPage）
│   │   ├── layout/                # Header / TabNav / Footer
│   │   ├── modals/                # 各类弹窗（SafetyModal / StcModal / ShotEditModal 等）
│   │   └── settings/              # 设置面板（SettingsPanel）
│   ├── data/
│   │   ├── directors.ts           # 20+ 导演风格配置
│   │   ├── platforms.ts           # 文字/图片/视觉三类平台配置
│   │   ├── styleMap.ts            # 24 种视觉风格（中/英文映射）
│   │   ├── styleAutoMap.ts        # 中文风格词自动识别映射（50+ 条）
│   │   ├── safetyWords.ts         # 安全词库（含名人气质化替换/IP替换）
│   │   ├── negativePrompts.ts     # 负向提示词（全局 + 24种风格专属）
│   │   ├── gridConfig.ts          # 九宫格配置
│   │   ├── bs2beats.ts            # BS2 节拍定义
│   │   ├── cameraTechs.ts         # 运镜手法数据
│   │   └── lightingTechs.ts       # 光影手法数据
│   ├── prompts/
│   │   ├── generate.ts            # 单段分镜生成 prompt（含九维铁律/台词开口时机）
│   │   ├── chain.ts               # 链式分镜 prompt（含视觉连续性铁律）
│   │   ├── singleShot.ts          # 单镜修改 prompt
│   │   └── drama/                 # 剧本工作台 prompt
│   │       ├── creativePlan.ts    # 创作方案
│   │       ├── characterDev.ts    # 角色体系
│   │       ├── episodeDirectory.ts # 分集目录
│   │       ├── episodeScript.ts   # 单集剧本（含忠实/爆款改编模式）
│   │       └── importScript.ts    # 导入剧本专用 prompt（拆集/反推创作方案/角色档案）
│   ├── services/
│   │   ├── api.ts                 # AI 文字接口
│   │   ├── chainEngine.ts         # 链式生成引擎（含 BridgeState 5字段视觉桥接）
│   │   ├── imageGen.ts            # 图片生成接口
│   │   ├── imagePrompt.ts         # 图片 prompt 构建（AI精炼/结构化输入/直接回退）
│   │   ├── gridGen.ts             # 九宫格 prompt 构建
│   │   ├── scriptImport.ts        # 导入剧本解析服务（正则+AI拆集）
│   │   ├── vision.ts              # 视觉分析服务
│   │   └── db.ts                  # REST API 客户端
│   ├── store/                     # Zustand 状态管理
│   │   ├── useMaterialStore.ts    # 素材库（含buildSystemPromptInfo/视觉铁律注入）
│   │   ├── useProjectStore.ts     # 项目/集数管理
│   │   ├── useShotStore.ts        # 镜头数据
│   │   ├── useChainStore.ts       # 链式生成状态
│   │   ├── useSettingsStore.ts    # API 设置（分平台存储）
│   │   └── useHistoryStore.ts     # 历史记录
│   ├── utils/
│   │   ├── sanitize.ts            # 安全过滤（先检测后气质化替换）
│   │   └── gridCanvas.ts          # Canvas 九宫格合成
│   └── types/index.ts             # TypeScript 类型定义
├── server/                        # 后端源码
│   ├── prisma/
│   │   └── schema.prisma          # 数据库模型（Project/Episode/History/Shot/Material/MediaFile）
│   ├── src/
│   │   ├── index.ts               # Express 入口
│   │   ├── middleware/auth.ts     # 默认用户鉴权中间件
│   │   └── routes/
│   │       ├── aiProxy.ts         # AI 代理路由（含负向词平台差异处理）
│   │       ├── projects.ts        # 项目 CRUD
│   │       ├── episodes.ts        # 集数 CRUD
│   │       ├── history.ts         # 历史记录
│   │       ├── shots.ts           # 镜头数据
│   │       ├── materials.ts       # 素材库
│   │       ├── media.ts           # 媒体文件（上传/列表/删除）
│   │       └── settings.ts        # 用户 API Key 设置
│   ├── uploads/                   # 上传文件存储目录
│   ├── .env                       # 环境变量（本地填写，不提交 git）
│   └── .env.example               # 环境变量模板
└── index.html
```

---

## 常见问题

**Q：启动后端报错 `connect ECONNREFUSED 127.0.0.1:5432`**

PostgreSQL 服务未启动。Windows 在服务管理器中启动 `postgresql-x64-18`；Linux 执行 `sudo systemctl start postgresql`。

**Q：`npx prisma migrate dev` 报错 `password authentication failed`**

`server/.env` 中的密码不正确，重新确认 PostgreSQL 密码后修改 `DATABASE_URL`。

**Q：前端页面空白或 API 请求失败**

确认后端已启动（访问 `http://localhost:3001` 应有响应），且前端 `vite.config.ts` 中代理配置正确（`/api` → `localhost:3001`）。

**Q：生产模式下如何修改端口**

编辑 `server/.env` 中的 `PORT=3001` 改为你想要的端口，同时在服务器防火墙放行该端口。

**Q：豆包模型填什么**

豆包平台需要在火山引擎控制台创建推理接入点，模型一栏填接入点 ID（格式为 `ep-xxxxxxxx-xxxxx`），而不是模型名称。新版 Seedream 5.0/4.5/4.0 图片生成模型可直接填模型名。

**Q：图片生成时提示 API 错误**

先在 ⚙️ 设置的"图片生成"标签中点击"测试 API"，确认 Key 和端点正确。Gemini 图片生成需使用 Google AI Studio 的 API Key（与文字生成同一个 Key 即可）。

**Q：九宫格直出和逐格合成有什么区别**

直出模式：将所有格子描述拼成一个英文 prompt，AI 直接生成一张完整宫格图，速度快但每格细节可能较粗糙。逐格合成：每个格子独立调用图片生成 API，最后用 Canvas 拼接成大图，细节更精细但会消耗多倍 API 调用次数。

**Q：RunningHub 文生图和图生图怎么切换**

自动切换，无需手动操作。素材库中有图片且分镜包含 `@标签` 时走图生图接口；没有参考图时自动走文生图接口。

**Q：RunningHub 生成很慢**

RunningHub 为异步任务接口，提交后每 3 秒轮询一次结果，最长等待 90 秒。低价渠道版不稳定，高峰期队列可能较长属正常现象。本地开发时 RunningHub 服务器需能访问到你的后端地址（`http://localhost:3001`），建议部署到公网后使用。