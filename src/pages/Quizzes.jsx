import { Link } from 'react-router-dom'

// One front door for everything quiz: join a live game, practise, battle, or make a quiz from your own questions.
// Each card goes to a full-screen page that needs no account.

const WAYS = [
  {
    to: '/play',
    icon: 'quiz',
    title: 'Join a live game',
    text: 'Playing along at an event? Enter the code from the big screen and pick a nickname.',
    action: 'Enter a code',
  },
  {
    to: '/practice',
    icon: 'target',
    title: 'Practise',
    text: 'Go through a quiz at your own pace and see each answer straight away. Race bots or past players if you like.',
    action: 'Pick a quiz',
  },
  {
    to: '/battle',
    icon: 'military_tech',
    title: 'Battle a friend',
    text: 'Challenge someone to the same questions, play a live duel, or take on a bot. Climb the champions list.',
    action: 'Start a battle',
  },
  {
    to: '/make',
    icon: 'edit',
    title: 'Make your own quiz',
    text: 'Paste your questions from a spreadsheet, get a private code, then practise, challenge or duel with it.',
    action: 'Make a quiz',
  },
  {
    to: '/cbt',
    icon: 'assignment',
    title: 'CBT practice',
    text: 'Timed exams that work like the real CBT: course question banks by level, a countdown, and a full review at the end.',
    action: 'Start practising',
    wide: true,
  },
]

export default function Quizzes() {
  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <div className="flex flex-col gap-1">
        <span className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-ink-muted">Quizzes</span>
        <h1 className="text-3xl font-bold text-ink-900 sm:text-4xl">Quizzes and battles</h1>
        <p className="max-w-2xl text-ink-muted">Play, practise or challenge a friend. No account needed.</p>
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {WAYS.map((way) => (
          <li key={way.to} className={way.wide ? 'sm:col-span-2' : undefined}>
            <Link
              to={way.to}
              className="group flex h-full flex-col gap-3 rounded-lg border border-hairline bg-surface p-6 shadow-md no-underline transition-transform hover:-translate-y-0.5"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-orange-500/15 text-orange-500">
                <span className="material-symbols-outlined" aria-hidden="true">{way.icon}</span>
              </span>
              <h2 className="text-xl font-bold text-ink-900">{way.title}</h2>
              <p className="flex-1 text-ink-muted">{way.text}</p>
              <span className="font-semibold text-orange-600 group-hover:underline">{way.action} →</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
