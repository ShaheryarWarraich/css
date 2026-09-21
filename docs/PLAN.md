# CSS OS — Phase 1 Plan (30,000 ft)

*Drafted 22 Sep 2026. Based on: the project brief, a profile of `CSS_Evidence_Bank_FINAL_Comprehensive.xlsx`, a learning-science literature review, and a CSS ecosystem review (FPSC examiner reports CE-2018/2019, essay feedback 2014–18, 2026 news, competitor scan).*

---

## 1. North star

> **Question in → thesis, arguments, evidence, counter-argument, conclusion out — from memory, in exam time, in the aspirant's own words.**

Success is not facts viewed. It is: how accurately and how fast the aspirant can retrieve and *deploy* evidence under exam conditions.

**Why this is the right target.** The written exam passes ~2.7% (476 of 17,351 in CSS 2026). The MPT passes ~85%, so MCQs are not where people fail. English Essay fails roughly 85–95% of candidates. FPSC examiners say why, in their own words:

- "crammed write up… stock of similar material, quotes and examples" (Essay 2019)
- "neither able to build an argument from multiple angles nor substantiated it with facts" (Essay 2016)
- "good in knowledge but lacked to apply in given situations" (Current Affairs 2019)
- "unable to identify the dormant contention in topics" (Essay 2017)
- "fake, sub-standard and unverifiable data… may be treated as plagiarism" (Economics 2019)

The brief's two layers (remember the fact; build the argument) map exactly onto the top two examiner complaints. No existing CSS product does either with spaced retrieval; the only serious AI competitor (cssprep.ai, PKR 5,000/month) has no evidence bank, no spacing and no offline mode.

### Five product principles

1. **Train and judge; never write for the user.** Examiners fail cloned content. If CSS OS hands 10,000 aspirants the same model sentences, it becomes the next academy guidebook. Model text is shown only as feedback after an attempt; the judge penalises verbatim reproduction.
2. **No source, no card.** Every fact carries source, reference period and URL. Only verified rows ship in the public pack.
3. **Works with no LLM at all.** The LLM improves judgment; it is never required to study.
4. **Phone, patchy 4G, load-shedding.** Text-only, offline-first, small payloads.
5. **LLM feedback is rubric-anchored advice, not a predicted FPSC mark.**

---

## 2. What the research changed in the brief

| Brief said | Research says | Plan |
|---|---|---|
| Day 0 → 1 → 3 → 7 → 14, then "in long-term memory" | The optimal gap grows with distance to the test (Cepeda 2008: ~5–10% of the retention interval for a test months away). Stopping at day 14 leaves 2–11 months of unprotected forgetting. | Adaptive scheduler (FSRS, MIT-licensed `ts-fsrs`) anchored to the exam date. Intervals capped so every item is seen in the last ~6 weeks. A fact is never "done". On a lapse: corrective feedback, re-retrieve in the same session, shortened interval — not a reset to zero. |
| Present the fact in different forms | Supported (Butler 2010; Pan & Rickard 2018): varied wording prevents memorising the card instead of the fact. | A **form ladder** tied to memory strength, not to fixed days (section 5). |
| Drill Layer B as a variation on Layer A | Fact quizzes do **not** improve higher-order performance; higher-order practice does (Agarwal 2019). Far transfer is rare. | Layer B gets its own scheduled items: claim→evidence, chain reconstruction, question→outline. Separate track, same scheduler. |
| System judges the answer | LLMs judge short factual answers well. Essay scoring agreement with humans ranges from ~0 to ~0.8 QWK and is biased toward length. | Deterministic grading wherever possible. LLM only for free text, with an analytic rubric, reference answer, fact bank and anchor examples. Dispute button. |
| — | Confidence ratings expose illusions of competence; high-confidence errors rebound after a week. | Ask confidence before reveal. Re-test confident errors within 1–3 days. Show a calibration chart. |
| — | The #1 reason people quit Anki is backlog avalanche. | Cap new items per day by a time budget. Never show a four-figure due count. Catch-up mode. |
| — | Updated statistics cause interference unless the change itself is noticed (Wahlheim & Jacoby 2013). | Versioned facts with "change cards" (FY25 was X → FY26 is Y, because…). Old value becomes an MCQ distractor. |

