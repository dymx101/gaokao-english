# 技术设计文档（TDD）｜高考英语 AI 词汇专家（v1.0）

> 依据：`doc/PRD.md`（v1.0）

## 0. 目标与非目标

### 0.1 技术目标
- 支持“自适应复习 + 错词强化 + 真题语境 + AI 生成能力”的核心闭环。
- 低成本可扩展：AI/语音调用可配额、可缓存、可降级。
- 可观测：关键学习链路可埋点，能评估学习效果与留存。

### 0.2 非目标（v1.0 不做）
- 教师/家长端
- 社交体系
- 多学科扩展

---

## 1. 总体架构

### 1.1 逻辑组件
- **Web/App 前端**：词卡、练习、错词本、真题例句、写作改写、PDF 导出入口。
- **Backend API**：鉴权、用户数据、学习记录、计划生成、导出任务。
- **AI 服务层（可插拔）**：助记生成、语境重构、语义辨析出题、写作改写。
- **内容/数据层**：3500 词库、真题语料、词频统计、音频（TTS）。
- **任务队列/异步**：PDF 导出、批量生成缓存、数据清洗流水线。

### 1.2 建议的代码分层（对应仓库结构）
- `src/backend/`
  - `api/` 路由（REST）
  - `services/` 业务服务（复习计划、错词、导出）
  - `ai/` AI Provider 抽象 + 实现（OpenAI/其他）
  - `data/` repository/DAO
  - `jobs/` 队列任务（PDF、预生成）
- `src/web/`
  - `pages/` / `components/` / `stores/`

---

## 2. 数据模型（建议）

> 可用 PostgreSQL / SQLite（本地）+ 后端同步。以下以服务端 DB 为主。

### 2.1 核心表

#### users
- `id`
- `created_at`

#### vocab_items（词库）
- `id`
- `word`（唯一）
- `phonetic`（可空）
- `pos`（词性：标准化）
- `meaning_zh`（可结构化：多义项 JSON）
- `roots`（词根词缀 JSON，可空）

#### exam_sentences（真题例句/片段）
- `id`
- `vocab_id`
- `source`（卷名/年份/地区）
- `text_en`
- `text_zh`（可空）
- `tags`（考点标签 JSON，可空）

#### user_vocab_state（用户-单词掌握状态）
- `user_id`
- `vocab_id`
- `status`（enum：unknown / fuzzy / mastered）
- `strength`（0-1 或 0-100）
- `next_review_at`
- `last_seen_at`
- `updated_at`

#### user_attempts（作答记录）
- `id`
- `user_id`
- `vocab_id`
- `question_type`（flashcard/mcq/cloze/semantic）
- `is_correct`
- `response_ms`（Reflection Time）
- `changed_answer`（bool，可空）
- `created_at`
- 索引：`(user_id, vocab_id, created_at)`

#### user_mistakes（错词聚合）
- `user_id`
- `vocab_id`
- `mistake_count`
- `mistake_level`（enum：careless / stubborn / similar_confusion）
- `last_mistake_at`
- `confusion_with`（易混词列表 JSON，可空）

#### ai_artifacts（AI 生成内容缓存）
- `id`
- `user_id`（可空：全局缓存时为空）
- `vocab_id`（可空：写作改写可按输入 hash）
- `type`（mnemonic/cloze/semantic_mcq/rewrite）
- `input_hash`
- `content_json`
- `quality_feedback`（up/down，可空）
- `created_at`
- `expires_at`

#### export_jobs（导出任务）
- `id`
- `user_id`
- `type`（mistakes_pdf）
- `status`（queued/running/done/failed）
- `file_url`（或本地路径）
- `created_at/updated_at`

---

## 3. 核心算法与策略

### 3.1 掌握度计算（MVP 方案）
输入：近期 `user_attempts`（正确与否、response_ms、错误次数）。

建议的启发式（先落地可跑，再迭代为模型）：
- `score = base + correctness_weight + time_weight + streak_weight - mistake_penalty`
- 时间权重：
  - 设定每题期望用时 `T_expected`（按题型不同配置）
  - `time_factor = clamp((T_expected - response_ms)/T_expected, -1, 1)`
  - 正确但用时过长 → 标记 fuzzy；快速正确 → 提升 mastered 概率。

状态映射（示例阈值，可配置）：
- `score < 0.35` → unknown
- `0.35 ≤ score < 0.75` → fuzzy
- `score ≥ 0.75` → mastered

### 3.2 复习间隔生成
- unknown：1 天内重复（同日可再出现，需去重与疲劳控制）
- fuzzy：1/2/4/7 天（随表现调整）
- mastered：7/14/30 天

实现：每次尝试后更新 `user_vocab_state.next_review_at`。

### 3.3 错词分级（careless / stubborn / similar_confusion）
- careless：偶发错（`mistake_count` 低）、但总体 response_ms 正常；或与同批次题整体正确率一致。
- stubborn：同词多次错（`mistake_count >= N`，例如 3），且跨多天仍错。
- similar_confusion：错题选项/用户选择与目标词在拼写相近（Levenshtein 距离阈值）或同义/近义集合内。

---

## 4. AI 能力设计（可插拔 Provider）

