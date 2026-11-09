# Input Validation with Zod

API handlers hand-validate (or trust) request bodies — zero `zod` usage exists (`grep -rl zod` → none),
so malformed payloads fail deep in handler code with 500s instead of a clean 400 at the boundary.

**Status:** draft. **Date:** 2026-11-09. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| Schemas | `api/_lib/schemas/` — one zod schema per public/mutation endpoint, colocated |
| Boundary | `validate(schema)(handler)` wrapper: parse → 400 with first error message, or proceed |
| Rollout | Phase 1: public POST endpoints; Phase 2: authenticated mutations; Phase 3: admin actions |
| Client parity | `zod` already a transitive dep; import in `src/` for form pre-validation where cheap |

### Out

- **Validating GET query strings exhaustively.** Only where unbounded (`page`, `pageSize` — via `listQuery`).
- **A shared schema package published to npm.** In-repo only.

---

## 2. The problem

`submit-public.js`, quiz cast/submit, forms, webhook handlers parse bodies ad hoc. A missing field throws a TypeError → 500 → Sentry noise → student-facing "something went wrong". Worse, a crafted but plausible payload (huge strings, wrong types) travels to Postgres before constraint checks catch it.

FYpro-v2 ships `zod@^4` for exactly this; the pattern is proven in-house.

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Library | `zod` v4 (add dependency) | Team familiarity; matches sibling project |
| Error shape | 400 `{ error: "<first issue message>" }` | UI toasts need one sentence, not an issue tree |
| Wrapper | `withValidatedBody(schema, handler)` in `api/_lib/validate.js` | One line per endpoint; no per-handler boilerplate |
| Limits | `z.string().max(2000)` everywhere; numbers `int().min(0)` | Kills the giant-payload class |
| Tests | Each schema gets 2 tests: valid passes, one invalid shape rejects | Schemas are code; they get tested |

## 4. The change

`npm i zod`; `api/_lib/validate.js` + `api/_lib/schemas/*.js`; wrap the Phase 1 handlers; CI gate unchanged (tests prove it). Example:

```js
const ContactSchema = z.object({ name: z.string().trim().min(1).max(120),
  email: z.string().email().max(200), message: z.string().trim().min(10).max(4000) });
export default withValidatedBody(ContactSchema, async (req, res, body) => { … });
```

## 5. Verification

1. `npm test` green incl. new schema tests.
2. Fuzz: `curl` with missing/extra/oversized fields → 400, not 500; one Sentry-free day after deploy.
3. Coverage: `grep -L withValidatedBody` lists unwrapped public POST handlers — burn down to 0.

## 6. Risk

Double validation (client + server) drifts — acceptable; server is authoritative, client validation is UX only. Webhook payloads (Resend, Paystack-style) must keep HMAC verification **before** schema validation of the unverified body is trusted — order matters; verify signature first, then parse.
