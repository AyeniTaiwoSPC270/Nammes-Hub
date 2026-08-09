import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { fetchNews, getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'
import { categoryImage } from '../lib/illustrations'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchNews().then((data) => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(rows), active)
  const [featured, ...rest] = items

  function selectCategory(category) {
    if (category === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
        <p className="text-ink-muted">Loading…</p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">News</div>
      <h1 className="mt-1.5 text-[32px]">Department news</h1>
      <p className="mt-2 max-w-2xl text-ink-muted">
        Department news and announcements, posted jointly with the PRO.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {categories.map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => selectCategory(category)}
            className={[
              'rounded-full px-4 py-2 text-sm font-semibold',
              category === active ? 'bg-green-100 text-green-700' : 'text-ink hover:text-green-700',
            ].join(' ')}
          >
            {category}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <p className="mt-8 text-ink-muted">No news posts in this category yet.</p>
      ) : (
        <div className="mt-6 flex flex-col gap-4">
          <Link to={`/news/${featured.id}`} className="block">
            <Card
              tone={featured.tone}
              eyebrow={featured.category}
              title={featured.title}
              meta={featured.date}
              image={featured.image_url ? { src: featured.image_url } : categoryImage(featured.category)}
            >
              {featured.body}{' '}
              {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
            </Card>
          </Link>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {rest.map((item) => (
              <Link key={item.id} to={`/news/${item.id}`} className="block">
                <Card
                  tone={item.tone}
                  eyebrow={item.category}
                  title={item.title}
                  meta={item.date}
                  image={item.image_url ? { src: item.image_url } : categoryImage(item.category)}
                >
                  {item.body}{' '}
                  {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
