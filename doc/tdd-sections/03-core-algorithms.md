# 03. 核心算法与策略（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 3.

## 3.1 掌握度计算（启发式 v1）

### Inputs

For a given `(user_id, vocab_id)`:

- Recent `user_attempts` window: last `K` attempts or last `D` days (e.g. K=8 or D=14)
- Current `user_vocab_state` (status/strength)

### Output

- `strength` in [0,1]
- `status` ∈ {unknown, fuzzy, mastered}

### Scoring function (suggested)

Let:

- `correct ∈ {0,1}`
- `rt = response_ms`
- `T_expected[question_type]` (config)

Compute:

- `time_factor = clamp((T_expected - rt)/T_expected, -1, 1)`
- `correctness_term = +w_correct if correct else -w_wrong`
- `time_term = w_time * time_factor` (only apply when correct; or apply both)
- `streak_term = w_streak * streak(correct)`
- `mistake_penalty = w_mistake * mistakes_in_window`

Example:

```
score = base
      + correctness_term
      + time_term
      + streak_term
      - mistake_penalty
strength = sigmoid(score)
```

### Mapping to status

Config thresholds (defaults):

- `< 0.35` => unknown
- `[0.35, 0.75)` => fuzzy
- `>= 0.75` => mastered

### Update rule

On every attempt submission:

1. append attempt row
2. recompute `strength`
3. set `status`
4. recompute `next_review_at` (see 3.2)

Use a DB transaction to keep consistency.

### Edge cases

- No attempts yet: default `strength=0.0`, `status=unknown`
- Long time no see: decay strength by time (optional v1.1)

## 3.2 复习间隔生成（Spaced repetition v1）

### Intervals

Config example:

- unknown: [0d, 1d] (same-day repeat allowed with fatigue control)
- fuzzy: [1d, 2d, 4d, 7d]
- mastered: [7d, 14d, 30d]

### Algorithm

- Maintain a per vocab “stage” derived from strength or recent streak.
- After each attempt:
  - if correct + fast => advance stage
  - if wrong => drop stage (or reset)
- `next_review_at = now + interval[stage]`

### Fatigue control

- Prevent same vocab from repeating too soon:
  - `minGapMinutes` (e.g. 10min)
- Session cap:
  - `maxReviewsPerSession`

## 3.3 错词分级（careless / stubborn / similar_confusion）

### Data sources

- `user_attempts` (wrong attempts)
- `user_mistakes` aggregate
- Optional: choices/options from mcq payload (v1 may not store)

### Rules (v1)

1. **stubborn**

- `mistake_count >= N` (default N=3)
- AND `last_mistake_at` spans >= 2 days across attempts (avoid same-session noise)

2. **careless**

- `mistake_count` low (<=2)
- AND response time normal range
- AND user overall accuracy in same session is similar (not a knowledge gap)

3. **similar_confusion**

- If we can infer a confusable word (user chose it / options contain it):
  - levenshtein(target, chosen) <= threshold (e.g. 2)
  - OR belongs to same synonym/confusable set
- Store `confusion_with` = [word/vocab_id]

### Implementation details

- On wrong attempt:
  - upsert `user_mistakes` (increment count, set last_mistake_at)
  - recompute `mistake_level` via above rules

## 3.4 Task selection strategy (today)

### Goal

Return a mixed set:

- due reviews (highest priority)
- a small number of new words
- a small number of mistake-focused drills

### Suggested composition (config)

- 60% due reviews
- 20% stubborn mistakes
- 20% new words

### Selection constraints

- avoid repeating same vocab twice in a small window
- avoid too many similar_confusion pairs back-to-back

## 3.5 Config surface (recommended)

- `review.thresholds.unknown/fuzzy/mastered`
- `review.intervals.{status}`
- `review.expectedTimeMs.{questionType}`
- `mistakes.stubbornThreshold`
- `mistakes.similarity.levenshteinThreshold`
- `tasks.today.mix` and `tasks.today.maxCount`
