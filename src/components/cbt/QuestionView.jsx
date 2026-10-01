import MathText from '../quiz/MathText'

// One question on the exam screen: the text, then either answer buttons or a box to type in.
// `feedback` (study mode only) marks the right and wrong answers once the student has checked.
const LETTERS = ['A', 'B', 'C', 'D']

export default function QuestionView({ question, index, total, answer, onAnswer, feedback, onCheck, checking }) {
  const locked = Boolean(feedback)
  const isChoice = question.type === 'multiple' || question.type === 'truefalse'

  return (
    <section aria-labelledby={`q-${question.id}`} className="flex flex-col gap-5 rounded-2xl border border-hairline bg-surface p-5 shadow-sm sm:p-7">
      <div className="text-sm font-semibold text-ink-muted">Question {index + 1} of {total}</div>
      <h2 id={`q-${question.id}`} className="text-xl font-semibold leading-snug text-ink-900 sm:text-2xl">
        <MathText>{question.text}</MathText>
      </h2>

      {isChoice ? (
        <div role="radiogroup" aria-labelledby={`q-${question.id}`} className="flex flex-col gap-3">
          {question.options.map((option, i) => {
            const chosen = answer?.choice === i
            const isRight = feedback && feedback.correctIndex === i
            const isWrong = feedback && chosen && !feedback.correct
            const tone = isRight
              ? 'border-green-600 bg-green-600/10'
              : isWrong
                ? 'border-red-600 bg-red-600/10'
                : chosen
                  ? 'border-orange-500 bg-orange-500/10'
                  : 'border-hairline bg-paper hover:border-ink-muted'
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={chosen}
                disabled={locked || checking}
                onClick={() => onAnswer({ choice: i })}
                className={`flex min-h-14 items-center gap-3 rounded-xl border-2 px-4 py-3 text-left text-lg ${tone} disabled:cursor-default`}
              >
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-bold ${chosen ? 'border-orange-500 bg-orange-500 text-white' : 'border-hairline text-ink-muted'}`}>{LETTERS[i]}</span>
                <span className="min-w-0 flex-1"><MathText>{option}</MathText></span>
                {isRight && <span className="material-symbols-outlined text-green-600" aria-label="Correct answer">check_circle</span>}
                {isWrong && <span className="material-symbols-outlined text-red-600" aria-label="Your answer, wrong">cancel</span>}
              </button>
            )
          })}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <label className="flex flex-col gap-2">
            <span className="text-sm font-semibold text-ink-muted">{question.type === 'numeric' ? 'Type a number' : 'Type your answer'}</span>
            <input
              value={answer?.text ?? ''}
              onChange={(e) => onAnswer({ text: e.target.value })}
              maxLength={40}
              inputMode={question.type === 'numeric' ? 'decimal' : 'text'}
              autoComplete="off"
              autoCapitalize="off"
              spellCheck={false}
              disabled={locked || checking}
              className="min-h-14 rounded-xl border-2 border-hairline bg-paper px-4 text-lg text-ink-900 focus:border-orange-500 focus:outline-none disabled:opacity-70"
            />
          </label>
          {onCheck && !locked && (
            <button type="button" onClick={onCheck} disabled={checking || !(answer?.text ?? '').trim()} className="min-h-12 self-start rounded-xl bg-orange-500 px-6 font-bold text-white disabled:opacity-50">
              {checking ? 'Checking…' : 'Check answer'}
            </button>
          )}
        </div>
      )}

      {feedback && (
        <div role="status" className={`rounded-xl p-4 ${feedback.correct ? 'bg-green-600/10 text-green-700' : 'bg-red-600/10 text-red-600'}`}>
          <p className="font-bold">{feedback.correct ? 'Correct' : 'Not quite'}</p>
          {!isChoice && !feedback.correct && feedback.correctText && <p className="mt-1">Answer: <strong>{feedback.correctText}</strong></p>}
          {feedback.explanation && <p className="mt-2 text-ink-900"><MathText>{feedback.explanation}</MathText></p>}
        </div>
      )}
    </section>
  )
}
