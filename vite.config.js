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
