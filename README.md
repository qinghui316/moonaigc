# MoonAIGC

> 导演级分镜生成引擎 — AI 驱动的影视分镜脚本生成工具

使用 **Vite + React 19 + TypeScript + TailwindCSS 4** 构建的现代化 Web 应用，后端使用 **Node.js + Express + Prisma + PostgreSQL** 持久化存储。

---

## 功能特性

### 剧本工作台

完整的微短剧从零到分镜的 AI 创作流水线：

- **项目管理**：创建/切换/删除项目，每个项目独立管理多集内容和专属素材库
- **AI 创作方案**：根据题材、受众、基调、集数、世界观，AI 一键生成包含三幕结构、节奏规划、付费卡点的完整创作方案，可编辑
- **AI 角色体系**：基于创作方案自动生成主角/反派完整档案（外貌、动机、弧线、关系网络），同步预填至素材库
- **分集目录生成**：支持**流式（一次生成全部集数）**和**链式（5集一批，保证连贯性）**两种模式
- **单集剧本生成**：基于分集目录逐集生成完整剧本，携带上一集结尾钩子保证连贯
- **链式生成全部剧本**：一键按序生成所有未完成集的剧本
- **重新生成指令弹窗**：重新生成任意内容时可输入修改要求，AI 按需定向调整
- **直通分镜**：任意集完成剧本后，一键进入分镜生成流程，历史记录自动关联

### 核心创作

- **链式分镜生成**：将剧本按叙事节拍（Burst / Mini / Full / Mood）自动切分，逐场流式生成分镜表格
- **单次直出模式**：一次性生成完整分镜表，适合短篇剧本
- **Save the Cat（STC）节拍引擎**：按经典编剧结构组织叙事
- **导演风格系统**：内置 20+ 知名导演风格

### 提示词工程

- **五维 SEEDANCE 提示词格式**：主体描述 · 场景环境 · 运镜手法 · 光影情绪 · 音效/对白
- **整合提示词**：一键整合为带时间戳的优化提示词列表，可直接投喂 AI 视频平台
- **全局润色 / 单镜精准修改**

### 剧本与素材

- **AI 资产提取**：从剧本中自动提取人物、场景、道具并同步到素材库
- **素材库**：管理角色、场景、道具三类素材，支持 @标签模式（LoRA 等）

### 视觉反推（Vision）

- **图片/视频分析**：上传后 AI 反推素材信息或生成分镜分析报告

### 数据与导出

- **PostgreSQL 后端存储**：所有数据持久化到数据库，支持未来多用户扩展
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
   - API 地址：`https://ark.cn-beijing.volces.com/api/v3`

---

## 支持的 AI 平台

**文字生成**

| 平台 | 推荐模型 | 说明 |
| --- | --- | --- |
| **豆包（推荐）** | `doubao-seed-2-0-pro-260215` | 模型填推理接入点 ID（ep-xxx） |
| 通义千问 | `qwen-max` | 阿里云百炼 |
| DeepSeek | `deepseek-chat` | 性价比首选 |
| Kimi | `moonshot-v1-128k` | 长文本场景 |
| 智谱 AI | `glm-4.7-flash`（免费） | 旗舰 GLM-5 |
| Gemini | `gemini-2.5-flash` | Google AI Studio 有免费额度 |
| OpenAI | `gpt-4o` | 需境外网络 |
| SiliconFlow | `deepseek-ai/DeepSeek-V3` | 国内多模型聚合 |
| OpenRouter | `anthropic/claude-sonnet-4-5` | 聚合多家模型 |
| 自定义端点 | — | 任意 OpenAI 兼容接口 |

**视觉分析**（需支持多模态）

| 平台 | 推荐模型 |
| --- | --- |
| Claude | `claude-sonnet-4-5-20251001` |
| GPT-4o | `gpt-4o` |
| Gemini | `gemini-2.5-flash`（支持视频） |

---

## 目录结构

```
moonaigc/
├── src/                     # 前端源码
│   ├── components/          # React 组件
│   ├── data/                # 静态数据（导演、平台配置等）
│   ├── prompts/             # AI 提示词模板
│   ├── services/
│   │   ├── api.ts           # AI 接口（通过后端代理）
│   │   ├── chainEngine.ts   # 链式生成引擎
│   │   ├── db.ts            # REST API 客户端
│   │   └── vision.ts        # 视觉分析服务
│   ├── store/               # Zustand 状态管理
│   └── types/               # TypeScript 类型定义
├── server/                  # 后端源码
│   ├── prisma/
│   │   └── schema.prisma    # 数据库模型
│   ├── src/
│   │   ├── index.ts         # Express 入口
│   │   ├── middleware/auth.ts
│   │   └── routes/          # REST 路由（settings/projects/episodes/history/materials/aiProxy）
│   ├── uploads/             # 上传文件存储
│   ├── .env                 # 环境变量（本地填写，不提交 git）
│   └── .env.example         # 环境变量模板
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
