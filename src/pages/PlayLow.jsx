import { useCallback, useEffect, useRef, useState } from 'react'
import { callQuiz } from '../data/quiz'
import { letterboxRect, toNormalized } from '../../api/_lib/quizGrading.js'
import { storeKey, readStore, writeStore, forgetSeat, finishSeat, stampSeat } from '../lib/quizPlayerStorage'

// The low-data phone client. Same API as /play, none of the look system.
//
// What this file is NOT: a smaller copy of PlayQuiz. It is a second client for the same server, and the reason it can
// be short is that it answers questions rather than performing them. Every attempt to make this a "theme" of PlayQuiz
// is what brought the 263 KB in the first place, and the cast, the backdrop, the sounds and the fonts are exactly the
// things a student on 2G cannot afford.
//
// The types it supports are the ones a student can answer without the look system: text, numeric (with a unit),
// true/false, ordering, and a diagram tap. A multiple-choice question with four images in its options is the one thing
// that would need the full client, and there is no graceful answer to that other than telling the student plainly.

const POLL_MS = 8000

function useSession(token) {
  const [state, setState] = useState(null)
  const [error, setError] = useState(null)
  const alive = useRef(true)

  const refresh = useCallback(async () => {
    if (!token) return
    try {
      const next = await callQuiz('state', { token, low: 1 })
      if (alive.current) {
        setState(next)
        setError(null)
      }
    } catch (e) {
      if (!alive.current) return
      // A dropped connection on a 2G link is the normal case, not an error worth shouting about.
      setError(e.message)
    }
  }, [token])

  useEffect(() => {
    alive.current = true
    refresh()
    const timer = setInterval(refresh, POLL_MS)
    return () => { alive.current = false; clearInterval(timer) }
  }, [refresh])

  return { state, error, refresh }
}

// Ordering by tapping, in sequence. Same interaction as the full client on purpose: a student who has used one has used
// both, and a different one would be a second thing to learn on a slow phone.
function OrderInput({ steps, onSubmit, locked }) {
  const [order, setOrder] = useState([])
  const pool = steps.map((text, i) => ({ text, i })).filter(({ i }) => !order.includes(i))
  return (
    <div>
      <ol className="mb-3 flex flex-col gap-2">
        {order.map((step, at) => (
          <li key={`${step}-${at}`} className="flex items-center gap-3 rounded-xl border border-slate-300 bg-white p-3">
            <b className="w-7 text-center">{at + 1}</b>
            <span className="flex-1">{steps[step]}</span>
            {!locked && (
              <button type="button" onClick={() => setOrder(order.filter((_, k) => k !== at))} aria-label={`Take ${steps[step]} back`}>×</button>
            )}
          </li>
        ))}
      </ol>
      {pool.map(({ text, i }) => (
        <button
          key={i}
          type="button"
          disabled={locked}
          onClick={() => setOrder([...order, i])}
          className="mb-2 flex w-full items-center gap-3 rounded-xl border border-slate-300 bg-white p-3 text-left"
        >
          <span aria-hidden="true">+</span><span className="flex-1">{text}</span>
        </button>
      ))}
      <button
        type="button"
        disabled={locked || order.length !== steps.length}
        onClick={() => onSubmit({ order })}
        className="mt-2 w-full rounded-xl bg-orange-600 p-4 text-lg font-bold text-white disabled:opacity-50"
      >
        Lock in order
      </button>
    </div>
  )
}

