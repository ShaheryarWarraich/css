# CSS OS — App Overview

*For Ahsan (reviewer, CSS 2027 candidate). Version 1.1, 22 September 2026.*

## What this is

CSS OS is a free study app built for CSS aspirants. It does one job: it makes sure the evidence you have collected — statistics, reports, constitutional articles, quotes — is actually in your head on exam day, **and** that you know what to do with it inside an argument.

It is not a notes app and it does not write essays for you. FPSC examiners fail answers built from stock material, so the app trains and checks; it never hands you sentences to copy.

## Why it exists

Look at the numbers. About 85% of candidates pass the MCQ screening test. Then about 2.7% pass the written exam (476 of 17,351 in CSS 2026). Examiner reports say the same things every year:

- "crammed write up… stock of similar material, quotes and examples"
- "neither able to build an argument from multiple angles nor substantiated it with facts"
- "good in knowledge but lacked to apply in given situations"
- "fake, sub-standard and unverifiable data… may be treated as plagiarism"

So the app focuses on the two things those reports describe: remembering verified evidence, and using it in arguments.

## How a session works

1. Open the app. It tells you how many facts are due today and roughly how long it will take (default: 30 minutes).
2. Each fact comes back in a different form depending on how well you know it:
   - a multiple-choice question with near-miss options (e.g. last year's figure)
   - type the missing figure
   - state the fact from memory
   - say what the fact proves — and what it does **not** prove
   - name the evidence that supports an argument
   - rebuild a cause-and-effect chain in the right order
3. After answering, you say how sure you were: *Guessing / Think so / Sure*. The app decides whether you were right. If you were **sure and wrong**, that fact comes back within two days, because that kind of mistake fades fastest if not corrected.
4. Every answer ends with the fact, its source, what it proves, a caveat, a memory hook, the wrong claim it can rebut, and the facts it pairs with.

Facts are never marked "done". The gap between reviews grows as your memory strengthens, but with the exam on 27 January 2027 no gap is allowed to exceed 21 days, so everything you learn comes back in the final weeks.

## The evidence bank

- 591 facts, 30 argument chains and maps, 6 quotes, 14 past-paper questions.
- Every fact has a source and a year. Facts that still need a source check are flagged in the app — verify them before you cite them in the hall.
- The 150 facts that feed the most argument chains are **Tier 1**. The app starts with those. You can add Tier 2 and 3 in Settings when Tier 1 feels solid.
- Themes: Economy, Governance, Education, Health, Gender, Environment & Climate, Water & Food, Energy, Security, IR, Constitution & Law, Criminology, and more.

## What's in each version

**Version 1.0 — Recall Core (22 Sep 2026)**
- Evidence bank loaded from the workbook, with automatic checks and a validation report.
- Adaptive scheduling tied to the exam date.
- The six exercise forms above.
- Confidence buttons and the two-day return for confident mistakes.
- Daily limits: time budget, new-items cap, no new material while a backlog exists.
- Bank browser, Progress page (recall rate, confidence accuracy, coverage by theme, 7-day forecast), backup and restore.
- Import your own Excel sheet in the same format: new rows are marked "to learn", changed figures come back as "updated" cards.
- Works offline once opened; installable on a phone.

**Version 1.1 — Tier 1 content pass + in-app review (this version)**
- For each Tier 1 fact, an AI drafted the five things the workbook left blank: a **caveat** (what the figure does not prove), 2–3 **pairings** with other facts, a **memory hook** ("22.7% → four in five working-age women counted outside the labour force"), the **wrong claim** the fact rebuts, and a **model sentence** showing how the fact could sit inside a paragraph.
- The AI was given only the fact and other facts from the bank, and told not to invent figures. The review screen flags any figure in a draft that is not in the fact or its pairings, so you can see at a glance where it may have gone beyond the bank.
- A **Review** screen inside the Bank tab where a reviewer approves, edits or rejects each draft. Nothing reaches learners until it is approved.
- Approved content appears immediately in your own drills; it goes to everyone in the next release after the maintainer merges your decisions.

## Your role, Ahsan

You are the reviewer and the first real user. Two things:

**1. Review the Tier 1 drafts (Bank → Review).**
- Enter your name once; it is attached to every decision.
- For each fact: read the fact and its source, then the five drafted fields.
- **Approve** if it is accurate and you would use it in an answer.
- **Edit** any field and approve — your version wins. Fix wording, sharpen the hook, swap a pairing.
- **Reject** if the caveat is wrong, the claim is unsupported, or the pairing makes no sense. Add a note saying why.
- Skip what you are unsure about and come back.
- When you have done a batch, press **Download decisions** and send the file to Shaheryar. That is how your approvals reach the shared version.
- There are 150. Ten a day is plenty.

What to be strict about:
- **Accuracy.** If the draft cites a figure that is not in the fact or its pairings, and you cannot verify it, reject it. A yellow flag on the card lists such figures.
- **Overclaiming.** A caveat should say what the number does *not* prove, concretely, not "check the source".
- **Exam usefulness.** Would this help you write a better paragraph under time pressure? If not, edit or reject.

**2. Use the app for your own preparation, and tell us what is wrong with it.**
- Do a session most days.
- Note anything that feels wrong: a bad question, an unfair grading, a figure you believe is out of date, a form that wastes time, anything confusing.
- Send the notes with your review file, or message directly. Specific beats polite: "E235's MCQ options are all obviously wrong" is more useful than "MCQs could be better".

## What's next

- **1.2 — Argument Engine.** Question decoder (what is this question actually asking?), timed outline trainer, "deploy this fact in two sentences" drills, and an AI check with a rubric built from examiner reports. Past-paper dataset 2016–2026 tagged by theme.
- **1.3 — Exam Conditions.** 3-hour timed simulator, 20-mark answer evaluation, précis trainer, personal English error log.
- **1.4 — Public release.** Polished phone app, contribution guide, a release calendar so figures update when the Economic Survey, HDR, CPI and others come out.
- **Phase 2 — NEWS OS.** A news reader across Pakistan's English and Urdu papers that shows how each outlet framed an event, and feeds new evidence into the bank.

## Practical notes

- **Link:** https://shaheryarwarraich.github.io/css/ — open it in Chrome or Safari; on a phone, use "Add to Home Screen" to install it. Progress is stored in the browser you use, so stick to one device or use Settings → Backup to move it.
- **AI answer checking** is optional and works only when running the app locally with your own AI subscription. Everything else works without it.
- **Nothing is sent anywhere.** Your progress and review decisions stay on your device until you download and share the file.