Evidence that is weak or contested and should not be oversold: FSRS improves scheduling efficiency, not proven exam scores; argument-mapping effect sizes come from a narrow research group; PEEL/Minto/MECE are professional heuristics, not experimentally validated; streak effects are industry data only.

---

## 3. Pain → Solve map

Severity (S) and feasibility (F) are 1–5. Phases are defined in section 8.

| # | Pain (with evidence) | Solve in CSS OS | S | F | Phase |
|---|---|---|---|---|---|
| 1 | Fact sheets are made, then forgotten. No spaced-recall tool exists for CSS. | **Recall Core**: evidence bank + adaptive spacing + form ladder + confidence + feedback. | 4 | 5 | 1.0 |
| 2 | "Good in knowledge but lacked to apply." Facts don't turn into arguments. | **Argument Engine**: evidence↔argument drills, chain reconstruction, deploy-in-a-paragraph, counter-argument drills. | 5 | 4 | 1.0 (deterministic forms) → 1.1 (judged forms) |
| 3 | Misreading the question ("dormant contention", directive words). | **Question Decoder**: on real past questions, identify directive, scope, hidden contention, then state a one-line thesis. Judged. | 5 | 4 | 1.1 |
| 4 | Outline and essay disconnected; outlines cloned. | **Outline Trainer**: timed thesis + outline from memory; judge checks coverage, MECE branches, counter-argument, evidence attached to each branch. Never generates the outline. | 5 | 4 | 1.1 |
| 5 | No affordable, honest feedback on writing (academy evaluation is expensive; FPSC gives none). | **Examiner Rubric Judge**: 20-mark answers scored on criteria lifted from FPSC examiner reports, each criterion quoted back with the evidence for the score. | 5 | 3 | 1.2 |
| 6 | Stale, wrong or fabricated statistics. | **Freshness Engine**: release calendar (Economic Survey in June, CPI in Feb, HDR in May, WJP in Oct…), expiry dates on cards, change cards, public changelog. | 4 | 4 | 1.3 |
| 7 | Brain goes blank under time pressure. | **Brain Dump + Exam Simulator**: free recall of a theme diffed against the bank; 3-hour / 4-question simulator with per-question clock; retrieval latency tracked. | 4 | 4 | 1.1 / 1.2 |
| 8 | Past-paper analysis is manual or sold. | **Open past-paper dataset** (2016–26) tagged by theme and directive; heatmaps; every question linked to argument maps. Feeds #3, #4, #7. | 3 | 5 | 1.1 |
| 9 | Précis & Composition fails 40–90% depending on year. | **Précis trainer**: checks one-third length, injected opinion, lifted sentences — all examiner-named, all gradeable. | 5 | 3 | 1.2 |
| 10 | English mechanics (agreement, tense, idiom misuse). | **Personal error log** harvested from the user's own judged writing → micro-drills on their recurring errors. | 5 | 3 | 1.2 |
| 11 | Cost and geography: academies PKR 60–120k, concentrated in Lahore/Islamabad. | Free, open source, offline PWA on a phone. Judging works with a free chatbot via copy-paste (section 6). | 4 | 4 | 1.3 |
| 12 | Misinformation (prep sites still say age limit is 35; it was rejected 4 Sep 2026). | **Rules & calendar source of truth**: versioned, dated, sourced. Countdown to MPT/written. | 3 | 5 | 1.3 |
| 13 | Islamiat/Pakistan Affairs references misquoted. | Reference decks: verses, hadith, constitutional articles, Quaid/Iqbal quotes with exact citation. Needs human scholar verification before release. | 4 | 3 | 1.3 |
| 14 | Review pile-ups, burnout, shame. | Load caps, minimum-viable-session streaks with freezes, catch-up mode, no leaderboards. | 4 | 4 | 1.0 |
| 15 | MPT MCQs. | Free by-product of the bank's MCQ form. Low priority: 85% pass anyway. | 2 | 5 | 1.0 |
| 16 | Current-affairs tracking; turning news into exam themes. | Out of Phase 1. This is the bridge to NEWS OS (section 9). | 4 | 3 | 2 |

