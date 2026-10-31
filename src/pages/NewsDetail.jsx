import { useState, useEffect, useRef } from 'react'
import { useParams, Navigate, useNavigate } from 'react-router-dom'
import Breadcrumbs from '../components/Breadcrumbs'
import Button from '../components/ui/Button'
import Badge from '../components/ui/Badge'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import ReportProblem from '../components/ReportProblem'
import { SkeletonText } from '../components/ui/Skeleton'
import { ContentLook } from '../components/content/ContentCards'
import { useNewsQuery, getNewsByKey, resolveNewsVideo, useNewsVideoFlag, useNewsShareFlag } from '../data/news'
import { shareArticle, copyLink, whatsappUrl } from '../lib/share'
import { youtubeEmbedUrl, youtubeThumbUrl } from '../lib/newsVideo'
import { usePageLook } from '../data/contentLooks'
import { linkifyText } from '../lib/linkify'
import { useToast } from '../lib/ToastContext'

/**
 * A post's player: a native `<video>` for an upload, a click-to-load facade for a YouTube link.
 *
 * The facade shows the cover (or the video's own thumbnail) and only builds the iframe on a real click,
 * so an article full of embeds makes zero third-party requests until somebody asks for one. Nothing
 * autoplays here -- `video_preview` is a card-only setting; the article always hands over the controls.
 *
 * If the file has since been deleted from storage the player is replaced by the cover, and by a plain
 * link when there is no cover, rather than leaving a broken box on a published post.
 */
function NewsVideo({ video, cover }) {
  const [failed, setFailed] = useState(false)
  const [playing, setPlaying] = useState(false)

  if (failed) {
    return (
      <div className="content-radius mt-6">
        {cover ? (
          <img src={cover} alt="" className="w-full" />
        ) : (
          <a href={video.url} className="text-brand-orange underline" target="_blank" rel="noreferrer">
            Watch this video
          </a>
        )}
      </div>
    )
  }

  if (video.kind === 'youtube') {
    if (playing) {
      return (
        <div className="content-radius relative mt-6 aspect-video w-full overflow-hidden bg-black">
          <iframe
            src={youtubeEmbedUrl(video.id)}
            title="Video"
            allow="autoplay; encrypted-media; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full border-0"
          />
        </div>
      )
    }
    return (
      <button
        type="button"
        onClick={() => setPlaying(true)}
        className="content-radius relative mt-6 block w-full overflow-hidden bg-ink-900 text-left"
      >
        <img
          src={cover || youtubeThumbUrl(video.id)}
          alt=""
          className="aspect-video w-full object-cover"
          loading="lazy"
          decoding="async"
        />
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg">
            <span className="material-symbols-outlined text-3xl" aria-hidden="true">
              play_arrow
            </span>
          </span>
        </span>
        <span className="sr-only">Play video</span>
      </button>
    )
  }

  return (
    <video
      src={video.url}
      poster={cover || undefined}
      controls
      playsInline
      preload="metadata"
      onError={() => setFailed(true)}
      className="content-radius mt-6 w-full bg-black"
    />
  )
}

/**
 * The share control: the phone's own sheet where one exists, with Copy link and WhatsApp beside it.
 * Rendered as a menu rather than three buttons because on a phone the sheet is the whole point and
 * two more buttons would crowd the footer of every article.
 */
