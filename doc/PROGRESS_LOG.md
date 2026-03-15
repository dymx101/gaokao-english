# 开发进度日志｜gaokao-english

> 规则：每完成一个 DEV_PLAN 里的 TASK，就在这里记录：完成内容、关键改动、如何验证。

## 状态总览（按 DEV_PLAN）

### M0 — Repo + dev environment

- [x] TASK-000: Create monorepo structure (`apps/web`, `apps/api`, `packages/shared`)
- [x] TASK-001: Add lint/format/test tooling
- [x] TASK-002: DB + migrations scaffold（Drizzle + SQLite；`pnpm -C apps/api db:migrate` OK）
- [x] TASK-003: Basic CI workflow（GitHub Actions: format:check + lint + build）

### M1 — Core learning loop

- [x] TASK-010: Seed `vocab_items` with a small sample dataset（当前 59 个词）
- [x] TASK-011: Implement `GET /api/v1/tasks/today`
- [x] TASK-012: Implement `POST /api/v1/attempts`（含 `user_vocab_state` 更新）
- [x] TASK-013: Web: Today page UI (`/today`)
- [x] TASK-014: Web: Session page (`/session/[id]`) with QuestionRenderer（当前 flashcard + 自评 mcq stub）
- [x] TASK-015: Word detail page (`/word/[vocabId]`) minimal

---

## 日志

### 2026-03-15

- 初始化 PRD/TDD 文档落地到 `doc/`（PRD.md、TECH_DESIGN.md）
- 确认数据库迁移可运行（TASK-002 验证）
- ✅ 完成 TASK-001：lint/format 基础工具
  - root：增加 prettier + `pnpm format`/`pnpm format:check`
  - api：补齐 eslint 配置与 `pnpm -C apps/api lint`
  - web：确认 eslint 可跑
  - 验证：根目录 `pnpm lint` 通过

- ✅ 完成 TASK-003：Basic CI workflow
  - 新增：`.github/workflows/ci.yml`
  - CI steps：install → format:check → lint → build
  - 修复：补齐 `@types/cors` 以确保 `apps/api` 能通过 `tsc` build
  - 增加：`.prettierignore`（避免 dist/migrations 等导致 CI format check 失败）
  - 验证（本地模拟）：`pnpm format:check && pnpm lint && pnpm build` 全绿

- ✅ 完成 TASK-010 / TASK-011 / TASK-012：M1 API + seed（可跑通）
  - DB schema：新增 `user_vocab_state`、`user_attempts`
  - Seed：`apps/api/src/seed/vocab.sample.json`（59 条）+ 启动时自动 seed（首次请求时）
  - API：
    - `GET /api/v1/tasks/today` 返回今日任务 items
    - `POST /api/v1/attempts` 写入 attempts，并 upsert 用户单词掌握状态
    - `GET /api/v1/word/:id`（给 web 后续用）
  - 验证：
    - 启动：`pnpm dev:api`
    - 今日任务：`curl http://localhost:3001/api/v1/tasks/today`
    - 提交作答：`curl -X POST http://localhost:3001/api/v1/attempts -H 'content-type: application/json' -d '{"vocabId":1,"questionType":"mcq","isCorrect":false,"responseMs":4200}'`

- ✅ 完成 TASK-013 / TASK-014 / TASK-015：M1 Web 基础闭环（可点通）
  - `/today`：展示今日任务 + “开始学习”（会把任务写入 localStorage 作为 demo session）
  - `/session/[sessionId]`：逐个展示单词（flashcard 可 reveal），提交“我对了/我错了”→ 调用 `/api/v1/attempts`
  - `/word/[vocabId]`：展示释义 + mastery 状态
  - 验证：
    - 启动 web：`pnpm dev`
    - 浏览器访问：`http://localhost:3000/today`

- ✅ 增加：局域网手机测试启动脚本（LAN dev）
  - 新增：`pnpm dev:lan`
  - 行为：自动探测本机局域网 IPv4，启动：
    - web: `0.0.0.0:3000`
    - api: `0.0.0.0:3001`
    - 并注入 `NEXT_PUBLIC_API_URL=http://<LAN_IP>:3001`
  - 验证：
    - 运行：`pnpm dev:lan`
    - 用手机/同网段设备访问：`http://<LAN_IP>:3000/today`
