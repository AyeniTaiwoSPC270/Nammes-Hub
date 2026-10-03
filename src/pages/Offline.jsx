import Reveal from '../components/ui/Reveal'
import Button from '../components/ui/Button'
import SocialIcons from '../components/SocialIcons'

// Copy is JSX rather than plain strings so the typographic apostrophes survive: entities only decode in
// JSX children, not inside a string in braces.
const COPY = {
  offline: {
    pill: 'No connection',
    eyebrow: <>You&rsquo;re offline</>,
    headline: <>We can&rsquo;t reach NAMMES Hub</>,
    body: (
      <>
        Nothing is loading because this device can&rsquo;t reach NAMMES Hub. Nothing you&rsquo;ve saved is
        lost &mdash; we&rsquo;ll bring you straight back once it&rsquo;s reachable again.
      </>
    ),
    label: 'Try again',
  },
  checking: {
    pill: <>Checking connection&hellip;</>,
    eyebrow: <>Reconnecting</>,
    headline: <>Trying to reach the Hub</>,
    body: (
      <>
        Hold on &mdash; we&rsquo;re checking your connection every few seconds and will load the page for
        you the moment it&rsquo;s back.
      </>
    ),
    label: <>Checking&hellip;</>,
  },
  // Shown only if the screen is reached while the link is slow rather than gone. We never get here from
  // ErrorBoundary on a slow link (it leaves the app alone), but the route can be opened by hand.
  slow: {
    pill: <>Slow connection&hellip;</>,
    eyebrow: <>Connection is struggling</>,
    headline: <>This page is taking a while</>,
    body: (
      <>
        Your connection is working, but it is slow. We&rsquo;re still trying &mdash; close other tabs or
        switch to a stronger network if this keeps up.
      </>
    ),
    label: 'Try again',
  },
  online: {
    pill: 'Back online',
    eyebrow: <>Connection restored</>,
    headline: <>You&rsquo;re back online</>,
    body: <>Your connection is working again. Reload to pick up where you left off.</>,
    label: 'Reload page',
  },
}

// The page is a solid brand fill, so it reads the same in light and dark; only the confirmation state needs
// a colour that isn't orange. This is the dark theme's --color-brand, which stays legible on bg-green-900.
// The tints below have to be written out: Tailwind only emits a class it can find as a literal in the
// source, so a helper like tint(70) would silently produce no CSS at all.
const RECOVERED_TEXT = 'text-[#5cb88a]'
const RECOVERED_DOT = 'bg-[#5cb88a]'

// Deliberately presentational. The status and retry action come from whoever is showing the screen, so
// there is one poller for the whole app no matter how many times this renders.
export default function Offline({ status = 'offline', onRetry }) {
  const copy = COPY[status] ?? COPY.offline
  const isChecking = status === 'checking'
  const isRecovered = status === 'online'

  return (
    <div className="flex min-h-svh flex-col items-center justify-between bg-green-900 px-4 py-6 text-white sm:px-6 sm:py-8">
      <header className="flex w-full max-w-4xl items-center justify-between py-2">
        <div className="flex items-center gap-3">
          <img src="/logo-small.png" alt="" width="32" height="32" className="h-8 w-8 object-contain" />
          <span className="font-display text-xl font-bold text-white">NAMMES Hub</span>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-semibold text-white/80">
          <span className="relative flex h-2 w-2">
            <span
              className={`absolute inline-flex h-full w-full rounded-full opacity-75 motion-safe:animate-ping ${isRecovered ? RECOVERED_DOT : 'bg-orange-500'}`}
            />
            <span className={`relative inline-flex h-2 w-2 rounded-full ${isRecovered ? RECOVERED_DOT : 'bg-orange-500'}`} />
          </span>
          {copy.pill}
        </div>
      </header>

      <Reveal className="my-auto flex max-w-xl flex-col items-center py-8 text-center">
        <div className="relative mb-6 flex h-40 w-40 items-center justify-center sm:h-48 sm:w-48">
          <span
            className={`absolute -top-1 left-4 h-3 w-3 rounded-full blur-[1px] motion-safe:animate-pulse ${isRecovered ? 'bg-[#5cb88a]/70' : 'bg-orange-500/80'}`}
          />
          <span
            className={`absolute right-1 top-10 h-2 w-2 rounded-full motion-safe:animate-ping ${isRecovered ? 'bg-[#5cb88a]/60' : 'bg-orange-500/70'}`}
          />
          <span
            className={`absolute bottom-3 left-0 h-2.5 w-2.5 rounded-full blur-[1px] motion-safe:animate-pulse ${isRecovered ? 'bg-[#5cb88a]/50' : 'bg-orange-500/60'}`}
          />
          <div className="flex h-full w-full items-center justify-center rounded-full border border-white/10 bg-white/5">
            {/* Names are written out rather than held in COPY so iconFont.test.js can still see them in
                icon_names; a glyph missing from the subset would otherwise render as the word "SYNC". */}
            <span
              className={`material-symbols-outlined text-7xl ${isChecking ? 'text-white/70 motion-safe:animate-spin' : isRecovered ? RECOVERED_TEXT : 'text-orange-500'}`}
            >
              {isChecking ? 'sync' : isRecovered ? 'check_circle' : 'wifi_off'}
            </span>
          </div>
        </div>

        <p
          className={`mb-2 font-mono text-xs font-bold uppercase tracking-[.05em] ${isRecovered ? RECOVERED_TEXT : 'text-orange-500'}`}
        >
          {copy.eyebrow}
        </p>

        <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl">{copy.headline}</h1>
        <p className="mb-8 max-w-md text-sm leading-relaxed text-white/75 sm:text-base">{copy.body}</p>

        <Button
          variant="accent"
          onClick={isRecovered ? () => window.location.reload() : onRetry}
          disabled={isChecking}
        >
          <span
            className={`material-symbols-outlined text-[18px] ${isChecking ? 'motion-safe:animate-spin' : ''}`}
          >
            {isRecovered ? 'restart_alt' : 'refresh'}
          </span>
          {copy.label}
        </Button>

        <div className="mt-10">
          <p className="mb-3 text-xs text-white/50">Still stuck? Say hello on</p>
          <SocialIcons className="justify-center" variant="dark" />
        </div>
      </Reveal>

      <footer className="w-full border-t border-white/10 py-4 text-center">
        <p className="text-xs text-white/40">
          National Association of Materials and Metallurgical Engineering Students &middot; University of Lagos
        </p>
      </footer>
    </div>
  )
}