function ArticleShare({ title, path }) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  useEffect(() => {
    if (!open) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('pointerdown', onPointerDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  async function handleNative() {
    setOpen(false)
    const result = await shareArticle({ title, path })
    if (result.reason === 'error') toast.error('Could not open the share sheet.')
  }

  async function handleCopy() {
    setOpen(false)
    const copied = await copyLink(path)
    if (copied) toast.success('Link copied to clipboard.')
    else toast.error('Could not copy the link — copy it from the address bar.')
  }

  function handleWhatsApp() {
    setOpen(false)
    window.open(whatsappUrl(title, path), '_blank', 'noopener,noreferrer')
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted transition-colors hover:text-brand-orange"
      >
        <span className="material-symbols-outlined text-base" aria-hidden="true">
          share
        </span>
        Share
      </button>

      {open && (
        <div role="menu" className="absolute bottom-full left-0 z-20 mb-2 w-48 rounded-lg border border-hairline bg-surface p-1 shadow-md">
          {canNativeShare && (
            <button
              type="button"
              role="menuitem"
              onClick={handleNative}
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-900 hover:bg-surface-low"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">share</span>
              Share…
            </button>
          )}
          <button
            type="button"
            role="menuitem"
            onClick={handleCopy}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-900 hover:bg-surface-low"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">content_copy</span>
            Copy link
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={handleWhatsApp}
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold text-ink-900 hover:bg-surface-low"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">campaign</span>
            WhatsApp
          </button>
        </div>
      )}
    </div>
  )
}

export default function NewsDetail() {
  const { key } = useParams()
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useNewsQuery()
  // Hook first, before any early return below: it has to run on every render or the loading and error
  // branches would render a different number of hooks than the loaded one.
  const videoEnabled = useNewsVideoFlag()
  const shareEnabled = useNewsShareFlag()
  // A detail page has no cards and no grid, so the look reaches it in exactly two places: the category
  // accent and the hero's corner radius. `ContentLook` wraps the article only, NOT the page, so the
  // breadcrumb, the back button and the nav keep the site's own colours.
  const { theme } = usePageLook('news')

  if (isError && !data) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <ErrorState message="Couldn't load this post right now." onRetry={refetch} />
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="h-4 w-48 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-4 h-3 w-24 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-2 h-8 w-2/3 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-3 h-4 w-56 animate-pulse rounded-sm bg-hairline" />
        <div className="mt-6 h-64 w-full animate-pulse rounded-lg bg-hairline" />
        <div className="mt-6">
          <SkeletonText lines={4} />
        </div>
      </div>
    )
  }

  const post = getNewsByKey(data ?? [], key)
  if (!post) return <Navigate to="/news" replace />

  // One URL per article: an id link resolves and then lands on the slug form, so every link ever
  // shared keeps working without the canonical address becoming two.
  const canonical = post.slug ?? post.id
  if (key !== canonical) return <Navigate to={`/news/${canonical}`} replace />

  const video = resolveNewsVideo(post, videoEnabled)
  // A video at the top IS the article's media, so the cover is not repeated above it -- it has already
  // done its job on the card that got the reader here. At the bottom, the cover keeps its usual slot.
  const showCover = Boolean(post.image_url) && !(video && video.position === 'top')

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
      <Breadcrumbs items={[{ label: 'News', to: '/news' }, { label: post.title }]} />

      <ContentLook theme={theme}>
        <div className="text-xs font-semibold uppercase tracking-[.05em] text-brand-orange">
          {post.category}
        </div>
        <h1 className="mt-1.5 text-3xl font-bold text-ink-900">{post.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
          <span>Posted by {post.author}</span>
          <span aria-hidden="true">&middot;</span>
          <span>{post.date}</span>
          {post.badge_tone && <Badge tone={post.badge_tone}>{post.badge_label}</Badge>}
        </div>

        {video && video.position === 'top' && <NewsVideo video={video} cover={post.image_url} />}

        <Reveal>
          {showCover && (
            <img
              src={post.image_url}
              decoding="async"
              alt=""
              style={{ width: `${post.image_width_pct || 100}%` }}
              className="content-radius mt-6"
            />
          )}

          <p className="mt-6 max-w-2xl leading-relaxed text-ink">{linkifyText(post.body)}</p>

          {video && video.position === 'bottom' && <NewsVideo video={video} cover={post.image_url} />}
        </Reveal>
      </ContentLook>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <Button variant="ghost" onClick={() => navigate('/news')}>
          Back to news
        </Button>
        {shareEnabled && <ArticleShare title={post.title} path={`/news/${canonical}`} />}
      </div>

      <div className="mt-4">
        <ReportProblem title={post.title} />
      </div>
    </div>
  )
}
