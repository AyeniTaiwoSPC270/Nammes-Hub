// The 50 quiz characters, as data, and the one place they are drawn.
//
// Every character is a spec: a body, a headpiece, a face, something to wear, maybe a floating prop, a colour, and its
// own moves. This module holds the part lists, the built-in roster, and the drawing itself, so the browser and the
// server-side result card draw from the same code instead of from a generated copy of it.
//
// It is imported by src/ as well as by api/, so it must stay pure: no window, no Supabase client, no Node built-ins,
// no React. The drawing returns SVG strings rather than React elements because react-dom/server inside a Vercel
// function is the failure mode recorded at api/_lib/characterSvg.js.

const CAMEL = /[A-Z]/g
const DROP = new Set(['key', 'ref'])

// React escapes these inside an attribute value, and the committed markup was produced by React, so escaping has to
// match it exactly or the parity test fails on characters nobody changed. React writes ' as &#x27; — confirmed
// against the font-family attribute in api/_lib/quizCharacterMarkup.js, not assumed.
const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;' }

export function h(tag, attrs = null, children = null) {
  return { tag, attrs, children }
}

function attribute(name, value) {
  if (value === null || value === undefined || value === false) return null
  const text = String(value).replace(/[&<>"']/g, (c) => ESCAPES[c])
  return `${name.replace(CAMEL, (c) => `-${c.toLowerCase()}`)}="${text}"`
}

function children(node) {
  if (node === null || node === undefined || node === false) return ''
  if (Array.isArray(node)) return node.map(children).join('')
  return node.tag ? toSvg(node) : String(node)
}

export function toSvg(node) {
  const attrs = Object.entries(node.attrs ?? {})
    .filter(([name]) => !DROP.has(name))
    .map(([name, value]) => attribute(name, value))
    .filter(Boolean)
    .join(' ')
  const open = attrs ? `<${node.tag} ${attrs}>` : `<${node.tag}>`
  return `${open}${children(node.children)}</${node.tag}>`
}