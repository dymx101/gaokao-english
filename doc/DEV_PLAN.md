# Dev Plan（v1.0）｜高考英语 AI 词汇专家

> Inputs:
>
> - PRD: `doc/PRD.md`
> - Tech design: `doc/TECH_DESIGN.md` (+ detailed sections in `doc/tdd-sections/`)
> - UI/UX spec: `doc/UI_UX_design.md`

## 0) Assumptions

- **MVP scope:** student-facing web app only.
- **Stack (suggested):**
  - Web: Next.js App Router + TS + Tailwind + shadcn/ui
  - Backend: Node/TS REST API
  - DB: SQLite for local dev → Postgres later
  - Jobs: simple DB-backed queue for exports (upgrade later)
- **AI/TTS:** can be stubbed initially; must have fallback.

## 1) Delivery strategy

- Build **vertical slices** (UI + API + DB) for the core loop first.
- Treat AI features as **optional enhancements** gated by cache/quota.
- Keep everything shippable at the end of each milestone.

## 2) Milestones (with exit criteria)

### M0 — Repo + dev environment (0.5–1 day)

Exit criteria:

- `pnpm dev` starts web
- `pnpm dev:api` starts backend
- DB migrations run
- basic CI (lint/test) green

### M1 — Core learning loop (2–4 days)

Scope:

- vocab import (minimal)
- Today tasks (fake selection ok)
- session flow: flashcard/mcq
- attempts logging + mastery update (simple heuristic)

Exit criteria:

- user can complete Today session end-to-end
- attempts persist; mastery status changes

### M2 — Mistakes system (2–3 days)

Scope:

- user_mistakes aggregation
- mistakes list + filters
- “start drill” from mistakes

Exit criteria:

- wrong answers create/update mistakes
- stubborn threshold works

### M3 — AI layer (mnemonic first) + caching/quota (2–4 days)

Scope:

- provider abstraction
- ai_artifacts cache table
- `/ai/mnemonic` endpoint + UI panel + feedback
- degrade fallback when AI unavailable

Exit criteria:

- repeated requests hit cache
- quota enforced

### M4 — Exam context + cloze/semantic (3–6 days)

Scope:

- exam_sentences import (small sample)
- word detail shows exam sentences
- cloze question type (template fallback)
- semantic mcq (optional)

Exit criteria:

- Today tasks can include an exam-context cloze

### M5 — Writing rewrite (2–4 days)

Scope:

- rewrite endpoint + UI
- caching by input hash
- safety (no raw text in logs; keep hash)

Exit criteria:

- rewrite works with fallback mode

### M6 — PDF export (3–6 days)

Scope:

- export_jobs
- worker + HTML template + PDF generation
- download link + UI job status

Exit criteria:

- export 200 mistakes under target time

### M7 — Observability + hardening (1–2 days)

Scope:

- event tracking in UI + backend
- error codes + requestId
- basic rate limiting

Exit criteria:

- key events emitted
- AI cost/caching metrics visible in logs

## 3) Work breakdown structure (executable tasks)

Below tasks are written to be directly copy-pasted into GitHub Issues.

### 3.1 M0 — Project setup

- [ ] **TASK-000**: Create monorepo structure (`apps/web`, `apps/api`, `packages/shared`)
  - DoD: workspace builds; TS path aliases work.
- [ ] **TASK-001**: Add lint/format/test tooling
  - web: eslint + prettier
  - api: eslint + prettier
  - DoD: `pnpm lint` passes.
- [ ] **TASK-002**: DB + migrations scaffold
  - Choose ORM (Prisma/Drizzle). Create initial schema.
  - DoD: `pnpm db:migrate` works.
- [ ] **TASK-003**: Basic CI workflow
  - DoD: PR triggers lint + unit tests.

### 3.2 M1 — Core loop (Today + Session + Attempts)

- [ ] **TASK-010**: Seed `vocab_items` with a small sample dataset
  - DoD: 50–200 words available via API.
- [ ] **TASK-011**: Implement `GET /api/v1/tasks/today`
  - DoD: returns mix of review/new from user state.
