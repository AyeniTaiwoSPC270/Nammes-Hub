// The handbook's editable content: the defaults written in the content-*.mjs files, plus the layer of edits an admin
// saves from the site (Admin > Handbook). Pure data, so the admin editor, the server and the local build all share it.
import { chapters as startChapters } from './content-start.mjs'
import { chapters as academicChapters } from './content-academics.mjs'
import { chapters as communityChapters } from './content-community.mjs'
import { chapters as adminChapters, appendices as adminAppendices } from './content-admin.mjs'
import { AUTHORS } from './data/authors.mjs'
import { SITE } from './helpers.mjs'

export const TITLE = 'The NAMMES Hub Handbook'
export const DEFAULT_EDITION = 'First Edition · September 2026'
export const DEFAULT_AS_OF = '30 September 2026'
export const DEFAULT_FOREWORD = `
  <p class="lead">Every session, hundreds of students ask the same questions: <em>Where is the outline? When is the exam? What happened to that link?</em></p>
  <p>NAMMES Hub was built so the answer is always one address away. It gathers everything the association publishes (outlines, timetables, resources, events, news and opportunities) and adds tools that make student life easier, like the CGPA calculator, the awards and the forms.</p>
  <p>But a tool is only useful if you know it is there. That is why this handbook exists. It walks you through every page, in plain language, from creating your account to nominating a classmate for an award. If you are an executive or admin, the final part shows you how to keep the Hub accurate, safe and alive.</p>
  <blockquote>Read it front to back once, then keep it on your phone. When you forget how to do something, open the contents page and jump straight to it.</blockquote>
  <p>We wrote this book together, ten executives with ten roles and one goal: that no member of the department ever feels lost on their own website.</p>
  <div class="signoff"><div class="who">The Executive Council</div><div class="small">{{team}} {{session}} · NAMMES, University of Lagos Chapter</div></div>
`

export const SITE_HOST = SITE.replace('https://', '')
export const DEFAULT_TEAM = 'The Aegis'
export const DEFAULT_SESSION = '26/27'
/** The council shown as the book's authors. photo: 'builtin:<slug>' (bundled), 'store:<path>' (handbook bucket) or 'url:<https address>'. */
export const DEFAULT_PEOPLE = AUTHORS.map((a) => ({ name: a.name, role: a.role, photo: `builtin:${a.slug}` }))

/**
 * Words on the covers and front pages. Plain text: a blank line starts a new paragraph, **double stars** make bold,
 * and {{team}} {{session}} {{session_long}} {{title}} {{edition}} {{as_of}} {{site}} are filled in automatically.
 * `panel` says which editor page shows the field.
 */
export const TEXT_FIELDS = [
  { key: 'cover_eyebrow', panel: 'cover', label: 'Small line above the logo', value: 'NAMMES · University of Lagos Chapter' },
  { key: 'cover_title', panel: 'cover', label: 'Book title', value: 'The NAMMES Hub Handbook', help: 'Also printed at the top of every page. The word Hub is shown in orange.' },
  { key: 'cover_subtitle', panel: 'cover', label: 'Sentence under the title', value: "A beginner's complete guide to every page, tool and feature, with a full guide for admins.", multiline: true },
  { key: 'credit_label', panel: 'cover', label: 'Label above the authors', value: 'Written by' },
  { key: 'credit_council', panel: 'cover', label: 'Authors line', value: 'The Executive Council', help: 'The team name and session (set under Meet the authors) are added after it.' },

  { key: 'title_subtitle', panel: 'title', label: 'Title page sentence', value: "A beginner's complete guide to every page, tool and feature of NAMMES Hub, with a full guide for admins.", multiline: true },
  { key: 'title_publisher', panel: 'title', label: 'Publisher lines (bottom of the title page)', value: 'National Association of Metallurgical and Materials Engineering Students\nUniversity of Lagos Chapter', multiline: true },
  { key: 'dedication', panel: 'title', label: 'Dedication (the quiet page after the cover)', value: 'For every student of Materials and Metallurgical Engineering: past, present and yet to come.', multiline: true },

  {
    key: 'copyright_body',
    panel: 'copyright',
    label: 'Copyright page text',
    multiline: true,
    rows: 14,
    help: 'A blank line starts a new paragraph. The title and edition are printed above this automatically.',
    value: [
      'Published by the National Association of Metallurgical and Materials Engineering Students (NAMMES), University of Lagos Chapter, as a free companion to {{site}}.',
      '© 2026 NAMMES Hub. All rights reserved. You are welcome to download, print and share this handbook with fellow students, provided it is shared whole and free of charge.',
      'This handbook describes NAMMES Hub as it stood on **{{as_of}}**. The Hub is updated continually by the executives, so screens, wording and features may change, and pages shown empty here may since have been filled. The latest edition can always be downloaded from the footer of the Hub.',
      'Screenshots were taken from the live public website. Course, event and form names shown are examples of the content published at that time.',
      'Set in Playfair Display and Public Sans.',
    ].join('\n\n'),
  },

  { key: 'toc_heading', panel: 'contents', label: 'Contents page heading', value: 'Contents' },
  { key: 'finder_heading', panel: 'contents', label: 'Second contents page heading', value: 'Where Do I Find…?' },
  { key: 'finder_intro', panel: 'contents', label: 'Sentence under that heading', value: 'Not sure which chapter you need? Start from what you want to do.' },

  {
    key: 'authors_intro',
    panel: 'authors',
    label: 'Meet the Authors page: opening paragraph',
    multiline: true,
    value: 'This handbook was written by the Executive Council of NAMMES, University of Lagos Chapter: **{{team}} {{session}}**. Between them they lead the association for the {{session_long}} session and look after the Hub you have just learned to use.',
  },
  {
    key: 'authors_thanks',
    panel: 'authors',
    label: 'Meet the Authors page: closing paragraph',
    multiline: true,
    value: 'With thanks to every member who uses, tests and improves NAMMES Hub. Your questions shaped this book. If something is unclear, reach any of us through the Contact page of the Hub.',
  },

  { key: 'back_eyebrow', panel: 'back', label: 'Small line at the top', value: 'The NAMMES Hub Handbook' },
  { key: 'back_heading', panel: 'back', label: 'Big heading', value: 'Everything NAMMES Hub has to offer, in one book.', multiline: true },
  {
    key: 'back_body',
    panel: 'back',
    label: 'Paragraphs',
    multiline: true,
    rows: 8,
    value: [
      'NAMMES Hub is the home of the National Association of Metallurgical and Materials Engineering Students, University of Lagos Chapter: your outlines, timetable, CGPA calculator, resources, events, news, opportunities, awards and forms, all in one place.',
      'This handbook walks a complete beginner through every page and shows the executives how to run it.',
    ].join('\n\n'),
  },
  {
    key: 'back_list',
    panel: 'back',
    label: 'What is inside (one item per line)',
    multiline: true,
    rows: 7,
    value: ['Every page of the Hub, explained', 'Sign-up, sign-in and your account', 'Outlines, timetable and CGPA', 'Events, news and opportunities', 'Awards and forms, step by step', 'A complete guide for admins'].join('\n'),
  },
  { key: 'back_scan', panel: 'back', label: 'Text next to the QR code', value: 'Scan to open NAMMES Hub on your phone.' },
  { key: 'back_fine', panel: 'back', label: 'Small print at the bottom', value: 'National Association of Metallurgical and Materials Engineering Students · UNILAG Chapter' },
]

