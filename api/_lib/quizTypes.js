// The one list of quiz question types, shared by the serverless handlers and the browser pages.
//
// Five hand-synced copies of this list used to exist. A type added to one and missed in the others is the worst kind
// of bug in this subsystem: it works on the projector and is silently dropped for a community set, or it imports from
// a spreadsheet and then refuses to save. Nothing here is written twice — the lists below are all derived from
// TYPE_INFO, and quizTypes.test.js asserts the consumers still agree with what is derived.

// `cbt: false` means the exam engine never draws it. A poll scores nothing (cbt.js:49), and a diagram needs a picture
// the exam question view does not render at all. `custom: false` means a community set cannot author it, because
// `order` and `poll` need the host to decide the answer and a custom set has no scored round for that.
export const TYPE_INFO = {
  multiple: {
    label: 'Multiple choice',
    hint: '2 to 4 answers, one is right.',
    cbtLabel: 'Multiple choice',
    cbt: true,
    custom: true,
    aliases: ['', 'mc', 'choice', 'multiple choice'],
  },
  truefalse: {
    label: 'True or false',
    hint: 'Two big buttons.',
    // The exam editor prints a type label inline in a dense table row, so its labels are terser than the quiz
    // editor's. Both live here rather than in a second map that could drift.
    cbtLabel: 'True/false',
    cbt: true,
    custom: true,
    aliases: ['true/false', 'true false', 'tf', 'boolean'],
  },
  numeric: {
    label: 'Number answer',
    hint: 'Players type a number. You can allow a small margin.',
    cbtLabel: 'Number',
    cbt: true,
    custom: true,
    aliases: ['number', 'numerical'],
  },
  text: {
    label: 'Typed answer',
    hint: 'Players type a word or short phrase. Case and punctuation are ignored.',
    cbtLabel: 'Typed',
    cbt: true,
    custom: true,
    aliases: ['typed', 'short', 'short answer'],
  },
  poll: {
    label: 'Poll (no score)',
    hint: 'Asks for an opinion. Nobody scores.',
    cbtLabel: 'Poll (no score)',
    cbt: false,
    custom: false,
    aliases: ['survey'],
  },
  order: {
    label: 'Put in order',
    hint: 'Players drag the steps into the right order. Partial credit for most of it in the right place.',
    cbtLabel: 'Order',
    cbt: true,
    // A custom set has no scored round for the host to decide a permutation in, so it cannot author this.
    custom: false,
    aliases: ['ordering', 'sequence', 'sort'],
  },
  diagram: {
    label: 'Tap the diagram',
    hint: 'A picture with hidden regions. Correct if the tap lands inside one of them.',
    cbtLabel: 'Diagram',
    // CBT renders no images at all, so the same exclusion as poll applies rather than growing the exam engine.
    cbt: false,
    custom: false,
    aliases: ['image', 'tap', 'point', 'hotspot', 'marker'],
  },
}

export const QUESTION_TYPES = Object.keys(TYPE_INFO)
export const CBT_QUESTION_TYPES = QUESTION_TYPES.filter((type) => TYPE_INFO[type].cbt)
export const CUSTOM_QUESTION_TYPES = QUESTION_TYPES.filter((type) => TYPE_INFO[type].custom)

// Every type an admin may pick in the quiz editor, with the fields the editor's `<select>` and hint line read.
export const QUESTION_TYPE_INFO = Object.fromEntries(
  QUESTION_TYPES.map((type) => [type, { label: TYPE_INFO[type].label, hint: TYPE_INFO[type].hint }]),
)

// Whether a type is answered by tapping one option. Kept here so the render-scan test can ask the same question the
// screens ask, instead of hard-coding a third copy of the choice list.
export function isChoiceTypeSource(type) {
  return ['multiple', 'truefalse', 'poll'].includes(type)
}

// The exam editor's inline labels. Falls back to the type key so an unexpected row shows something rather than nothing.
export function cbtTypeLabel(type) {
  return TYPE_INFO[type]?.cbtLabel ?? type
}

// A spreadsheet says "Multiple choice", "mc" or nothing at all, and all three mean the same question. The canonical
// name is always accepted too, so a round trip through this map is stable.
const ALIAS_LOOKUP = Object.fromEntries(
  QUESTION_TYPES.flatMap((type) => [[type, type], ...TYPE_INFO[type].aliases.map((alias) => [alias, type])]),
)

export function resolveTypeAlias(raw) {
  return ALIAS_LOOKUP[String(raw ?? '').trim().toLowerCase()] ?? null
}

export function isQuestionType(type) {
  return Object.prototype.hasOwnProperty.call(TYPE_INFO, type)
}