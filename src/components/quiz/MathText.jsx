import { useEffect, useMemo, useState } from 'react'
import { splitMath } from '../../lib/mathText'

// Quiz text with inline maths ($x^2$). Text without any maths is shown as plain text and never loads KaTeX. KaTeX is
// loaded on first use and renders with trust turned off, so it only ever produces maths markup.

let katexPromise = null
function loadKatex() {
  if (!katexPromise) {
    katexPromise = Promise.all([import('katex'), import('katex/dist/katex.min.css')]).then(([mod]) => mod.default ?? mod)
  }
  return katexPromise
}

function Formula({ source }) {
  const [html, setHtml] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadKatex()
      .then((katex) => {
        if (!cancelled) setHtml(katex.renderToString(source, { throwOnError: false, trust: false, output: 'html' }))
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [source])
  if (html === null) return <span>{source}</span>
  return <span dangerouslySetInnerHTML={{ __html: html }} />
}

export default function MathText({ children, className }) {
  const parts = useMemo(() => splitMath(children), [children])
  return (
    <span className={className}>
      {parts.map((part, i) => (part.type === 'math' ? <Formula key={i} source={part.value} /> : <span key={i}>{part.value}</span>))}
    </span>
  )
}
