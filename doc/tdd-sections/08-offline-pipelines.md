# 08. 数据处理流水线（离线）（Detailed TDD）

> Derived from `doc/TECH_DESIGN.md` section 8.

## 8.1 Goals
- Produce clean, normalized datasets for app runtime:
  - vocab_items (3500)
  - exam_sentences (aligned)
  - frequency stats

## 8.2 Pipeline: vocab cleaning

### Inputs
- CSV/JSON from open sources or OCR

### Steps
1) Normalize `word`:
   - trim, lower-case (store original casing if needed)
   - dedupe by word
2) Normalize POS:
   - map variants (noun/n. => n)
3) Meanings:
   - parse multi-sense into JSON array
4) Roots (optional):
   - derive prefix/suffix/root via rule list or AI batch

### Output
- `out/vocab_items.json`
- `out/vocab_items.csv`

### Validation
- uniqueness of word
- required fields present
- length sanity checks

## 8.3 Pipeline: exam parsing

### Inputs
- past exam papers text (per year/region)

### Steps
1) Sentence segmentation
2) Tokenization + lemmatization (optional)
3) Align sentence to vocab:
   - simple contains match + word boundary
   - optionally POS/lemma match
4) Slice long sentences into shorter segments (max chars)
5) Tagging:
   - v1: rule-based tags
   - v1.1: AI tagging batch

### Output
- `out/exam_sentences.json`
- `out/frequency.json`

### Validation
- each exam_sentence has vocab_id
- language sanity (mostly English)

## 8.4 Frequency heatmap generation

### Stats
- appearances last 3 years
- number of distinct papers

### Output
- `out/frequency_by_vocab_id.json`

## 8.5 Scheduling
- Run offline pipeline on dataset updates.
- For production: CI job or cron on admin machine.

## 8.6 Loading into DB
- Use a one-shot importer:
  - truncate & reload for global tables in early stage
  - later: upsert with immutable ids

## 8.7 Reproducibility
- Store pipeline scripts under `scripts/pipeline/*`
- Keep input snapshot checksums
- Version outputs with a dataset version string
