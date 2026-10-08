import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

// Regenerates api/_lib/quizCharacterMarkup.js from Character.jsx. The generator itself is the test that normally
// proves the two match, so this just runs that one file with the write turned on.
//
// A wrapper rather than `REGEN=1 vitest ...` because npm scripts run under cmd.exe on Windows and sh elsewhere,
// and neither accepts the other's env-var prefix.
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const child = spawn(
  process.execPath,
  [join(root, 'node_modules', 'vitest', 'vitest.mjs'), 'run', 'scripts/quizCharacterMarkup.test.js'],
  {
    cwd: root,
    stdio: 'inherit',
    env: { ...process.env, REGEN_CARD_CHARACTERS: '1' },
  },
)

child.on('exit', (code) => process.exit(code ?? 1))