// One <img> and one click handler. The letterbox mapping is the same pure function the editor and the full client use,
// so a tap lands where the marker was drawn.
function DiagramInput({ src, alt, onSubmit, locked }) {
  const wrap = useRef(null)
  const img = useRef(null)
  const [natural, setNatural] = useState({ width: 0, height: 0 })
  const [tap, setTap] = useState(null)

  function handle(event) {
    if (locked) return
    const box = wrap.current?.getBoundingClientRect()
    if (!box || !natural.width) return
    const mapped = toNormalized(
      { x: event.clientX - box.left, y: event.clientY - box.top },
      letterboxRect({ width: box.width, height: box.height }, natural),
      natural,
    )
    if (mapped.x < 0 || mapped.x > 1 || mapped.y < 0 || mapped.y > 1) return
    setTap(mapped)
  }

  return (
    <div>
      <div ref={wrap} onClick={handle} className="flex h-56 items-center justify-center">
        <img ref={img} src={src} alt={alt} onLoad={(e) => setNatural({ width: e.target.naturalWidth, height: e.target.naturalHeight })} className="max-h-56 max-w-full object-contain" />
      </div>
      <button
        type="button"
        disabled={locked || !tap}
        onClick={() => tap && onSubmit({ tap })}
        className="mt-3 w-full rounded-xl bg-orange-600 p-4 text-lg font-bold text-white disabled:opacity-50"
      >
        Lock in answer
      </button>
    </div>
  )
}

function Question({ question, reveal, locked, onAnswer }) {
  const [text, setText] = useState('')
  const unit = question.unit ? ` (${question.unit})` : ''
  const shown = question.options ?? []

  if (reveal) {
    return (
      <div className="rounded-xl bg-slate-100 p-4">
        <p className="font-bold">{reveal.correct ? 'Correct' : reveal.pointsAwarded > 0 ? 'Partly right' : 'Not correct'}</p>
        {reveal.correctText && <p className="mt-1">Answer: {reveal.correctText}</p>}
        {reveal.credit != null && reveal.credit < 1 && (
          <p className="mt-1">{Math.round(reveal.credit * shown.length)} of {shown.length} steps in the right place</p>
        )}
        {reveal.explanation && <p className="mt-2">{reveal.explanation}</p>}
      </div>
    )
  }

  if (question.type === 'order') return <OrderInput steps={shown} onSubmit={onAnswer} locked={locked} />
  if (question.type === 'diagram') {
    return <DiagramInput src={question.imageUrl} alt={question.imageAlt} onSubmit={onAnswer} locked={locked} />
  }

  return (
    <form
      onSubmit={(e) => { e.preventDefault(); if (text.trim() && !locked) onAnswer({ answerText: text.trim() }) }}
      className="flex flex-col gap-3"
    >
      {shown.length > 0 && (
        <div className="mb-2 flex flex-col gap-2">
          {shown.map((option, i) => (
            <button
              key={i}
              type="button"
              disabled={locked}
              onClick={() => onAnswer({ chosenIndex: i })}
              className="rounded-xl border border-slate-300 bg-white p-4 text-left text-lg"
            >
              {option}
            </button>
          ))}
        </div>
      )}
      {shown.length === 0 && (
        <>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={40}
            inputMode={question.type === 'numeric' ? 'decimal' : 'text'}
            autoComplete="off"
            autoCapitalize="off"
            spellCheck={false}
            aria-label="Your answer"
            placeholder={question.type === 'numeric' ? `Number${unit}` : 'Type your answer'}
            className="w-full rounded-xl border-2 border-slate-300 bg-white p-4 text-xl"
          />
          <button type="submit" disabled={locked || !text.trim()} className="rounded-xl bg-orange-600 p-4 text-lg font-bold text-white disabled:opacity-50">
            Lock in answer
          </button>
        </>
      )}
    </form>
  )
}