### 4.1 Provider 抽象
- `generateMnemonic(vocabItem, userContext?)`
- `generateCloze(vocabItem, difficulty, length)`
- `generateSemanticMCQ(targetWord, confusableWords[], context?)`
- `rewriteForWriting(inputText, preferredWords[])`

要求：
- 所有生成接口必须可配置：模型、温度、最大 token、超时。
- 统一返回结构化 JSON（而不是纯文本），方便前端展示与审计。

### 4.2 缓存策略
- **按输入 hash 缓存**（`ai_artifacts.input_hash`），避免重复生成。
- 助记：可以全局缓存（不强个性化）+ 用户反馈标注。
- Cloze/辨析：可半个性化（按错词集合/难度）缓存 24-72h。
- 写作改写：按用户输入 hash + 用户错词集合 hash 缓存短期。

### 4.3 内容安全与质量
- 生成后做后处理：
  - 过滤不适宜内容/敏感内容（关键词 + provider moderation）
  - 校验目标词必须出现在 cloze/题干中
  - 长度、语言比例检查
- 前端提供“有用/没用/举报”入口，回写 `ai_artifacts.quality_feedback`。

---

## 5. TTS 与音频

### 5.1 接入策略
- Provider：Google TTS 或 Azure Speech（可配置）。
- 支持英音/美音两种 voice。

### 5.2 缓存与成本
- 以 `word + accent + speed` 作为 cache key。
- 首次请求生成并落盘（或对象存储），后续直接取 URL。

---

## 6. API 设计（REST 示例）

### 6.1 词力测验
- `POST /api/v1/placement/start` → 返回 20 题（vocab_id 列表/题目结构）
- `POST /api/v1/placement/submit` → 写入 attempts，返回初始 level + 计划

### 6.2 每日任务
- `GET /api/v1/tasks/today` → 核心词 + 复习词 + AI 语境题

### 6.3 作答回传
- `POST /api/v1/attempts`
  - body: `{vocabId, questionType, isCorrect, responseMs, changedAnswer}`
  - side effects: 更新 `user_vocab_state`、`user_mistakes`

### 6.4 错词本
- `GET /api/v1/mistakes?level=stubborn&limit=...`
- `POST /api/v1/mistakes/{vocabId}/mark`（可手动标注/移除）

### 6.5 AI 接口
- `POST /api/v1/ai/mnemonic` `{vocabId}`
- `POST /api/v1/ai/cloze` `{vocabId, difficulty, length}`
- `POST /api/v1/ai/semantic-mcq` `{vocabId}`
- `POST /api/v1/ai/rewrite` `{text}`

### 6.6 导出
- `POST /api/v1/exports/mistakes-pdf` → 返回 jobId
- `GET /api/v1/exports/{jobId}` → 状态/下载链接

---

## 7. PDF 导出（A4 + 二维码回扫）

### 7.1 生成内容
- 按错词列表输出：单词、词性、释义、例句、错因标签。
- 二维码：建议 encode 深链接，例如：`app://review?list=mistakes&ids=...` 或 `https://.../review?...`

### 7.2 实现建议
- 后端异步 job：拉取数据 → 模板渲染（HTML/CSS）→ headless chromium/puppeteer 转 PDF。
- 模板分免费/高级两套（商业化区分）。

---

## 8. 数据处理流水线（离线）

### 8.1 3500 词库清洗
- 输入：GitHub 开源 / PDF OCR
- 输出：标准字段 CSV/JSON → 入库 `vocab_items`
- 清洗：去重、词性归一、大小写、派生词（可选）

### 8.2 真题解析
- 输入：历年真题文本
- 处理：
  - 句子切分、对齐词表
  - 长难句切片为短句
  - 标注考点 tags（先规则/后 AI）
- 输出：`exam_sentences` + 词频统计表

### 8.3 词频热力图
- 统计维度：近 3 年出现次数/出现卷数。
- 生成：离线定时任务（每次数据更新重算）。

---

## 9. 埋点与可观测性（最低要求）

### 9.1 关键事件
- `placement_start/submit`
- `task_view/task_complete`
- `attempt_submit`（含 responseMs、questionType）
- `ai_generate`（type、latency、cache_hit、cost_estimate）
- `export_start/export_done`

### 9.2 指标（用于 PRD 的“成功标准”落地）
- 学习效果：7 天内同一词正确率提升、错词回归率下降。
- 留存：D1/D7 留存、周活。
- 成本：AI 调用次数/人/日、TTS 调用次数、缓存命中率。

---

## 10. 降级与容灾
- AI 服务不可用：
  - 助记 → 回退到词根/人工预置助记
  - Cloze/辨析 → 回退到真题例句 + 固定题型模板
  - 写作改写 → 回退到预置高级表达库
- TTS 不可用：
  - 回退到已有缓存音频或仅展示音标

---

## 11. 安全与合规
- 真题数据：需明确来源与版权/授权策略。
- 用户数据：最小化采集；学习记录属于敏感教育数据，需加密传输与访问控制。
- 生成内容：审核与举报通道；日志可追溯（保留 input_hash，不强制保存原文）。

---

## 12. 里程碑（建议）
- M1：词库入库 + 基础练习 + attempts 记录 + 简化复习计划
- M2：错词本分级 + AI 助记（含缓存）
- M3：Cloze/语义辨析 + 真题例句 + 词频展示
- M4：写作改写 + PDF 导出 + 周报图谱（可先简化）
