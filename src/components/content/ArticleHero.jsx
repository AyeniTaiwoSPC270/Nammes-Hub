// The masthead of an article page.
//
// News and Events share it so the two detail pages open the same way. It sits directly on the page
// surface rather than in a coloured panel: the headline is meant to be the loudest thing on the screen,
// and a filled block behind it competes with the cover photo immediately below.
import { Fragment } from 'react'
import { Link } from 'react-router-dom'

export default function ArticleHero({
  back = null,
  eyebrow,
  title,
  summary = '',
  date,
  minutes = null,
  meta = [],
  badge = null,
}) {
  // Only the date and the reading time get an icon; anything else (an event's venue) is prose and
  // wearing a clock would be a lie about what it is.
  const details = [
    date ? { icon: 'calendar_month', text: date } : null,
    minutes ? { icon: 'schedule', text: `${minutes} min read` } : null,
    ...meta.map((text) => ({ icon: null, text })),
  ].filter(Boolean)

  return (
    <header className="mx-auto max-w-[860px]">
      {(back || eyebrow) && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          {back ? (
            <Link
              to={back.to}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-900 transition-colors hover:text-brand"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                arrow_back
              </span>
              {back.label}
            </Link>
          ) : (
            <span />
          )}

          {eyebrow && (
            <span className="rounded-full border border-brand/25 bg-brand/5 px-3 py-1 text-[11px] font-bold uppercase tracking-[.08em] text-brand">
              {eyebrow}
            </span>
          )}
        </div>
      )}

      {details.length > 0 && (
        <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-ink-muted">
          {details.map((item, index) => (
            <Fragment key={index}>
              <span className="inline-flex items-center gap-1.5">
                {item.icon && (
                  <span
                    className="material-symbols-outlined text-[18px] text-brand-orange"
                    aria-hidden="true"
                  >
                    {item.icon}
                  </span>
                )}
                {item.text}
              </span>
            </Fragment>
          ))}
          {badge}
        </div>
      )}

      <h1 className="mt-3 font-display text-[2.2rem] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink-900 sm:text-[3.25rem]">
        {title}
      </h1>

      {summary && (
        <p className="mt-5 max-w-[760px] text-lg leading-relaxed text-ink-muted sm:text-xl">{summary}</p>
      )}
    </header>
  )
}
