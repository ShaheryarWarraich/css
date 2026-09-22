# CSS OS

A free trainer for Pakistan's CSS exam. It does two things:

1. **Makes evidence stick.** Facts from a sourced evidence bank come back on an adaptive schedule, each time in a different form.
2. **Makes evidence usable.** It drills what each fact proves, which facts support which argument, and how causal chains fit together.

It trains and judges. It never writes answers for you: FPSC examiners fail stock material.

Status: **release 1.1 — Recall Core + Tier 1 content pass with in-app review.** Plain-language overview for reviewers: [docs/APP-OVERVIEW.md](docs/APP-OVERVIEW.md). Plan and roadmap: [docs/PLAN.md](docs/PLAN.md).

## Run it

```bash
npm install
npm run dev
```

Open http://localhost:5173. Progress is stored in your browser only; use Settings → Download backup.

## How it works

| Piece | Where | Notes |
|---|---|---|
| Evidence bank | `content/source/*.xlsx` → `npm run ingest` → `public/packs/core.json` | The workbook is the authoring tool. The ingest repairs what it can and reports the rest in [docs/validation-report.md](docs/validation-report.md). |
| Scheduler | `src/engine/scheduler.ts` | FSRS (`ts-fsrs`). The interval cap is tied to the exam date, so every item returns in the final weeks. Nothing is ever "done". |
| Form ladder | `src/engine/forms.ts` | MCQ → fill the figure → state it → what does it prove → evidence for a claim → rebuild the causal chain. The rung depends on memory strength. |
| Session builder | `src/engine/session.ts` | Most-forgotten first, time budget, new-item cap, no new material during a backlog, themes interleaved. |
| Judging | deterministic first; self-check second; optional AI third | `npm run judge` starts a local bridge to your own `claude` CLI (or `JUDGE_CMD="gemini -p"`). Enter `http://127.0.0.1:8787` in Settings. The app works fully without it. |
| Your own facts | Settings → Add your own facts | Import a sheet in the same format. New rows are marked to learn; changed values return as change cards. |

## Content pass and review

`node tools/enrich.mjs --tier 1` drafts, for each Tier 1 fact, a caveat, pairings, a memory hook and the wrong claim it rebuts, using your `claude` CLI. Drafts land in `content/proposals/` and ship to the app as **pending**. A reviewer approves, edits or rejects them in **Bank → Review**, then downloads a decisions file. Merge it with:

```bash
node tools/apply-review.mjs content/reviews/<file>.json && npm run ingest
```

Approved content is written to `content/overrides/layer-b.json`, which `ingest` applies on top of the workbook.

## Confidence buttons

You answer, then say how sure you were. The app judges correctness; you only supply confidence. A confident wrong answer returns within two days, because that kind of correction fades.

## Content rules

- No source, no card.
- Rows marked "needs audit" are flagged in the app. Verify before citing them in an exam.
- Content fixes go through pull requests against the workbook, with `npm run ingest` output committed alongside.

## Test

```bash
npm test
```
