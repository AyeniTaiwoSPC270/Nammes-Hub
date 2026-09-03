import { Link, useSearchParams } from 'react-router-dom'
import Badge from '../components/ui/Badge'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import { SkeletonCard } from '../components/ui/Skeleton'
import { useNewsQuery, getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'
import newsBanner from '../assets/banners/news-banner.jpg'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useNewsQuery()

  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(data ?? []), active)
  const [featured, ...rest] = items

  function selectCategory(category) {
    if (category === 'All') {
      setSearchParams({})
    } else {
      setSearchParams({ category })
    }
  }

  return (
    <div>
      <PageBanner
        image={newsBanner}
        title="Department News"
        subtitle="News and announcements, posted jointly with the PRO."
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <div className="flex flex-wrap gap-2 mb-8">
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => selectCategory(category)}
              className={[
                'rounded-full px-4 py-2 text-sm font-semibold border transition-colors',
                category === active
                  ? 'bg-green-900 text-white border-green-900'
                  : 'bg-surface text-ink border-hairline hover:bg-surface-low',
              ].join(' ')}
            >
              {category}
            </button>
          ))}
        </div>

        {isError && !data ? (
          <ErrorState message="Couldn't load news right now." onRetry={refetch} />
        ) : isLoading ? (
          <div className="flex flex-col gap-5">
            <SkeletonCard imageVariant="cover" />
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
              <SkeletonCard imageVariant="cover" />
            </div>
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon="article"
            title={active === 'All' ? 'No news yet' : `No news in ${active} yet`}
            description="Department news and announcements will show up here once they're posted."
          />
        ) : (
          <div className="flex flex-col gap-5">
            <Link
              to={`/news/${featured.id}`}
              className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md hover:shadow-lg transition-shadow md:flex-row"
            >
              {featured.image_url && (
                <img
                  src={featured.image_url}
                  alt=""
                  className="h-64 w-full object-cover md:h-auto md:w-1/2"
                />
              )}
              <div className="flex w-full flex-col justify-center gap-2 p-6 md:w-1/2">
                <div className="flex items-center gap-2">
                  {featured.category && (
                    <span className="text-xs font-bold uppercase tracking-[.05em] text-orange-600">
                      {featured.category}
                    </span>
                  )}
                  {featured.badge_tone && <Badge tone={featured.badge_tone}>{featured.badge_label}</Badge>}
                </div>
                <h3 className="text-xl font-bold text-ink-900 m-0">{featured.title}</h3>
                <p className="text-sm text-ink-muted">{featured.date}</p>
              </div>
            </Link>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {rest.map((item) => (
                <Link
                  key={item.id}
                  to={`/news/${item.id}`}
                  className="flex flex-col overflow-hidden rounded-lg border border-hairline bg-surface shadow-md hover:shadow-lg transition-shadow"
                >
                  {item.image_url && <img src={item.image_url} alt="" className="h-48 w-full object-cover" />}
                  <div className="flex flex-grow flex-col gap-2 p-6">
                    <div className="flex items-center gap-2">
                      {item.category && (
                        <span className="text-xs font-bold uppercase tracking-[.05em] text-orange-600">
                          {item.category}
                        </span>
                      )}
                      {item.badge_tone && <Badge tone={item.badge_tone}>{item.badge_label}</Badge>}
                    </div>
                    <h3 className="text-xl font-bold text-ink-900 m-0 line-clamp-2">{item.title}</h3>
                    <p className="mt-auto text-sm text-ink-muted">{item.date}</p>
                    <span className="inline-flex items-center gap-1 text-sm font-bold text-orange-600">
                      Read more
                      <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