export default function PlayLow() {
  const [token, setToken] = useState(() => {
    // The URL first, because that is how the host's link arrives and how a refresh gets here. Then the seat this
    // device stored, because a student on the worst connection in the building is also the one most likely to have the
    // tab closed on them -- and losing the seat there means retyping a code they may not have written down.
    const fromUrl = new URLSearchParams(window.location.search).get('token')
    if (fromUrl) return fromUrl
    const code = new URLSearchParams(window.location.search).get('code')
    return code ? (readStore(storeKey(code))?.token ?? '') : ''
  })
  const [nickname, setNickname] = useState('')
  const [code, setCode] = useState(() => new URLSearchParams(window.location.search).get('code') ?? '')
  const [joining, setJoining] = useState(false)
  const [sending, setSending] = useState(false)
  const { state, error, refresh } = useSession(token)

  // A finished game is flagged as over, not forgotten, so its token can still paint the result after a reload while the
  // full client's join form stops offering a code that cannot be joined. Both routes share this storage, so both have to
  // flag the end.
  const finished = state?.session?.state === 'finished'
  useEffect(() => {
    if (finished && code) finishSeat(code)
  }, [finished, code])

  async function join(event) {
    event.preventDefault()
    setJoining(true)
    try {
      // The stored token is what turns this from a new join into a resume, and a new join with a name already on the
      // roster is a 409. Same reason the full client sends it.
      const saved = readStore(storeKey(code))
      const joined = await callQuiz('join', { code, nickname, token: saved?.token })
      writeStore(storeKey(code), stampSeat({ token: joined.token, code, nickname: joined.nickname ?? nickname }))
      window.history.replaceState(null, '', `?token=${joined.token}`)
      setToken(joined.token)
      setNickname('')
    } catch (e) {
      // The room is gone (finished, or cleaned up): drop the dead seat so it cannot be offered again.
      if (e.status === 404) forgetSeat(code)
      setError(e.message)
    } finally {
      setJoining(false)
    }
  }

  async function answer(payload) {
    if (sending) return
    setSending(true)
    try {
      await callQuiz('answer', { token, ...payload })
    } catch (e) {
      setError(e.message)
    } finally {
      setSending(false)
      refresh()
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col justify-center gap-4 p-5">
        <h1 className="text-2xl font-bold">Join a quiz</h1>
        <p className="text-slate-600">This is the light version. Fewer images, less scrolling.</p>
        <form onSubmit={join} className="flex flex-col gap-3">
          <input value={code} onChange={(e) => setCode(e.target.value)} inputMode="numeric" aria-label="Quiz code" placeholder="6-digit code" className="rounded-xl border-2 border-slate-300 p-4 text-xl" />
          <input value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={20} aria-label="Your name" placeholder="Your name" className="rounded-xl border-2 border-slate-300 p-4 text-xl" />
          <button type="submit" disabled={joining || !code || !nickname.trim()} className="rounded-xl bg-orange-600 p-4 text-lg font-bold text-white disabled:opacity-50">
            {joining ? 'Joining...' : 'Join'}
          </button>
        </form>
        {error && <p role="alert" className="text-red-700">{error}</p>}
      </main>
    )
  }

  const session = state?.session
  const question = state?.question
  const reveal = state?.reveal

  return (
    <main className="mx-auto flex min-h-[100dvh] max-w-md flex-col gap-4 p-4">
      <header className="flex items-center justify-between text-sm font-bold">
        <span>{session ? `Q${(session.index ?? 0) + 1} of ${session.questionCount ?? '?'}` : 'Loading'}</span>
        <span>{state?.me ? `${state.me.nickname} · ${state.me.score} pts` : ''}</span>
      </header>

      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
      {!session && <p>Connecting...</p>}

      {session?.state === 'lobby' && <p>You are in. Waiting for the host to start.</p>}

      {session?.state === 'finished' && <p className="text-xl font-bold">Finished. {state.me.score} points.</p>}

      {question && (
        <section className="flex flex-col gap-4">
          <h1 className="text-lg font-bold leading-snug">{question.text}</h1>
          {question.imageUrl && question.type !== 'diagram' && (
            <img src={question.imageUrl} alt={question.imageAlt} className="max-h-48 w-full object-contain" />
          )}
          <Question
            question={question}
            reveal={reveal}
            locked={Boolean(question.answered) || session.state !== 'question'}
            onAnswer={answer}
          />
        </section>
      )}

      <footer className="mt-auto pt-6 text-center text-xs text-slate-500">
        Light version · saves data
      </footer>
    </main>
  )
}