Deliberately out of scope: optional-subject scoring predictions (trends are noise), viva/psychological prep (affects ~400 people a year), peer-review community (needs moderation capacity), predicted marks.

---

## 4. System at 30,000 ft

```
 CONTENT LAYER (git, public)          LEARNING ENGINE (on device)        JUDGE (pluggable)
 ───────────────────────────          ───────────────────────────        ─────────────────
 Excel (your authoring tool)          Scheduler (FSRS, exam-anchored)    0. Deterministic (MCQ, cloze,
   ↓ ingest + validator               Form ladder / item selector           numeric tolerance, ID match,
 Content pack (versioned JSON)   →    Session builder (time budget,         chain ordering)
   facts · arguments · chains ·         interleaving, load caps)         1. Self-check vs. model + checklist
   maps · quotes · questions ·        Review log (every attempt)         2. Copy-paste to any chatbot
   prompt variants · rubrics          Metrics (retention, latency,       3. Local CLI bridge (claude -p,
 Build-time LLM (your CLI)              calibration, coverage)              gemini, codex)
   generates variants + distractors                                      4. API key (fallback)
   → validated → committed            SURFACE: offline PWA (phone + desktop)
```

Three ideas carry the design:

**a) Content is a git repo; learner state is on the device.** The evidence bank is public, versioned and reviewable — a pull request is the verification workflow, and the changelog is the freshness record. Review history never leaves the device (export/import as a file). No server, no accounts, no hosting bill.

**b) LLM work is moved to build time wherever possible.** "Different forms" of each fact (rephrased prompts, MCQ distractors, application prompts) are generated once by the maintainer using the CLI subscription, validated, and shipped inside the content pack. Learners get variety with zero LLM cost. Only free-text judging needs a model at run time.

**c) The judge is a ladder, not a dependency.** Most forms grade deterministically. For free text, the user picks what they have: self-check, copy-paste to a free chatbot, a local CLI on their own subscription, or an API key. Note: a personal CLI subscription can power *your own* judging and the build-time generation; it cannot be the back-end for other aspirants — each user brings their own.

---

## 5. The learning design

### Two item types, one scheduler

- **Fact items** (Layer A): one per evidence row.
- **Argument items** (Layer B): one per argument chain, argument map, and past question.

### The form ladder (rung chosen by memory strength; strong learners skip lower rungs)

| Rung | Form | Workbook fields used | Judge |
|---|---|---|---|
| 1 | MCQ with competitive distractors (last year's value, a neighbour's value) | Value, Year, Comparator | Deterministic |
| 2 | Cued recall / cloze; reversed cue ("28.9% — of what, which year, which source?") | Title, Value, Year, Source | Deterministic + tolerance |
| 3 | Evidence → Argument: "What does this prove? What does it *not* prove?" | What It Proves, Counterargument | Self-check or LLM |
| 4 | Argument → Evidence: "Give 2–3 pieces of evidence for this claim" | Primary Argument, Pairs With | ID match (precision/recall) |
| 5 | Deploy: "Use this stat in two sentences to support or undermine claim X" | How to Deploy (shown after) | LLM, short rubric |
| 6 | Chain reconstruction: fill missing links / order the causal chain | Argument Maps: Causal Chain | Deterministic |
| 7 | Brain dump: "Everything on Pakistan's water security, 4 minutes" | Map + linked evidence | Diff vs. bank |
| 8 | Question → outline in 8 minutes (real past question) | Past-Paper Theme, Maps, Policy Chain | LLM, full rubric |

