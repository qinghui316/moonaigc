# MoonAIGC

> 导演级分镜生成引擎，面向短剧 / 微短剧创作的 Agent工作台

MoonAIGC 是一个把「项目管理 -> 剧本工作台 -> 分镜生成 -> AI 生图 -> 素材管理 -> 图库 / 历史回看」串成完整链路的创作工具。  
前端基于 **Vite + React 19 + TypeScript + TailwindCSS 4**，后端基于 **Node.js + Express + Prisma + PostgreSQL**。

---

## 功能概览

### 1. 项目管理

- 创建、切换、删除项目
- 管理题材、受众、基调、集数、世界观等基础信息
- 每个项目独立管理剧集、素材和生成结果
- 应用默认进入 `项目管理` 页

### 2. 剧本工作台

- AI 生成创作方案
- AI 生成人物体系
- 生成分集目录
- 逐集生成剧本
- 支持导入已有文本进行拆集、忠实改编或爆款改编
- 支持按要求重新生成任意阶段内容

### 3. 创建分镜

- 根据单集剧本生成结构化分镜表
- 支持链式生成和单次直出
- 输出可直接用于后续生图 / 生视频的结构化字段
- 每条分镜保留 `SEEDANCE提示词`

### 4. AI 生图

AI 生图页目前分为两个模式：

- `普通镜头生图`
- `宫格生图模式`

#### 普通镜头生图

- 默认跟随当前已打开的项目和当前集
- 自动加载当前集对应的最新分镜记录
- 支持 `AI精炼`
- 支持参考图自动匹配、手动补充和本地上传
- 支持单镜生图与批量生图
- 支持镜头图持久化存储

#### 宫格生图模式

- 默认跟随当前已打开的项目和当前集
- 默认比例 `16:9`
- 默认分辨率 `4K`
- 当前实现重点支持 `9 宫格`
- 采用两阶段生成：
  1. 先根据所选分镜与参考图生成 9 条宫格分镜结构
  2. 再基于这 9 条结构和参考图一次性生成宫格图片
- 宫格结果独立入库，不和普通镜头图混用
- 支持：
  - 结果列表
  - 结果详情
  - 删除
  - 重新生成
  - 结果图点击预览
  - 本次实际上传参考图展示
  - 9 条宫格面板表格展示

### 5. 素材管理

- 管理角色、场景、道具三类素材
- 支持 `@标签` 引用模式
- 支持素材图生成
- 支持图片反推描述
- 支持素材图放大预览

### 6. 图片画廊

- 浏览镜头图、宫格图、素材图
- 按项目筛选
- 支持预览、下载、删除

### 7. 历史记录

- 回看历史分镜结果
- 将历史结果重新载入工作流继续编辑

---

## 当前 9 宫格系统

当前版本的 9 宫格不是简单的“一次性 prompt 拼图”，而是独立业务链路。

### 两阶段生成

#### 阶段 1：宫格分镜重组

输入：

- 用户选中的源分镜
- 这些源分镜已选好的参考图
- 当前风格、比例等设置

输出：

- 9 条结构化宫格面板结果
- 每条面板包含：
  - `panelOrder`
  - `timeRange`
  - `sourceShotRefs`
  - `seedancePrompt`
  - `imagePromptText`

#### 阶段 2：生成宫格图

输入：

- 阶段 1 生成的 9 条面板结果
- 本次实际上传参考图

输出：

- 一张完整 9 宫格图片

### 结果持久化

9 宫格结果会单独入库，对应独立的数据模型：

- `GridResult`
- `GridPanel`

结果详情页会展示：

- 宫格图
- 来源分镜
- 本次实际上传参考图
- 9 条宫格面板表格

### 来源分镜冻结规则

- 已被某条宫格结果占用的源分镜会冻结
- 未占用的源分镜仍可继续选择生成新的宫格结果
- 删除对应宫格结果后，相关冻结自动解除

---

## 主要提示词能力

### 分镜侧

- 结构化分镜生成
- 链式分镜生成
- Save the Cat 节拍引导
- 导演风格注入
- `SEEDANCE提示词` 输出

### 生图侧

