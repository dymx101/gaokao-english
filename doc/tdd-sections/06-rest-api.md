# 06. API 设计（REST）（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 6.

## 6.0 Conventions
- Base path: `/api/v1`
- Auth: `Authorization: Bearer <token>`
- Errors:

```json
{ "error": { "code": "...", "message": "...", "requestId": "..." } }
```

- All IDs: `uuid` for user-owned rows, `int/uuid` for vocab.

## 6.1 Placement test

### POST /placement/start
Returns a test session and 20 questions.

Request:
```json
{ "count": 20 }
```

Response:
```json
{
  "sessionId": "uuid",
  "items": [
    { "vocabId": 123, "questionType": "mcq", "payload": { "stem": "...", "options": ["..."] } }
  ]
}
```

Notes:
- Keep payload minimal; avoid leaking full vocab definitions in test.

### POST /placement/submit
Request:
```json
{
  "sessionId": "uuid",
  "answers": [
    { "vocabId": 123, "questionType": "mcq", "isCorrect": true, "responseMs": 1200 }
  ]
}
```

Response:
```json
{ "level": "L2", "plan": { "dailyNew": 40, "dailyReview": 80 } }
```

Side effects:
- insert attempts
- initialize user_vocab_state for touched items

## 6.2 Today tasks

### GET /tasks/today
Response:
```json
{
  "date": "2026-03-15",
  "items": [
    {
      "vocabId": 123,
      "mode": "review",
      "questionType": "cloze",
      "payload": { "question": "..." }
    }
  ]
}
```

Rules:
- prioritize due reviews
- mix in stubborn mistakes & new words

## 6.3 Attempts

### POST /attempts
Request:
```json
{
  "vocabId": 123,
  "questionType": "cloze",
  "isCorrect": false,
  "responseMs": 4200,
  "changedAnswer": true,
  "meta": { "choice": "...", "options": ["..."] }
}
```

Response:
```json
{
  "updatedState": { "status": "fuzzy", "strength": 0.52, "nextReviewAt": "..." },
  "mistake": { "mistakeCount": 3, "mistakeLevel": "stubborn" }
}
```

Notes:
- `meta` is optional but helpful to detect similar_confusion.

## 6.4 Mistakes

### GET /mistakes
Query:
- `level=stubborn|careless|similar_confusion`
- `limit`, `cursor`

Response:
```json
{
  "items": [
    { "vocabId": 123, "word": "...", "mistakeCount": 3, "mistakeLevel": "stubborn" }
  ],
  "nextCursor": "..."
}
```

### POST /mistakes/{vocabId}/mark
Use for manual override.

Request:
```json
{ "action": "remove" | "setLevel", "level": "careless" }
```

## 6.5 AI endpoints

### POST /ai/mnemonic
```json
{ "vocabId": 123 }
```

### POST /ai/cloze
```json
{ "vocabId": 123, "difficulty": 1, "length": 1 }
```

### POST /ai/semantic-mcq
```json
{ "vocabId": 123 }
```

### POST /ai/rewrite
```json
{ "text": "...", "preferredWords": ["abandon", "..."], "level": "gaokao" }
```

AI responses should include:
- `cacheHit` boolean
- `artifactId` for feedback

## 6.6 Exports

### POST /exports/mistakes-pdf
```json
{ "level": "stubborn", "limit": 200 }
```

Response:
```json
{ "jobId": "uuid" }
```

### GET /exports/{jobId}
```json
{ "status": "running", "fileUrl": null }
```

## 6.7 Admin/ops (optional)
- `POST /admin/reindex` (pipelines)
- `POST /admin/ai/pregen` (pre-generate artifacts)

## 6.8 Versioning & compatibility
- Version API by path (`/v1`).
- Add fields backwards-compatibly; never change meaning of existing fields.
