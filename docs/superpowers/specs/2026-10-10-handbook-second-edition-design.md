# NAMMES Hub Handbook — Second Edition Design

A second edition of *The NAMMES Hub Handbook* covering everything shipped since 30 September 2026, illustrated entirely by real captures of the live site.

**Status:** approved. **Date:** 2026-10-10. **Plan:** `docs/superpowers/plans/2026-10-10-handbook-second-edition.md`

---

## 1. The problem

The handbook's printed PDF is commit `594fcb6`, built 2026-09-30. Two separate gaps follow from that.

**The PDF is older than its own source.** Three later commits edited the handbook text and never rebuilt it — `f937b21` (sound lab), `d667b32` (per-effect switches, imported audio) and `688e0e9` (battle question count). Those changes are in `content-quiz.mjs` on disk and absent from the shipped document. A bare rebuild would already close this gap.

**Thirteen shipped features have no handbook text at all.** The academic calendar (public page, four admin tabs, email reminders), CBT practice, make-your-own-exam, community quizzes, result cards, question bank settings, backdrop controls, the offline screen, quitting practice part-way, the `/practice` listing page, forms focus mode, three more banner pages, and the five-group navigation.

Alongside both gaps sits a structural weakness: **the two quiz chapters and almost the entire admin guide contain no images.** Three mockups exist in the whole book, one of which illustrates a navigation bar that stopped existing on 2026-10-02.

---

## 2. Scope

### In

| Piece | What it is |
|---|---|
| Three new chapters | Academic Calendar (member), Practice Exams and Your Own Questions (member), Managing the Calendar (admin) |
| Ten existing chapters edited | Navigation, quizzes, admin quizzes, banners, forms, plus cross-links |
| Front matter | Second Edition line, as-of date, foreword, back cover |
| Appendices A, B, C | New routes, new glossary terms, new troubleshooting entries |
| `FIND_DEFAULTS` | The "Where Do I Find…?" contents page |
| Screenshot pipeline | Admin login mode, new routes, offline capture, one real bug in the cropper |
| Build toolchain | `pdftotext` → `pdf.js` |

### Out

- **The admin editor UI and the serverless rebuild path.** Working, unchanged.
- **New admin calendar features.** `76db4c3` (four tabs, one route) is documented as built.
- **`book.css` redesign.** New chapters use `helpers.mjs` as it stands.
- **The nine unreferenced screenshots.** Deleted unless a chapter genuinely needs one.

---

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Source of truth | Edit `content-*.mjs` | Admin overrides are per-account data, not repository content. `book-content.mjs:150-190` already makes repo text the default layer |
| Chapter placement | Insert logically, renumber 24 → 27 | The nav puts Calendar above Outlines and groups CBT under Practice. The book should read the way the site is organised. Old printouts carry stale numbers — accepted, and the edition line changes |
| CBT chapter shape | One member chapter, two halves | `/make` and `/cbt/make` are the same component. Splitting repeats the importer instructions |
| File placement | `content-academics.mjs` and `content-community.mjs` | Part-scoped files. Only `content-quiz.mjs` is separate, because it is spliced into two parts |
| Images | **Live captures only** | A drawn stand-in is a picture of something no member will ever see |
| Ch. 3's drawn navbar | **Deleted**, replaced by captures | It depicts a menu removed on 2026-10-02 |
| Admin images | Real captures via a scripted login | A throwaway account beats an illustration, and beats hand-typed screenshots |
| Personal data | Certain admin pages never photographed | The handbook is a public download. Member emails and contact messages must not end up in one |
| `pdftotext` | Replaced by `pdf.js` | Already a dependency; the recipe exists at `handbookBuild.js:207-211`; removes the last external binary from the build |
| Edition line | Second Edition · October 2026 | The book would otherwise claim to describe the site as of 30 September, which is now false |
| As-of date | 10 October 2026 | The date the screenshots are actually taken |

---

## 4. Chapter map

```
Part One · Start Here
  1  Welcome to NAMMES Hub
  2  Getting Started in Five Minutes
  3  Finding Your Way Around                       ← rewritten
  4  Your Account

Part Two · Academics
  5  The Academic Calendar                         ← NEW
  6  Course Outlines
  7  The Programme Curriculum
  8  The Timetable
  9  The CGPA Calculator
 10  Resources

Part Three · Community
 11  Events
 12  Department News
 13  Opportunities
 14  The Awards
 15  Forms
 16  Live Quizzes and Battles                       ← extended
 17  Practice Exams and Your Own Questions          ← NEW

Part Four · About NAMMES
 18  About, the Excos and Contact

Part Five · Admin Guide
 19  Before You Begin
 20  Managing the Site's Content                    ← banners 11 → 15
 21  Managing Academics
 22  Managing the Calendar                          ← NEW
 23  Building Forms                                 ← focus mode
 24  Running Live Quizzes                           ← +4 sections
 25  Running the Awards
 26  Talking to Members
 27  People, Security and the System

Appendices  A Quick Reference · B Glossary · C Questions and Troubleshooting
```

Chapters 3, 16 and 17 carry the most new images. Chapter 24 carries the most new text.

---

## 5. Per-chapter changes

**Ch. 2 Getting Started.** Mention the calendar and CBT practice in "what you can do here".

**Ch. 3 Finding Your Way Around.** The `figure class="mock"` navbar is deleted and replaced by real captures of the desktop bar and the phone menu. Prose rewritten for five groups — General, Academics, Community, Practice, Support — and for the phone menu's labelled cards with their icons.

**Ch. 5 The Academic Calendar (new).** Month and Agenda views, the Academic and Events source filters, the Next up strip, the "Dates to be announced" panel, `Ring today's date`, and the two different empty sentences the grid uses. Phones always open on Agenda regardless of the admin default, and the handbook should say so.

