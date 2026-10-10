# NAMMES Hub Handbook Second Edition Implementation Plan

> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A second edition of *The NAMMES Hub Handbook* covering everything shipped since 30 September 2026, illustrated entirely by real captures of the live site.

**Architecture:** Text lives in `scripts/manual/content-*.mjs` as HTML strings and prints through `build.mjs`. Images are captured from production by `capture-screens.mjs` — which gains a scripted admin login — cropped by `prep-screens.mjs`, and written to `screens/`. No new runtime dependency: `pdfjs-dist` replaces the `pdftotext` binary.

**Tech Stack:** Node, Puppeteer Core (headless Edge), `@napi-rs/canvas`, `pdfjs-dist`, Supabase auth REST.

**Spec:** `docs/superpowers/specs/2026-10-10-handbook-second-edition-design.md`

---

## File map

| File | Change |
|---|---|
| `scripts/manual/build.mjs` | `pageTexts()` → `pdf.js` |
| `scripts/manual/capture-screens.mjs` | login mode, new public routes, admin routes, offline |
| `scripts/manual/prep-screens.mjs` | `NO_CROP` fix, admin redaction review |
| `scripts/manual/content-start.mjs` | Ch. 2 cross-links, Ch. 3 rewrite |
| `scripts/manual/content-academics.mjs` | new Ch. 5, Ch. 6 cross-link |
| `scripts/manual/content-community.mjs` | new Ch. 17, Ch. 11 and Ch. 15 cross-links |
| `scripts/manual/content-quiz.mjs` | Ch. 16 and Ch. 24 additions |
| `scripts/manual/content-admin.mjs` | new Ch. 22, Ch. 20 banners, Ch. 21 cross-link, Ch. 23 focus mode, renumber |
| `scripts/manual/book-content.mjs` | `FIND_DEFAULTS`, edition, as-of, foreword, back cover |
| `scripts/manual/screens/` | re-captured and new images |
| `scripts/manual/README.md` | capture modes, admin login, the no-mockup rule |
| `package.json` | `manual:build`, `manual:capture`, `manual:prep` |
| `.env.example` | `HANDBOOK_ADMIN_EMAIL`, `HANDBOOK_ADMIN_PASSWORD` (blank) |

---

## Gates

`npm test && npm run lint && npm run build` must exit 0 at the end of every task.

There is no separate typecheck and no separate vitest config; Vitest runs on defaults. TypeScript is not used in this project.

---

### Task 1 — Page measurement without poppler

`build.mjs:49` shells out to `pdftotext`, which is not installed. This is the only reason the handbook cannot be built from a clean checkout.

- [ ] Read `.env` and `.env.local` into `process.env` in the capture script. The Supabase keys are in `.env`; the admin keys go in `.env.local`. Both are ignored by `.gitignore:30` (`.env*`)
- [ ] Replace `pdftotext` in `pageTexts()` with `pdfjs-dist/legacy/build/pdf.mjs`, mirroring `handbookBuild.js:207-211` — the legacy build, worker imported explicitly
- [ ] Make `pageTexts()` async; update its three call sites in `main()`
- [ ] Confirm no `pdftotext` string remains anywhere in the repo
- [ ] Gate: `node scripts/manual/build.mjs` prints a PDF, TOC page numbers increase through the book, and the reported total matches the PDF

### Task 2 — Capture script: login, routes, offline

