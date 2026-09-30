// The handbook's editable content: the defaults written in the content-*.mjs files, plus the layer of edits an admin
// saves from the site (Admin > Handbook). Pure data, so the admin editor, the server and the local build all share it.
import { chapters as startChapters } from './content-start.mjs'
import { chapters as academicChapters } from './content-academics.mjs'
import { chapters as communityChapters } from './content-community.mjs'
import { chapters as adminChapters, appendices as adminAppendices } from './content-admin.mjs'

export const TITLE = 'The NAMMES Hub Handbook'
export const DEFAULT_EDITION = 'First Edition · September 2026'
export const DEFAULT_AS_OF = '30 September 2026'
export const DEFAULT_FOREWORD = `
  <p class="lead">Every session, hundreds of students ask the same questions: <em>Where is the outline? When is the exam? What happened to that link?</em></p>
  <p>NAMMES Hub was built so the answer is always one address away. It gathers everything the association publishes (outlines, timetables, resources, events, news and opportunities) and adds tools that make student life easier, like the CGPA calculator, the awards and the forms.</p>
  <p>But a tool is only useful if you know it is there. That is why this handbook exists. It walks you through every page, in plain language, from creating your account to nominating a classmate for an award. If you are an executive or admin, the final part shows you how to keep the Hub accurate, safe and alive.</p>
  <blockquote>Read it front to back once, then keep it on your phone. When you forget how to do something, open the contents page and jump straight to it.</blockquote>
  <p>We wrote this book together, ten executives with ten roles and one goal: that no member of the department ever feels lost on their own website.</p>
  <div class="signoff"><div class="who">The Executive Council</div><div class="small">The Aegis 26/27 · NAMMES, University of Lagos Chapter</div></div>
`

export const CHAPTERS = [...startChapters, ...academicChapters, ...communityChapters, ...adminChapters]
export const APPENDICES = adminAppendices

/** The sections an admin can edit, in book order. `kind` decides which fields the editor offers. */
export const EDITABLE = [
  ...CHAPTERS.map((c) => ({ id: c.id, kind: 'chapter', label: c.admin ? c.title : `${c.num}. ${c.title}`, part: c.part })),
  ...APPENDICES.map((a) => ({ id: a.id, kind: 'appendix', label: `Appendix ${a.letter}. ${a.title}`, part: 'Appendices' })),
]

/**
 * Turns the saved edits into the book's working content.
 * overrides = { settings: { edition, as_of, foreword_html } | null, chapters: { [id]: { title, intro, html } } }
 * A field left empty or missing falls back to the original text, so a partial edit never blanks a page.
 */
export function makeContext(overrides = {}, css = '') {
  const settings = overrides.settings ?? {}
  const edits = overrides.chapters ?? {}
  const pick = (base) => {
    const e = edits[base.id]
    if (!e) return base
    return {
      ...base,
      title: e.title?.trim() || base.title,
      ...(base.intro !== undefined ? { intro: e.intro?.trim() || base.intro } : {}),
      html: e.html?.trim() || base.html,
    }
  }
  return {
    title: TITLE,
    edition: settings.edition?.trim() || DEFAULT_EDITION,
    asOf: settings.as_of?.trim() || DEFAULT_AS_OF,
    forewordHtml: settings.foreword_html?.trim() || DEFAULT_FOREWORD,
    chapters: CHAPTERS.map(pick),
    appendices: APPENDICES.map(pick),
    css,
  }
}
