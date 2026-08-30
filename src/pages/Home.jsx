import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { fetchNews, getNews } from '../data/news'
import { fetchExcos } from '../data/excos'
import { splitFeaturedExcos } from '../lib/excos'

export default function Home() {
  const navigate = useNavigate()
  const [newsRows, setNewsRows] = useState([])
  const [newsLoading, setNewsLoading] = useState(true)
  const [excosRows, setExcosRows] = useState([])
  const [excosError, setExcosError] = useState(false)

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

  const [featuredNews, ...restNews] = getNews(newsRows).slice(0, 4)
  const { featured: featuredExcos, rest: restExcos } = splitFeaturedExcos(excosRows)

  return (
    <div>
      <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-700 to-orange-600 px-6 py-20 sm:px-8 sm:py-24">
        <div className="relative mx-auto max-w-[960px]">
          <div className="max-w-[560px]">
            <div className="inline-block w-fit whitespace-nowrap rounded-full bg-white px-3.5 py-1 font-mono text-[13px] font-bold uppercase text-green-900">
              NAMMES · 2025/2026 SESSION
            </div>
            <h1 className="mt-5 text-[30px] text-white sm:text-[44px]">
              Everything the department publishes, in one place.
            </h1>
            <p className="mt-3 text-[17px] text-white/90">
              Course outlines, event records, drive links, department news and opportunities —
              built for finding what you need in seconds.
            </p>
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="primary" onClick={() => navigate('/outlines')}>
                Browse outlines
              </Button>
              <Button variant="secondary" onClick={() => navigate('/events')}>
                See events
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] px-5 pt-14 pb-18 sm:px-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
              Department news
            </div>
            <h2 className="mt-1.5 text-[28px]">What&rsquo;s happening in the department</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/news')}>
            View all news
          </Button>
        </div>

        {!newsLoading && featuredNews && (
          <>
            <Card
              tone={featuredNews.tone}
              eyebrow={featuredNews.category}
              title={featuredNews.title}
              meta={featuredNews.date}
              image={featuredNews.image_url ? { src: featuredNews.image_url } : undefined}
              imageVariant="cover"
              imageAspect="video"
            >
              {featuredNews.body}{' '}
              {featuredNews.badge_tone && <Badge tone={featuredNews.badge_tone}>{featuredNews.badge_label}</Badge>}
            </Card>

            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {restNews.map((item) => (
                <Card
                  key={item.id}
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : undefined}
                  imageVariant="cover"
                  imageAspect="standard"
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              ))}
            </div>
          </>
        )}
      </div>

      <div className="mx-auto max-w-[880px] px-5 pb-18 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          Executives · 2025/2026
        </div>
        <h2 className="mt-1.5 mb-6 text-[28px]">Meet the Excos</h2>
        {excosError ? (
          <p className="text-ink-muted">Couldn&rsquo;t load the Excos list right now.</p>
        ) : (
          <>
            {featuredExcos.length > 0 && (
              <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
                {featuredExcos.map((x) => (
                  <div key={x.id} className="flex flex-col items-center gap-3 rounded-lg bg-green-700 p-6 text-center">
                    <div className="flex h-[160px] w-[160px] items-center justify-center overflow-hidden rounded-full bg-green-100 font-display text-4xl text-green-700">
                      {x.photo_url ? (
                        <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (x.name || x.role).charAt(0)
                      )}
                    </div>
                    <div>
                      <div className="text-lg font-semibold text-white">{x.name || 'Name Surname'}</div>
                      <div className="mt-0.5 font-mono text-xs uppercase tracking-[.04em] text-orange-400">
                        {x.role}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {restExcos.length > 0 && (
              <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
                {restExcos.map((x) => (
                  <div key={x.id} className="flex flex-col items-center gap-2.5">
                    <div className="flex h-[120px] w-[120px] items-center justify-center overflow-hidden rounded-full bg-green-100 font-display text-2xl text-green-700">
                      {x.photo_url ? (
                        <img src={x.photo_url} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (x.name || x.role).charAt(0)
                      )}
                    </div>
                    <div className="text-center">
                      <div className="text-[15px] font-semibold">{x.name || 'Name Surname'}</div>
                      <div className="mt-0.5 font-mono text-xs text-ink-muted">{x.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
