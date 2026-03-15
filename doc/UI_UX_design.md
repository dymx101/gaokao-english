# UI/UX Design（Web App Implementation Spec）｜高考英语 AI 词汇专家（v1.0）

> Basis: `doc/PRD.md` + `doc/TECH_DESIGN.md` (v1.0)

## Assumptions (for implementation)
- **Stack:** Next.js (App Router) + TypeScript + Tailwind + shadcn/ui + Lucide icons
- **Data:** TanStack Query (server state) + Zustand (UI/session state)
- **Form:** react-hook-form + zod
- **Analytics:** simple `track(event, props)` wrapper (see §9)
- **Responsive:** mobile-first (375px baseline), scales to desktop

---

## 1) Design principles (non-negotiable)
1. One primary action per screen (Start / Next / Rewrite / Export)
2. Every AI feature must show **cache/degraded** status and allow 👍/👎 feedback
3. Touch targets ≥ 44×44, keyboard accessible, visible focus ring
4. Never block the core learning loop on AI/TTS availability

---

## 2) Design system (practical)

### 2.1 Visual style
- **Style:** clean, modern, study-focused (avoid childish playful fonts)
- **Surfaces:** neutral background + subtle card borders; minimal shadows
- **Motion:** 150–250ms micro transitions; respect `prefers-reduced-motion`

### 2.2 Color tokens (Tailwind / CSS variables)
Use semantic tokens (no raw hex in components):
- `--background`, `--foreground`
- `--card`, `--card-foreground`
- `--primary`, `--primary-foreground`
- `--muted`, `--muted-foreground`
- `--destructive`
- `--border`, `--ring`

Status colors (mastery):
- unknown: muted
- fuzzy: amber
- mastered: green

### 2.3 Typography (recommended)
The ui-ux-pro-max dataset suggested overly playful education fonts; for Gaokao we should use a **serious, high-legibility sans**.

Recommended pairing (from typography search):
- **Heading/Body:** `IBM Plex Sans` (trustworthy, readable) OR `DM Sans`
- Chinese fallback: `Noto Sans SC`

Tailwind example:
```ts
// tailwind.config.ts
fontFamily: {
  sans: ["IBM Plex Sans", "Noto Sans SC", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
}
```

### 2.4 Component library
- shadcn/ui primitives: `Button`, `Card`, `Tabs`, `Badge`, `Progress`, `Dialog`, `Sheet`, `DropdownMenu`, `Toast`
- Icons: Lucide (single consistent set)

---

## 3) Information Architecture (IA)

### 3.1 Primary navigation
Mobile: **Bottom nav** (max 5)
- Today（今日）
- Mistakes（错词）
- Exam（真题）
- Writing（写作）
- Profile（我的）

Desktop (≥1024px): left sidebar with same destinations.

### 3.2 Secondary entry points
- Global search (word lookup): header search icon → `/search`
- Export: from Mistakes page (not in primary nav)

---

## 4) Route map (Next.js App Router)

```
/app
  /(shell)
    layout.tsx              # AppShell with nav
    today/page.tsx
    session/[sessionId]/page.tsx
    word/[vocabId]/page.tsx
    mistakes/page.tsx
    exam/page.tsx
    writing/page.tsx
    profile/page.tsx
    search/page.tsx
    export/mistakes/page.tsx
  /(onboarding)
    onboarding/page.tsx
    placement/page.tsx
```

Routing rules:
- Learning happens inside `/session/[sessionId]` (deep-linkable, resumable).
- Word details always at `/word/[vocabId]`.

---

## 5) Data contracts (UI-facing types)

### 5.1 Shared enums
```ts
type MasteryStatus = "unknown" | "fuzzy" | "mastered";
type QuestionType = "flashcard" | "mcq" | "cloze" | "semantic";
type MistakeLevel = "careless" | "stubborn" | "similar_confusion";
```

### 5.2 API shapes (aligned to TECH_DESIGN.md)

Today tasks:
```ts
type TodayTaskItem = {
  vocabId: number;
  mode: "review" | "mistake" | "new";
  questionType: QuestionType;
  payload: any; // render-specific, validated server-side
};

type TodayTasksResponse = {
  date: string;
  items: TodayTaskItem[];
};
```

Attempt submit:
```ts
type AttemptSubmitRequest = {
  vocabId: number;
  questionType: QuestionType;
  isCorrect: boolean;
  responseMs: number;
  changedAnswer?: boolean;
  meta?: { choice?: string; options?: string[] };
};

type AttemptSubmitResponse = {
  updatedState: { status: MasteryStatus; strength: number; nextReviewAt: string };
  mistake?: { mistakeCount: number; mistakeLevel: MistakeLevel };
};
```

AI artifact:
```ts
type AiArtifact = {
  artifactId: string;
  type: "mnemonic" | "cloze" | "semantic_mcq" | "rewrite";
  cacheHit: boolean;
  degraded?: boolean;
  content: any;
};
```

---

## 6) Screen specs (component tree + states)

### 6.1 Today (`/today`)
**Primary goal:** start/resume a learning session.

Header:
- Date, progress (completed/total)
- Search icon

Body:
- `TodaySummaryCard` (optional: streak/time)
- `TaskSection` x3 (Due Reviews / Mistakes Drill / New Words)

