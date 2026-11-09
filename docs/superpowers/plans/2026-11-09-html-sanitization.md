# HTML Rendering Sanitization — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the three `dangerouslySetInnerHTML` surfaces incapable of executing markup, and document the CSP posture for inline styles.

**Architecture:** KaTeX renders with `trust:false` (kills `\href`/`\html…`), strict mode `warn`; the Character SVG generator gets snapshot tests proving output contains only internal enums → fixed markup; the third (API-side) surface is audited and fixed or verdict-documented. Tests lock the behavior.

**Tech Stack:** KaTeX (already a dep, `^0.18.10`), vitest, no new deps.

**Spec:** `docs/superpowers/specs/2026-11-09-html-sanitization-design.md`

## Global Constraints

- No removal of math rendering — sanitize, don't amputate.
- CSP `style-src 'unsafe-inline'` may remain **only** with a written justification in DESIGN_SYSTEM.md or the audit doc; everything else in CSP stays as-is.

---

## Task 1: Inventory (pass 1)

- [ ] `grep -rn dangerouslySetInnerHTML src api | tee docs/security/.raw-innerhtml.txt`
- [ ] For each hit, record: file, data source (user/admin/internal), verdict (fix/safe/remove), in `docs/security/html-surfaces.md`.
- [ ] Commit the inventory doc (it is the audit artifact).

## Task 2: MathText

**Files:** Modify `src/components/quiz/MathText.jsx`; Create `src/components/quiz/MathText.test.jsx`

- [ ] Find the KaTeX call; change options to:

```js
katex.renderToString(tex, {
  trust: false,          // no \href, \htmlClass, \htmlId, \htmlStyle
  strict: 'warn',        // log weird-but-legal TeX instead of throwing
  throwOnError: false,   // render error inline, never crash the page
  output: 'html',
});
```

- [ ] Tests: render `\htmlClass{evil}{x}`, `\href{javascript:alert(1)}{y}`, `<img src=x onerror=alert(1)>`, `\frac{1}{2}` → assert output contains no `href="javascript:`, no `<img`, and the fraction renders.
- [ ] Also clamp input length (`tex.slice(0, 2000)`) — defense in depth.

## Task 3: Character SVG

**Files:** Modify `api/_lib/quizCharacterArt.js` (server) or `src/components/quiz/Character.jsx` (client) — audit doc says which renders `dangerouslySetInnerHTML`; snapshot both paths.

- [ ] Add a snapshot test that feeds every enum combination (mood × cast member) and asserts: no `<script`, no ` on[a-z]+=`, no `<foreignObject`, stable markup shape.
- [ ] If any prop path interpolates request/user data into markup → route it through `escapeHtml` (or better, drop it); re-run snapshots.

## Task 4: Third surface (API card rendering)

- [ ] Identify it from the inventory; apply the same treatment (trust-disabled renderer, or escape + verdict).
- [ ] If it is `quiz-card.js`/`award-card.js` inline HTML for PNG capture: inputs are already internal (enums from DB rows written by admins) — document as *internal-trusted* with a comment at the site; add the test anyway.

## Task 5: CSP note + final grep

- [ ] Attempt nonce-based `style-src`: build, check Tailwind v4 emits no inline `style=` attributes that break; if anything breaks or it's inconclusive in a day, revert and record: "`style-src 'unsafe-inline'` retained because Tailwind v4 + KaTeX emit inline styles; acceptable because script-src is strict." — in `docs/security/html-surfaces.md`.
- [ ] `grep -rn dangerouslySetInnerHTML src api` — every hit now references the audit doc in a comment.
- [ ] `npm test`, `npm run lint`, `npm run build`.

## Rollback

KaTeX options revert in one commit; snapshot tests guard the SVG path.
