import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import Button from '../components/ui/Button'
import Reveal from '../components/ui/Reveal'
import WelcomeMessage from '../components/WelcomeMessage'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard, SkeletonText } from '../components/ui/Skeleton'
import SlideshowLayer from '../components/SlideshowLayer'
import { ContentFeed, ContentGrid, EventCard, NewsCard, NewsFeatureCard, staggerDelay } from '../components/content/ContentCards'
import NextUpStrip from '../components/calendar/NextUpStrip'
import { useNewsQuery, getNews } from '../data/news'
import { useExcosQuery } from '../data/excos'
import { useEventsQuery, groupEventsByTime } from '../data/events'
import { useAcademicCalendarQuery, useCalendarFlag, useCalendarSettingsQuery } from '../data/calendar'
import { useSiteContentQuery } from '../data/siteContent'
import { usePageLook } from '../data/contentLooks'
import { defaultTheme } from '../../api/_lib/contentTheme.js'
import { addMonths, toDayKey } from '../../api/_lib/calendarDates.js'
import { mergeCalendarSources } from '../../api/_lib/calendarMerge.js'
import { linkifyText } from '../lib/linkify'
import { heroImages } from '../lib/heroImages'
import { selectNextUp } from '../lib/calendarNextUp.js'
import { useHolidayTheme } from '../lib/HolidayThemeProvider'
import { holidayImageUrl } from '../data/holidays'

// The same four the calendar page's strip shows. Home has more blocks below it, so there is no reason to grow it.
const NEXT_UP_COUNT = 4

const CARD_STAGGER = 0.06
const MAX_STAGGER_DELAY = 0.3

// Home's fallback look, resolved once per page rather than per card. Same values `usePageLook` would return
// if nothing is saved and nothing is live, so switching the opt-in on is the only thing that changes.
const DEFAULT_LOOKS = { news: defaultTheme('news'), events: defaultTheme('events') }

