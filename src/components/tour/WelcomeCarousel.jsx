import { useTour } from '../../lib/TourContext'
import Button from '../ui/Button'

export default function WelcomeCarousel() {
  const { phase, carouselSlide, carouselIndex, carouselTotal, nextCarousel, backCarousel, skip } = useTour()

  if (phase !== 'carousel') return null

  const isFirst = carouselIndex === 0
  const isLast = carouselIndex === carouselTotal - 1

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4">
      <div className="w-full max-w-[420px] rounded-lg bg-surface p-6 shadow-md sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[.05em] text-orange-600">
            {carouselSlide.eyebrow}
          </span>
          {!isLast && (
            <button type="button" onClick={skip} className="text-sm font-semibold text-ink-muted hover:text-ink-900">
              Skip
            </button>
          )}
        </div>

        <h2 className="mb-3 text-2xl font-bold text-ink-900">{carouselSlide.heading}</h2>
        <p className="mb-6 text-base leading-relaxed text-ink-muted">{carouselSlide.body}</p>

        {carouselSlide.items && (
          <div className="mb-6 flex flex-wrap gap-2">
            {carouselSlide.items.map((item) => (
              <span key={item} className="rounded-md bg-surface-low px-3 py-1.5 text-sm font-semibold text-brand">
                {item}
              </span>
            ))}
          </div>
        )}

        <div className="mb-6 flex items-center justify-center gap-2">
          {Array.from({ length: carouselTotal }).map((_, i) => (
            <span
              key={i}
              className={[
                'h-2 rounded-full transition-all',
                i === carouselIndex ? 'w-6 bg-ink-900' : 'w-2 bg-hairline',
              ].join(' ')}
            />
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!isFirst && (
            <Button variant="secondary" onClick={backCarousel} className="flex-1">
              Back
            </Button>
          )}
          <Button variant={isLast ? 'accent' : 'primary'} onClick={nextCarousel} className="flex-1">
            {isLast ? 'Get started' : 'Next'}
          </Button>
        </div>
      </div>
    </div>
  )
}
