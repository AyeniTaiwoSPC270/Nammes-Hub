import { Link, useSearchParams } from 'react-router-dom'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'
import { getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'
import { categoryImage } from '../lib/illustrations'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(), active)
  const [featured, ...rest] = items

  function selectCategory(category) {
    if (category === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
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
              image={categoryImage(featured.category)}
            >
              {featured.body}{' '}
              {featured.badge && <Badge tone={featured.badge.tone}>{featured.badge.label}</Badge>}
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
                  image={categoryImage(item.category)}
                >
                  {item.body}{' '}
                  {item.badge && <Badge tone={item.badge.tone}>{item.badge.label}</Badge>}
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
