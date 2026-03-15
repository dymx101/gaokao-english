# 02. 数据模型（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 2.

## 2.0 Storage choice
- **Prod:** PostgreSQL 15+
- **Local/dev:** SQLite (via Prisma/Drizzle) 可选

Design goals:
- 写入热点：`user_attempts`（append-only）
- 读热点：`tasks/today`, `mistakes`, `user_vocab_state`

## 2.1 Tables (core)

### users
Purpose: minimal user identity.

Columns:
- `id` (uuid, pk)
- `created_at` (timestamptz)

Indexes:
- pk

---

### vocab_items
Purpose: global 3500 word bank.

Columns:
- `id` (bigserial/uuid, pk)
- `word` (text, unique, not null)
- `phonetic` (text, null)
- `pos` (text, null) — normalized (e.g. "n", "v", "adj")
- `meaning_zh` (jsonb, not null) — e.g. `[{sense: 1, zh: "...", en: "..."}]`
- `roots` (jsonb, null) — prefix/suffix/root info

Indexes:
- unique(`word`)

---

### exam_sentences
Purpose: exam contexts bound to vocab.

Columns:
- `id` (bigserial, pk)
- `vocab_id` (fk vocab_items.id)
- `source` (text) — year/paper/region
- `text_en` (text)
- `text_zh` (text, null)
- `tags` (jsonb, null)

Indexes:
- (`vocab_id`)
- optional full-text index on `text_en`

---

### user_vocab_state
Purpose: per-user mastery state & next review scheduling.

Columns:
- `user_id` (fk users.id)
- `vocab_id` (fk vocab_items.id)
- `status` (text) — enum: unknown/fuzzy/mastered
- `strength` (numeric) — 0..1 (or smallint 0..100)
- `next_review_at` (timestamptz)
- `last_seen_at` (timestamptz, null)
- `updated_at` (timestamptz)

PK:
- (`user_id`, `vocab_id`)

Indexes:
- (`user_id`, `next_review_at`) — fetch due reviews
- (`user_id`, `status`) — status filtering

---

### user_attempts
Purpose: append-only attempt log.

Columns:
- `id` (uuid, pk)
- `user_id`
- `vocab_id`
- `question_type` — enum: flashcard/mcq/cloze/semantic
- `is_correct` (bool)
- `response_ms` (int)
- `changed_answer` (bool, null)
- `created_at` (timestamptz)

Indexes:
- (`user_id`, `vocab_id`, `created_at desc`)
- (`user_id`, `created_at desc`) — activity timeline

Retention:
- keep forever (preferred) or roll up after N months (optional).

---

### user_mistakes
Purpose: aggregated mistakes for quick queries & tagging.

Columns:
- `user_id`
- `vocab_id`
- `mistake_count` (int)
- `mistake_level` — enum: careless/stubborn/similar_confusion
- `last_mistake_at` (timestamptz)
- `confusion_with` (jsonb, null) — list of vocab_ids or words

PK:
- (`user_id`, `vocab_id`)

Indexes:
- (`user_id`, `mistake_level`, `mistake_count desc`)

---

### ai_artifacts
Purpose: cached AI outputs (global or per-user).

Columns:
- `id` (uuid, pk)
- `user_id` (null allowed) — null => global cache
- `vocab_id` (null allowed)
- `type` — enum: mnemonic/cloze/semantic_mcq/rewrite
- `input_hash` (text) — sha256
- `content_json` (jsonb)
- `quality_feedback` (text, null) — up/down/report
- `created_at` (timestamptz)
- `expires_at` (timestamptz)

Indexes:
- (`type`, `input_hash`) unique (optionally include `user_id` for per-user)
- (`expires_at`) for cleanup job

---

### export_jobs
Purpose: async exports.

Columns:
- `id` (uuid, pk)
- `user_id`
- `type` — mistakes_pdf
- `status` — queued/running/done/failed
- `file_url` (text, null)
- `error_message` (text, null)
- `created_at`, `updated_at`

Indexes:
- (`user_id`, `created_at desc`)
- (`status`, `created_at asc`) for workers

## 2.2 Migrations & seeds
- Seed `vocab_items` and `exam_sentences` from offline pipeline outputs (see §08).
- Enforce immutable vocab ids (don’t renumber once released).

## 2.3 Data access patterns
- `tasks/today`:
  - query due reviews: `user_vocab_state where next_review_at <= now()`
  - query new words: pick from `unknown` pool with spacing rules
- `attempts` write:
  - insert attempt
  - transactionally update state + mistakes

## 2.4 Cleanup jobs
- `ai_artifacts` cleanup: delete expired daily
- `export_jobs`: keep last N or keep metadata forever, delete files after TTL (optional)
