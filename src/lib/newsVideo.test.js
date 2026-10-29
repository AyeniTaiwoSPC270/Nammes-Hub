import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import {
  parseYouTubeId,
  isNewsVideoUrl,
  resolveVideo,
  formatDuration,
  isValidDuration,
  videoFileError,
  youtubeEmbedUrl,
  MAX_VIDEO_BYTES,
} from './newsVideo'

const BASE = 'https://proj.supabase.co/storage/v1'
const BUCKET_URL = `${BASE}/object/public/news-videos/1730000000-clip.mp4`
const opts = (enabled = true) => ({ enabled, storageBase: BASE })

describe('parseYouTubeId', () => {
  it('reads the id out of the shapes an admin actually pastes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeId('https://youtu.be/abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeId('https://m.youtube.com/watch?v=abcdefghijk&t=42')).toBe('abcdefghijk')
    expect(parseYouTubeId('https://www.youtube.com/embed/abcdefghijk')).toBe('abcdefghijk')
    expect(parseYouTubeId('https://www.youtube.com/shorts/abcdefghijk')).toBe('abcdefghijk')
  })

  it('rejects look-alike hosts instead of trusting the substring', () => {
    // The whole reason the host is compared exactly: `includes('youtube.com')` accepts all three of these.
    expect(parseYouTubeId('https://youtube.com.evil.example/watch?v=abcdefghijk')).toBeNull()
    expect(parseYouTubeId('https://evilyoutube.com/watch?v=abcdefghijk')).toBeNull()
    expect(parseYouTubeId('https://notyoutube.com.evil.example/x')).toBeNull()
  })

  it('rejects non-https, missing and malformed input', () => {
    expect(parseYouTubeId('javascript:alert(1)')).toBeNull()
    expect(parseYouTubeId('ftp://youtube.com/watch?v=abcdefghijk')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/watch?v=')).toBeNull()
    expect(parseYouTubeId('https://www.youtube.com/watch')).toBeNull()
    expect(parseYouTubeId('not a url')).toBeNull()
    expect(parseYouTubeId('')).toBeNull()
    expect(parseYouTubeId(null)).toBeNull()
    expect(parseYouTubeId(42)).toBeNull()
  })

  it('rejects a too-short id', () => {
    expect(parseYouTubeId('https://youtu.be/abc')).toBeNull()
  })
})

describe('isNewsVideoUrl', () => {
  it('accepts an object URL inside our own bucket', () => {
    expect(isNewsVideoUrl(BUCKET_URL, BASE)).toBe(true)
  })

  it('rejects other buckets, other hosts and arbitrary media', () => {
    expect(isNewsVideoUrl(`${BASE}/object/public/news-images/a.png`, BASE)).toBe(false)
    expect(isNewsVideoUrl('https://evil.example/storage/v1/object/public/news-videos/x.mp4', BASE)).toBe(false)
    expect(isNewsVideoUrl('https://evil.example/news-videos/x.mp4', BASE)).toBe(false)
    // A look-alike path on a different project must not pass as ours either.
    expect(isNewsVideoUrl('https://other.supabase.co/storage/v1/object/public/news-videos/x.mp4', BASE)).toBe(false)
    expect(isNewsVideoUrl(BUCKET_URL, '')).toBe(false)
    expect(isNewsVideoUrl(BUCKET_URL, undefined)).toBe(false)
    expect(isNewsVideoUrl('', BASE)).toBe(false)
    expect(isNewsVideoUrl(null, BASE)).toBe(false)
  })

  it('tolerates a trailing slash on the storage base', () => {
    expect(isNewsVideoUrl(BUCKET_URL, `${BASE}/`)).toBe(true)
  })
})

