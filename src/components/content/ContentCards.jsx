// The three card components and the wrapper that carries a look, shared by /events, /news, Home and the
// Design Studio's preview.
//
// THIS IS THE WHOLE POINT OF THE FILE GROUP. Before it, there were four card renderers that did not agree:
// hand-written markup inside Events.jsx and News.jsx, the generic ui/Card on Home's news block, and a
// fourth inline copy of the event card at Home.jsx:204-217. The studio's preview is only worth anything if
// it renders what the public page renders, so the preview renders THESE.
//
// Which is also the lesson api/_lib/quizCharacterArt.js is built around: one place draws a character, and
// both the browser and the card parser read it. A design studio whose preview draws its own approximation
// is the same mistake with a smaller blast radius.
import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Badge from '../ui/Badge'
import BlurredBackdropImage from '../ui/BlurredBackdropImage'
import { themeVars } from '../../../api/_lib/contentTheme.js'
import { resolveNewsVideo, useNewsVideoFlag } from '../../data/news'
import { useContentSettingsQuery } from '../../data/contentLooks'

// The same pair Events.jsx and Home.jsx both used for the reveal cascade.
export const CARD_STAGGER = 0.06
export const MAX_STAGGER_DELAY = 0.3

// How long a preview may sit mounted without a single frame before it is given up on. Deliberately
// longer than any allowed preview length (2-30s): it only exists so an autoplay the phone refuses, or a
// file that never loads, cannot leave a video element parked on the card forever.
const NEVER_STARTED_MS = 8000

/**
 * The reveal delay for card `index`, or none at all when the look has the cascade switched off.
 *
 * The parent owns this rather than the card, because the parent is what knows the index. `Reveal` takes a
 * `delay`, so switching the cascade off is a 0 rather than a different tree -- an admin who turns it off
 * sees the same cards arrive together.
 */
export function staggerDelay(theme, index) {
  if (!theme?.layout?.stagger) return 0
  return Math.min(index * CARD_STAGGER, MAX_STAGGER_DELAY)
}

// Mirrors the `tones` map in src/components/ui/Card.jsx:4-8, on purpose: `news.tone` and `events.tone` are
// per-ITEM accents chosen in the admin, and they have to keep painting the same colour they paint today.
// NewsDetail and Card are the two other readers of those columns.
const TONES = {
  neutral: 'border-hairline bg-surface',
  green: 'border-green-900 bg-green-900 text-white',
  orange: 'border-transparent bg-orange-100 dark:bg-brand-orange/15',
}