- [ ] **TASK-012**: Implement `POST /api/v1/attempts`
  - Writes `user_attempts`, updates `user_vocab_state`.
  - DoD: transactionally consistent; returns updated state.
- [ ] **TASK-013**: Web: Today page UI (`/today`)
  - DoD: renders tasks; Start button.
- [ ] **TASK-014**: Web: Session page (`/session/[id]`) with QuestionRenderer
  - Supports `flashcard` and `mcq`.
  - DoD: submit attempt; shows feedback; next.
- [ ] **TASK-015**: Word detail page (`/word/[vocabId]`) minimal
  - DoD: shows word + meaning + mastery badge.

### 3.3 M2 — Mistakes

- [ ] **TASK-020**: Implement `user_mistakes` upsert logic
  - DoD: wrong attempt increments count + sets level.
- [ ] **TASK-021**: Implement `GET /api/v1/mistakes`
  - DoD: supports filter by level + pagination.
- [ ] **TASK-022**: Web: Mistakes page (`/mistakes`) with tabs
  - DoD: list + filters; click to word detail.
- [ ] **TASK-023**: “Drill mistakes” start flow
  - DoD: Start drill creates a session seeded with mistakes.

### 3.4 M3 — AI mnemonic (provider + cache + quota)

- [ ] **TASK-030**: Create `ai_artifacts` schema + cleanup job
- [ ] **TASK-031**: Implement AI provider interface + stub provider
- [ ] **TASK-032**: `POST /api/v1/ai/mnemonic` with cache by input_hash
  - DoD: cacheHit true on repeat.
- [ ] **TASK-033**: Quota service (per user per day per type)
  - DoD: returns `AI_QUOTA_EXCEEDED` with reset time.
- [ ] **TASK-034**: Web: AI mnemonic panel on Word/Session
  - DoD: shows cached/generated badge + 👍/👎 feedback.

### 3.5 M4 — Exam context + Cloze

- [ ] **TASK-040**: Import `exam_sentences` sample dataset
- [ ] **TASK-041**: API: `GET /api/v1/word/:id` includes exam sentences
- [ ] **TASK-042**: Implement cloze generator
  - v1: template based on exam sentence; AI optional.
- [ ] **TASK-043**: Web: ClozeQuestion renderer

### 3.6 M5 — Writing rewrite

- [ ] **TASK-050**: Implement `POST /api/v1/ai/rewrite` (stub + cache)
- [ ] **TASK-051**: Web: Writing page UI + result cards
- [ ] **TASK-052**: Safety: avoid logging raw text; store hash only

### 3.7 M6 — PDF export

- [ ] **TASK-060**: Implement `export_jobs` schema + worker loop
- [ ] **TASK-061**: `POST /api/v1/exports/mistakes-pdf` creates queued job
- [ ] **TASK-062**: Worker: render HTML template + puppeteer PDF
- [ ] **TASK-063**: `GET /api/v1/exports/:jobId` status + file url
- [ ] **TASK-064**: Web: Export UI (form + status + download)

### 3.8 M7 — Observability + hardening

- [ ] **TASK-070**: Add requestId + structured logging to API
- [ ] **TASK-071**: Implement `track()` in web + emit required events
- [ ] **TASK-072**: Rate limiting on AI endpoints
- [ ] **TASK-073**: Error code mapping & user-friendly error UI

## 4) Execution order (recommended)

1. M0 tasks 000–003
2. M1 tasks 010–015 (ship vertical slice)
3. M2 tasks 020–023
4. M3 tasks 030–034
5. M4 tasks 040–043
6. M5 tasks 050–052
7. M6 tasks 060–064
8. M7 tasks 070–073

## 5) QA checklist (per milestone)

- Mobile layout at 375px, no horizontal scroll
- Keyboard navigation + visible focus
- AI down/degraded mode works
- Attempts are persisted and consistent
- CacheHit observable for AI endpoints

## 6) Optional nice-to-haves (defer)

- Auth (real login), multi-device sync
- Dark mode
- Advanced analytics dashboard
- Better spaced repetition model
