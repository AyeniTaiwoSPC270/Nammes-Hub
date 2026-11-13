import { useState } from 'react'
import { Link, useParams, Navigate } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import ReportProblem from '../components/ReportProblem'
import { SkeletonText } from '../components/ui/Skeleton'
import { ContentGrid, ContentLook, NewsCard } from '../components/content/ContentCards'
import ArticleHero from '../components/content/ArticleHero'
import RichBody from '../components/content/RichBody'
import { editorOf, readingMinutes, summaryOf } from '../lib/richText'
import { useNewsQuery, getNewsByKey, resolveNewsVideo, useNewsVideoFlag, useNewsShareFlag } from '../data/news'
import { shareArticle, copyLink, whatsappUrl, xUrl } from '../lib/share'
import { WhatsAppIcon, XIcon } from '../components/SocialIcons'
import { youtubeEmbedUrl, youtubeThumbUrl } from '../lib/newsVideo'
import { usePageLook } from '../data/contentLooks'
import { useToast } from '../lib/ToastContext'

const SHARE_ICON_CLASS =
  'flex h-9 w-9 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:border-brand hover:text-brand'

// "Dr. A. Bello" reads as "AB", not "DA": the last two words, so an honorific never becomes the avatar.
function initials(name) {
  const words = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (words.length === 0) return 'NH'
  return words
    .slice(-2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

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
 * The share row: label plus round targets, on the article's own footer line. The phone's own sheet is
 * offered alongside the named networks rather than hidden behind a menu -- at the end of an article a
 * reader is deciding where to send it, so the destinations should be visible.
 */
function ArticleShare({ title, path }) {
  const toast = useToast()
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'

  function handleX() {
    window.open(xUrl(title, path), '_blank', 'noopener,noreferrer')
  }

  function handleWhatsApp() {
    window.open(whatsappUrl(title, path), '_blank', 'noopener,noreferrer')
  }

  async function handleCopy() {
    const copied = await copyLink(path)
    if (copied) toast.success('Link copied to clipboard.')
    else toast.error('Could not copy the link — copy it from the address bar.')
  }

  async function handleNative() {
    const result = await shareArticle({ title, path })
    if (result.reason === 'error') toast.error('Could not open the share sheet.')
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5">
      <span className="mr-1 text-[11px] font-bold uppercase tracking-[.12em] text-ink-muted">Share to</span>
      <button type="button" onClick={handleX} aria-label="Share on X" title="Share on X" className={SHARE_ICON_CLASS}>
        <XIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleWhatsApp}
        aria-label="Share on WhatsApp"
        title="Share on WhatsApp"
        className={SHARE_ICON_CLASS}
      >
        <WhatsAppIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={handleCopy}
        aria-label="Copy link"
        title="Copy link"
        className={SHARE_ICON_CLASS}
      >
        <span className="material-symbols-outlined text-lg" aria-hidden="true">
          link
        </span>
      </button>
      {canNativeShare && (
        <button
          type="button"
          onClick={handleNative}
          aria-label="More share options"
          title="More share options"
          className={SHARE_ICON_CLASS}
        >
          <span className="material-symbols-outlined text-lg" aria-hidden="true">
            share
          </span>
        </button>
      )}
    </div>
  )
}

export default function NewsDetail() {
  const { key } = useParams()
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
  const minutes = readingMinutes(post.body)
  const summary = summaryOf(post.body)
  const editor = editorOf(post.body)

  // Same section first, then whatever is newest, always three: one related story in a three-column
  // grid leaves two empty columns and reads as a mistake.
  const others = (data ?? []).filter((item) => item.id !== post.id)
  const sameCategory = others.filter((item) => item.category === post.category)
  const more = [...sameCategory, ...others.filter((item) => item.category !== post.category)].slice(0, 3)

  return (
    <div className="mx-auto max-w-[1200px] px-5 pb-16 pt-8 sm:px-6">
      <ContentLook theme={theme}>
        <ArticleHero
          back={{ to: '/news', label: 'Back to News' }}
          eyebrow={post.category}
          title={post.title}
          date={post.date}
          minutes={minutes}
          summary={summary}
          badge={post.badge_tone ? <Badge tone={post.badge_tone}>{post.badge_label}</Badge> : null}
        />

        {/* One measure for the whole article: the headline, the cover, the prose and the credits all share
            the same column, so the photo never runs wider than the text beside it. The cover is drawn by
            the body, either at its `[image]` line or above the first paragraph, in its own proportions
            unless an admin chose a shape. */}
        <article className="mx-auto mt-8 max-w-[720px]">
          {video && video.position === 'top' && <NewsVideo video={video} cover={post.image_url} />}

          <Reveal>
            <RichBody
              text={post.body}
              cover={showCover ? post.image_url : null}
              imageWidthPct={post.image_width_pct}
            />

            {video && video.position === 'bottom' && <NewsVideo video={video} cover={post.image_url} />}
          </Reveal>

          {/* The credits, then the share row: the reader has finished the piece by the time they reach
              these, so they sit after the prose rather than at the top of the page. */}
          <div className="mt-10">
            <div className="content-radius flex flex-wrap items-center gap-x-10 gap-y-3 bg-surface-low px-5 py-4">
              <span
                aria-hidden="true"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-green-900 text-sm font-bold text-white"
              >
                {initials(post.author)}
              </span>
              <div>
                <div className="text-xs font-semibold uppercase tracking-[.08em] text-ink-muted">
                  Writer
                </div>
                <div className="text-sm font-semibold text-ink-900">{post.author || 'Nammes Hub'}</div>
              </div>
              {editor && (
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[.08em] text-ink-muted">
                    Editor
                  </div>
                  <div className="text-sm font-semibold text-ink-900">{editor}</div>
                </div>
              )}
            </div>

            {shareEnabled && (
              <div className="mt-5">
                <ArticleShare title={post.title} path={`/news/${canonical}`} />
              </div>
            )}
          </div>

          <div className="mt-6">
            <ReportProblem title={post.title} />
          </div>
        </article>

        {more.length > 0 && (
          <section className="mx-auto mt-16 max-w-[1100px]">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="font-display text-2xl font-bold text-ink-900">More from News</h2>
              <Link to="/news" className="text-sm font-bold text-brand-orange hover:underline">
                All news
              </Link>
            </div>
            <ContentGrid theme={theme} className="mt-5">
              {more.map((item) => (
                <NewsCard key={item.id} item={item} theme={theme} />
              ))}
            </ContentGrid>
          </section>
        )}
      </ContentLook>
    </div>
  )
}
