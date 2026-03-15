# 09. 埋点与可观测性（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 9.

## 9.1 Goals
- Measure learning outcomes and retention.
- Track AI/TTS cost and cache efficiency.
- Debug production issues with traceable events.

## 9.2 Event schema (recommended)
Use a single `events` stream (log/DB/analytics).

Common fields:
- `event` (string)
- `userId`
- `ts`
- `sessionId` (optional)
- `requestId`
- `properties` (json)

## 9.3 Required events (v1)

### placement_start
Properties: `{count}`

### placement_submit
Properties: `{correctRate, level}`

### task_view
Properties: `{date, itemsCount}`

### attempt_submit
Properties:
- `{vocabId, questionType, isCorrect, responseMs, changedAnswer}`

### ai_generate
Properties:
- `{type, vocabId?, cacheHit, latencyMs, model, tokens?, costEstimate?}`

### export_start / export_done
Properties:
- `{jobId, type, status, latencyMs, sizeBytes?}`

## 9.4 Metrics

### Learning
- per-word correctness improvement (7d window)
- mistake recurrence rate (stubborn→correct transition)

### Retention
- D1/D7 retention
- WAU/MAU

### Cost
- AI calls per user per day (by type)
- cache hit rate (AI + TTS)
- latency percentiles

## 9.5 Logging
- Structured logs (JSON)
- Include `requestId`, `userId`, `route`, `latencyMs`
- Redact sensitive fields (rewrite input text) — keep only `input_hash`

## 9.6 Tracing (optional)
- OpenTelemetry spans:
  - API request span
  - DB query spans
  - provider call span

## 9.7 Alerting (minimal)
- AI provider error rate > X%
- Export worker failures > X%
- DB connection errors

## 9.8 Data privacy
- Avoid storing raw writing text in logs/events.
- Keep only hashes and metadata.