export const DEFAULT_TEXTS = Object.fromEntries(TEXT_FIELDS.map((f) => [f.key, f.value]))

/** '26/27' -> '2026/2027'. Anything else is used as typed. */
export function longSession(session) {
  const m = /^\s*(\d{2})\s*\/\s*(\d{2})\s*$/.exec(session ?? '')
  return m ? `20${m[1]}/20${m[2]}` : String(session ?? '')
}

// Contents-page shortcuts: what a reader wants to do, and the chapter or appendix that answers it.
export const FIND_DEFAULTS = [
  ['I want to create an account', 'quickstart'],
  ['I forgot my password', 'account'],
  ['I want to know what a course covers', 'outlines'],
  ['I need my class or exam timetable', 'timetable'],
  ['I want to work out my CGPA', 'cgpa'],
  ['I am looking for past questions or notes', 'outlines'],
  ['I am looking for slides and shared folders', 'resources'],
  ['I want to see photos from an event', 'events'],
  ['I want to find a scholarship or internship', 'opportunities'],
  ['I want to vote in the awards', 'awards'],
  ['I need to register for something', 'forms'],
  ['I want to reach an executive', 'association'],
  ['I want to publish news or an event', 'admin-content'],
  ['I want to build a registration form', 'admin-forms'],
  ['I want to run the awards', 'admin-awards'],
  ['I want to email every member', 'admin-comms'],
  ['I want to make someone an admin', 'admin-people'],
  ['Something has gone wrong', 'faq'],
]

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
  const texts = { ...DEFAULT_TEXTS }
  for (const [key, value] of Object.entries(settings.texts ?? {})) {
    if (key in DEFAULT_TEXTS && typeof value === 'string' && value.trim()) texts[key] = value
  }
  const savedFinder = Array.isArray(settings.texts?.finder) ? settings.texts.finder : []
  const authors = overrides.authors ?? {}
  const people = Array.isArray(authors.people) && authors.people.length ? authors.people : DEFAULT_PEOPLE
  return {
    title: texts.cover_title,
    texts,
    finder: FIND_DEFAULTS.map(([task, id], i) => [savedFinder[i]?.trim() || task, id]),
    team: authors.team?.trim() || DEFAULT_TEAM,
    session: authors.session?.trim() || DEFAULT_SESSION,
    people: people.map((p) => ({
      name: p.name,
      role: p.role,
      photo: p.photo,
      // Bundled photos have a fixed path; the server swaps in inline data for uploaded ones.
      img: p.img ?? (String(p.photo).startsWith('builtin:') ? `../authors/${String(p.photo).slice(8)}.jpg` : ''),
    })),
    edition: settings.edition?.trim() || DEFAULT_EDITION,
    asOf: settings.as_of?.trim() || DEFAULT_AS_OF,
    forewordHtml: settings.foreword_html?.trim() || DEFAULT_FOREWORD,
    chapters: CHAPTERS.map(pick),
    appendices: APPENDICES.map(pick),
    css,
  }
}
