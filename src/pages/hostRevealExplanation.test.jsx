import { describe, expect, it, vi, beforeEach } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { RevealScreen } from './HostQuiz.jsx'

// SoundControl in the Stage footer reads the sound preferences through useSyncExternalStore, which has no server
// snapshot and so cannot be rendered to a string. It is a browser-only widget and says nothing about the reveal.
//
// ThemeProvider is stubbed for the same reason and harder: it reads localStorage and window.matchMedia on mount, so
// rendering it needs a DOM this suite does not have. What is under test is the reveal markup, so the provider becomes a
// pass-through and the colour scheme stops mattering.
vi.mock('../components/quiz/QuizParts.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, SoundControl: () => null }
})

vi.mock('../lib/ThemeContext.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, ThemeProvider: ({ children }) => children }
})

// QuizThemeToggle sits in the same Stage footer and also reads useTheme. It is a browser chrome control with nothing to
// do with what the reveal draws, so it is stubbed for the same reason as the provider above.
vi.mock('../components/quiz/QuizThemeToggle.jsx', () => ({ default: () => null, QuizThemeToggle: () => null }))

// The host's saved preferences are read before the reveal mounts.
beforeEach(() => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} })
})

// SoundControl in the Stage footer reads the sound preferences through useSyncExternalStore, which has no server
// snapshot and so cannot be rendered to a string. It is a browser-only widget and says nothing about the reveal, so it
// is stubbed out rather than taught to render on a server it will never render on.
vi.mock('../components/quiz/QuizParts.jsx', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, SoundControl: () => null }
})

// The explanation is authored in the editor, sent with the reveal payload, rendered by the phone and rendered by the
// projector. The projector was the one that was missing, and then it crashed the whole page with
// `ReferenceError: reveal is not defined` because the block read `reveal.explanation` while the prop it was given was
// named `explanation`.
//
// That is why this renders the component rather than scanning the source. A scan cannot see a ReferenceError, and the
// scan that shipped alongside the bug asserted that the exact wrong identifier was present, so it passed on a screen
// that took the projector down every time everyone had answered. Rendering executes the code, so a bare identifier
// throws here instead of in a room.

// The minimum a reveal needs. The counts are one per option, the answers are what the room submitted, and
// playersById resolves the fastest-correct name.
const QUESTION = {
  id: 'q1',
  type: 'multiple',
  text: 'Which course covers eigenvalues?',
  options: ['MTH 204', 'STA 201', 'CSC 211'],
  correct_index: 0,
  image_path: null,
  image_alt: null,
}

function render(props = {}) {
  return renderToStaticMarkup(
    <RevealScreen
      title="Maths"
      question={QUESTION}
      index={0}
      total={3}
      counts={[2, 0, 1]}
      answers={[{ player_id: 'p1', correct: true, answered_at: new Date().toISOString() }]}
      playersById={new Map([['p1', { nickname: 'Ada' }]])}
      questionStartedAt={new Date().toISOString()}
      playerCount={3}
      onNext={() => {}}
      busy={false}
      isLast={false}
      auto={false}
      holdMs={0}
      {...props}
    />,
  )
}

describe('the projector reveal screen', () => {
  it('renders without crashing, with and without an explanation', () => {
    // The bare `reveal` identifier throws here rather than in a live game.
    expect(() => render()).not.toThrow()
    expect(() => render({ explanation: 'They are the roots of det(A - λI).' })).not.toThrow()
  })

  it('shows the explanation the host typed', () => {
    const html = render({ explanation: 'They are the roots of det(A - λI).' })
    expect(html).toContain('Why')
    expect(html).toContain('They are the roots of det(A - λI).')
  })

  it('leaves the block out entirely when a question has no explanation', () => {
    const html = render()
    expect(html).not.toContain('>Why<')
  })

  it('does not render the answer as correct while the drum roll still holds it', () => {
    // holdMs > 0 means `revealed` is false, which is the state the crash was hit in: the screen mounted on the reveal.
    const html = render({ holdMs: 3000, explanation: 'Held back.' })
    expect(html).toContain('Held back.')
    expect(html).toContain('opacity-40')
  })

  it('still renders a diagram reveal with its regions', () => {
    const diagram = {
      ...QUESTION,
      type: 'diagram',
      options: [],
      correct_index: null,
      image_path: '11111111-1111-4111-8111-111111111111/22222222-2222-4222-8222-222222222222.webp',
      diagram_targets: [{ x: 0.5, y: 0.25, r: 0.08, ar: 1.5 }],
    }
    expect(() => render({ question: diagram, explanation: 'The peak is at the top.' })).not.toThrow()
  })

  it('still renders an ordering reveal', () => {
    const order = { ...QUESTION, type: 'order', options: ['Start', 'Then', 'Finish'], correct_index: null }
    expect(() => render({ question: order, explanation: 'In that sequence.' })).not.toThrow()
  })
})