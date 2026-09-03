import { Link } from 'react-router-dom'

const linkGroups = [
  {
    heading: 'Explore',
    items: [
      { label: 'Home', to: '/' },
      { label: 'Outlines', to: '/outlines' },
      { label: 'Events', to: '/events' },
      { label: 'Meet the Excos', to: '/excos' },
    ],
  },
  {
    heading: 'Resources',
    items: [
      { label: 'Resources', to: '/resources' },
      { label: 'News', to: '/news' },
      { label: 'Opportunities', to: '/opportunities' },
    ],
  },
  {
    heading: 'Department',
    items: [
      { label: 'CGPA calculator', to: '/cgpa' },
      { label: 'Sign in', to: '/login' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto bg-ink-900 px-8 pt-12 pb-7 text-white/72">
      <div className="mx-auto flex max-w-[880px] flex-wrap justify-between gap-8">
        <div className="max-w-80">
          <span className="inline-flex items-center gap-2 whitespace-nowrap font-display text-xl font-bold text-orange-500">
            <img src="/logo.png" alt="" className="h-8 w-8" />
            NAMMES Hub
          </span>
          <p className="mt-3 text-sm leading-relaxed">
            National Association of Metallurgical and Material Engineering Students, University of Lagos Chapter
          </p>
        </div>

        {linkGroups.map((group) => (
          <div key={group.heading}>
            <div className="mb-3 text-xs font-semibold uppercase tracking-[.05em] text-orange-500">
              {group.heading}
            </div>
            <div className="flex flex-col gap-2">
              {group.items.map((item) => (
                <Link key={item.label} to={item.to} className="text-sm text-white/80 no-underline hover:text-white hover:underline">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-8 flex max-w-[880px] flex-wrap justify-between gap-2 border-t border-white/15 pt-5 text-xs text-white/50">
        <span>&copy; {year} NAMMES Hub. All rights reserved.</span>
        <span>University of Lagos, Faculty of Engineering</span>
      </div>
    </footer>
  )
}
