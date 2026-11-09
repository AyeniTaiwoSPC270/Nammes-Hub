# Input Validation with Zod — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Every mutating endpoint rejects malformed bodies with 400 + one-sentence error — before any handler code runs.

**Architecture:** `api/_lib/validate.js` exports `withValidatedBody(schema, handler)` — parse, on failure `400 { error }` with the first issue message, else call handler with the parsed body. Schemas live in `api/_lib/schemas/*.js`. Rollout in three phases; Phase 1 covers the public write paths first.

**Tech Stack:** `zod` v4 (new dependency), existing handlers, vitest.

**Spec:** `docs/superpowers/specs/2026-11-09-input-validation-zod-design.md`

## Global Constraints

- Webhook-style HMAC verification happens **before** schema validation of any body.
- Error shape is exactly `{ error: string }` — the UI toasts one sentence; never an issues array.
- Keep messages human: zod's `message` fields are hand-written (`"Tell us your name."`), not default prose.
- `_lib` + handlers only; no new `api/` top-level files.

---

## Task 1: Install + wrapper

- [ ] `npm install zod`
- [ ] **Files:** Create `api/_lib/validate.js`:

```js
export const withValidatedBody = (schema, handler) => async (req, res) => {
  const parsed = schema.safeParse(req.body ?? {});
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return res.status(400).json({ error: first?.message ?? 'Invalid request.' });
  }
  return handler(req, res, parsed.data);
};
// withQuery(schema, handler) — same contract for req.query, page/pageSize enforced (used by pagination plan)
```

- [ ] Commit.

## Task 2: Phase 1 — public writes

**Files:** Create `api/_lib/schemas/{contact,submit-public,quiz-join,quiz-cast,quiz-submit,award-vote,form-submit}.js`

- [ ] `contact.js`: `{ name: z.string().trim().min(1,'Tell us your name.').max(120), email: z.string().email('That email does not look right.').max(200), message: z.string().trim().min(10,'Write at least a sentence.').max(4000) }`.
- [ ] `quiz-join.js`: `{ code: z.string().trim().regex(/^[A-Za-z0-9]{4,8}$/, 'Quiz codes are 4–8 letters or digits.'), nickname: z.string().trim().min(1).max(40) }`.
- [ ] `quiz-cast.js`: `{ sessionId: z.string().uuid(), questionId: z.string().uuid(), optionIndex: z.number().int().min(0).max(9) }` (adjust to the handler's actual payload — read it first).
- [ ] `quiz-submit.js`: mirror cast + `answerText: z.string().max(500).optional()`.
- [ ] `award-vote.js`, `form-submit.js`, `submit-public.js`: read each handler, transcribe its true contract into a schema (grep the property accesses).
- [ ] Wrap each handler module's default export. Quiz handlers are dispatched from `api/quiz.js` → wrap the inner handler functions in `api/_lib/handlers/`, not the dispatcher.
- [ ] Tests per schema: happy path + one invalid (missing field). Vitest runs TS-free JS fine.
- [ ] Commit per schema group.

## Task 3: Phase 2 — authenticated mutations

- [ ] `account.js` actions (`disable-user`, `delete-user`, `anonymise-user`): schema `{ }` body optional; mainly **query** validation via `withQuery`.
- [ ] `bookmark`/`submission-review` actions if present — transcribe contracts the same way.

## Task 4: Phase 3 — admin mutations

- [ ] Broadcast send (`send-broadcast.js`), banner/content config actions in `api/system.js` handlers, feature-flag flips: transcribe + wrap. Flag flips: `{ key: z.string().max(80), value: z.boolean() }`.

## Task 5: Burn-down gate

- [ ] `grep -rL withValidatedBody api --include='*.js' | grep -v '_lib\|test'` → every remaining file either wraps or has a comment justifying (GET-only handlers).
- [ ] `npm test`, `npm run lint`, `npm run build`; staging fuzz:
  `curl -s -X POST $STAGING/api/submit-public -H 'content-type: application/json' -d '{}'` → `{"error":"…"}` 400.
- [ ] ADMIN.md: "400 errors now mean *your* input was rejected with a specific reason" — copy for support.

## Rollback

Revert the wrapper commits; handlers regain hand-validation behavior. Schemas can stay in tree unused.
