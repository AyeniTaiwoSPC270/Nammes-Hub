import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import WelcomeMessage from '../components/WelcomeMessage'
import EmptyState from '../components/ui/EmptyState'
import { fetchNews, getNews } from '../data/news'
import { fetchExcos } from '../data/excos'
import { fetchEvents } from '../data/events'

export default function Home() {
  const navigate = useNavigate()
  const [newsRows, setNewsRows] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [excosRows, setExcosRows] = useState([])
  const [excosError, setExcosError] = useState(false)
  const [eventsRows, setEventsRows] = useState([])
  const [eventsLoading, setEventsLoading] = useState(true)

  useEffect(() => {
    fetchNews().then((data) => {
      setNewsRows(data)
      setNewsLoading(false)
    })
  }, [])

  useEffect(() => {
    fetchExcos()
      .then(setExcosRows)
      .catch(() => setExcosError(true))
  }, [])

  useEffect(() => {
    fetchEvents().then((data) => {
      setEventsRows(data)
      setEventsLoading(false)
    })
  }, [])

  const [featuredNews, ...restNews] = getNews(newsRows).slice(0, 4)
  const previewEvents = eventsRows.slice(0, 3)

  return (
    <div>
      {/* 1. Hero */}
      <section className="relative w-full h-[420px] sm:h-[560px] flex items-center overflow-hidden bg-green-900">
        <div className="absolute inset-0 z-10 bg-green-900 opacity-80" />
        <div className="relative z-20 max-w-[1200px] w-full mx-auto px-5 sm:px-8">
          <h1 className="text-3xl sm:text-5xl font-bold text-white mb-3 max-w-2xl">NAMMES Hub</h1>
          <p className="text-lg text-white/90 mb-8 max-w-xl">
            The digital home of our student society — outlines, events, resources, news and
            opportunities, all in one place.
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

          {!newsLoading && !featuredNews && (
            <EmptyState
              icon="article"
              title="No news yet"
              description="Department news and announcements will show up here once they're posted."
            />
          )}

          {!newsLoading && featuredNews && (
            <>
              <Card
                layout="row"
                tone={featuredNews.tone}
                eyebrow={featuredNews.category}
                title={featuredNews.title}
                image={featuredNews.image_url ? { src: featuredNews.image_url } : undefined}
                imageVariant="cover"
                className="mb-5 cursor-pointer hover:shadow-lg transition-shadow"
              >
                <span className="line-clamp-3">{featuredNews.body}</span>{' '}
                {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
              </Card>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {restNews.map((item) => (
                  <Card
                    key={item.id}
                    tone={item.tone}
                    eyebrow={item.category}
                    title={item.title}
                    image={item.image_url ? { src: item.image_url } : undefined}
                    imageVariant="cover"
                    imageAspect="standard"
                    className="cursor-pointer hover:shadow-lg transition-shadow"
                  >
                    <span className="line-clamp-2">{item.body}</span>{' '}
                    {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                  </Card>
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

          {!eventsLoading && previewEvents.length === 0 && (
            <EmptyState
              icon="event_busy"
              title="No events yet"
              description="Check back soon — upcoming workshops, seminars, and gatherings will show up here."
            />
          )}

          {!eventsLoading && previewEvents.length > 0 && (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
              {previewEvents.map((event) => (
                <article
                  key={event.id}
                  className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md cursor-pointer hover:shadow-lg transition-shadow"
                >
                  {event.image_url && (
                    <img src={event.image_url} alt="" className="h-48 w-full object-cover" />
                  )}
                  <div className="flex flex-col gap-2 p-6">
                    <div className="flex items-center gap-1 text-sm text-ink-muted">
                      <span className="material-symbols-outlined text-[16px]">calendar_today</span>
                      {event.date}
                    </div>
                    <h3 className="text-xl font-bold text-ink-900 m-0">{event.title}</h3>
                  </div>
                </article>
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
          {excosError ? (
            <p className="text-ink-muted">Couldn&rsquo;t load the Excos list right now.</p>
          ) : (
            <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
              {excosRows.map((x) => (
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
