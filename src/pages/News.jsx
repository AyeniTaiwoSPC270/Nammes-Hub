import { useSearchParams } from 'react-router-dom'
import PageBanner from '../components/PageBanner'
import EmptyState from '../components/ui/EmptyState'
import ErrorState from '../components/ui/ErrorState'
import Reveal from '../components/ui/Reveal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { ContentFeed, NewsCard, NewsFeatureCard, staggerDelay } from '../components/content/ContentCards'
import { useNewsQuery, getNews, filterNewsByCategory, NEWS_CATEGORIES } from '../data/news'
import { usePageBanner } from '../data/pageBanners'
import { usePageLook } from '../data/contentLooks'

const categories = ['All', ...NEWS_CATEGORIES]

export default function News() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { data, isLoading, isError, refetch } = useNewsQuery()
  const { theme } = usePageLook('news')

  const requestedCategory = searchParams.get('category')
  const active = categories.includes(requestedCategory) ? requestedCategory : 'All'
  const items = filterNewsByCategory(getNews(data ?? []), active)
  // `featured: 'none'` on the events page, and on a news page whose admin turned the featured card off, both
  // land here as "no featured story" -- so every item goes in the grid rather than one being held back.
  const [first, ...rest] = theme.layout.featured === 'none' ? [null, ...items] : items
  const banner = usePageBanner('news')

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
        images={banner?.image_urls}
        transition={banner?.transition}
        intervalSeconds={banner?.interval_seconds}
        title={banner?.title ?? 'Department News'}
        subtitle={banner?.subtitle ?? 'News and announcements, posted jointly with the PRO.'}
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
          <ContentFeed theme={theme} featured={first ? <Reveal><NewsFeatureCard item={first} theme={theme} /></Reveal> : null}>
            {rest.map((item, i) => (
              <Reveal key={item.id} delay={staggerDelay(theme, i)}>
                <NewsCard item={item} theme={theme} />
              </Reveal>
            ))}
          </ContentFeed>
        )}
      </div>
    </div>
  )
}
