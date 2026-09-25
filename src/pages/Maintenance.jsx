import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'
import SocialIcons from '../components/SocialIcons'
import { useSiteContentQuery } from '../data/siteContent'

const DEFAULT_MESSAGE =
  "NAMMES Hub is currently undergoing scheduled maintenance. All student records, outlines, and ballots remain safe and intact. We'll be back online shortly."

export default function Maintenance() {
  const contentQuery = useSiteContentQuery()
  const content = contentQuery.data
  const message = content?.maintenance_message?.trim() || DEFAULT_MESSAGE
  const contactEmail = content?.maintenance_contact_email

  return (
    <div className="flex min-h-svh flex-col items-center justify-between bg-green-900 px-4 py-6 text-white sm:px-6 sm:py-8">
      <header className="flex w-full max-w-4xl items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="" className="h-8 w-8 object-contain" />
          <span className="font-display text-xl font-bold text-white">NAMMES Hub</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
          <span className="relative flex h-2 w-2">
            <span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-500 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500" />
          </span>
          Scheduled maintenance
        </div>
      </header>

      <Reveal className="my-auto flex max-w-xl flex-col items-center py-8 text-center">
        <div className="relative mb-6 flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <span className="motion-safe:animate-pulse absolute -top-1 left-4 h-3 w-3 rounded-full bg-orange-500/80 blur-[1px]" />
          <span className="motion-safe:animate-ping absolute right-1 top-10 h-2 w-2 rounded-full bg-orange-500/70" />
          <span className="motion-safe:animate-pulse absolute bottom-3 left-0 h-2.5 w-2.5 rounded-full bg-orange-500/60 blur-[1px]" />
          <div className="flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-white/5">
            <span className="material-symbols-outlined text-7xl text-orange-500">build</span>
          </div>
        </div>

        <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl">We&rsquo;ll be right back</h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">{message}</p>

        <div className="flex w-full flex-col items-center justify-center gap-4 sm:flex-row">
          {contactEmail && (
            <a href={`mailto:${contactEmail}`} className="no-underline">
              <Button variant="accent">
                <span className="material-symbols-outlined text-[18px]">support_agent</span>
                Reach an Exco
              </Button>
            </a>
          )}
        </div>

        <SocialIcons className="mt-8" variant="dark" />
      </Reveal>

      <footer className="w-full border-t border-white/10 py-4 text-center">
        <p className="text-xs text-white/40">
          National Association of Materials and Metallurgical Engineering Students · University of Lagos
        </p>
      </footer>
    </div>
  )
}
