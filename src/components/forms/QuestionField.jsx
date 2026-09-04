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
    'focus:outline-none focus:border-green-900',
    error ? 'border-danger' : 'border-hairline',
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
          {(question.options || []).map((option, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input type="radio" name={question.id} checked={value === option} onChange={() => onChange(option)} />
              {option}
            </label>
          ))}
        </div>
      )}

      {question.type === 'checkboxes' && (
        <div className="flex flex-col gap-2">
          {(question.options || []).map((option, i) => (
            <label key={i} className="flex items-center gap-2 text-sm text-ink">
              <input type="checkbox" checked={(value || []).includes(option)} onChange={() => toggleCheckbox(option)} />
              {option}
            </label>
          ))}
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
        <div className="flex items-center gap-3">
          {question.scale_min_label && <span className="text-xs text-ink-muted">{question.scale_min_label}</span>}
          {Array.from(
            { length: question.scale_max - question.scale_min + 1 },
            (_, i) => question.scale_min + i
          ).map((n) => (
            <label key={n} className="flex flex-col items-center gap-1 text-sm text-ink">
              <input type="radio" name={question.id} checked={String(value) === String(n)} onChange={() => onChange(n)} />
              {n}
            </label>
          ))}
          {question.scale_max_label && <span className="text-xs text-ink-muted">{question.scale_max_label}</span>}
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
