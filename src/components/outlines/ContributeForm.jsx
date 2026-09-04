import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../lib/AuthContext'
import { useToast } from '../../lib/ToastContext'
import { SUBMISSION_TYPES, validateSubmissionDraft } from '../../data/outlineSubmissions'
import Button from '../ui/Button'
import FormField from '../ui/FormField'

const ACCEPTED_FILE_TYPES = ['application/pdf', 'image/jpeg', 'image/png']

export default function ContributeForm({ outlineId, onSubmitted }) {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const toast = useToast()

  const [type, setType] = useState(SUBMISSION_TYPES[0])
  const [session, setSession] = useState('')
  const [title, setTitle] = useState('')
  const [mode, setMode] = useState('file')
  const [file, setFile] = useState(null)
  const [externalUrl, setExternalUrl] = useState('')
  const [formError, setFormError] = useState('')

  const submitMutation = useMutation({
    mutationFn: async () => {
      const validationError = validateSubmissionDraft({ title, mode, hasFile: Boolean(file), externalUrl })
      if (validationError) throw new Error(validationError)

      let file_url = null
      if (mode === 'file') {
        if (!ACCEPTED_FILE_TYPES.includes(file.type)) {
          throw new Error('Please choose a PDF, JPG, or PNG file.')
        }
        if (file.size > 10 * 1024 * 1024) {
          throw new Error('File must be smaller than 10MB.')
        }
        const path = `${user.id}/${Date.now()}-${file.name.replace(/\s+/g, '-')}`
        const { error: uploadError } = await supabase.storage.from('outline-attachments').upload(path, file)
        if (uploadError) throw uploadError
        const { data } = supabase.storage.from('outline-attachments').getPublicUrl(path)
        file_url = data.publicUrl
      }

      const { error: insertError } = await supabase.from('outline_submissions').insert({
        outline_id: outlineId,
        type,
        session: session.trim() || null,
        title: title.trim(),
        file_url,
        external_url: mode === 'link' ? externalUrl.trim() : null,
        submitted_by: user.id,
        submitted_by_email: user.email,
      })
      if (insertError) throw insertError
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['outline_submissions', 'approved', outlineId] })
      toast.success('Thanks — this is awaiting review.')
      setType(SUBMISSION_TYPES[0])
      setSession('')
      setTitle('')
      setMode('file')
      setFile(null)
      setExternalUrl('')
      setFormError('')
      onSubmitted?.()
    },
    onError: (error) => {
      setFormError(error.message)
    },
  })

  function handleSubmit(e) {
    e.preventDefault()
    setFormError('')
    submitMutation.mutate()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <FormField label="Type" type="select" value={type} onChange={(e) => setType(e.target.value)} options={SUBMISSION_TYPES} />
      <FormField
        label="Session (optional)"
        value={session}
        onChange={(e) => setSession(e.target.value)}
        placeholder="e.g. 2023/2024"
      />
      <FormField
        label="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="e.g. 2023 second semester exam"
        required
      />

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode('file')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors',
            mode === 'file'
              ? 'bg-green-900 text-white border-green-900'
              : 'bg-surface text-ink border-hairline hover:bg-surface-low',
          ].join(' ')}
        >
          Upload a file
        </button>
        <button
          type="button"
          onClick={() => setMode('link')}
          className={[
            'rounded-full px-4 py-1.5 text-sm font-semibold border transition-colors',
            mode === 'link'
              ? 'bg-green-900 text-white border-green-900'
              : 'bg-surface text-ink border-hairline hover:bg-surface-low',
          ].join(' ')}
        >
          Paste a link
        </button>
      </div>

      {mode === 'file' ? (
        <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
          <span className="material-symbols-outlined text-3xl text-ink-muted">upload_file</span>
          <span className="text-sm font-semibold text-ink-muted">{file ? file.name : 'Click to choose a file'}</span>
          <span className="text-xs text-ink-muted">PDF, JPG, PNG up to 10MB</span>
          <input
            type="file"
            accept="application/pdf,image/jpeg,image/png"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
      ) : (
        <FormField
          label="Link"
          type="url"
          value={externalUrl}
          onChange={(e) => setExternalUrl(e.target.value)}
          placeholder="https://drive.google.com/…"
        />
      )}

      {formError && <span className="text-xs text-danger">{formError}</span>}

      <Button variant="primary" type="submit" loading={submitMutation.isPending}>
        Submit for review
      </Button>
    </form>
  )
}