This covers the four retrieval directions your App Schema sheet already specifies (Argument→Evidence, Evidence→Argument, Evidence→Theory, Question→Map).

### Argument scoring rubric (each 0–3, behavioural descriptors, sourced to examiner reports)

1. Answers the question actually asked (directive + scope)
2. Clear, qualified thesis from the start
3. Argument branches distinct and sufficient
4. Causal chain complete — mechanism stated, no leaps
5. Evidence accurate and specific (checked against the bank; invented figures flagged)
6. Warrant explicit — *why* the evidence supports the claim
7. Strongest counter-argument stated and answered
8. Conclusion synthesises rather than summarises
9. Own wording (penalty for reproducing bank/model text)

Judge hygiene: rubric + reference outline + fact bank + 2–3 anchor answers per band in the prompt; quote evidence before scoring; median of 3 runs; length-neutral instruction. Before trusting it, check against 50 human-marked answers.

### Session shape (default 30 minutes)

Due reviews, lowest retrievability × priority first → a few new items (throttled by projected load) → one argument item → weekly: one brain dump, one timed outline. Confusable facts are interleaved; subjects are mixed after first exposure.

---

## 6. The four open items from the brief — recommendations

| Open item | Recommendation | Why |
|---|---|---|
| **Tech stack** | TypeScript end to end. Vite + React PWA; `ts-fsrs` for scheduling; SheetJS for in-browser Excel import; a ~100-line Node "judge bridge" that shells out to `claude -p` (or gemini/codex) for desktop users. Hosted free on GitHub Pages. | One language, one codebase for phone and desktop; offline by default; no server to run or pay for; matches the push-to-GitHub workflow. |
| **Database** | Content: Excel → validated JSON content pack in git. Learner state: IndexedDB (via Dexie) with file export/import. | Git gives versioning, review and a changelog for free. Local state means privacy and offline. A hosted DB only becomes necessary if sync or community features are added. |
| **How different forms are generated** | Rungs 1, 2, 4, 6, 7 are templated from structured fields. Rephrasings, distractors and application prompts are LLM-generated at build time, validated (single unambiguous answer, no true lure), committed to the pack. Users can flag bad items. | Zero run-time cost; reviewable; published studies show 10–30% of LLM-generated items are flawed, so validation must sit before shipping. |
| **How argument chains are scored** | Three tiers: deterministic (chain order, missing link, evidence ID match) → self-check against a model with the rubric as a checklist → LLM with the 9-criterion rubric. | Works for every user regardless of LLM access; keeps LLM judgment where it is reliable. |

Learner-added sheets (v2, v3…): import in the browser, run through the same validator, new rows marked "to learn", changed rows produce change cards, removed rows retire.

---

## 7. The evidence bank: what it needs before it can power Layer B

Profile of the current workbook: 605 evidence rows, 18 chains, 12 maps, 6 quotes.

| Finding | Consequence | Fix |
|---|---|---|
| `Pairs With` is one boilerplate sentence in 513 rows; `Counterargument` has 3 distinct values across 605 rows; `Memory Hook` is mostly title + value | Rungs 3–5 have no real answer key | LLM-draft per-row pairings, qualifications and hooks; human review; commit |
| Only 41 rows carry an `Argument Map ID`; 110 of 353 map references and 5 of 79 quote references point to IDs that don't exist | Maps can't be drilled reliably | Validator reports dangling refs; back-fill map links from the maps' own ID lists; restore or drop missing rows |
| 175 categories, 84 evidence types, ~20 ID prefix styles, 3 rows with shifted columns | No usable filters or interleaving | Controlled vocabulary: ~15 themes × CSS paper tags × 12 evidence roles; one ID scheme |
| 543 of 605 rows are Priority A | No prioritisation | Re-tier: Tier 1 ≈ 150 rows (highest past-paper reach), Tier 2, Tier 3 |
| 80 rows "need final source-line audit"; 513 "retroactive normalization pending"; 7 "Verified" | Can't be gifted as-is — examiners treat unverifiable data as plagiarism | Verification pass; only verified rows enter the public pack |
| 575 unique titles in 605 rows | Same fact learned twice | Dedupe pass keeping the strongest framing |

