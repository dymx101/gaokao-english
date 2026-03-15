# 00. 目标与非目标（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 0.

## 0.1 技术目标（可验收）

### G1. 支持核心学习闭环
**Scope:** 自适应复习 → 错词强化 → 真题语境练习 → AI 生成能力（助记/出题/改写）→ 反馈回写。

**Definition of done (v1):**
- 用户能完成：
  - 看词卡/练习题 → 提交作答 → 系统更新掌握状态与下次复习时间
  - 错词本能聚合并分级
  - 真题例句可展示并用于题目
  - AI 内容可生成且落入缓存表

### G2. 低成本可扩展（配额/缓存/降级）
**Design requirements:**
- 所有 AI/TTS 调用必须：
  - 可配额（per user / per day / per feature）
  - 可缓存（按输入 hash、可过期）
  - 可降级（provider 不可用时仍可完成学习任务）

**Acceptance checks:**
- 同一输入重复请求，命中缓存不触发外部调用
- AI provider 超时/失败时，返回可用 fallback（见 §10）

### G3. 可观测性（学习效果 + 成本）
**Design requirements:**
- 核心链路埋点：测评、任务、作答、AI 调用、导出
- 指标可计算：正确率变化、错词回归率、留存、AI 成本/缓存命中

## 0.2 非目标（v1.0 不做）
- 教师/家长端
- 社交体系
- 多学科扩展

## 0.3 范围边界与约束

### 产品边界
- 只覆盖“高考英语词汇”学习与相关练习/写作改写，不做完整英语课程体系。

### 工程约束（推荐）
- v1.0 以 **单体后端 + 关系型 DB + 轻量队列** 落地
- AI 层必须为可插拔 Provider，避免业务逻辑绑死到单一模型供应商

## 0.4 风险清单（v1）

| 风险 | 影响 | 缓解策略 |
|---|---|---|
| AI 成本不可控 | 运营成本爆炸 | 配额 + 缓存 + 预生成 + 降级 |
| 真题版权不清晰 | 合规风险 | 明确来源、只存片段、可替换语料 |
| 掌握度算法效果差 | 学习体验差 | 先启发式可跑 + 可配置阈值 + 逐步 A/B |

## 0.5 配置项（建议）
- `limits.ai.perUserPerDay`：按 AI type 分桶（mnemonic/cloze/semantic/rewrite）
- `limits.tts.perUserPerDay`
- `ai.cache.ttlHours.{type}`
- `review.intervals`：unknown/fuzzy/mastered 的间隔序列
- `review.fatigue.maxPerSession`：单次会话最多题数
