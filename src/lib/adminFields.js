import { PREVIEW_STYLES, POSITIONS, isValidDuration } from './newsVideo'

export function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function generateId(seed) {
  const suffix = Math.random().toString(36).slice(2, 8)
  return `${slugify(seed)}-${suffix}`
}

export function clampImageWidth(value) {
  return Math.min(100, Math.max(30, Math.round(value)))
}

export function parseListField(text) {
  return (text || '')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

export function formatListField(list) {
  return (list || []).join('\n')
}

export function buildFormState(fields, record) {
  const state = {}
  fields.forEach((f) => {
    if (f.type === 'list') state[f.field] = formatListField(record?.[f.field])
    else if (f.type === 'image') {
      state[f.field] = record?.[f.field] ?? ''
      state[f.widthField] = record?.[f.widthField] ?? 100
    } else if (f.type === 'video') {
      // One field type owns five columns, the same way `image` owns its width. Preview and position are
      // seeded rather than blank for a NEW post, because those two carry a `default` in the database and
      // a blank string would be rejected by their check constraint before anyone saw a video.
      state[f.field] = record?.[f.field] ?? ''
      state[f.kindField] = record?.[f.kindField] ?? ''
      state[f.previewField] = record?.[f.previewField] ?? PREVIEW_STYLES[1].value
      state[f.positionField] = record?.[f.positionField] ?? POSITIONS[0].value
      state[f.durationField] = record?.[f.durationField] ?? ''
    } else if (f.type === 'select') {
      // A native <select> visually shows its first <option> even when the
      // controlled value doesn't match any option (e.g. an empty default).
      // Default to the first option so the displayed value and form state agree.
      state[f.field] = record?.[f.field] ?? (f.options && f.options.length > 0 ? f.options[0] : '')
    } else state[f.field] = record?.[f.field] ?? ''
  })
  return state
}

export function buildPayload(fields, values) {
  const payload = {}
  fields.forEach((f) => {
    if (f.type === 'list') payload[f.field] = parseListField(values[f.field])
    else if (f.type === 'image') {
      payload[f.field] = values[f.field] || null
      payload[f.widthField] = values[f.widthField] ? Number(values[f.widthField]) : null
    } else if (f.type === 'video') {
      // No URL means no video, so every companion column is nulled too -- a leftover `video_kind` with an
      // empty url would read as a broken player. The five columns move as a group rather than keeping
      // whatever the form last held.
      const url = values[f.field] || ''
      if (!url) {
        payload[f.field] = null
        payload[f.kindField] = null
        payload[f.previewField] = null
        payload[f.positionField] = null
        payload[f.durationField] = null
      } else {
        payload[f.field] = url
        payload[f.kindField] = values[f.kindField] || null
        payload[f.previewField] = PREVIEW_STYLES.some((s) => s.value === values[f.previewField]) ? values[f.previewField] : PREVIEW_STYLES[1].value
        payload[f.positionField] = POSITIONS.some((p) => p.value === values[f.positionField]) ? values[f.positionField] : POSITIONS[0].value
        // A duration the badge would print verbatim ("12 minutes") is dropped rather than published;
        // the field warns inline while typing, so this is the last line of defence, not the only one.
        payload[f.durationField] = isValidDuration(values[f.durationField]) && values[f.durationField] ? String(values[f.durationField]).trim() : null
      }
    } else if (f.type === 'number') payload[f.field] = values[f.field] === '' ? null : Number(values[f.field])
    else payload[f.field] = values[f.field] === '' ? null : values[f.field]
  })
  return payload
}