- 单镜 `AI精炼`
- 参考图自动识别与手动补充
- 风格映射
- 负向提示词
- 批量生图链式参考图传递

### 宫格侧

- 宫格专用分镜重组提示词
- 宫格图片专用 prompt 组装
- 结果结构校验与降级兜底

---

## 技术栈


| 层级    | 技术                                       |
| ----- | ---------------------------------------- |
| 前端框架  | React 19 + TypeScript                    |
| 构建    | Vite 7                                   |
| 样式    | TailwindCSS 4                            |
| 状态管理  | Zustand 5                                |
| 后端    | Node.js + Express + TypeScript           |
| ORM   | Prisma 5                                 |
| 数据库   | PostgreSQL 14+                           |
| AI 接入 | 后端代理转发（OpenAI / Gemini / Anthropic 兼容格式） |


---

## 项目结构

```text
moonaigc-react/
├── src/
│   ├── components/
│   │   ├── create/            # 分镜生成
│   │   ├── gallery/           # 图片画廊
│   │   ├── history/           # 历史记录
│   │   ├── imagegen/          # AI 生图、宫格结果工作区
│   │   ├── layout/            # Header / TabNav / Footer
│   │   ├── materials/         # 素材管理
│   │   ├── projects/          # 项目管理
│   │   └── scriptwork/        # 剧本工作台
│   ├── data/                  # 平台、风格、负向词等静态配置
│   ├── prompts/               # 提示词模板
│   ├── services/              # AI / 生图 / 宫格 / DB 客户端
│   ├── store/                 # Zustand 状态管理
│   ├── types/                 # 类型定义
│   └── App.tsx
├── server/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   ├── src/
│   │   ├── index.ts
│   │   ├── middleware/
│   │   └── routes/
│   ├── uploads/
│   ├── .env.example
│   └── package.json
├── package.json
└── README.md
```

---

## 数据模型

核心模型位于 `server/prisma/schema.prisma`。

### 主要实体

- `Project`
- `Episode`
- `HistoryRecord`
- `Shot`
- `MaterialSet`
- `MediaFile`

### 宫格结果相关实体

#### GridResult

保存一条完整宫格结果：

- 所属项目 / 集 / 历史记录
- 布局、比例
- 来源分镜引用
- 本次实际上传参考图
- 第一阶段原始模型输出
- 结构化校验结果
- 最终宫格图文件关联

#### GridPanel

保存 9 宫格中的单个面板：

- 面板顺序
- 时间段
- `seedancePrompt`
- `sourceSeedancePrompts`
- `imagePromptText`
- 来源分镜引用

---

## 后端接口

### 宫格结果

- `POST /api/grid-results`
- `GET /api/grid-results`
- `GET /api/grid-results/:id`
- `PUT /api/grid-results/:id/media`
- `DELETE /api/grid-results/:id`

### 媒体文件

- `POST /api/media/upload`
- `GET /api/media`
- `GET /api/media/:id/file`

---

## 支持的 AI 平台

### 文本生成


| 平台          | 推荐模型                          | 说明             |
| ----------- | ----------------------------- | -------------- |
| 豆包（推荐）      | `doubao-seed-2-0-pro-260215`  | 模型通常填写推理接入点 ID |
| 通义千问        | `qwen-max`                    | 阿里云百炼          |
| DeepSeek    | `deepseek-chat`               | 性价比高           |
| Kimi        | `moonshot-v1-128k`            | 长文本友好          |
| 智谱 AI       | `glm-4.7-flash` / `glm-5`     | GLM 系列         |
| Gemini      | `gemini-2.5-flash`            | 多模态能力强         |
| OpenAI      | `gpt-4o`                      | 需可访问 OpenAI    |
| SiliconFlow | `deepseek-ai/DeepSeek-V3`     | 国内多模型聚合        |
| OpenRouter  | `anthropic/claude-sonnet-4-5` | 聚合多家模型         |
| 自定义端点       | -                             | 任意 OpenAI 兼容接口 |


### 图片生成


