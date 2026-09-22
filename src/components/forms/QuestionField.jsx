import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function QuestionField({ question, value, onChange, error }) {
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
      setUploadError('Please choose a PDF, JPG, or PNG file.')
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      setUploadError('File must be smaller than 10MB.')
      return
    }
    setUploadError('')
    setUploading(true)
    const path = `${question.form_id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadErr } = await supabase.storage.from('form-uploads').upload(path, file)
    setUploading(false)
    if (uploadErr) {
      setUploadError(uploadErr.message)
      return
    }
    const { data } = supabase.storage.from('form-uploads').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  function toggleCheckbox(option) {
    const current = Array.isArray(value) ? value : []
    onChange(current.includes(option) ? current.filter((o) => o !== option) : [...current, option])
  }

  const controlClass = [
    'rounded-md border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150',
    'focus:outline-none focus:border-brand',
    error ? 'border-danger' : 'border-hairline',
  ].join(' ')

  const choiceRowClass = (checked) =>
    [
      'flex cursor-pointer items-center gap-3 rounded-md border px-3 py-2.5 text-sm transition-colors duration-150',
      checked ? 'border-brand bg-surface-low' : 'border-hairline bg-surface hover:bg-surface-low',
    ].join(' ')

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-semibold text-ink-900">
        {question.label}
        {question.required && <span className="text-danger"> *</span>}
      </label>
      {question.helper_text && <span className="text-xs text-ink-muted">{question.helper_text}</span>}

      {question.type === 'short_text' && (
        <input type="text" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {question.type === 'paragraph' && (
        <textarea value={value || ''} onChange={(e) => onChange(e.target.value)} rows={4} className={controlClass} />
      )}

      {question.type === 'multiple_choice' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => {
            const checked = value === option
            return (
              <label key={i} className={choiceRowClass(checked)}>
                <input type="radio" name={question.id} checked={checked} onChange={() => onChange(option)} className="sr-only" />
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2',
                    checked ? 'border-brand' : 'border-hairline',
                  ].join(' ')}
                >
                  {checked && <span className="h-2.5 w-2.5 rounded-full bg-green-900" />}
                </span>
                <span className="text-ink">{option}</span>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'checkboxes' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => {
            const checked = (value || []).includes(option)
            return (
              <label key={i} className={choiceRowClass(checked)}>
                <input type="checkbox" checked={checked} onChange={() => toggleCheckbox(option)} className="sr-only" />
                <span
                  className={[
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-sm border-2',
                    checked ? 'border-green-900 bg-green-900' : 'border-hairline bg-surface',
                  ].join(' ')}
                >
                  {checked && <span className="material-symbols-outlined text-sm text-white">check</span>}
                </span>
                <span className="text-ink">{option}</span>
              </label>
            )
          })}
        </div>
      )}

      {question.type === 'dropdown' && (
        <select value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass}>
          <option value="" disabled>Choose an option</option>
          {(question.options || []).map((option, i) => (
            <option key={i} value={option}>{option}</option>
          ))}
        </select>
      )}

      {question.type === 'linear_scale' && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            {Array.from(
              { length: question.scale_max - question.scale_min + 1 },
              (_, i) => question.scale_min + i
            ).map((n) => {
              const checked = String(value) === String(n)
              return (
                <label key={n} className="flex cursor-pointer flex-col items-center gap-1.5">
                  <input type="radio" name={question.id} checked={checked} onChange={() => onChange(n)} className="sr-only" />
                  <span
                    className={[
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors duration-150',
                      checked ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
                    ].join(' ')}
                  >
                    {n}
                  </span>
                </label>
              )
            })}
          </div>
          {(question.scale_min_label || question.scale_max_label) && (
            <div className="flex items-center justify-between text-xs text-ink-muted">
              <span>{question.scale_min_label}</span>
              <span>{question.scale_max_label}</span>
            </div>
          )}
        </div>
      )}

      {question.type === 'file_upload' && (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
          <span className="material-symbols-outlined text-3xl text-ink-muted">upload_file</span>
          <span className="text-sm font-semibold text-ink-muted">
            {uploading ? 'Uploading…' : value ? 'File uploaded — click to replace' : 'Click to choose a file'}
          </span>
          <span className="text-xs text-ink-muted">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={handleFileChange}
            disabled={uploading}
            className="hidden"
          />
        </label>
      )}

      {question.type === 'date' && (
        <input type="date" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {question.type === 'time' && (
        <input type="time" value={value || ''} onChange={(e) => onChange(e.target.value)} className={controlClass} />
      )}

      {uploadError && <span className="text-xs text-danger">{uploadError}</span>}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  )
}
