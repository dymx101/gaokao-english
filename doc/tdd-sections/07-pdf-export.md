# 07. PDF 导出（A4 + 二维码回扫）（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 7.

## 7.1 Goals

- Export mistakes list into printable A4 PDF.
- Embed QR code for “scan to review in app”.
- Async generation so it doesn’t block API.

## 7.2 Export content specification

For each vocab row:

- word
- pos
- meaning_zh (primary senses)
- exam sentence (if available)
- mistake metadata: level, count, last_mistake_at
- optional: confusion_with list

PDF structure:

1. Cover page: title + date range + filters
2. Table/list pages
3. QR codes:
   - global QR on cover (review all)
   - optional per-word QR (deep link)

## 7.3 Deep link format

Prefer HTTPS for cross-device:

- `https://<domain>/review?list=mistakes&ids=123,456&level=stubborn`

If app supports custom scheme:

- `app://review?list=mistakes&ids=...`

Recommendation: encode short token instead of long id list:

- create `export_share_token` mapping to ids (optional v1.1)

## 7.4 Architecture

- API creates `export_jobs` row (queued)
- Worker consumes job:
  1. load user + mistakes data
  2. render HTML template
  3. generate QR (node-qrcode)
  4. run headless chromium (puppeteer) to print to PDF
  5. store file (local or object storage)
  6. update job status + file_url

## 7.5 Templates

- Use HTML/CSS templates for fast iteration.
- Provide two themes:
  - free: minimal
  - premium: richer layout, more examples

## 7.6 Implementation details

### HTML rendering

- Use a server-side template engine (e.g. handlebars/ejs) or React SSR.
- Keep templates deterministic and font-safe.

### Puppeteer settings

- A4, margin 12–15mm
- printBackground: true
- embed fonts (Noto Sans) to avoid missing Chinese glyphs

### Storage

- Local path: `storage/exports/{jobId}.pdf`
- file_url can be:
  - signed URL (S3)
  - direct local download route `GET /downloads/exports/{jobId}`

## 7.7 Failure handling

- If job fails:
  - set status=failed
  - store error_message
  - allow retry (idempotent if same filters)

## 7.8 Performance & limits

- Default max items per export (e.g. 200)
- Throttle concurrent chromium workers
- Cache per-user export for same filter+day (optional)
