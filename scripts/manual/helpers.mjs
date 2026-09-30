// Small HTML builders shared by the chapter files. Every helper returns a string.

export const SITE = 'https://www.nammeshub.com.ng'

const ICON = {
  tip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z"/></svg>',
  note: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>',
  warn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 2.5 20h19L12 3zM12 10v5M12 17.6v.01"/></svg>',
  admin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3 4 6v6c0 4.5 3.2 7.8 8 9 4.8-1.2 8-4.5 8-9V6l-8-3zM9 12l2 2 4-4"/></svg>',
}

const CALLOUT_LABEL = { tip: 'Tip', note: 'Good to know', warn: 'Careful', admin: 'Admin only' }
const CALLOUT_CLASS = { tip: '', note: 'note', warn: 'warn', admin: 'admin' }

export function callout(kind, body, title) {
  const cls = CALLOUT_CLASS[kind]
  return `<div class="callout ${cls}"><div class="ct">${ICON[kind]}<span>${title || CALLOUT_LABEL[kind]}</span></div>${body}</div>`
}
export const tip = (body, title) => callout('tip', body, title)
export const note = (body, title) => callout('note', body, title)
export const warn = (body, title) => callout('warn', body, title)
export const adminBox = (body, title) => callout('admin', body, title)

/** A small fact box: [['Address', '/outlines'], ['Sign-in needed?', 'No'], ...]. Use { wide: true } as a third item for a full-width cell. */
export function glance(cells) {
  const html = cells
    .map(([k, v, opts]) => `<div class="cell${opts?.wide ? ' wide' : ''}"><div class="k">${k}</div><div class="v">${v}</div></div>`)
    .join('')
  return `<div class="glance">${html}</div>`
}

export function steps(items, cls = '') {
  return `<ol class="steps ${cls}">${items.map((s) => `<li>${s}</li>`).join('')}</ol>`
}

export function bullets(items, cls = '') {
  return `<ul class="${cls}">${items.map((s) => `<li>${s}</li>`).join('')}</ul>`
}

export function table(headers, rows) {
  const head = `<thead><tr>${headers.map((h) => `<th>${h}</th>`).join('')}</tr></thead>`
  const body = `<tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
  return `<table>${head}${body}</table>`
}

export function pills(items, orange = false) {
  return `<div class="pills">${items.map((p) => `<span class="pill${orange ? ' o' : ''}">${p}</span>`).join('')}</div>`
}

/** A screenshot in a browser frame. opts: { url, crop: 'mm height', phone, narrow } */
export function shot(name, caption, opts = {}) {
  const narrow = opts.narrow ?? !(opts.phone || opts.wide)
  const cls = ['shot', opts.crop ? 'crop' : '', opts.phone ? 'phone' : '', narrow ? 'narrow' : ''].filter(Boolean).join(' ')
  const bar = opts.phone ? '' : `<div class="bar"><i></i><i></i><i></i><span>${opts.url ?? ''}</span></div>`
  const style = opts.crop ? ` style="height:${opts.crop}mm"` : ''
  return `<figure class="${cls}"><div class="frame">${bar}<img src="../screens/${name}.jpg"${style} alt=""></div><figcaption>${caption}</figcaption></figure>`
}

export function path(text) {
  return `<span class="path">${text}</span>`
}

export function qa(q, a) {
  return `<div class="qa"><div class="q">${q}</div><div class="a">${a}</div></div>`
}

export function glanceFor({ address, signIn, who, best }) {
  return glance([
    ['Address', `${SITE.replace('https://', '')}${address}`],
    ['Sign-in needed?', signIn],
    ['Who it is for', who, { wide: false }],
    ['Best for', best],
  ])
}
