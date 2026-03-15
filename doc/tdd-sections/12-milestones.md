# 12. 里程碑（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 12.

## M1 — 基础闭环

**Deliverables**

- vocab_items import + basic vocab API
- basic practice flows (flashcard/mcq)
- `user_attempts` logging
- `user_vocab_state` updates + simple review scheduling

**Exit criteria**

- can complete daily tasks end-to-end
- correctness history visible per word

## M2 — 错词本 + AI 助记

**Deliverables**

- `user_mistakes` aggregation + levels
- AI mnemonic endpoint + caching + quota
- feedback capture (up/down)

**Exit criteria**

- stubborn mistakes list stable
- mnemonic cache hit rate measurable

## M3 — Cloze / 语义辨析 + 真题语境 + 词频

**Deliverables**

- exam_sentences pipeline + runtime serving
- cloze and semantic MCQ generation (AI + fallback)
- frequency heatmap data and UI

**Exit criteria**

- tasks/today can include exam-context questions

## M4 — 写作改写 + PDF 导出

**Deliverables**

- rewrite endpoint + caching + safety
- export_jobs + worker + PDF template
- weekly summary/report (optional simplified)

**Exit criteria**

- export completes under N seconds for 200 items

## Cross-cutting (every milestone)

- config & env management
- structured logs + events
- error codes and degradation paths
