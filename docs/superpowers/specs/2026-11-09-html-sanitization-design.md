# Sanitizing HTML Rendering Surfaces

Two product renderers inject HTML (`MathText` via KaTeX, `Character` via generated SVG) and CSP still
allows `'unsafe-inline'` styles — an XSS foothold in a student-facing app with 500+ aria-labeled surfaces.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| KaTeX config | `trust: false`, `strict: 'error'`, HTML-only output; reject `\href`, `\html…` |
| Character SVG | Prove all SVG is self-generated from internal props; assert no user input reaches markup |
| Audit | `grep -rn dangerouslySetInnerHTML` cataloged in `docs/security/html-surfaces.md`; each with verdict |
| CSP | Evaluate nonce-based `style-src`; if blocked by Tailwind v4 inline needs, document accepted risk |
| Test | Character/MathText render tests assert no `<script>`, no `on*=` attributes in output |

### Out

- **Removing HTML rendering.** Math typesetting is a feature; sanitize, don't delete.
- **Full CSP hardening.** Keep `style-src 'unsafe-inline'` only with written justification.

---

## 2. The problem

`dangerouslySetInnerHTML` count: **3** references — two in `src/` (`MathText.jsx`, `quiz/Character.jsx`) and one in `api/` (card/image render path). KaTeX with default trust settings will render `\url{javascript:…}`-class input if question text is ever sourced from a community submission. Quiz questions flow from admin-authored banks (trusted-ish), but outlines/past questions naming and user-generated content paths increase exposure.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| KaTeX | `katex.renderToString(src, { trust: false, strict: 'warn', throwOnError: false })` | Disables URL/HTML commands; renders unknown safely |
| Input gate | Strip/escape user-authored TeX at write time too (defense in depth) | Two cheap nets beat one |
| Character | Snapshot-test the SVG generator against a prop matrix; assert no raw interpolation of request data | If all props are enums, output is safe |
| Third surface | Inspect `api/` occurrence before merging this spec; same treatment | Every surface gets a verdict |
| CSP | Attempt `nonce-` styles; otherwise record why `'unsafe-inline'` remains | Honesty over compliance theater |

## 4. The change

Edit the three call-sites per above; add `src/components/quiz/__tests__/xss.test.jsx`; write `docs/security/html-surfaces.md` listing each surface, its data source, and its control; link from ADMIN.md security section.

## 5. Verification

1. New tests pass: `\htmlClass{…}`, `\href{javascript:alert(1)}`, `<img onerror>` all render inert.
2. `grep -rn dangerouslySetInnerHTML src api` → every remaining hit references the audit doc.
3. Staging XSS smoke (seed hostile question; open quiz play) → nothing executes.

## 6. Risk

`strict: 'error'` can break legacy question strings using iffy TeX — use `'warn'` first, log, tighten later. Removing `'unsafe-inline'` from `style-src` may break Tailwind/inline styles silently; verify with a full click-through before flipping.