This content work is as large as the software work and runs in parallel from day one.

---

## 8. Roadmap

| Release | Theme | Contents |
|---|---|---|
| **1.0** | Recall Core | Ingest + validator + cleaned pack (Tier 1 first); FSRS anchored to exam date; rungs 1, 2, 4, 6; confidence capture; feedback with "so-what" + source; load caps; Excel import; state export; CLI judge bridge for short answers; metrics page. Push to GitHub, review, iterate. |
| **1.1** | Argument Engine | Rungs 3, 5, 7, 8; Question Decoder; Outline Trainer; 9-criterion rubric judge with copy-paste mode; past-paper dataset + heatmap. |
| **1.2** | Exam Conditions | Timed simulator; 20-mark answer evaluation; outline↔essay consistency check; précis trainer; personal English error log. |
| **1.3** | The Gift | Installable offline PWA polish; public content packs + contribution guide; Freshness Engine + release calendar; rules/calendar source of truth; reference decks; wellbeing guardrails. |
| **2.x** | NEWS OS bridge | See below. |

Timing note: CSS 2027 written exam starts 27 Jan 2027 — about four months out. If the first learner is sitting it, 1.0 should be in hand within 2–3 weeks and 1.1 by early November, with content limited to Tier 1.

### Success metrics

- Retention at review (target 85–90%) and share of Tier-1 facts at exam-ready strength
- Retrieval latency per fact; minutes to a complete outline
- Calibration (stated confidence vs. actual accuracy)
- Evidence density: distinct, correct facts deployed per 20-mark answer
- Rubric trend per criterion; adherence (sessions per week, backlog size)

---

## 9. How Phase 1 sets up NEWS OS

The content schema already has the two entities NEWS OS needs: **sources** (publisher, URL, date, reliability) and **issues/themes** (the argument maps). Phase 2 adds a pipeline in front of them:

RSS feeds (English + Urdu papers) → cluster articles by event → per-event brief showing how each outlet framed it, what is agreed, what is disputed → candidate evidence cards and map updates → human approval → content pack.

CSS OS becomes one consumer of NEWS OS. The Freshness Engine in 1.3 is the first, narrow version of that pipeline (official report releases only).

---

## 10. Risks

| Risk | Mitigation |
|---|---|
| The tool becomes a new source of cloned content | Principle 1; own-wording criterion; model text only after an attempt; several framings per fact |
| LLM judge gives confident, wrong feedback | Deterministic first; rubric + anchors; dispute button; audit against human-marked answers; never show predicted marks |
| A wrong fact ships and thousands memorise it | No source, no card; verification gate; public changelog; in-app "report this fact" |
| Content clean-up stalls the software | Ship 1.0 on Tier 1 (~150 rows) only |
| Scope creep from the tangents | Roadmap order is fixed by the pain × feasibility ranking; everything below 1.1 waits for learner feedback |
| Religious reference content is wrong | Human scholar verification before any Islamiat deck is published |
| Exam rules change (cluster-based exam, Urdu option are proposed, not notified) | Rules live in a dated config; nothing in the engine assumes the current paper pattern |

---

## 11. Decisions needed from you

1. **Who is learner #1 and which exam?** CSS 2027 (Jan 2027) or CSS 2028? This sets the pace and the Tier-1 cut. *Default assumed: CSS 2027, so 1.0 ships on Tier 1 within weeks.*
2. **Desktop-first for learner #1, or public PWA from day one?** *Default: same PWA codebase; desktop with CLI judge first, public polish in 1.3.*
3. **Who verifies content?** The 80 + 513 unverified rows need a human pass. *Default: I draft fixes and flag doubts; you or a CSS-qualified reviewer approve via pull request.*
4. **Stack sign-off**: TypeScript PWA + git content + IndexedDB + CLI judge bridge. *Default: proceed as recommended.*
