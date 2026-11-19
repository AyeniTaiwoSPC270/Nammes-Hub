import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import PageBanner from '../components/PageBanner'
import Reveal from '../components/ui/Reveal'
import { usePageBanner } from '../data/pageBanners'
import { useSiteContentQuery } from '../data/siteContent'
import { useCalendarFlag } from '../data/calendar'
import { socialLinks } from '../components/SocialIcons'
import { recordFollowLinkClick, recordFollowScan } from '../data/follow'
import { campaignFromSearch, followLinkKey, scanSourceFromSearch } from '../lib/followHub'

// Everything the QR code can usefully offer, in one list so a feature the site switches off does not leave
// a dead tile on the page a poster sends people to.
const HUB_LINKS = [
  { to: '/news', label: 'News', hint: 'What the department is up to', icon: 'article' },
  { to: '/events', label: 'Events', hint: 'What is coming up', icon: 'event' },
  { to: '/calendar', label: 'Calendar', hint: 'Senate dates and deadlines', icon: 'calendar_month', requires: 'calendar' },
  { to: '/quiz', label: 'Quizzes', hint: 'Play and battle', icon: 'quiz' },
  { to: '/cbt', label: 'CBT practice', hint: 'Practise for exams', icon: 'assignment' },
  { to: '/outlines', label: 'Outlines', hint: 'Course outlines by level', icon: 'menu_book' },
  { to: '/resources', label: 'Resources', hint: 'Slides, past questions, notes', icon: 'folder_open' },
  { to: '/cgpa', label: 'CGPA calculator', hint: 'Work out where you stand', icon: 'insights' },
]

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./i, '')
  } catch {
    return ''
  }
}

export default function Follow() {
  const banner = usePageBanner('follow')
  const contentQuery = useSiteContentQuery()
  const content = contentQuery.data
  const calendarEnabled = useCalendarFlag()
  const links = socialLinks(content)
  const substackUrl = content?.substack_url
  const hubLinks = HUB_LINKS.filter((item) => item.requires !== 'calendar' || calendarEnabled)

  // Fire and forget: a tap that opens WhatsApp must not wait on a counter, and a failed beacon is never a
  // reason to block the link. `_url` is stripped so the stored key is `whatsapp`, not the site-content name.
  function trackLink(key) {
    const slug = followLinkKey(typeof key === 'string' ? key.replace(/_url$/, '') : key)
    if (slug) recordFollowLinkClick(slug).catch(() => {})
  }

  // One beacon per mount. A scan is counted only when the code arrived with its marker: a direct visit to
  // /follow is ordinary traffic and the page-view tracker already has it, so counting it here as well would
  // report every link share as a scan. The ref is what stops React StrictMode's double invoke in
  // development from doubling the number.
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current || typeof window === 'undefined') return
    reported.current = true
    const source = scanSourceFromSearch(window.location.search)
    if (!source) return
    recordFollowScan(source, campaignFromSearch(window.location.search) ?? '').catch(() => {})
  }, [])

  return (
    <div>
      <PageBanner
        images={banner?.image_urls ?? []}
        transition={banner?.transition}
        intervalSeconds={banner?.interval_seconds}
        title={banner?.title ?? 'Follow NAMMES'}
        subtitle={banner?.subtitle ?? 'Every social, the newsletter and the Hub itself — one tap from here.'}
        size="md"
      />

      <Reveal as="section" className="mx-auto max-w-[1000px] px-5 py-14 sm:px-6">
        <div className="flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-ink-900">Follow the department</h2>
          <p className="text-ink-muted">
            Announcements, results, events and opportunities land on these first. Join the ones you use.
          </p>
        </div>

        {contentQuery.isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-lg bg-surface-low" />
            ))}
          </div>
        ) : links.length > 0 ? (
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {links.map(({ key, label, url, Icon }) => (
              <a
                key={key}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackLink(key)}
                className="group flex items-center gap-4 rounded-lg border border-hairline bg-surface p-5 no-underline shadow-sm transition-shadow hover:shadow-md"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-surface-low text-brand transition-colors group-hover:bg-brand group-hover:text-white">
                  <Icon className="h-5 w-5" />
                </span>
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-bold text-ink-900">{label}</span>
                  <span className="truncate text-xs text-ink-muted">{hostOf(url)}</span>
                </span>
                <span className="material-symbols-outlined ml-auto shrink-0 text-hairline transition-colors group-hover:text-brand">
                  arrow_forward
                </span>
              </a>
            ))}
          </div>
        ) : (
          <div className="mt-6 rounded-lg border border-hairline bg-surface-low p-6">
            <p className="text-sm text-ink-muted">
              No social links have been added yet. In the meantime you can reach an Exco directly.
            </p>
            <Link
              to="/excos"
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-brand no-underline hover:text-orange-500 hover:underline"
            >
              Meet the Excos
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </Link>
          </div>
        )}

        {substackUrl && (
          <div className="mt-10 flex flex-col gap-4 rounded-lg bg-green-900 p-6 text-white sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div>
              <h3 className="text-xl font-bold text-white">The NAMMES Communique</h3>
              <p className="mt-1 max-w-lg text-sm text-white/75">
                The department&rsquo;s newsletter — write-ups, interviews and the stories behind the results.
                Subscribe once and it comes to your inbox.
              </p>
            </div>
            <a
              href={substackUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackLink('newsletter')}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md bg-orange-500 px-5 py-3 text-sm font-bold text-white no-underline transition-colors hover:bg-orange-600"
            >
              Read &amp; subscribe
              <span className="material-symbols-outlined text-base">arrow_forward</span>
            </a>
          </div>
        )}

        <div className="mt-14 flex flex-col gap-1">
          <h2 className="text-2xl font-bold text-ink-900">The rest of the Hub</h2>
          <p className="text-ink-muted">Everything else a student needs, without hunting through a menu.</p>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {hubLinks.map(({ to, label, hint, icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => trackLink(to)}
              className="group flex flex-col gap-2 rounded-lg border border-hairline bg-surface p-5 no-underline shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="material-symbols-outlined text-brand">{icon}</span>
              <span className="text-sm font-bold text-ink-900">{label}</span>
              <span className="text-xs leading-relaxed text-ink-muted">{hint}</span>
            </Link>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-4 rounded-lg border border-hairline bg-surface-low p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-ink-900">Still need a person?</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Send the association a message, or go straight to the Exco for your question.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/contact"
              className="inline-flex items-center gap-1.5 rounded-md border border-brand px-4 py-2.5 text-sm font-bold text-brand no-underline hover:bg-brand hover:text-white"
            >
              <span className="material-symbols-outlined text-base">mail</span>
              Contact us
            </Link>
            <Link
              to="/excos"
              className="inline-flex items-center gap-1.5 rounded-md border border-hairline px-4 py-2.5 text-sm font-bold text-ink-900 no-underline hover:bg-surface"
            >
              <span className="material-symbols-outlined text-base">groups</span>
              Meet the Excos
            </Link>
          </div>
        </div>
      </Reveal>
    </div>
  )
}
