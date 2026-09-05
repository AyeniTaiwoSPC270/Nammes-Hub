import { Link, useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import WelcomeMessage from '../components/WelcomeMessage'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard, SkeletonText } from '../components/ui/Skeleton'
import { useNewsQuery, getNews } from '../data/news'
import { useExcosQuery } from '../data/excos'
import { useEventsQuery } from '../data/events'

export default function Home() {
  const navigate = useNavigate()
  const newsQuery = useNewsQuery()
  const excosQuery = useExcosQuery()
  const eventsQuery = useEventsQuery()

  const [featuredNews, ...restNews] = getNews(newsQuery.data ?? []).slice(0, 4)
  const previewEvents = (eventsQuery.data ?? []).slice(0, 3)

  return (
    <div>
      {/* 1. Hero */}
      <section className="relative w-full min-h-[420px] sm:min-h-[560px] flex items-center overflow-hidden bg-green-900">
        <img
          src="https://images.unsplash.com/photo-1584365098838-50ccef838f4a?auto=format&fit=crop&w=1600&q=80"
          alt=""
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />
        <div className="absolute inset-0 z-10 bg-green-900 opacity-80" />
        <div className="relative z-20 max-w-[1200px] w-full mx-auto px-5 sm:px-8">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 max-w-2xl">
            The Nigerian Association of Materials and Metallurgical Engineering Students Hub
          </h1>
          <p className="text-lg text-white/90 mb-8 max-w-xl">
            NAMMES is the student-led voice of the department at the University of Lagos —
            representing our members academically, professionally, and socially. This Hub brings
            everything the association publishes, from course outlines and events to resources,
            news, and opportunities, into one place.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button variant="primary" onClick={() => navigate('/outlines')}>
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
        </div>
      </section>

      {/* 2. Welcome message */}
      <WelcomeMessage />

      {/* 3. Department news */}
      <section className="w-full bg-surface-low py-16">
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
          ) : !featuredNews ? (
            <EmptyState
              icon="article"
              title="No news yet"
              description="Department news and announcements will show up here once they're posted."
            />
          ) : (
            <>
              <Link to={`/news/${featuredNews.id}`} className="block">
                <Card
                  layout="row"
                  tone={featuredNews.tone}
                  eyebrow={featuredNews.category}
                  title={featuredNews.title}
                  image={featuredNews.image_url ? { src: featuredNews.image_url } : undefined}
                  imageVariant="cover"
                  interactive
                  className="mb-5 cursor-pointer"
                >
                  <span className="line-clamp-3">{featuredNews.body}</span>{' '}
                  {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
                  <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                    Read more
                    <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                  </span>
                </Card>
              </Link>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {restNews.map((item) => (
                  <Link key={item.id} to={`/news/${item.id}`} className="block">
                  <Card
                    tone={item.tone}
                    eyebrow={item.category}
                    title={item.title}
                    image={item.image_url ? { src: item.image_url } : undefined}
                    imageVariant="cover"
                    imageAspect="standard"
                    interactive
                    className="cursor-pointer"
                  >
                    <span className="line-clamp-2">{item.body}</span>{' '}
                    {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                    <span className="mt-2 inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                      Read more
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </Card>
                  </Link>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      {/* 4. Upcoming events */}
      <section className="w-full bg-surface py-16">
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
              title="No events yet"
              description="Check back soon. Upcoming workshops, seminars, and gatherings will show up here."
            />
          ) : (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {previewEvents.map((event) => (
                <Link
                  key={event.id}
                  to={`/events/${event.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-md"
                >
                  {event.image_url && (
                    <div className="flex aspect-[3/4] w-full shrink-0 items-center justify-center overflow-hidden bg-surface-low">
                      <img src={event.image_url} alt="" className="h-full w-full object-contain" />
                    </div>
                  )}
                  <div className="flex flex-col gap-2 p-6">
                    <div className="flex items-center gap-1 text-sm text-ink-muted">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      {event.date}
                    </div>
                    <h3 className="text-xl font-bold text-ink-900 m-0">{event.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* 5. Meet the Excos */}
      <section className="w-full bg-surface-low py-16">
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
              {excosQuery.data.map((x) => (
                <div key={x.id} className="flex flex-col items-center gap-2.5 text-center">
                  <div className="flex h-28 w-28 sm:h-40 sm:w-40 items-center justify-center overflow-hidden rounded-full bg-surface shadow-md font-display text-2xl text-green-900">
                    {x.photo_url ? (
                      <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                    ) : (
                      (x.name || x.role).charAt(0)
                    )}
                  </div>
                  <div className="font-bold text-ink-900">{x.name || 'Name Surname'}</div>
                  <div className="text-xs font-semibold uppercase tracking-[.05em] text-orange-500">{x.role}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
