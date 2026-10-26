import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabaseClient'
import {
  PREVIEW_STYLES,
  POSITIONS,
  MAX_VIDEO_BYTES,
  videoFileError,
  readVideoDuration,
  formatDuration,
  isValidDuration,
  parseYouTubeId,
  youtubeWatchUrl,
} from '../../lib/newsVideo'
import { ClearImageButton } from './ImageFieldControls'

// Same control styling FormField builds, so a select inside this panel does not look like a
// different form from the fields beside it.
const controlClass =
  'min-h-11 rounded-md border px-3 py-2.5 text-base bg-surface text-ink transition-colors duration-150 focus:outline-none focus:border-brand border-hairline'

const MAX_MB = Math.round(MAX_VIDEO_BYTES / (1024 * 1024))

/**
 * The `video` field type: an uploaded MP4 or a YouTube link, plus the per-post preview style, article
 * position and duration badge. Owns five columns through `kindField`/`previewField`/`positionField`/
 * `durationField`, the same way the `image` type owns its width.
 *
 * `coverUrl` is passed in rather than looked up so this panel can say out loud what a video with no
 * cover will look like on the card -- the agreed warn-don't-block rule.
 */
export default function VideoUploadField({
  label,
  url,
  kind,
  preview,
  position,
  duration,
  coverUrl,
  onChange,
}) {
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkDraft, setLinkDraft] = useState('')
  const fileRef = useRef(null)

  const hasVideo = Boolean(url)
  const durationBad = !isValidDuration(duration)

  async function handleFileChange(e) {
    const file = e.target.files?.[0]
    // Reset before the early returns, or choosing the same file twice would fire no change event.
    e.target.value = ''
    if (!file) return
    const problem = videoFileError(file)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setUploading(true)
    const path = `${Date.now()}-${file.name.replace(/\s+/g, '-')}`
    const { error: uploadError } = await supabase.storage.from('news-videos').upload(path, file, {
      contentType: 'video/mp4',
    })
    if (uploadError) {
      setUploading(false)
      setError(uploadError.message)
      return
    }
    const { data } = supabase.storage.from('news-videos').getPublicUrl(path)
    // Read the runtime from the file itself while we still have it: a badge the admin never has to
    // type is better than one they must remember to update. Failing to read it leaves the field blank
    // rather than failing the upload.
    const seconds = await readVideoDuration(file)
    setUploading(false)
    setLinkOpen(false)
    onChange({ url: data.publicUrl, kind: 'file', duration: seconds ? formatDuration(seconds) : '' })
  }

  function submitLink() {
    const id = parseYouTubeId(linkDraft)
    if (!id) {
      setError('Only YouTube links are supported — paste a youtube.com or youtu.be URL, or upload the file instead.')
      return
    }
    setError('')
    setLinkOpen(false)
    setLinkDraft('')
    // Store the canonical watch URL rather than whatever was pasted: shorts, embed and mobile links all
    // resolve to the same id, and one stored shape is one thing to reason about later.
    onChange({ url: youtubeWatchUrl(id), kind: 'youtube', duration: '' })
  }

  // A <form> here would nest inside the admin form that renders this field -- invalid HTML, and a
  // nested submit is exactly the kind of thing that works in one browser and not another. Enter is
  // handled directly instead.
  function handleLinkKeyDown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      submitLink()
    }
  }

  function handleClear() {
    setError('')
    setLinkOpen(false)
    onChange({ url: '', kind: '', duration: '' })
  }

  if (!hasVideo) {
    return (
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-low"
          >
            {uploading ? 'Uploading…' : 'Upload MP4'}
          </button>
          <button
            type="button"
            onClick={() => setLinkOpen((open) => !open)}
            className="rounded-md border border-hairline bg-surface px-3 py-2 text-sm font-semibold text-ink hover:bg-surface-low"
          >
            YouTube link
          </button>
        </div>
        <span className="text-xs text-ink-muted">
          Optional. MP4 up to {MAX_MB}MB, or a YouTube link — a video post keeps its cover image for the cards.
        </span>
        <input
          ref={fileRef}
          type="file"
          accept="video/mp4"
          onChange={handleFileChange}
          disabled={uploading}
          className="hidden"
        />
        {linkOpen && (
          <div className="mt-1 flex flex-col gap-2">
            <input
              type="url"
              value={linkDraft}
              onChange={(e) => setLinkDraft(e.target.value)}
              onKeyDown={handleLinkKeyDown}
              placeholder="https://www.youtube.com/watch?v=…"
              className={controlClass}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={submitLink}
                className="rounded-md bg-green-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
              >
                Use this link
              </button>
              <button
                type="button"
                onClick={() => {
                  setLinkOpen(false)
                  setLinkDraft('')
                  setError('')
                }}
                className="rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-ink-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
        {error && <span className="text-xs text-danger">{error}</span>}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">{label}</span>

      <div className="relative max-w-[400px] rounded-md bg-surface-low p-3 pr-10">
        <span className="text-sm font-semibold text-ink">
          {kind === 'youtube' ? 'YouTube video' : 'Uploaded MP4'}
        </span>
        <span className="mt-0.5 block truncate text-xs text-ink-muted">{url}</span>
        <ClearImageButton label="Remove video" onClick={handleClear} />
      </div>

      <div className="grid max-w-[400px] grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
            Card preview
          </span>
          <select
            value={preview}
            onChange={(e) => onChange({ preview: e.target.value })}
            className={controlClass}
          >
            {PREVIEW_STYLES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
            Article position
          </span>
          <select
            value={position}
            onChange={(e) => onChange({ position: e.target.value })}
            className={controlClass}
          >
            {POSITIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="flex max-w-[400px] flex-col gap-1.5">
        <span className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">Duration</span>
        <input
          type="text"
          value={duration}
          onChange={(e) => onChange({ duration: e.target.value })}
          placeholder="4:12"
          className={controlClass}
        />
        {durationBad ? (
          <span className="text-xs text-danger">Use m:ss, like 4:12 — this prints on the card.</span>
        ) : (
          <span className="text-xs text-ink-muted">
            {kind === 'youtube'
              ? 'YouTube does not share runtimes without an API key, so this one is typed by hand.'
              : 'Read from the file; edit it if the file was wrong.'}
          </span>
        )}
      </label>

      {!coverUrl && (
        <span className="text-xs font-semibold text-orange-600">
          No cover image — this card will use a placeholder tile.
        </span>
      )}

      {error && <span className="text-xs text-danger">{error}</span>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="text-xs font-semibold text-green-900 hover:underline"
        >
          {uploading ? 'Uploading…' : kind === 'youtube' ? 'Upload a file instead' : 'Replace video'}
        </button>
        {kind === 'file' && (
          <button
            type="button"
            onClick={() => {
              setLinkOpen(true)
              setLinkDraft('')
            }}
            className="text-xs font-semibold text-green-900 hover:underline"
          >
            Use a YouTube link instead
          </button>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="video/mp4"
        onChange={handleFileChange}
        disabled={uploading}
        className="hidden"
      />
      {linkOpen && (
        <div className="flex flex-col gap-2">
          <input
            type="url"
            value={linkDraft}
            onChange={(e) => setLinkDraft(e.target.value)}
            onKeyDown={handleLinkKeyDown}
            placeholder="https://www.youtube.com/watch?v=…"
            className={controlClass}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={submitLink}
              className="rounded-md bg-green-900 px-3 py-2 text-sm font-semibold text-white hover:opacity-90"
            >
              Use this link
            </button>
            <button
              type="button"
              onClick={() => setLinkOpen(false)}
              className="rounded-md border border-hairline px-3 py-2 text-sm font-semibold text-ink-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