**Ch. 6 Course Outlines.** Cross-link the calendar for exam dates.

**Ch. 11 Events.** Departmental events now appear inside the calendar alongside senate dates.

**Ch. 14 Awards / Ch. 15 Forms.** Awards gained a page banner. Forms gained a bare fill-in mode.

**Ch. 16 Live Quizzes and Battles.** The `/practice` listing page; `Quit practice` and its second-tap confirmation; **result cards** — what they are, `Share my result` and `Share this duel`, and that the rank line only appears for a hosted game. Correct "you find all of them under Community", which is now the Practice group.

**Ch. 17 Practice Exams and Your Own Questions (new).** `/cbt`, the exam start page, the exam screen with its clock and navigator grid, results, study mode; then `/make`, `/cbt/make` and `/set/:code`. Two things a reader most needs to know: the clock is the server's and does not stop when the tab closes, and answers are never sent to the browser during a timed attempt.

**Ch. 20 Managing the Site's Content.** Page banners go from eleven pages to **fifteen** — Calendar, Awards, Quizzes and Forms join. Add the Zoom transition.

**Ch. 21 Managing Academics.** Pointer to the calendar chapter.

**Ch. 22 Managing the Calendar (new).** The four tabs and what each is for, the paste preview and its per-line warnings, the eight design swatches, session switching and archiving, and the email reminders including their lead time.

**Ch. 23 Building Forms.** `Hide the navbar while filling`, and that only the fill-in screen goes bare — closed, sign-in-required and already-answered screens keep the navbar, so there is always a way back.

**Ch. 24 Running Live Quizzes.** Four additions: **question bank** settings (Questions to ask, Questions per battle, both shuffles, the live summary line, and that a game freezes its draw at start); **backdrop** controls (My image, Fit, Strength, Size/Zoom, Blur, Fade back); the **Result card** studio tab and the `Result card` button on the host and the report; and the **Game menu** — End game now, Delete this game — including that ending keeps the report and deleting does not.

**Ch. 27 People, Security and the System.** The `calendar` key in `feature_flags` as an off switch.

### Appendices and front matter

Appendix A gains `/calendar`, `/quiz`, `/practice`, `/cbt`, `/cbt/make`, `/make`, `/set/:code` and two admin routes. Appendix B gains CBT, community quiz, exam paper, question bank, result card, senate date, feature flag. Appendix C gains the offline screen, the CBT clock, why a personal exam appears in no list, and a missing result card. `FIND_DEFAULTS` gains six entries.

`DEFAULT_EDITION` becomes Second Edition · October 2026 and `DEFAULT_AS_OF` becomes 10 October 2026. The foreword and back cover mention the calendar and CBT.

---

## 6. The capture contract

1. **Live only.** Every image is a capture of `https://www.nammeshub.com.ng`. No mockups, no redrawn screens, no invented states.
2. **No stale diagrams.** The drawn navbar is deleted rather than repaired.
3. **Signed in where the page requires it.** `cgpa` and `awards` currently show a sign-in prompt because they were captured logged out. Both are re-shot authenticated.
4. **Offline is a real capture.** Puppeteer's `setOfflineMode(true)`, not a drawing.
5. **One look.** Light theme forced via `localStorage`, as `capture-screens.mjs:10` already does.
6. **Unreachable means no image.** Where no script can produce the state, the section reads as text and the gap is reported, not filled.

### Never photographed

| Route | Why |
|---|---|
| `/admin/users` | Member email addresses |
| `/admin/messages` | Contact messages: name, address, message body |
| `/admin/reviews` | Pending edits attributed to members |
| `/admin/system` | Server errors and the activity log |
| `/admin/broadcasts` | Recipient lists |
| `/admin/submissions` | Student names and matric numbers |
| `/admin/forms/:id/responses` | Answered form submissions |

### Reviewed individually

`/admin/security`, `/admin/awards` (admin-only notes) and `/admin/quizzes/battles` (member-created content) are captured but reviewed before entering `screens/`. Anything carrying a member's name, email or matric number is redacted or dropped.

---

## 7. Build toolchain

`build.mjs:49` shells out to `pdftotext`, which is not installed here and is the only reason the handbook cannot be built from a clean checkout.

Replace it with `pdfjs-dist/legacy/build/pdf.mjs`, copying the recipe at `handbookBuild.js:207-211` — the legacy build with the worker imported explicitly, because the normal worker path is resolved at run time and cannot be seen by a bundler. `pageTexts()` becomes async. `pdfjs-dist@^6.3.289` is already a dependency (`package.json:30`), so nothing is added.

This also unifies page measurement. Today the local build measures with `pdftotext` and the serverless build measures with `pdf.js` (`handbookBuild.js:206-222`); two implementations of the same job can drift.

---

## 8. Publishing — read before shipping

- `public/documents/NAMMES-Hub-Handbook.pdf` is the **fallback only**. `useHandbookPdfUrl()` at `src/data/handbook.js:11-14` serves `site_content.handbook_pdf_url` whenever it is set. Publishing means: deploy, then Admin → Handbook → **Rebuild PDF**.
- **Saved admin overrides win.** `makeContext` layers `handbook_chapters` over the repository text, and any non-empty field replaces the default. If anyone edited a chapter in the browser, the new text never appears until they press **Restore original text**. Check this before publishing or the second edition silently ships as the first.
- Nine captured images are referenced nowhere and are deleted rather than left to rot.

---

## 9. What this cannot verify

Quiz audio, calendar rendering across the eight swatches in dark mode, and reminder delivery have not been seen in a live session and cannot be faked by a passing build. Neither can a live game's projector or a real CBT attempt. The handbook text is written from the code; where behaviour was never witnessed it is stated as the code states it, not as a verified fact.