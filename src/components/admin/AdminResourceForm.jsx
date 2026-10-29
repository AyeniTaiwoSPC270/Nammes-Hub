import { useState } from 'react'
import FormField from '../ui/FormField'
import Button from '../ui/Button'
import ImageUploadField from './ImageUploadField'
import VideoUploadField from './VideoUploadField'
import AvatarUploadField from './AvatarUploadField'
import EventImageUploadField from './EventImageUploadField'
import { buildFormState, buildPayload } from '../../lib/adminFields'
import { useContentSettingsQuery } from '../../data/contentLooks'

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
  // Only screens with a video field pay for this -- it feeds the live "site default" hints on the
  // preview length and repeat controls. The key is shared with every other settings reader, so this
  // is a cache read, not a second request, wherever the row is already loaded.
  const settingsQuery = useContentSettingsQuery({
    enabled: config.fields.some((f) => f.type === 'video'),
  })

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
    if (f.type === 'video') {
      return (
        <VideoUploadField
          key={f.field}
          label={f.label}
          url={values[f.field]}
          kind={values[f.kindField]}
          preview={values[f.previewField]}
          position={values[f.positionField]}
          duration={values[f.durationField]}
          seconds={values[f.secondsField]}
          loop={values[f.loopField]}
          defaultSeconds={settingsQuery.data?.news_video_preview_seconds ?? 3}
          defaultLoop={settingsQuery.data?.news_video_loop === true}
          coverUrl={f.coverField ? values[f.coverField] : ''}
          onChange={(patch) => {
            if ('url' in patch) setField(f.field, patch.url)
            if ('kind' in patch) setField(f.kindField, patch.kind)
            if ('preview' in patch) setField(f.previewField, patch.preview)
            if ('position' in patch) setField(f.positionField, patch.position)
            if ('duration' in patch) setField(f.durationField, patch.duration)
            if ('seconds' in patch) setField(f.secondsField, patch.seconds)
            if ('loop' in patch) setField(f.loopField, patch.loop)
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
          <div key={row[0].field} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
