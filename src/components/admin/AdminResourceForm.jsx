import { useState } from 'react'
import FormField from '../ui/FormField'
import Button from '../ui/Button'
import ImageUploadField from './ImageUploadField'
import AvatarUploadField from './AvatarUploadField'
import EventImageUploadField from './EventImageUploadField'
import { buildFormState, buildPayload } from '../../lib/adminFields'

export default function AdminResourceForm({ config, record, onSubmit, onCancel, saving }) {
  const [values, setValues] = useState(() => buildFormState(config.fields, record))

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    onSubmit(buildPayload(config.fields, values))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {config.fields.map((f) => {
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
      })}
      <div className="flex gap-3">
        <Button type="submit" variant="primary" loading={saving}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
