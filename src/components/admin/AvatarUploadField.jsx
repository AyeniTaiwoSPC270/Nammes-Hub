import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function AvatarUploadField({ label, url, onChange }) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setError('Please choose an image file.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be smaller than 5MB.')
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('exco-photos').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('exco-photos').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
      <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-dashed border-hairline bg-surface-low p-6 text-center transition-colors hover:bg-hairline/20">
        <span className="material-symbols-outlined text-3xl text-ink-muted">add_photo_alternate</span>
        <span className="text-sm font-semibold text-ink-muted">{uploading ? 'Uploading…' : 'Click to upload photo'}</span>
        <span className="text-xs text-ink-muted">JPEG, PNG up to 5MB</span>
        <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} className="hidden" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div className="relative mt-2 h-[120px] w-[120px]">
          <div className="h-full w-full overflow-hidden rounded-full bg-surface-low shadow-md">
            <img src={url} alt="" className="h-full w-full object-cover" />
          </div>
          <button
            type="button"
            onClick={() => onChange('')}
            aria-label="Remove photo"
            className="absolute -right-1 -top-1 flex h-7 w-7 items-center justify-center rounded-full bg-danger text-white shadow-md transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>
      )}
    </div>
  )
}
