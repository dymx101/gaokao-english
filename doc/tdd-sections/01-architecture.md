# 01. 总体架构（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 1.

## 1.1 逻辑架构

### Components

1. **Web/App 前端**

- Responsibilities:
  - 词卡学习与练习（flashcard/mcq/cloze/semantic）
  - 错词本浏览、筛选、手动标注
  - 真题例句/语境展示
  - 写作改写（输入/输出对照）
  - 导出 PDF 任务触发/下载
- Non-responsibilities:
  - 不直接调用模型供应商；统一走后端 AI API

2. **Backend API (monolith v1)**

- Responsibilities:
  - 鉴权与用户隔离
  - 词库与真题内容读取
  - attempts 写入、状态更新（user_vocab_state/user_mistakes）
  - 复习计划生成（tasks/today）
  - AI 调用编排 + 缓存 + 限流
  - 导出任务（异步）

3. **AI 服务层（可插拔）**

- Responsibilities:
  - 对外提供结构化 JSON 输出
  - 统一超时、重试、审计、缓存键生成
  - Provider 实现可替换（OpenAI/其他/本地）

4. **内容/数据层**

- vocab_items (3500) + exam_sentences + 词频统计
- TTS 音频缓存（本地或对象存储）

5. **任务队列/异步**

- PDF 导出、批量预生成缓存、离线数据清洗

## 1.2 运行时拓扑（推荐 v1）

- Frontend: Next.js/Vite 单页应用（部署到静态托管或与后端同域）
- Backend: Node/TypeScript 服务（REST）
- DB: PostgreSQL（生产） / SQLite（本地）
- Queue: 轻量方案（如 bullmq + redis；或 DB-backed jobs 表）
- Object storage（可选）: S3-compatible (MinIO) 用于 PDF/音频

## 1.3 代码分层（与仓库约定）

```
src/backend/
  api/          # 路由 + request/response schema + auth middleware
  services/     # 业务服务：review plan、mistakes、exports
  ai/           # provider abstraction + prompt builders + validators
  data/         # repositories/DAO + migrations
  jobs/         # async jobs: exports, pregen
src/web/
  pages/
  components/
  stores/
```

### Layering rules

- `api/` 只做输入校验、鉴权、调用 service、序列化输出
- `services/` 不依赖 web 框架；通过 repository + ai client 完成业务
- `ai/` 不直接读写 DB；只暴露纯函数（prompt/build/validate）+ client wrapper
- `data/` 不包含业务逻辑（仅 CRUD + query）

## 1.4 关键横切能力

### Auth

- v1: 简化为 session token / JWT（按需求）
- 所有 user-scoped 表必须有 `user_id` 作为分区键

### Rate limit + quota

- 在 `services/aiQuotaService` 中实现：
  - key = `userId + aiType + yyyy-mm-dd`
  - store = DB/Redis

### Caching

- AI artifacts: DB 缓存（`ai_artifacts`）
- TTS: 文件/对象存储缓存（key = word+accent+speed）

### Observability

- Request id、structured logs
- Metrics events（见 §09）

## 1.5 Deployment notes

- 先单体部署；当 AI/导出压力高时拆：
  - `export-worker`
  - `ai-worker`（可队列化生成，前端轮询/长轮询）

## 1.6 Error model（API 统一）

```json
{ "error": { "code": "AI_TIMEOUT", "message": "...", "requestId": "..." } }
```

- 可重试错误：`AI_TIMEOUT`, `AI_RATE_LIMIT`, `EXPORT_BUSY`
- 不可重试错误：`VALIDATION_FAILED`, `UNAUTHORIZED`
