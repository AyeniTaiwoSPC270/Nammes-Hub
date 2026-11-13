// The masthead of an article page.
//
// News and Events share it so the two detail pages open the same way: the category, a headline that can
// be read from across the page, and the byline underneath. It deliberately does not use the cover as a
// background -- article covers keep their own proportions (an admin uploads posters, not crops), so a
// full-bleed hero would have to cut them.
import { Fragment } from 'react'

export default function ArticleHero({ eyebrow, title, meta = [], badge = null }) {
  return (
    <header className="relative overflow-hidden rounded-lg bg-green-900">
      {/* Rings rather than a photograph: a text-only article still gets a composed masthead. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border-[28px] border-white/5"
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-24 right-24 h-52 w-52 rounded-full border-[18px] border-orange-500/25"
      />

      <div className="relative mx-auto max-w-[900px] px-5 py-11 sm:px-10 sm:py-16">
        <div className="flex flex-wrap items-center gap-2">
          {eyebrow && (
            <span className="rounded-full bg-orange-500 px-3 py-1 text-[11px] font-bold uppercase tracking-[.12em] text-green-900">
              {eyebrow}
            </span>
          )}
          {badge}
        </div>

        <h1 className="mt-4 font-display text-[1.9rem] font-bold leading-[1.12] text-white sm:text-[2.75rem]">
          {title}
        </h1>

        {meta.length > 0 && (
          <div className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/75">
            {meta.map((item, index) => (
              <Fragment key={index}>
                {index > 0 && (
                  <span aria-hidden="true" className="text-white/30">
                    &middot;
                  </span>
                )}
                <span>{item}</span>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </header>
  )
}
