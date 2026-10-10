# Handbook Second Edition — what I need before I start

**Date:** 2026-10-10 · **Spec:** `../specs/2026-10-10-handbook-second-edition-design.md` · **Plan:** `2026-10-10-handbook-second-edition.md`

Three things: two lines of environment, three screenshots nobody but you can take, and two answers.

---

## 1. Two lines in `.env.local`

Open `.env.local` in the repo root and paste these at the end. Fill in the blanks — do not paste the password anywhere else, and never into chat.

```
HANDBOOK_ADMIN_EMAIL=your-admin-address@example.com
HANDBOOK_ADMIN_PASSWORD=the-password
```

The file is ignored by `.gitignore:30` (`.env*`), so nothing in it can be committed. I read it at run time and never echo it into output, a log or a diff.

**The account needs:**

| Requirement | Why |
|---|---|
| The `admin` role | Every admin screenshot |
| **No authenticator app enrolled** | `AdminRoute.jsx:31` raises `MfaChallenge` at `aal1`. With MFA on, the capture photographs a six-digit code box instead of the page |
| A distinct address you don't mind deleting | It appears in `/admin/users` and in the System activity log. Delete it when we finish |

Keep it `admin`, not `owner`. Part Five distinguishes the two from Ch. 19 onward, and an `admin`-role view — where the calendar Session tab's owner-only **Set active session** button reads disabled — is the truthful picture for that audience.

> The Supabase keys are already in `.env` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`), so the script will read both files. Nothing else needs adding.

---

## 2. Three screenshots

No script can produce these. Drop them as **PNG files** in:

```
scripts/manual/out/drop/
```

That folder is gitignored, so nothing lands in the repository by accident.

### ① `cbt-exam.png` — the CBT exam screen

1. Go to `nammeshub.com.ng/cbt` and open any published exam
2. Press **Start exam**
3. Answer two or three questions
4. **Flag for review** one question — this makes the navigator show all three states at once, which is the entire point of the picture
5. Capture the full viewport at 1280×860 in light theme: the countdown clock, one question, the Previous / Flag for review / Clear answer / Next row, and the navigator grid with its Answered / Not answered / Flagged legend
6. Submit afterwards, so no half-finished attempt is left dangling

### ② Four shots from one live game — solo is fine

You do not need an event. Host a game yourself with **test bots** and join as a player on your phone.

1. Admin → Live Quiz → **Host** on any quiz with questions
2. In the lobby, add test bots
3. Open `nammeshub.com.ng/play` on your phone and join

Then capture:

| File | What |
|---|---|
| `quiz-lobby.png` | The projector lobby: six-digit code, QR code, arriving players |
| `quiz-projector.png` | A question with the countdown running |
| `quiz-phone.png` | Your phone showing **only the answer buttons** |
| `quiz-podium.png` | The finished screen |

The projector and phone shots are a pair, and it is the image the quiz chapter has always lacked — the text says *"your phone shows only the answer buttons, so look up to read the question and tap down to answer"*, and this is that, shown.

**Join with a neutral nickname such as `Player One`.** The result card carries the nickname and the score, and that card goes into a PDF anyone can download.

### ③ Two files from that same finished game

On the podium, press **Share my result**, then save both:

| File | What |
|---|---|
| `result-card-modal.png` | The modal, with the card and the Share and Save buttons |
| `result-card.png` | The card itself, 1080×1920 — right-click → Save image as |

The raw card is the artifact; the modal is the interface. I want both.

---

## 3. Two answers

1. **Are `/practice` and `/cbt` showing real content, or empty states?**
   If empty, those chapters carry no image and the section reads as text. Not blocking — the capture run reveals it either way — but knowing in advance avoids a surprise.

2. **Could you not get a game hosted?**
   Then say so and I mock only that one. Everything else stays a real capture.

---

## 4. What I do first

1. **Smoke test** — sign in with the account above, load `/admin`, confirm it is neither the login page nor an MFA prompt. Thirty seconds; catches a typo before a fifteen-minute run rather than after.
2. **Task 1** — swap `pdftotext` for `pdf.js` in `build.mjs`.
3. **Tasks 2–4** — capture, crop, review, curate.
4. **Tasks 5–8** — write the chapters.
5. **Task 9** — build, verify, report.

Each task ends with `npm test && npm run lint && npm run build` at exit 0.

---

## 5. What only you can do at the end

Two things, and the second one is the one that catches people:

- **Publish.** The committed PDF in `public/documents/` is the fallback only. `src/data/handbook.js:11-14` serves `site_content.handbook_pdf_url` when it is set. After deploying, press **Rebuild PDF** in Admin → Handbook.
- **Check for saved overrides.** `makeContext` layers `handbook_chapters` over the repository text, and any non-empty field wins. If anyone has edited a chapter in the browser, the new text will not appear until they press **Restore original text**. Skip this and the second edition silently ships as the first.

Delete the throwaway admin account once the captures are in.