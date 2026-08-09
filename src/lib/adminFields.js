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
    } else if (f.type === 'number') payload[f.field] = values[f.field] === '' ? null : Number(values[f.field])
    else payload[f.field] = values[f.field] === '' ? null : values[f.field]
  })
  return payload
}
