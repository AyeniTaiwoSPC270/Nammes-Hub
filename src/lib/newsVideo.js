// Everything that decides *whether* and *how* a news post plays a video, kept pure so the admin form,
// the cards and the article page all judge a row the same way. Spec: docs/superpowers/specs/2026-10-26-news-video-design.md
//
// No supabase client and no `window` at import time: this module is imported by components that run
// during render on both the public pages and the admin screens.

export const VIDEO_KINDS = ['file', 'youtube']

// Labelled rather than raw enum values in the form: 'auto'/'tap' mean nothing in a dropdown.
export const PREVIEW_STYLES = [
  { value: 'auto', label: 'Autoplay as the card scrolls in' },
  { value: 'tap', label: 'Play when tapped' },
  { value: 'hover', label: 'Play on hover' },
  { value: 'none', label: 'Cover only — never plays on the card' },
]

export const POSITIONS = [
  { value: 'top', label: 'Top of the article' },
  { value: 'bottom', label: 'Bottom of the article' },
]

// 50MB of video/mp4, decided in the spec. There is no transcoding anywhere in this stack, so whatever
// the admin picks is what every visitor downloads.
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024

// How long a card preview runs before it stops itself. Long enough to read a gesture, short enough that
// a grid of twenty cards cannot stream a whole video nobody asked for.
export const PREVIEW_SECONDS = 3

// Supabase's public object URL shape, for our bucket, relative to the storage API root the caller
// passes (`<project>/storage/v1`). The check is anchored on that base rather than on a substring,
// because `url.includes(prefix)` accepts `https://evil.example/storage/v1/object/public/news-videos/x.mp4`
// -- and the whole point of this guard is that an admin payload cannot point the public pages at
// someone else's media.
const PUBLIC_OBJECT_PREFIX = '/object/public/news-videos/'

/**
 * The 11-character id out of any of the URL shapes an admin might paste, or null.
 *
 * Host comparison is exact and deliberately excludes subdomains of subdomains: `youtube.com.evil.example`
 * must not read as YouTube, which is why the host is taken from `new URL()` and compared whole rather
 * than with a `includes('youtube.com')`.
 */
export function parseYouTubeId(input) {
  if (!input || typeof input !== 'string') return null
  let url
  try {
    url = new URL(input.trim())
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase()
  const isYouTube = host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com' || host === 'youtu.be'
  if (!isYouTube) return null

  let id = null
  if (host === 'youtu.be') id = url.pathname.split('/').filter(Boolean)[0]
  else if (url.pathname === '/watch') id = url.searchParams.get('v')
  else {
    const match = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?#]+)/)
    if (match) id = match[1]
  }
  return id && /^[A-Za-z0-9_-]{6,}$/.test(id) ? id : null
}

export function youtubeWatchUrl(id) {
  return `https://www.youtube.com/watch?v=${id}`
}

// nocookie is the privacy-enhanced domain: same player, no view tracked against the visitor's identity.
export function youtubeEmbedUrl(id) {
  return `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`
}

export function youtubeThumbUrl(id) {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`
}

export function isNewsVideoUrl(url, storageBase) {
  if (typeof url !== 'string' || typeof storageBase !== 'string' || !storageBase) return false
  return url.startsWith(`${storageBase.replace(/\/$/, '')}${PUBLIC_OBJECT_PREFIX}`)
}

/**
 * A row's video columns, cleaned into one shape — or `null` when the post has no usable video.
 *
 * Every branch that could disagree with another surface is settled here instead: a `file` row pointing
 * at some other bucket, a `youtube` row with a URL that is not YouTube, and a kind the check constraint
 * would reject all read as "no video" rather than as a broken player on the page.
 */
export function resolveVideo(item, { enabled = true, storageBase } = {}) {
  if (!enabled || !item) return null
  const { video_kind: kind, video_url: url } = item
  if (!kind || !url) return null

  if (kind === 'file') {
    if (!isNewsVideoUrl(url, storageBase)) return null
    return { kind, url, preview: cleanPreview(item.video_preview), position: cleanPosition(item.video_position), duration: item.video_duration || '' }
  }
  if (kind === 'youtube') {
    const id = parseYouTubeId(url)
    if (!id) return null
    return { kind, url, id, preview: cleanPreview(item.video_preview), position: cleanPosition(item.video_position), duration: item.video_duration || '' }
  }
  return null
}

function cleanPreview(value) {
  return PREVIEW_STYLES.some((s) => s.value === value) ? value : 'tap'
}

function cleanPosition(value) {
  return POSITIONS.some((p) => p.value === value) ? value : 'top'
}

/** `95` -> `1:35`, `3725` -> `1:02:05`. Anything unplayable reads as '' rather than `NaN:NaN`. */
export function formatDuration(seconds) {
  const total = Number(seconds)
  if (!Number.isFinite(total) || total <= 0) return ''
  const s = Math.round(total)
  const hrs = Math.floor(s / 3600)
  const mins = Math.floor((s % 3600) / 60)
  const secs = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hrs > 0 ? `${hrs}:${pad(mins)}:${pad(secs)}` : `${mins}:${pad(secs)}`
}

/**
 * True for `4:12`, `1:02:05` and `0:07` — the shapes `formatDuration` writes, plus a bare `7`.
 * Kept strict on purpose: the badge is printed verbatim, so `12 minutes` or `4.12` would render as
 * literally that, and a typo is better caught here than on the public card.
 */
export function isValidDuration(text) {
  if (!text) return true
  return /^\d{1,3}(:[0-5]\d){1,2}$|^\d{1,3}$/.test(String(text).trim())
}

/** The reason a chosen file cannot be uploaded, or '' when it can. Checked before any bytes move. */
export function videoFileError(file) {
  if (!file) return 'Please choose a video file.'
  if (file.type !== 'video/mp4') return 'Please choose an MP4 video file.'
  if (file.size > MAX_VIDEO_BYTES) {
    const mb = Math.round(file.size / (1024 * 1024))
    return `This video is ${mb}MB — the limit is ${Math.round(MAX_VIDEO_BYTES / (1024 * 1024))}MB.`
  }
  return ''
}

/**
 * The file's runtime in seconds, or null when the browser cannot read it (odd codec, truncated file).
 *
 * Uses a detached object URL and always revokes it: the admin screen would otherwise leak one blob URL
 * per attempt, and a phone-recorded file is large enough for that to matter.
 */
export function readVideoDuration(file) {
  return new Promise((resolve) => {
    if (typeof document === 'undefined' || !file) return resolve(null)
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => {
      URL.revokeObjectURL(url)
      resolve(Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null)
    }
    video.onerror = () => {
      URL.revokeObjectURL(url)
      resolve(null)
    }
    video.src = url
  })
}
