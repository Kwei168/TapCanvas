# TapCanvas 部署说明（测试用）

## ✅ 已完成：前端已上线 Vercel
- 生产地址（任选其一，均可用）：
  - https://dist-wine-mu-80.vercel.app
  - https://dist-65pynizdx-guiyingyi2021s-projects.vercel.app
- 状态：已验证可正常渲染 TapCanvas Pro 落地页。
- 当前限制：前端是纯静态站点，`VITE_API_BASE` 暂指向占位后端地址（尚未运行），
  且 GitHub 登录用的是占位 `client_id`。所以现在只能看 UI，登录 / 建项目 / AI 生成等
  功能要等后端起来并接通后才能用。

## 🔧 还差一步：部署后端（长驻 Node 服务）
后端 = `apps/hono-api`（NestJS + Hono + Prisma/Postgres，需要数据库）。
你之前选了 **Railway / Render**，下面以 Render 为例（仓库根目录已备好 `render.yaml`）。

### Render 部署步骤
1. 把这个仓库推到你自己的 GitHub（fork 或新建仓库均可）。
2. 打开 Render 控制台 → New → **Blueprint** → 关联该 GitHub 仓库 → 选择本仓库的 `render.yaml`。
3. Render 会自动创建：
   - `tapcanvas-api` 服务（Node 运行时，构建并运行 `apps/hono-api`）
   - 一个免费的 Postgres 数据库（自动注入 `DATABASE_URL`，启动时会按 `schema.sql` 自动建表）
4. 在 Render 控制台的 `tapcanvas-api` 服务里，补充以下**可选**环境变量（不填也能启动，但对应功能不可用）：
   - `REDIS_URL`：可选。免费方案可用 Upstash Redis（无需信用卡）后填入；不填也能启动。
   - `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_GENERATIVE_AI_API_KEY`：AI 生成所需，至少一个。
   - `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`：GitHub 登录所需。
   - `TAPCANVAS_API_BASE_URL`：填你 Vercel 前端地址（如 https://dist-wine-mu-80.vercel.app ）。
5. 手动触发 Deploy，等变成 Healthy（健康检查路径 `/health/version`）。

### Railway 替代方案
Railway 同样可行：新建 Project → 连 GitHub 仓库 → 加 Postgres + Redis 插件 →
Build Command 设为 `pnpm --filter @tapcanvas/api prisma:generate && pnpm --filter @tapcanvas/api build`，
Start Command 设为 `node apps/hono-api/dist/main.js`，再填同样的 env 变量。

## 🔌 接通前后端（交给我）
后端起来后，把**后端地址**发给我（例如 `https://tapcanvas-api.onrender.com`），我会：
1. 把前端 `VITE_API_BASE` 改成该地址并重新部署 Vercel。
2. 若你要 GitHub 登录，提供 `client_id` / `client_secret`，我一并写入前端重新构建部署
   （注意：GitHub OAuth App 的 Authorization callback URL 必须填你 Vercel 前端的
   `https://<前端域名>/oauth/github`）。

## 💡 备选：全放 Vercel（无需 Railway/Render 账号）
如果你不想开 Railway/Render，我也可以把后端包成 **Vercel Serverless 函数** + 用免费的
**Neon Postgres**（无需信用卡）跑起来，全部由我完成。代价：Vercel 函数有 60s 超时与冷启动，
长耗时的 AI 出图可能会被截断；Railway/Render 这类长驻服务没有这个限制。

---
需要你提供的（按需）：
- [ ] 后端运行地址（Railway/Render 部署后给我），或
- [ ] 一个免费的 Neon Postgres 连接串（若选全 Vercel 方案）
- [ ] GitHub OAuth `client_id` / `client_secret`（仅当需要登录）
- [ ] 至少一个 AI 提供方 API Key（仅当需要实际 AI 生成）