| 平台          | 推荐模型                             | 说明             |
| ----------- | -------------------------------- | -------------- |
| 豆包 Seedream | `doubao-seedream-5-0-lite`       | 支持多分辨率和参考图     |
| Gemini 生图   | `gemini-3.1-flash-image-preview` | 适合轻量生图         |
| 贞贞 AI 工坊    | `nano-banana-2`                  | 兼容 OpenAI 风格接口 |
| RunningHub  | `全能图片V2 / 全能图片PRO`               | 成本较低，支持图生图     |


### 视觉分析


| 平台     | 推荐模型                         |
| ------ | ---------------------------- |
| Claude | `claude-sonnet-4-5-20251001` |
| GPT-4o | `gpt-4o`                     |
| Gemini | `gemini-2.5-flash`           |


---

## 推荐模型

推荐文本生成优先使用豆包，图像生成按你的渠道选择豆包 Seedream / RunningHub / Gemini。

### 豆包配置步骤

1. 访问 [火山引擎控制台](https://console.volcengine.com/ark/region:ark+cn-beijing/overview)
2. 创建推理接入点
3. 创建 API Key
4. 在项目右上角 `API设置` 中填写：
  - 平台：豆包
  - API Key：你的火山引擎 API Key
  - 模型：推理接入点 ID（`ep-xxxx`）
  - API 地址：`https://ark.cn-beijing.volces.com/api/v3`

---

## 本地开发

### 环境要求

- Node.js 20+
- PostgreSQL 14+

### 1. 安装依赖

根目录：

```bash
npm install
```

后端：

```bash
cd server
npm install
cd ..
```

### 2. 配置环境变量

复制模板：

```bash
copy server\.env.example server\.env
```

或手动创建 `server/.env`，最少配置：

```env
DATABASE_URL=postgresql://postgres:你的密码@localhost:5432/moonaigc
PORT=3001
UPLOAD_DIR=./uploads
NODE_ENV=development
```

### 3. 初始化数据库

```bash
cd server
npx prisma migrate dev
cd ..
```

### 4. 启动

推荐直接在项目根目录执行：

```bash
npm run dev:all
```

会同时启动：

- 前端：`http://localhost:5173`
- 后端：`http://localhost:3001`

也可以分开启动：

```bash
# 终端 1
cd server
npm run dev

# 终端 2
npm run dev
```

---

## 构建与生产运行

### 前端构建

```bash
npm run build
```

### 后端构建

```bash
cd server
npm run build
```

### 后端生产启动

```bash
cd server
NODE_ENV=production npm start
```

### PM2（可选）

```bash
npm install -g pm2
cd server
NODE_ENV=production pm2 start dist/index.js --name moonaigc
pm2 save
pm2 startup
```

---

## 常用脚本

### 根目录

```bash
npm run dev
npm run dev:all
npm run build
npm run lint
```

### server

```bash
npm run dev
npm run build
npm run start
npm run db:migrate
npm run db:generate
```

---

## 常见问题

### 1. 后端启动时报 `connect ECONNREFUSED 127.0.0.1:5432`

PostgreSQL 没启动。  
Windows 请在服务管理器启动 PostgreSQL 服务；Linux/macOS 请先启动数据库服务。

### 2. `npx prisma migrate dev` 报 `password authentication failed`

`server/.env` 里的 `DATABASE_URL` 密码不正确，重新确认数据库密码。

### 3. 页面空白或 API 请求失败

检查：

- 后端是否已启动
- 前端开发代理是否正常
- 浏览器控制台是否有运行时错误

### 4. 删除宫格结果时报 `Cannot DELETE /api/grid-results/:id`

通常是后端还在跑旧进程。重启后端开发服务即可。

### 5. 旧宫格结果没有新字段

旧结果不会自动补齐新增字段。  
如果需要看到新的结构化结果、参考图记录或来源提示词，建议重新生成一次。

---

## 适合谁用

MoonAIGC 适合：

- 微短剧导演 / 编剧
- 分镜设计师
- AI 视频 / AI 生图工作流搭建者
- 需要把剧本、分镜、素材和生图串成完整流水线的团队

---

## License

This project is licensed under the GPL-3.0 License. See the [LICENSE](./LICENSE) file for details.

---