describe('resolveVideo', () => {
  const base = { video_kind: 'file', video_url: BUCKET_URL, video_preview: 'tap', video_position: 'top', video_duration: '1:35' }

  it('is null when the kill switch is off, even for a perfect row', () => {
    expect(resolveVideo(base, opts(false))).toBeNull()
  })

  it('is null for a file when no storage base is known, rather than trusting the path alone', () => {
    expect(resolveVideo(base, { enabled: true })).toBeNull()
  })

  it('returns a cleaned video for a valid uploaded file', () => {
    expect(resolveVideo(base, opts())).toEqual({
      kind: 'file',
      url: BUCKET_URL,
      preview: 'tap',
      position: 'top',
      duration: '1:35',
      previewSeconds: 3,
      loop: false,
    })
  })

  it('is null for a post with no video at all', () => {
    expect(resolveVideo({}, opts())).toBeNull()
    expect(resolveVideo(null, opts())).toBeNull()
    expect(resolveVideo({ video_kind: 'file' }, opts())).toBeNull()
  })

  it('is null when a file row points outside the news-videos bucket', () => {
    expect(resolveVideo({ ...base, video_url: 'https://evil.example/x.mp4' }, opts())).toBeNull()
  })

  it('is null when a youtube row is not actually YouTube', () => {
    expect(resolveVideo({ ...base, video_kind: 'youtube', video_url: 'https://youtube.com.evil.example/watch?v=abcdefghijk' }, opts())).toBeNull()
  })

  it('resolves a valid YouTube row to its id', () => {
    const v = resolveVideo({ ...base, video_kind: 'youtube', video_url: 'https://youtu.be/abcdefghijk' }, opts())
    expect(v.kind).toBe('youtube')
    expect(v.id).toBe('abcdefghijk')
    expect(youtubeEmbedUrl(v.id)).toContain('youtube-nocookie.com/embed/abcdefghijk')
  })

  it('falls back to defaults for preview and position the check constraint would have rejected', () => {
    const v = resolveVideo({ ...base, video_preview: 'hoverish', video_position: 'sideways' }, opts())
    expect(v.preview).toBe('tap')
    expect(v.position).toBe('top')
  })
})

describe('preview timing', () => {
  const row = { video_kind: 'file', video_url: BUCKET_URL, video_preview: 'tap', video_position: 'top' }

  it('prefers the post, then the site default, then 3 seconds', () => {
    expect(resolveVideo({ ...row, video_preview_seconds: 9 }, opts()).previewSeconds).toBe(9)
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 7 } }).previewSeconds).toBe(7)
    expect(resolveVideo(row, opts()).previewSeconds).toBe(3)
  })

  it('settles a value the check constraint would have rejected', () => {
    // A hand-edited row must not reach a renderer: out of range and non-integers fall through.
    for (const bad of [1, 31, 0, -5, 'six', 4.5]) {
      const v = resolveVideo({ ...row, video_preview_seconds: bad }, { ...opts(), defaults: { seconds: 7 } })
      expect(v.previewSeconds, String(bad)).toBe(7)
    }
  })

  it('clamps the inherited default too, then floors at the constant', () => {
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 99 } }).previewSeconds).toBe(30)
    expect(resolveVideo(row, { ...opts(), defaults: { seconds: 1 } }).previewSeconds).toBe(2)
    expect(resolveVideo(row, opts()).previewSeconds).toBe(3)
  })

  it('reads the loop tri-state: post wins, else the default, else off', () => {
    expect(resolveVideo({ ...row, video_loop: false }, { ...opts(), defaults: { loop: true } }).loop).toBe(false)
    expect(resolveVideo({ ...row, video_loop: true }, opts()).loop).toBe(true)
    expect(resolveVideo(row, { ...opts(), defaults: { loop: true } }).loop).toBe(true)
    expect(resolveVideo(row, opts()).loop).toBe(false)
    // A JSON payload delivers booleans, not strings -- a truthy "false" must not read as loop on.
    expect(resolveVideo({ ...row, video_loop: 'false' }, { ...opts(), defaults: { loop: true } }).loop).toBe(true)
  })
})

// The card is where a preview is actually shown, and both settings die quietly if it reads the
// constant or forgets the loop attribute -- nothing else in the suite renders it.
describe('the card honours the per-post timing', () => {
  const cards = readFileSync('src/components/content/ContentCards.jsx', 'utf8')

  it('loops when the post says so', () => {
    expect(cards).toContain('loop={video.loop}')
  })

  it("counts down the row's own seconds and never the constant", () => {
    expect(cards).toContain('previewSeconds')
    expect(cards).not.toContain('PREVIEW_SECONDS')
  })
})