CTA:
- `PrimaryButton: Start` (creates/resumes session)

States:
- Loading: skeleton list
- Empty: “All done” + secondary CTA “Extra practice” (guard by quota)

**TanStack Query**
- `useTodayTasks()` → `GET /api/v1/tasks/today`

**Events**
- `task_view`
- `task_start`

---

### 6.2 Session (`/session/[sessionId]`)
**Primary goal:** answer items sequentially with immediate feedback.

Layout:
- `SessionHeader` (progress, close/back)
- `QuestionRenderer` (switch by questionType)
- `FeedbackPanel` (after submit)
- `NextButton` sticky bottom

Question renderers:
- `FlashcardQuestion`
  - Word header + TTS controls
  - Reveal meaning
  - Self-rating buttons: Know/Fuzzy/Don’t
- `MCQQuestion` / `SemanticMCQQuestion`
  - Options list, single select, submit
- `ClozeQuestion`
  - Sentence + blank, options

AI affordances (secondary):
- `AiHelpDrawer`
  - Mnemonic (cached by default)
  - “Regenerate” only if quota allows
  - Feedback buttons

States:
- Loading next item: skeleton
- Network error: inline error + Retry

**State (Zustand)**
- `sessionStore`: currentIndex, startedAt, per-item start timestamp

**Events**
- `attempt_submit`
- `ai_generate` (if called)

---

### 6.3 Word Detail (`/word/[vocabId]`)
**Primary goal:** clarify meaning + exam contexts + targeted help.

Sections (vertical):
1) `WordHeader`
   - word, phonetic, POS, meanings
   - TTS (US/UK toggle)
2) `MasteryBadge` + next review time
3) `ExamSentenceList` (real first)
4) `AiMnemonicCard` (cached)
5) `ConfusionPanel` (if similar_confusion)
6) Actions: add/remove from mistakes, manual mark

States:
- No exam sentence: show placeholder + optional AI generate (quota)

---

### 6.4 Mistakes (`/mistakes`)
**Primary goal:** browse and drill mistakes; export.

UI:
- `Tabs` (All / Careless / Stubborn / Similar)
- `MistakeList` (virtualize if >50)
- Row: word, short meaning, count, last mistake, tag

Actions:
- Primary: “Start drill” (stubborn-first)
- Secondary: “Export PDF” → `/export/mistakes`

---

### 6.5 Export Mistakes PDF (`/export/mistakes`)
Flow:
1) Choose filter (level + limit)
2) Template (Basic / Advanced)
3) Create job
4) Poll job status, enable download

Components:
- `ExportForm`
- `ExportJobStatus`

States:
- queued/running/done/failed
- failure shows Retry

---

### 6.6 Exam (`/exam`)
**Primary goal:** practice with real exam contexts.

Components:
- `ExamFilters` (year/region/tag)
- `ExamSentenceCard` list (highlight word)
- “Practice” button starts a session seeded by that sentence

---

### 6.7 Writing (`/writing`)
**Primary goal:** generate better rewrites with Gaokao-appropriate tone.

Components:
- `WritingInput`
- `RewriteOptions` (tone, use mistakes words)
- `RewriteResults`
  - 2–3 cards, each: rewritten text, notes, usedWords chips
  - Actions: Copy, Favorite

States:
- Loading: skeleton cards
- AI down: fallback “improvement checklist” (degraded)

---

### 6.8 Profile (`/profile`)
Sections:
- Preferences: accent, daily target (new/review)
- AI quota usage (today)
- Data: export/download (optional)

---

## 7) Client-side state (Zustand)

### 7.1 `preferencesStore`
- accent: `us|uk`
- dailyPlan: `{ newTarget, reviewTarget }`

### 7.2 `sessionStore`
- sessionId
- currentIndex
- itemStartAt
- completedCount

Rules:
- session state should survive refresh (persist to localStorage).

---

## 8) API hooks (TanStack Query)

Recommended hooks:
- `useTodayTasks()`
- `useStartSession()`
- `useSession(sessionId)`
- `useSubmitAttempt()`
- `useMistakes(level)`
- `useWord(vocabId)`
- `useAiMnemonic(vocabId)`
- `useCreateExportJob()` + `useExportJob(jobId)`

Implementation notes:
- Add `requestId` header from server into error UI for support.

---

## 9) UX instrumentation (events)

Mandatory events (align to TECH_DESIGN.md):
- `placement_start`, `placement_submit`
- `task_view`, `task_start`, `task_complete`
- `attempt_submit` (include responseMs, questionType)
- `ai_generate` (type, cacheHit, latency)
- `ai_feedback` (artifactId, up/down/report)
- `export_start`, `export_done`

---

## 10) Accessibility checklist (web)
- Visible focus rings for all interactive elements
- Icon-only buttons must have `aria-label`
- Form labels must be visible (no placeholder-only)
- Contrast ≥ 4.5:1 for body text
- Respect `prefers-reduced-motion`

---

## 11) Deliverables to produce next
1) Wireframes (low-fi) for: Today, Session, Word Detail, Mistakes, Writing, Export
2) Component contract doc (props + states) for `QuestionRenderer` and `AiHelpDrawer`
3) A page-level design token file (colors/typography/radius/shadows)
