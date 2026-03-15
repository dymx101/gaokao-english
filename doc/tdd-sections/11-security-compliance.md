# 11. 安全与合规（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 11.

## 11.1 Content / copyright
- Exam data must have a documented source and license/permission.
- Prefer storing **short snippets** rather than full papers.
- Keep pipeline replaceable so content can be swapped if takedown occurs.

## 11.2 User data handling
- Minimize collected PII (v1 can be anonymous account).
- Treat learning records as sensitive education data.

Controls:
- TLS everywhere
- Auth required for all user endpoints
- Row-level access control (always scope by user_id)

## 11.3 Secrets management
- Do not hardcode provider keys.
- Use env vars / secret manager.
- Rotate keys regularly.

## 11.4 AI generated content safety
- Enforce moderation:
  - provider moderation API when available
  - keyword filters
- Provide user report channel; log artifact id.

## 11.5 Logging & retention
- Avoid logging raw writing inputs.
- Store only `input_hash` + metadata.
- Set retention for:
  - request logs (e.g. 14–30 days)
  - analytics events (as needed)

## 11.6 Data export & deletion
- Provide ability to export user learning history (optional)
- Provide account deletion path (delete user rows; keep global vocab)

## 11.7 Threat model (quick)
- Abuse of AI endpoints (cost attack)
  - mitigate: auth + quota + captcha (if public) + caching
- Prompt injection via exam text
  - mitigate: treat corpus as untrusted; strict JSON output validation
- SSRF via media URLs
  - mitigate: disallow arbitrary URLs or use allowlist