- [ ] Add `HANDBOOK_ADMIN_EMAIL` and `HANDBOOK_ADMIN_PASSWORD` to `.env.example` as blank placeholders
- [ ] Sign in by calling Supabase's auth endpoint directly and writing the session to `localStorage`. **Not** through the sign-in form — `Login.jsx:161` renders a Turnstile challenge, and `VITE_TURNSTILE_SITE_KEY` is filled on production, so a headless browser will not pass it
- [ ] Assert the account has no MFA enrolled. `AdminRoute.jsx:31` raises `MfaChallenge` at `aal1`, and the capture would photograph a six-digit code box
- [ ] Smoke test before the full run: sign in, load `/admin`, confirm the result is not the login page and not an MFA prompt. Thirty seconds, and it catches a typo before a fifteen-minute run
- [ ] Add public routes: `/calendar`, `/cbt`, `/quiz`, `/practice`, `/make`, `/cbt/make`
- [ ] Add phone routes: `/calendar`, `/cbt`. The calendar has no view URL parameter, so the desktop Agenda shot is taken by clicking the **Agenda** toggle; the phone capture opens on Agenda by itself
- [ ] Scrape a live exam code off `/cbt` for the `cbt-start` shot
- [ ] Add `/admin` and the permitted admin routes from spec §6
- [ ] Capture the offline screen with `setOfflineMode(true)`
- [ ] Add `manual:build`, `manual:capture` and `manual:prep` scripts to `package.json`

### Task 3 — Cropper fixes

- [ ] Add `offline` to `NO_CROP` (`prep-screens.mjs:13`). Its background is brand green `rgb(11,36,23)` — the exact colour `isFooterGreen` probes for. Unfixed, the cropper walks the whole image and cuts it to 300px of nothing
- [ ] Add `result-card` and `result-card-modal` to `NO_CROP` for the same reason: a green result card can trigger the same probe
- [ ] Confirm `/practice`, `/quiz`, `/make` and `/cbt` are not cropped — they are full-screen layouts with no footer
- [ ] Review every admin capture for member names, emails and matric numbers before it enters `screens/`
- [ ] Delete the nine unreferenced images: `about`, `forms`, `forgot`, `timetable`, `outlines`, `news-detail`, `resources-level`, `m-home`, `m-outlines`

### Task 4 — Capture and curate

- [ ] Capture into `scripts/manual/out/raw/` — gitignored, so nothing lands in the repo by accident
- [ ] Review every image against the contract in spec §6
- [ ] Apply the drop files supplied by hand (CBT exam, live game, result card) through `prep-screens.mjs`
- [ ] Write the keepers into `screens/`

### Task 5 — New member chapters

- [ ] Ch. 5 The Academic Calendar in `content-academics.mjs`, with `shot('calendar')`, `shot('calendar-agenda')` and `shot('m-calendar', …, { phone: true })`
- [ ] Ch. 17 Practice Exams and Your Own Questions in `content-community.mjs`, wired beside the existing quiz splice point
- [ ] Ch. 3: delete the `figure class="mock"` navbar, insert `shot('home-nav')` and the re-shot `m-menu`, rewrite the prose for five groups

### Task 6 — New admin chapter

- [ ] Ch. 22 Managing the Calendar in `content-admin.mjs`
- [ ] Four tab screenshots: `admin-calendar-dates`, `-paste`, `-design`, `-session`

### Task 7 — Existing chapter edits

- [ ] Ch. 16: `/practice` listing, quit part-way, result cards, and the Community → Practice correction
- [ ] Ch. 24: question bank, backdrop controls, result card tab and buttons, Game menu
- [ ] Ch. 20: eleven → fifteen banner pages, add the Zoom transition
- [ ] Ch. 23: `Hide the navbar while filling`
- [ ] Ch. 27: the `calendar` feature flag
- [ ] Cross-links in Ch. 2, 6, 11, 15, 21
- [ ] Renumber every chapter and appendix

### Task 8 — Front matter and appendices

- [ ] `DEFAULT_EDITION` → Second Edition · October 2026; `DEFAULT_AS_OF` → 10 October 2026
- [ ] Foreword and back cover mention the calendar and CBT
- [ ] `FIND_DEFAULTS` +6 · App. A +9 routes · App. B +7 terms · App. C +4 entries
- [ ] Update `scripts/manual/README.md` with the capture modes, the admin login and the no-mockup rule

### Task 9 — Build and report

- [ ] Gate: `npm test && npm run lint && npm run build`
- [ ] `node scripts/manual/build.mjs`; read the TOC numbers off the PDF
- [ ] Report: images that were redacted or dropped, the three no-script captures and whether they arrived, and the spec §8 publishing steps that need a Supabase login