describe('formatDuration / isValidDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(95)).toBe('1:35')
    expect(formatDuration(3725)).toBe('1:02:05')
    expect(formatDuration(7)).toBe('0:07')
  })

  it('reads unusable seconds as an empty badge rather than NaN', () => {
    expect(formatDuration(0)).toBe('')
    expect(formatDuration(-4)).toBe('')
    expect(formatDuration(undefined)).toBe('')
    expect(formatDuration('soon')).toBe('')
  })

  it('round-trips its own output', () => {
    expect(isValidDuration(formatDuration(95))).toBe(true)
    expect(isValidDuration(formatDuration(3725))).toBe(true)
  })

  it('accepts a blank duration (a badge that shows no runtime is fine)', () => {
    expect(isValidDuration('')).toBe(true)
    expect(isValidDuration(null)).toBe(true)
  })

  it('rejects prose and out-of-range minutes, which would print verbatim on the card', () => {
    expect(isValidDuration('4.12')).toBe(false)
    expect(isValidDuration('12 minutes')).toBe(false)
    expect(isValidDuration('1:99')).toBe(false)
    expect(isValidDuration('4:1')).toBe(false)
  })
})

// The review queue is the trap this whole feature could fall into: `apply_change_request` rewrites
// every column it names and sets the rest to NULL, so a media column added to `news` without being
// added here is a video that vanishes the first time a non-owner's edit is approved.
//
// It reads the LATEST matching migration on purpose. Two files now define the function, and this test
// originally took the FIRST match -- which after the second migration meant every assertion below kept
// passing against the stale copy no client ships.
describe('apply_change_request knows about every news video column', () => {
  const VIDEO_COLUMNS = [
    'video_kind', 'video_url', 'video_preview', 'video_position', 'video_duration',
    'video_preview_seconds', 'video_loop',
  ]

  // Found by content rather than by name: the timestamp prefix changes whenever this is re-cut, and a
  // guard that silently reads nothing (or the pre-video migration) would pass for the wrong reason.
  const newsBranch = (() => {
    const dir = 'supabase/migrations'
    const files = readdirSync(dir)
      .filter((name) => name.endsWith('.sql'))
      .sort() // readdir order is filesystem-defined; "latest" has to mean chronological name order
    const matches = files
      .map((name) => readFileSync(`${dir}/${name}`, 'utf8'))
      .filter((sql) => sql.includes('video_kind') && sql.includes('apply_change_request'))
    const migration = matches.at(-1)
    if (!migration) return null
    const start = migration.indexOf("req.entity_type = 'news'")
    const end = migration.indexOf("req.entity_type = 'events'")
    return start > -1 && end > start ? migration.slice(start, end) : null
  })()

  it('exists at all (otherwise every assertion below is vacuously true)', () => {
    expect(newsBranch).toBeTruthy()
  })

  it('writes all seven columns on insert', () => {
    const insert = newsBranch.slice(newsBranch.indexOf('insert into public.news'), newsBranch.indexOf('else'))
    for (const column of VIDEO_COLUMNS) expect(insert, column).toContain(column)
  })

  it('writes all seven columns on update, each guarded on the payload carrying it', () => {
    const update = newsBranch.slice(newsBranch.indexOf('update public.news'))
    for (const column of VIDEO_COLUMNS) {
      // Unguarded, a request submitted before this migration -- or one whose sender had the kill
      // switch off, and so sent no video fields -- would write NULL over the live video.
      expect(update, column).toContain(`${column} = case when req.payload ? '${column}'`)
    }
  })
})

describe('videoFileError', () => {
  const mp4 = { type: 'video/mp4', size: 10 * 1024 * 1024 }

  it('accepts an MP4 under the cap', () => {
    expect(videoFileError(mp4)).toBe('')
  })

  it('names the actual size when the file is too big', () => {
    const err = videoFileError({ type: 'video/mp4', size: 84 * 1024 * 1024 })
    expect(err).toContain('84MB')
    expect(err).toContain('50MB')
  })

  it('rejects other types before any upload starts', () => {
    expect(videoFileError({ type: 'video/quicktime', size: 1024 })).toContain('MP4')
    expect(videoFileError({ type: 'image/png', size: 1024 })).toContain('MP4')
    expect(videoFileError(null)).toBeTruthy()
  })

  it('agrees with the bucket file_size_limit in the migration', () => {
    expect(MAX_VIDEO_BYTES).toBe(52428800)
  })
})
