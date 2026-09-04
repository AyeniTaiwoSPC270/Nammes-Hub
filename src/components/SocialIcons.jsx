function WhatsAppIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12.04 2c-5.52 0-10 4.48-10 10 0 1.77.46 3.44 1.26 4.88L2 22l5.25-1.38a9.96 9.96 0 0 0 4.79 1.22h.01c5.52 0 10-4.48 10-10s-4.48-9.84-10.01-9.84Zm5.86 14.2c-.25.7-1.45 1.34-2 1.43-.51.08-1.16.11-1.87-.12-.43-.14-.98-.32-1.69-.63-2.97-1.28-4.91-4.27-5.06-4.47-.15-.2-1.21-1.61-1.21-3.07s.77-2.18 1.04-2.48c.27-.3.6-.37.8-.37s.4 0 .58.01c.19.01.44-.07.68.52.25.6.85 2.08.93 2.23.08.15.13.33.03.53-.1.2-.15.33-.3.5-.15.18-.31.4-.44.53-.15.15-.3.31-.13.6.17.3.76 1.25 1.63 2.02 1.12 1 2.06 1.31 2.36 1.46.3.15.48.13.66-.08.18-.2.76-.89.96-1.2.2-.3.4-.25.66-.15.27.1 1.71.81 2 .96.3.15.5.22.57.35.08.13.08.75-.17 1.45Z" />
    </svg>
  )
}

function XIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M18.24 3H21l-6.55 7.49L22 21h-6.15l-4.82-6.3L5.5 21H2.73l7.03-8.03L2 3h6.3l4.35 5.75L18.24 3Zm-1.08 16.17h1.53L7.9 4.73H6.27l10.89 14.44Z" />
    </svg>
  )
}

function InstagramIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none" />
    </svg>
  )
}

function LinkedInIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M4.98 3.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5ZM3.5 9.75h3v10.75h-3V9.75Zm6.25 0h2.88v1.47h.04c.4-.76 1.38-1.56 2.85-1.56 3.05 0 3.61 2 3.61 4.6v6.24h-3v-5.53c0-1.32-.02-3.02-1.84-3.02-1.84 0-2.12 1.44-2.12 2.92v5.63h-3V9.75Z" />
    </svg>
  )
}

function YouTubeIcon(props) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M21.58 7.2a2.75 2.75 0 0 0-1.94-1.95C17.9 4.75 12 4.75 12 4.75s-5.9 0-7.64.5A2.75 2.75 0 0 0 2.42 7.2 28.6 28.6 0 0 0 2 12a28.6 28.6 0 0 0 .42 4.8 2.75 2.75 0 0 0 1.94 1.95c1.74.5 7.64.5 7.64.5s5.9 0 7.64-.5a2.75 2.75 0 0 0 1.94-1.95c.29-1.58.43-3.2.42-4.8.01-1.6-.13-3.22-.42-4.8ZM10 15.02V8.98L15.27 12 10 15.02Z" />
    </svg>
  )
}

export const socialLinks = [
  { label: 'WhatsApp community', href: '#', Icon: WhatsAppIcon },
  { label: 'X', href: '#', Icon: XIcon },
  { label: 'Instagram', href: '#', Icon: InstagramIcon },
  { label: 'LinkedIn', href: '#', Icon: LinkedInIcon },
  { label: 'YouTube', href: '#', Icon: YouTubeIcon },
]

const darkLinkClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-white/20 text-white/70 transition-colors hover:border-orange-500 hover:text-orange-500'
const lightLinkClass =
  'flex h-8 w-8 items-center justify-center rounded-full border border-hairline text-ink-muted transition-colors hover:border-green-900 hover:text-green-900'

export default function SocialIcons({ className = '', variant = 'dark' }) {
  const linkClass = variant === 'light' ? lightLinkClass : darkLinkClass

  return (
    <div className={['flex items-center gap-3', className].join(' ')}>
      {socialLinks.map(({ label, href, Icon }) => (
        <a key={label} href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={linkClass}>
          <Icon className="h-4 w-4" />
        </a>
      ))}
    </div>
  )
}
