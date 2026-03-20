# Contributing to MoonAIGC

感谢你关注 MoonAIGC。

这个文档用于说明如何提交 Issue、发起 Pull Request，以及在本地参与开发。

## 开始之前

请先确认：

- 你已经阅读 [README.md](./README.md)
- 你本地可以正常启动前后端开发环境
- 你准备提交的内容与项目目标一致

## 提交 Issue

欢迎提交以下类型的问题：

- Bug / 回归问题
- 文档错误或缺失
- 新功能建议
- 交互体验优化建议
- 模型接入或兼容性问题

提交 Issue 时建议尽量包含：

- 使用场景
- 复现步骤
- 预期结果
- 实际结果
- 控制台报错或接口报错
- 截图 / 录屏（如果有）

## 提交 Pull Request

### 分支建议

请不要直接提交到主分支，建议从主分支切出功能分支，例如：

```bash
git checkout -b feat/grid-preview
```

### 提交内容建议

PR 应尽量做到：

- 单一目标明确
- 不混入无关重构
- 保持现有代码风格
- UI 修改附带截图
- 数据结构变更附带迁移说明

### 提交前检查

提交前请至少完成以下检查：

```bash
npx tsc -b
```

如果你改了后端 Prisma 模型，也请确认：

```bash
cd server
npx prisma migrate dev
```

## 代码风格

请尽量遵守以下约定：

- 使用 TypeScript
- 保持组件职责清晰
- Zustand store 的修改尽量集中
- 不要提交无关格式化噪音
- 不要把本地环境变量、密钥或临时文件提交到仓库

## 文档更新

如果你的改动影响以下内容，请同步更新文档：

- 启动方式
- 页面结构
- API / 数据模型
- 用户操作流程
- 新增配置项

## 数据库相关

如果你的改动涉及数据库模型：

- 更新 `server/prisma/schema.prisma`
- 生成并提交 migration
- 确保老数据不会被无提示破坏

## 讨论与范围

以下类型的改动建议先开 Issue 或 Discussion 再做：

- 大范围 UI 重构
- 数据模型重设计
- 工作流级别调整
- 默认模型 / 默认平台切换
- License 或发布策略变更

## License

提交到本仓库的代码默认视为遵循仓库当前 License。
