# Test Isolation: Worktrees Design

`npm test` at the repository root also discovers tests inside `.claude/worktrees/**`, which are separate git
worktrees of this same project. A stale one makes the suite fail on a file that has nothing to do with the working
tree, so "all tests pass" is no longer something a full run can tell you.

**Status:** draft. **Date:** 2026-10-17. **Plan:** none yet.

---

## 1. Scope

### In

| Piece | What it is |
|---|---|
| `vite.config.js` | A `test.exclude` entry for `.claude/`, layered on Vitest's defaults |
| Verification | The same full run, before and after, compared by file count and failure list |

### Out

- **Deleting `.claude/worktrees`.** They may hold unmerged work, and a tool deleting another tool's scratch space is
  how a branch disappears.
- **A `.gitignore` change.** `.claude/` is already ignored by git; Vitest does not read `.gitignore`. This is the gap.
- **Moving or renaming tests.** No test belongs under `.claude`; there is nothing to move.
- **Changing the test environment.** Vitest runs on defaults (`node`); this change must not alter that.

---

## 2. The problem

`vitest run` with no config walks the project and applies its default `exclude` (`node_modules`, `dist`, `.idea`,
`.git`, and so on). `.claude` is not in that list.

Worktrees are full checkouts. When one is behind, its tests run against **their own** copy of `src/` and **this**
checkout's `supabase/migrations/`, because a test that reads a relative path resolves it against the file that
imported it. A migration that exists in the main checkout but not in the stale worktree's test fixture — or the
reverse — fails with `ENOENT`, on a file the current branch's author never touched.

Observed on 2026-10-17: `.claude/worktrees/admin-notifications/src/lib/adminInbox.test.js` fails twice reading
`supabase/migrations/20261017120000_admin_inbox.sql`. The main checkout has no such migration; the worktree's test
expects one. `npm test` reports 2 failed / 5589 passed, and the two are unrelated to the branch.

---

## 3. Decisions

| Decision | Choice | Why |
|---|---|---|
| Where the rule lives | `vite.config.js`, not the npm script | `npx vitest run` must behave the same as `npm test`; a flag in one script is bypassed by the next person who types the binary |
| How the default is preserved | Spread `configDefaults.exclude` | Assigning a fresh array silently re-includes `node_modules`, which is slower and can match duplicate React copies |
| Pattern | `'**/.claude/**'` | Matches the directory at any depth, so a nested checkout's worktree is excluded too |
| Config helper | `defineConfig` from `vitest/config` | The `test` key is then typed by the package that owns it; the Vite export ignores it at build time either way |

---

## 4. The change

```js
import { defineConfig, configDefaults } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    // `.claude/worktrees/*` are full checkouts of this repo. A stale one contributes its own tests, which resolve
    // paths against this tree and fail on migrations that only exist on one side -- see the design note in
    // docs/superpowers/specs/2026-10-17-test-isolation-design.md.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
})
```

No other key moves. `environment` stays unset, which is Vitest's `node` default and what the current 373 files
already run under.

---

## 5. Verification

1. `npm test` before the change: record the file/test counts and the failure names.
2. `npm test` after: the failures are gone and the file count drops by exactly the number of test files under
   `.claude`.
3. Confirm no project test is lost: diff the list of test file paths Vitest reports, not just the totals.
4. `npm run lint` and `npm run build` — neither reads `test.exclude`, but the config file is shared, so both are run
   to prove the import change is inert at build time.
5. `npm run dev` — Vitest config keys are ignored by the dev server; the check is that it starts.

Command outputs must be read with their exit status, not through `| tail`, or a failing run can look like a passing
one.

---

## 6. Risk

The only real one: a future test written **inside** a worktree is now invisible to the root run. That is the intended
behaviour — a worktree runs its own `npm test` — and the alternative is a suite whose result depends on someone
else's checkout. If a worktree's tests ever need to run from the root, they are in the wrong place.
