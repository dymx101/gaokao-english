# 05. TTS 与音频（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 5.

## 5.1 Goals

- Provide reliable pronunciation playback for vocab items.
- Keep TTS cost low via caching.
- Support accents (UK/US) and optional speed.

## 5.2 Interface

Backend endpoint examples:

- `GET /api/v1/tts/word?word=abandon&accent=us&speed=1.0`
  - returns `{ url, cacheHit }`

Or embed TTS url as part of vocab payload.

## 5.3 Provider strategy

- Provider: Google TTS or Azure Speech (configurable)

Config:

- `tts.provider = "google" | "azure"`
- `tts.voices.uk`, `tts.voices.us`
- `tts.defaultSpeed`

## 5.4 Caching & storage

### Cache key

`tts_key = sha256(word + "|" + accent + "|" + speed + "|" + voiceId)`

### Storage options

- v1 simplest: local filesystem under `./storage/tts/{tts_key}.mp3`
- production: object storage (S3/MinIO) + CDN

### Flow

1. compute key
2. check storage for existing file
3. if exists: return URL
4. else:
   - call provider
   - validate audio duration (sanity: 0.2s–10s)
   - store
   - return URL

## 5.5 Cost controls

- hard limits: per-user per-day TTS requests
- batch pre-generation for top N words (optional)

## 5.6 Failure modes

- Provider down: return `null` url and UI falls back to phonetic only.
- Storage failure: still allow learning; don’t block core workflow.

## 5.7 Security

- If using signed URLs: short TTL for private buckets.
- Avoid SSRF when accepting external media URLs (prefer internal storage only).
