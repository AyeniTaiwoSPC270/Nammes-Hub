import { useState } from 'react'
import FormField from '../ui/FormField'
import Button from '../ui/Button'
import ImageUploadField from './ImageUploadField'
import AvatarUploadField from './AvatarUploadField'
import EventImageUploadField from './EventImageUploadField'
import { buildFormState, buildPayload } from '../../lib/adminFields'

// Short, single-line field types can sit two-up in the panel (matching the
// mockup's paired Category/Date row); the first field and any long-form
// fields (textarea, list, image types) always take the full row width.
const SHORT_TYPES = new Set(['text', 'select', 'date', 'number', 'url', 'email', 'tel'])

function groupFields(fields) {
  const rows = []
  let i = 0
  while (i < fields.length) {
    const field = fields[i]
    const next = fields[i + 1]
    const canPair = i > 0 && SHORT_TYPES.has(field.type) && next && SHORT_TYPES.has(next.type)
    if (canPair) {
      rows.push([field, next])
      i += 2
    } else {
      rows.push([field])
      i += 1
    }
  }
  return rows
}

export default function AdminResourceForm({ config, record, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => buildFormState(config.fields, record))

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(buildPayload(config.fields, values))
  }

  function renderField(f) {
    if (f.type === 'image') {
      return (
        <ImageUploadField
          key={f.field}
          label={f.label}
          url={values[f.field]}
          widthPct={values[f.widthField]}
          onChange={({ url, widthPct }) => {
            setField(f.field, url)
            setField(f.widthField, widthPct)
          }}
        />
      )
    }
    if (f.type === 'avatar') {
      return (
        <AvatarUploadField
          key={f.field}
          label={f.label}
          url={values[f.field]}
          onChange={(url) => setField(f.field, url)}
        />
      )
    }
    if (f.type === 'event-image') {
      return (
        <EventImageUploadField
          key={f.field}
          label={f.label}
          url={values[f.field]}
          onChange={(url) => setField(f.field, url)}
        />
      )
    }
    return (
      <FormField
        key={f.field}
        label={f.label}
        type={f.type === 'list' ? 'textarea' : f.type}
        value={values[f.field]}
        onChange={(e) => setField(f.field, e.target.value)}
        options={f.options}
        required={!f.optional}
        helper={f.type === 'list' ? 'One item per line' : undefined}
      />
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {groupFields(config.fields).map((row) =>
        row.length === 2 ? (
          <div key={row[0].field} className="grid grid-cols-2 gap-3">
            {row.map((f) => renderField(f))}
          </div>
        ) : (
          renderField(row[0])
        )
      )}
      <div className="flex justify-end gap-3 border-t border-hairline pt-4">
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" variant="primary" loading={saving}>
          Save changes
        </Button>
      </div>
    </form>
  )
}
