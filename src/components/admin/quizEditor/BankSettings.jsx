import { useMemo } from 'react'
import { cleanDrawSettings, DRAW_MAX_QUESTIONS } from '../../../../api/_lib/quizDraw.js'

// How many questions a battle may hold. A battle is two people answering at their own pace, so it stays much shorter than
// a hosted game even though both draw from the same bank.
export const BATTLE_DRAW_MAX = 50

// A quiz made before question banks keeps playing every question in order with its answers as written, so these are the
// defaults for a *new* quiz only. An older quiz arrives with null settings and is left alone.
export const NEW_BANK_SETTINGS = { drawCount: '', shuffleQuestions: true, shuffleOptions: true }

function blankToSettings(row) {
  const s = row?.draw_settings ?? {}
  return {
    drawCount: s.draw_count == null || s.draw_count === '' ? '' : String(s.draw_count),
    shuffleQuestions: s.shuffle_questions === true,
    shuffleOptions: s.shuffle_options === true,
  }
}

// The bank settings to save, shaped for saveQuiz. `bankSize` is how many questions the quiz holds, so the count can be
// clamped to what actually exists rather than trusting the number box.
//
// Deliberately camelCase, matching every other argument saveQuiz takes: saveQuiz owns the mapping to the column names,
// alongside every other column it writes.
export function saveBankSettings(settings, bankSize) {
  const clean = cleanDrawSettings(
    { draw_count: settings.drawCount === '' ? null : settings.drawCount, shuffle_questions: settings.shuffleQuestions, shuffle_options: settings.shuffleOptions },
    bankSize,
  )
  return {
    drawSettings: {
      draw_count: clean.drawCount,
      shuffle_questions: clean.shuffleQuestions,
      shuffle_options: clean.shuffleOptions,
    },
    // Blank means "a battle uses the same number as the game", which the server reads as null.
    battleQuestionCount: settings.battleQuestionCount === '' || settings.battleQuestionCount == null
      ? null
      : Math.min(BATTLE_DRAW_MAX, Math.max(1, Math.round(Number(settings.battleQuestionCount) || 0) || 1)),
  }
}

// What the admin will actually get, as a sentence: "This game will ask 15 of 30 questions."
export function describeBank(settings, bankSize) {
  const clean = cleanDrawSettings(
    { draw_count: settings.drawCount === '' ? null : settings.drawCount },
    bankSize,
  )
  if (bankSize === 0) return 'Add some questions first, then choose how many to ask.'
  const asked = clean.questionsPerGame
  if (asked >= bankSize) {
    return `This game will ask all ${bankSize} question${bankSize === 1 ? '' : 's'}.`
  }
  const battle = Number(settings.battleQuestionCount)
  const battleCount = settings.battleQuestionCount === '' || !Number.isFinite(battle) ? asked : Math.min(BATTLE_DRAW_MAX, battle)
  return `This game will ask ${asked} of ${bankSize} questions. A battle will ask ${battleCount}.`
}

const ROWS = [
  {
    key: 'shuffleQuestions',
    label: 'Shuffle the questions',
    hint: 'Players get a different mix each time, so nobody can memorise question 3.',
  },
  {
    key: 'shuffleOptions',
    label: 'Shuffle the answers',
    hint: 'The answers to each question move around, so position stops giving it away. Questions like "All of the above" are never shuffled.',
  },
]

export default function BankSettings({ settings, onChange, questionCount }) {
  const save = useMemo(() => saveBankSettings(settings, questionCount), [settings, questionCount])
  const set = (patch) => onChange({ ...settings, ...patch })
  const wantsDraw = settings.drawCount !== ''

  return (
    <fieldset className="rounded-lg border border-hairline bg-surface p-4">
      <legend className="px-1 text-sm font-bold text-ink-900">Question bank</legend>
      <p className="mb-3 text-sm text-ink-muted">
        Every question in this quiz is the bank. Below you choose how many a game asks from it.
      </p>

      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Questions to ask
          <input
            type="number"
            min={1}
            max={Math.min(DRAW_MAX_QUESTIONS, Math.max(1, questionCount))}
            step={1}
            value={settings.drawCount}
            onChange={(e) => set({ drawCount: e.target.value })}
            placeholder={questionCount > 0 ? `All ${questionCount}` : 'All'}
            className="min-h-11 rounded-md border border-hairline bg-paper px-3 py-2 text-base font-normal"
          />
          <span className="text-sm font-normal text-ink-muted">
            Leave this blank to ask every question. Set a number to draw a different mix each time you host.
          </span>
        </label>

        {wantsDraw && (
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Questions per battle
            <input
              type="number"
              min={1}
              max={BATTLE_DRAW_MAX}
              step={1}
              value={settings.battleQuestionCount}
              onChange={(e) => set({ battleQuestionCount: e.target.value })}
              placeholder={String(save.battle_question_count ?? '') || String(save.draw_settings.draw_count ?? '') || 'Same as above'}
              className="min-h-11 rounded-md border border-hairline bg-paper px-3 py-2 text-base font-normal"
            />
            <span className="text-sm font-normal text-ink-muted">
              A battle is two people at their own pace, so it is usually shorter. Leave blank to use the same number as the game.
            </span>
          </label>
        )}

        {ROWS.map((r) => (
          <label key={r.key} className="flex cursor-pointer items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 h-5 w-5"
              checked={settings[r.key]}
              onChange={(e) => set({ [r.key]: e.target.checked })}
            />
            <span>
              <span className="block font-semibold text-ink-900">{r.label}</span>
              <span className="block text-sm text-ink-muted">{r.hint}</span>
            </span>
          </label>
        ))}

        <p className="text-sm font-semibold text-brand-orange">{describeBank(settings, questionCount)}</p>
      </div>
    </fieldset>
  )
}

export { blankToSettings as bankSettingsFromRow }