export default function Home() {
  const navigate = useNavigate()
  const newsQuery = useNewsQuery()
  const excosQuery = useExcosQuery()
  const eventsQuery = useEventsQuery()
  const contentQuery = useSiteContentQuery()
  const content = contentQuery.data
  const heroSlides = heroImages(content)
  const reducedMotion = useReducedMotion()

  // Two conditions, both required: the calendar's kill switch, and the admin's per-block opt-in. The academic query
  // is gated on the pair, so a visitor on a site that never turned this on pays for no extra calendar request.
  const calendarEnabled = useCalendarFlag()
  const calendarSettingsQuery = useCalendarSettingsQuery()
  const showNextUp = calendarEnabled && Boolean(calendarSettingsQuery.data?.next_up_on_home)
  const academicQuery = useAcademicCalendarQuery(calendarSettingsQuery.data?.active_session, showNextUp)

  // Read off the local clock rather than toISOString(), for the same reason /calendar does: the browser's day is
  // the day the reader is living in, and two blocks on one page disagreeing about it would be worse than the edge.
  const today = useMemo(() => new Date(), [])
  const todayKey = toDayKey(today)
  const nextUpRange = useMemo(
    () => ({ from: todayKey, to: toDayKey(addMonths(today, 12)) }),
    [today, todayKey],
  )
  const mergedCalendar = useMemo(
    () =>
      mergeCalendarSources(
        { academic: academicQuery.data ?? [], events: eventsQuery.data ?? [] },
        nextUpRange,
      ),
    [academicQuery.data, eventsQuery.data, nextUpRange],
  )
  const nextUp = useMemo(
    () => selectNextUp(mergedCalendar.items, todayKey, { enabled: showNextUp, limit: NEXT_UP_COUNT }),
    [mergedCalendar.items, todayKey, showNextUp],
  )

  // Read on BOTH pages, and only ever applied to this page's own block. Home also renders awards,
  // opportunities and announcements, and an accent that spread to those would be a bug report rather than a
  // feature -- which is why `onHome` is a separate switch from "this design is live on /news".
  const newsLook = usePageLook('news')
  const eventsLook = usePageLook('events')

  // The default theme unless the admin has opted this block in. A design that is live on /news but not here
  // must render exactly what Home rendered before this existed.
  const newsTheme = newsLook.onHome ? newsLook.theme : DEFAULT_LOOKS.news
  const eventsTheme = eventsLook.onHome ? eventsLook.theme : DEFAULT_LOOKS.events

  // The live holiday theme's art band: below the navbar (which Layout owns), above the hero — the exact
  // placement the spec pins. Nothing else on Home changes for a holiday; the palette repaint is global.
  const holiday = useHolidayTheme()
  const holidayBandUrl = holiday?.imagery?.band ? holidayImageUrl(holiday.imagery.band) : null

  const heroRef = useRef(null)
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const heroImageY = useTransform(scrollYProgress, [0, 1], reducedMotion ? [0, 0] : [0, 60])

  const [leadStory, ...restNews] = getNews(newsQuery.data ?? []).slice(0, 4)
  // A look whose lead story is switched off shows none, here exactly as it does on /news and in the studio's
  // preview. Without this the preview would be reviewing a tree the page never builds.
  const showLead = newsTheme.layout.featured !== 'none'
  // Only the upcoming bucket: undated events have their own bucket now and belong to the calendar's TBA panel,
  // not on Home (spec §10).
  const previewEvents = groupEventsByTime(eventsQuery.data ?? []).upcoming.slice(0, 3)

  return (
    <div>
      {holidayBandUrl && <img src={holidayBandUrl} alt="" className="h-24 w-full object-cover sm:h-32" />}
      {/* 1. Hero */}
      <section ref={heroRef} className="relative w-full min-h-[420px] sm:min-h-[560px] flex items-center overflow-hidden bg-green-900">
        {heroSlides.length > 0 && (
          <motion.div style={{ y: heroImageY }} className="absolute inset-0 z-0">
            <SlideshowLayer
              images={heroSlides}
              transition={content?.hero_transition ?? 'fade'}
              intervalSeconds={content?.hero_interval_seconds ?? 5}
            />
          </motion.div>
        )}
        {heroSlides.length > 0 && <div className="absolute inset-0 z-10 bg-green-900 opacity-80" />}
        <motion.div
          className="relative z-20 max-w-[1200px] w-full mx-auto px-5 py-14 sm:px-8 sm:py-0"
          initial={reducedMotion ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut', delay: reducedMotion ? 0 : 0.15 }}
        >
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 max-w-2xl">
            {content?.hero_title}
          </h1>
          <p className="text-lg text-white/90 mb-8 max-w-xl">{linkifyText(content?.hero_subtitle)}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="accent" onClick={() => navigate('/outlines')}>
              Browse outlines
            </Button>
            <Button
              variant="ghost"
              className="border border-white text-white hover:bg-white hover:text-green-900"
              onClick={() => navigate('/events')}
            >
              See events
            </Button>
          </div>
        </motion.div>
      </section>

      {/* 2. Welcome message */}
      <Reveal>
        <WelcomeMessage
          name={content?.president_name}
          role={content?.president_role}
          message={content?.president_message}
          photoUrl={content?.president_photo_url}
        />
      </Reveal>

      {/* 3. Department news */}
      <Reveal as="section" className="w-full bg-surface-low py-16">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">Latest News</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/news')}>
              View all news
            </Button>
          </div>

          {newsQuery.isError && !newsQuery.data ? (
            <ErrorState message="Couldn't load news right now." onRetry={newsQuery.refetch} />
          ) : newsQuery.isLoading ? (
            <>
              <div className="mb-5">
                <SkeletonCard imageVariant="cover" />
              </div>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <SkeletonCard imageVariant="cover" />
                <SkeletonCard imageVariant="cover" />
                <SkeletonCard imageVariant="cover" />
              </div>
            </>
          ) : !leadStory ? (
            <EmptyState
              icon="article"
              title="No news yet"
              description="Department news and announcements will show up here once they're posted."
            />
          ) : (
            /* ContentFeed, not a bare ContentGrid: the lead story is a SIBLING of the grid, so a grid that
               carried the `--content-*` vars on its own would leave the lead story rendering at the built-in
               radius and title size while every card under it followed the look. */
            <ContentFeed
              theme={newsTheme}
              featured={showLead ? <NewsFeatureCard item={leadStory} theme={newsTheme} /> : null}
            >
              {(showLead ? restNews : [leadStory, ...restNews]).map((item, i) => (
                <Reveal key={item.id} delay={staggerDelay(newsTheme, i)}>
                  <NewsCard item={item} theme={newsTheme} excerpt={item.body} />
                </Reveal>
              ))}
            </ContentFeed>
          )}
        </div>
      </Reveal>

      {/* 4. Next up -- additive, so it renders nothing when there is nothing to say. The empty "nothing on"
          sentence belongs to Upcoming Events below, not here. */}
      {nextUp.length > 0 && (
        <Reveal as="section" className="w-full bg-surface pt-16">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
            <NextUpStrip items={nextUp} todayKey={todayKey} />
          </div>
        </Reveal>
      )}

      {/* 5. Upcoming events */}
      <Reveal as="section" className="w-full bg-surface py-16">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">Upcoming Events</h2>
            <Button variant="ghost" size="sm" onClick={() => navigate('/events')}>
              View all events
            </Button>
          </div>

          {eventsQuery.isError && !eventsQuery.data ? (
            <ErrorState message="Couldn't load events right now." onRetry={eventsQuery.refetch} />
          ) : eventsQuery.isLoading ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
            </div>
          ) : previewEvents.length === 0 ? (
            <EmptyState
              icon="event_busy"
              title="No upcoming events"
              // Scoped to what this block shows. Home copies only the `events` table here; the calendar's own
              // dates, when the admin opts them in, are the NextUpStrip above this block.
              description="Lectures, exams and registration dates are on the calendar."
            />
          ) : (
            <ContentGrid theme={eventsTheme}>
              {previewEvents.map((event, i) => (
                <Reveal key={event.id} delay={staggerDelay(eventsTheme, i)}>
                  <EventCard event={event} theme={eventsTheme} />
                </Reveal>
              ))}
            </ContentGrid>
          )}
        </div>
      </Reveal>

      {/* 5. Meet the Excos */}
      <Reveal as="section" className="w-full bg-surface-low py-16">
        <div className="mx-auto max-w-[1200px] px-5 sm:px-6">
          <div className="mb-8 flex items-baseline justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold text-ink-900">Our Executives</h2>
              <p className="text-sm font-semibold uppercase tracking-[.05em] text-orange-500">
                The Aegis 26/27
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/excos')}>
              Meet the Excos
            </Button>
          </div>
          {excosQuery.isError && !excosQuery.data ? (
            <ErrorState message="Couldn't load the Excos list right now." onRetry={excosQuery.refetch} />
          ) : excosQuery.isLoading ? (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center gap-2.5">
                  <div className="h-28 w-28 animate-pulse rounded-full bg-hairline sm:h-40 sm:w-40" />
                  <SkeletonText lines={2} className="w-20" />
                </div>
              ))}
            </div>
          ) : (excosQuery.data ?? []).length === 0 ? (
            <EmptyState
              icon="group_off"
              title="Excos coming soon"
              description="Executive Council members will appear here once they're added."
            />
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {excosQuery.data.map((x, i) => (
                <Reveal key={x.id} delay={Math.min(i * CARD_STAGGER, MAX_STAGGER_DELAY)} className="flex flex-col items-center gap-2.5 text-center">
                  <div className="flex h-28 w-28 sm:h-40 sm:w-40 items-center justify-center overflow-hidden rounded-full bg-surface shadow-md font-display text-2xl text-brand">
                    {x.photo_url ? (
                      <img src={x.photo_url} loading="lazy" decoding="async" alt="" className="h-full w-full object-cover object-top" />
                    ) : (
                      (x.name || x.role).charAt(0)
                    )}
                  </div>
                  <div className="font-bold text-ink-900">{x.name || 'Name Surname'}</div>
                  <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-500">{x.role}</div>
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </Reveal>
    </div>
  )
}
