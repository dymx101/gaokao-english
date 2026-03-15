# 10. 降级与容灾（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 10.

## 10.1 Principles
- Core learning loop must work without AI/TTS.
- Degradation must be explicit in UX (show fallback label).
- Prefer deterministic fallbacks for predictability.

## 10.2 AI service unavailable

### Mnemonic fallback
- Use roots (if available) + template:
  - “把 {word} 想成 {sound-alike}，联想到 {image}，意思是 {meaning}。”
- Or provide a short static explanation from dataset.

### Cloze/semantic fallback
- Use `exam_sentences`:
  - blank out target word in sentence
  - provide options from:
    - confusable list (if available)
    - random same-POS words
- Provide rule-based explanation:
  - highlight collocations in sentence

### Rewrite fallback
- Use deterministic phrase bank substitution:
  - replace common verbs/adjs with advanced equivalents
- Provide “improvement checklist” instead of rewritten text.

### API behavior
- Return success with `degraded=true` and include fallback payload.
- Only hard-fail when the request is explicitly “AI-only”.

## 10.3 TTS unavailable
- Serve cached audio if exists
- Else return null url and show phonetics only

## 10.4 Queue/worker unavailable
- For exports:
  - create job but status remains queued
  - show retry button

## 10.5 Storage unavailable
- Don’t block attempts/state updates.
- For exports/audio: return retryable error.

## 10.6 Rate limits & backpressure
- Use:
  - per-user quotas
  - global concurrency caps for provider calls
  - circuit breaker when provider error rate high

## 10.7 Disaster recovery (minimal)
- DB backups daily
- Object storage lifecycle policies
- Ability to regenerate derived data (AI artifacts are cache)
