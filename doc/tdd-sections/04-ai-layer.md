# 04. AI 能力设计（Provider 可插拔）（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 4.

## 4.1 Goals

- Centralize all model calls behind a stable interface.
- Enforce: quota, caching, safety checks, structured output.
- Support: provider swap (OpenAI/others) without touching business logic.

## 4.2 Public interface (backend)

TypeScript-style contracts:

```ts
export type AiArtifactType = "mnemonic" | "cloze" | "semantic_mcq" | "rewrite";

export interface AiProvider {
  generateMnemonic(input: {
    word: string;
    meaningZh: any;
    roots?: any;
    userContext?: any;
  }): Promise<MnemonicOut>;
  generateCloze(input: {
    word: string;
    examSentence?: string;
    difficulty: number;
    length: number;
  }): Promise<ClozeOut>;
  generateSemanticMCQ(input: {
    target: string;
    confusables: string[];
    context?: string;
  }): Promise<SemanticMcqOut>;
  rewriteForWriting(input: {
    text: string;
    preferredWords?: string[];
  }): Promise<RewriteOut>;
}
```

All outputs must be JSON-serializable and validated.

## 4.3 Output schemas (suggested)

### MnemonicOut

```json
{
  "mnemonic": "string",
  "anchors": ["roots", "sound", "image"],
  "pitfalls": ["common confusion"],
  "example": { "en": "...", "zh": "..." }
}
```

### ClozeOut

```json
{
  "question": "... ____ ...",
  "answer": "targetWord",
  "options": ["..."],
  "explanation": { "en": "...", "zh": "..." },
  "difficulty": 1
}
```

### SemanticMcqOut

```json
{
  "stem": "Choose the best word...",
  "options": ["target", "conf1", "conf2", "conf3"],
  "answer": "target",
  "rationales": { "target": "...", "conf1": "..." },
  "tips": ["usage note"]
}
```

### RewriteOut

```json
{
  "rewrites": [
    { "level": "gaokao", "text": "...", "notes": ["..."], "usedWords": ["..."] }
  ],
  "warnings": ["..."],
  "diffHints": ["..."]
}
```

## 4.4 Caching

### Cache key

`input_hash = sha256(JSON.stringify({type, normalizedInput, modelConfigVersion}))`

Normalization rules:

- trim, normalize whitespace
- lower-case for word keys
- stable sort arrays

### Cache scope

- Mnemonic: global cache OK (user_id null) unless userContext affects output
- Cloze/MCQ: include difficulty + confusable set + optional context; TTL 24–72h
- Rewrite: include full text hash + preferred words hash; TTL shorter

### Cache read/write flow

1. compute hash
2. query `ai_artifacts` where `type` + `hash` (+ user_id scope) and not expired
3. if hit: return content with `cache_hit=true`
4. else call provider
5. validate output → write artifact row → return

## 4.5 Quota / throttling

- Enforce at `AIService` before provider call.
- Store counters in Redis (preferred) or DB.
- Deny with error code `AI_QUOTA_EXCEEDED` and include reset time.

## 4.6 Safety, quality, and guardrails

### Safety checks (post-generation)

- content moderation: provider moderation if available + keyword rules
- schema validation (Zod/JSON schema)
- hard constraints:
  - cloze/MCQ must contain target word in `answer`
  - options must be unique and include answer
  - language ratio checks (avoid full Chinese for English tasks)

### User feedback loop

- UI: useful/not useful/report
- Persist to `ai_artifacts.quality_feedback`
- Use feedback to:
  - blacklist low-quality artifacts (serve fallback)
  - offline evaluation set

## 4.7 Provider implementation guidance

### Resilience

- timeout per call (e.g. 20s)
- retry policy: only on rate-limit/5xx with jitter
- circuit breaker when provider unhealthy

### Observability

Log & metrics per call:

- latency_ms
- prompt_tokens/completion_tokens (if available)
- estimated_cost
- cache_hit
- model name/version

## 4.8 Fallbacks (tie-in to §10)

- mnemonic fallback: roots + handcrafted template
- cloze/MCQ fallback: exam sentence + rule-based question templates
- rewrite fallback: phrase bank substitution + deterministic rewrite hints
