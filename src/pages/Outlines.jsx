import { useNavigate } from 'react-router-dom'
import { LEVELS } from '../data/outlines'
import PageBanner from '../components/PageBanner'
import Reveal from '../components/ui/Reveal'
import { usePageBanner } from '../data/pageBanners'
import outlinesBanner from '../assets/banners/outlines-banner.jpg'

const CARD_STAGGER = 0.06
const MAX_STAGGER_DELAY = 0.3

export default function Outlines() {
  const navigate = useNavigate()
  const banner = usePageBanner('outlines')

  return (
    <div>
      <PageBanner
        image={banner?.image_url ?? outlinesBanner}
        title={banner?.title ?? 'Course Outlines'}
        subtitle={banner?.subtitle ?? 'Access detailed curriculum structures and requirements.'}
      />
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:px-6">
        <h2 className="text-xl font-bold text-brand mb-4">Select Level</h2>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          {LEVELS.map((level, i) => (
            <Reveal key={level} delay={Math.min(i * CARD_STAGGER, MAX_STAGGER_DELAY)}>
              <button
                type="button"
                onClick={() => navigate(`/outlines/${level}`)}
                className="w-full rounded-md border border-hairline bg-surface px-4 py-3 text-center text-sm font-semibold text-ink-900 transition-colors hover:bg-surface-low"
              >
                {level} Level
              </button>
            </Reveal>
          ))}
        </div>
      </div>
    </div>
  )
}
