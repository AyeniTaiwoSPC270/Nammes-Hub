import { Link } from 'react-router-dom'
import SocialIcons from './SocialIcons'

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
      { label: 'Contact Us', to: '/contact' },
      { label: 'Sign in', to: '/login' },
    ],
  },
]

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer className="mt-auto bg-green-900 text-white/72">
      <div className="mx-auto flex max-w-[1080px] flex-wrap items-center justify-between gap-4 border-b border-white/10 px-8 py-5">
        <span className="text-sm text-white/80">Have a question for the association?</span>
        <Link
          to="/excos"
          className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-500 no-underline hover:text-orange-100"
        >
          Reach an Exco
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      </div>

      <div className="mx-auto max-w-[1080px] px-8 pt-10">
        <h3 className="text-xl font-bold text-white">Stay Connected With Us</h3>
        <p className="mt-1 text-sm font-semibold text-white/90">Subscribe to our Newsletter</p>
        <p className="mt-1 max-w-md text-sm text-white/70">
          Get the latest updates, events, and opportunities delivered to your inbox.
        </p>
        <iframe
          src="https://nammescommunique.substack.com/embed"
          width="480"
          height="320"
          style={{ border: '1px solid #EEE', background: 'white' }}
          frameBorder="0"
          scrolling="no"
          title="Subscribe to the NAMMES Communique newsletter"
          className="mt-4 max-w-full rounded-lg"
        />
      </div>

      <div className="mx-auto flex max-w-[1080px] flex-wrap justify-between gap-10 px-8 pt-10 pb-8">
        <div className="max-w-88 min-w-56 flex-[2]">
          <span className="inline-flex items-center gap-2 whitespace-nowrap font-display text-2xl font-bold text-white">
            <img src="/logo.png" alt="" className="h-9 w-9" />
            NAMMES Hub
          </span>
          <span className="mt-2 block h-0.5 w-10 rounded-full bg-orange-500" />
          <p className="mt-4 text-sm leading-relaxed">
            National Association of Metallurgical and Material Engineering Students, University of Lagos Chapter
          </p>
          <SocialIcons className="mt-5" />
        </div>

        <div className="flex flex-1 flex-wrap justify-between gap-8">
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
      </div>

      <div className="mx-auto flex max-w-[1080px] flex-wrap justify-between gap-2 border-t border-white/10 px-8 py-5 text-xs text-white/50">
        <span>&copy; {year} NAMMES Hub. All rights reserved.</span>
        <span>University of Lagos, Faculty of Engineering</span>
      </div>
    </footer>
  )
}