// Text colour follows the surface, so a green tone's title does not stay near-black on near-black.
const TONE_TEXT = {
  green: {
    title: 'text-white',
    meta: 'text-white/70',
    body: 'text-white/90',
    // On a dark fill the accent token would be the wrong thing: the site's --color-brand-orange is a dark
    // brown in light mode precisely so it reads on a page surface. The orange-500 is chosen for contrast
    // against green-900 instead.
    eyebrow: 'text-orange-500',
    action: 'text-orange-500',
  },
  orange: { title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink', eyebrow: 'text-brand-orange', action: 'text-brand-orange' },
  // `text-brand-orange` rather than `text-orange-600`, even though the two are the same hex today
  // (src/index.css:32). `--color-brand-orange` is the token the studio's accent repoints -- it is one of
  // the three in contentTheme.js themeVars -- so the category label and the Read more link follow the look
  // instead of staying orange whatever the admin chose.
  neutral: { title: 'text-ink-900', meta: 'text-ink-muted', body: 'text-ink', eyebrow: 'text-brand-orange', action: 'text-brand-orange' },
}

const EYEBROW = 'text-xs font-bold uppercase tracking-[.05em]'

/**
 * Carries every `--content-*` custom property for everything inside it.
 *
 * The vars are emitted on a wrapper rather than per card because a card is also rendered by the studio's
 * preview and by a loading skeleton, and none of those should have to know the scale maps.
 */
export function ContentLook({ theme, className = '', children }) {
  return (
    <div style={themeVars(theme)} className={className}>
      {children}
    </div>
  )
}

/**
 * The card grid.
 *
 * The vars go on the grid element itself rather than on a wrapper around it, so nothing has to account for
 * an extra `div` between a flex column and its grid. `theme` is required rather than optional: a grid
 * without the vars would silently fall back to three columns and an unset radius, which looks like a bug the
 * admin cannot find the cause of.
 */
export function ContentGrid({ theme, className = '', children }) {
  return (
    <div style={themeVars(theme)} className={['content-grid', className].filter(Boolean).join(' ')}>
      {children}
    </div>
  )
}

/**
 * A page's worth of cards: an optional featured story, then the grid. Both live inside one `ContentLook` so
 * the featured card inherits the same vars as the cards below it.
 */
export function ContentFeed({ theme, featured = null, gap = 'gap-5', children }) {
  return (
    <ContentLook theme={theme} className={['flex flex-col', gap].join(' ')}>
      {featured}
      <div className="content-grid">{children}</div>
    </ContentLook>
  )
}

/**
 * One event. `event.meta` and `event.description` are optional, which is what lets Home's three-up
 * preview use the same card as /events rather than a fourth copy of it.
 */
export function EventCard({ event, theme }) {
  const tone = TONES[event.tone] ? event.tone : 'neutral'
  const text = TONE_TEXT[tone]
  return (
    <Link
      to={`/events/${event.id}`}
      className={[
        'content-card flex flex-col overflow-hidden border transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5',
        TONES[tone],
        text.body,
      ].join(' ')}
    >
      <CardImage theme={theme} src={event.image_url} />
      <div className="content-card-body flex flex-grow flex-col gap-2">
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          {event.meta && <span className={['text-sm', text.meta].join(' ')}>{event.meta}</span>}
          <div className={['ml-auto flex items-center gap-1 text-sm', text.meta].join(' ')}>
            <span className="material-symbols-outlined text-[16px]">calendar_today</span>
            {event.date}
          </div>
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{event.title}</h3>
        {event.description && <p className={['content-clamp flex-grow text-base leading-relaxed', text.body].join(' ')}>{event.description}</p>}
      </div>
    </Link>
  )
}

/**
 * One news item. `excerpt` is passed only by Home, which shows a body preview and a "Read more" link;
 * /news shows the date instead, so an excerpt prop rather than a guess at which page this is.
 */
export function NewsCard({ item, theme, excerpt = '' }) {
  const videoEnabled = useNewsVideoFlag()
  const settings = useContentSettingsQuery().data
  const video = resolveNewsVideo(item, videoEnabled, settings)
  const tone = TONES[item.tone] ? item.tone : 'neutral'
  const text = TONE_TEXT[tone]
  return (
    <Link
      to={`/news/${item.id}`}
      className={['content-card flex flex-col overflow-hidden border transition-shadow hover:shadow-lg', TONES[tone], text.body].join(' ')}
    >
      <VideoBand video={video} hasCover={Boolean(item.image_url) && theme.card.image !== 'none'} className="content-image w-full shrink-0">
        <CardImage theme={theme} src={item.image_url} />
      </VideoBand>
      <div className="content-card-body flex flex-grow flex-col gap-2">
        <div className="flex items-center gap-2">
          {item.category && <span className={[EYEBROW, text.eyebrow].join(' ')}>{item.category}</span>}
          {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{item.title}</h3>
        {excerpt ? (
          <p className={['content-clamp text-base leading-relaxed', text.body].join(' ')}>{excerpt}</p>
        ) : (
          <p className={['mt-auto text-sm', text.meta].join(' ')}>{item.date}</p>
        )}
        <span className={['inline-flex items-center gap-1 text-sm font-bold', text.action].join(' ')}>
          Read more
          <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
        </span>
      </div>
    </Link>
  )
}

/**
 * The first story on /news, shown larger than the rest.
 *
 * `layout: 'image-left'` keeps the fixed half-height panel it has always had on phones -- its height comes
 * from the text beside it on a desktop, so an aspect ratio there would fight the layout rather than fill it.
 * `image-top` is the one that uses `--content-aspect`, because there the image is the card's own band.
 */
export function NewsFeatureCard({ item, theme }) {
  const videoEnabled = useNewsVideoFlag()
  const settings = useContentSettingsQuery().data
  const video = resolveNewsVideo(item, videoEnabled, settings)
  const tone = TONES[item.tone] ? item.tone : 'neutral'
  const text = TONE_TEXT[tone]
  const side = theme.layout.featured === 'image-left'
  // With a video the band carries the size and the picture fills it; without one the picture carries
  // the size exactly as it always has, so a video post and a text post lay out identically.
  const fill = Boolean(video)
  const bandClass = side ? 'h-64 w-full shrink-0 md:h-auto md:w-1/2' : 'content-image w-full shrink-0'
  const image = item.image_url ? (
    theme.card.image === 'none' ? null : theme.card.image === 'cover' ? (
      <BlurredBackdropImage
        src={item.image_url}
        className={fill ? 'h-full w-full' : bandClass}
      />
    ) : (
      <img
        src={item.image_url}
        loading="lazy"
        decoding="async"
        alt=""
        className={fill ? 'h-full w-full object-cover' : `${bandClass} object-cover`}
      />
    )
  ) : null

  return (
    <Link
      to={`/news/${item.id}`}
      className={[
        'content-card flex flex-col overflow-hidden border transition-shadow',
        // A look with `card.shadow: 'none'` has nothing to lift TOWARDS, so the hover shadow is only declared
        // while the resting one is real. Leaving it in unconditionally was a transition animating nothing.
        theme.card.shadow === 'none' ? '' : 'hover:shadow-lg',
        side ? 'md:flex-row' : '',
        TONES[tone],
        text.body,
      ].join(' ')}
    >
      <VideoBand video={video} hasCover={Boolean(item.image_url) && theme.card.image !== 'none'} className={bandClass}>
        {image}
      </VideoBand>
      <div className={['content-card-body flex w-full flex-col justify-center gap-2', side ? 'md:w-1/2' : ''].join(' ')}>
        <div className="flex items-center gap-2">
          {item.category && <span className={[EYEBROW, text.eyebrow].join(' ')}>{item.category}</span>}
          {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
        </div>
        <h3 className={['content-card-title content-clamp m-0 font-bold', text.title].join(' ')}>{item.title}</h3>
        <p className={['text-sm', text.meta].join(' ')}>{item.date}</p>
      </div>
    </Link>
  )
}

/**
 * The card's picture, in whichever of the three ways the look asks for. Nothing at all when
 * `card.image` is 'none', which is the admin's way of saying these rows have no usable picture.
 */
function CardImage({ theme, src }) {
  if (!src || theme.card.image === 'none') return null
  if (theme.card.image === 'plain') {
    return <img src={src} loading="lazy" decoding="async" alt="" className="content-image w-full shrink-0 object-cover" />
  }
  return <BlurredBackdropImage src={src} className="content-image w-full shrink-0" />
}

/**
 * A card's media band for a post that has a video: the cover (or, with no cover, a placeholder tile)
 * with the VIDEO badge and the preview layer over it.
 *
 * A video band is drawn even when the look has `card.image: 'none'`. That switch is the admin saying
 * these rows have no usable *picture*; the play affordance is the video's own, and a video post that
 * renders no media at all on the card would be undiscoverable.
 *
 * `className` is the band's own size -- the classes the cover would have carried. The wrapper takes
 * them so the band keeps the aspect ratio and the flex behaviour it had when it was just an <img>,
 * and the cover inside fills it instead of sizing it. Without them a feature card's half-width panel
 * would collapse, because the height came from the picture.
 */
function VideoBand({ video, hasCover, className = '', children }) {
  if (!video) return children
  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      {children}
      {!hasCover && <div className="absolute inset-0 bg-ink-900" />}
      <VideoOverlay video={video} />
    </div>
  )
}

/**
 * The VIDEO/duration badges and, for an uploaded file, the few-second preview the admin chose for this
 * post. Always muted and playsInline -- a card that made noise would be a bug report, and autoplay
 * with sound is blocked by every browser anyway.
 *
 * A YouTube post gets badges and no play control: the card is an `<Link>`, and an iframe inside an
 * anchor is invalid HTML, so the player belongs on the article page where it is one tap away.
 * `preview: 'none'` likewise renders the glyph without a control -- that card never plays.
 */
function VideoOverlay({ video }) {
  const [playing, setPlaying] = useState(false)
  const bandRef = useRef(null)
  const timerRef = useRef(null)
  const startedRef = useRef(false)

  const stopPreview = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    setPlaying(false)
  }, [])

  // Arms the stop countdown, but only once frames are actually flowing: the preview is N seconds
  // of PLAYING, not N seconds of mounting. Starting the clock at mount let a slow phone connection
  // spend the whole budget buffering, unmount the video before its first frame and report "video does
  // not play" while a desktop on the same code played fine.
  //
  // With repeat on there is no timer at all -- the stop triggers (hover-off, tap-toggle, scroll-out)
  // are the whole rule, which is what the owner chose over a looping cap that visibly restarts mid-read.
  const armStop = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    if (video.loop) return
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setPlaying(false)
    }, video.previewSeconds * 1000)
  }, [video.loop, video.previewSeconds])

  // Starts muted. The clock it sets here is only a safety net for a file that never starts at all
  // (autoplay blocked, dead connection), so it is deliberately longer than the preview itself and is
  // replaced by `armStop` the moment playback begins.
  const startPreview = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    setPlaying(true)
    timerRef.current = setTimeout(() => {
      timerRef.current = null
      setPlaying(false)
    }, NEVER_STARTED_MS)
  }, [])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  // `auto`: play when the card is mostly on screen. With a timed preview that is once for the rest
  // of the page load (`startedRef` is the "once"); with repeat it is every re-entry, and the
  // observer STOPS it on the way out -- otherwise a card scrolled past keeps streaming a 30MB file
  // on a phone with nothing on screen to show it.
  useEffect(() => {
    if (video.kind !== 'file' || video.preview !== 'auto') return undefined
    const node = bandRef.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.some((entry) => entry.isIntersecting)
        if (visible) {
          if (startedRef.current && !video.loop) return
          startedRef.current = true
          startPreview()
        } else if (video.loop) {
          stopPreview()
        }
      },
      { threshold: 0.6 }
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [video.kind, video.preview, video.loop, startPreview, stopPreview])

  const canPlay = video.kind === 'file' && video.preview !== 'none'
  const badge =
    'absolute left-2 top-2 z-10 rounded-md bg-black/75 px-2 py-1 text-[10px] font-bold uppercase tracking-[.08em] text-white'

  return (
    <div
      ref={bandRef}
      className="absolute inset-0 z-10"
      onPointerEnter={(e) => {
        if (canPlay && video.preview === 'hover' && e.pointerType === 'mouse') startPreview()
      }}
      onPointerLeave={(e) => {
        // Symmetric with the enter handler, and the reason a phone used to play nothing: touch fires
        // pointerleave the instant a finger lifts (or while it scrolls across the band), so without
        // this guard a tap started a preview that cancelled itself in the same gesture and a scroll
        // cut a playing one dead -- on a mouse only.
        if (canPlay && video.preview === 'hover' && e.pointerType === 'mouse') stopPreview()
      }}
    >
      {playing && (
        <video
          src={video.url}
          loop={video.loop}
          className="absolute inset-0 h-full w-full object-cover"
          autoPlay
          muted
          playsInline
          preload="metadata"
          onPlaying={armStop}
          aria-label="Video preview"
        />
      )}

      <span className={badge}>Video</span>
      {video.duration && (
        <span className="absolute bottom-2 right-2 z-10 rounded-md bg-black/75 px-2 py-1 text-[11px] font-semibold text-white">
          {video.duration}
        </span>
      )}

      <div className="absolute inset-0 flex items-center justify-center">
        {canPlay ? (
          <button
            type="button"
            aria-label={playing ? 'Stop preview' : 'Play preview'}
            // The card is a link; without this the tap would navigate to the article instead of
            // previewing, which is the whole point of this control.
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              if (playing) stopPreview()
              else startPreview()
            }}
            className="pointer-events-auto flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-ink shadow-md transition-transform hover:scale-105"
          >
            <span className="material-symbols-outlined text-2xl" aria-hidden="true">
              {playing ? 'stop' : 'play_arrow'}
            </span>
          </button>
        ) : (
          <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-ink shadow-md">
            <span className="material-symbols-outlined text-2xl">play_arrow</span>
          </span>
        )}
      </div>
    </div>
  )
}