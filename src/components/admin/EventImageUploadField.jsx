import { useState } from 'react'
import { supabase } from '../../lib/supabaseClient'

export default function EventImageUploadField({ label, url, onChange }) {
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
    const { error: uploadError } = await supabase.storage.from('event-images').upload(path, file)
    setUploading(false)
    if (uploadError) {
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('event-images').getPublicUrl(path)
    onChange(data.publicUrl)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-green-900">{label}</span>
      <input type="file" accept="image/*" onChange={handleFileChange} disabled={uploading} />
      {error && <span className="text-xs text-danger">{error}</span>}
      {url && (
        <div className="mt-2 aspect-[4/3] w-full max-w-[400px] overflow-hidden rounded-sm bg-green-100">
          <img src={url} alt="" className="h-full w-full object-cover" />
        </div>
      )}
    </div>
  )
}
