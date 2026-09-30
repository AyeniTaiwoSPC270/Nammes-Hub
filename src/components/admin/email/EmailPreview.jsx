import { useState } from 'react'

const DEVICES = [
  { id: 'desktop', label: 'Desktop', icon: 'desktop_windows', width: '100%' },
  { id: 'mobile', label: 'Phone', icon: 'phone_iphone', width: '375px' },
]

// Live preview of the rendered email. The dark view approximates how some inboxes auto-invert
// colors; real inboxes differ, and the email asks them not to (color-scheme: light).
export default function EmailPreview({ html, subject, height = 600 }) {
  const [device, setDevice] = useState('desktop')
  const [dark, setDark] = useState(false)
  const width = DEVICES.find((d) => d.id === device).width

  return (
    <div className="overflow-hidden rounded-lg border border-hairline bg-surface-low shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-hairline bg-surface px-4 py-2.5">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.05em] text-ink-muted">Live preview</p>
          {subject !== undefined && (
            <p className="mt-0.5 truncate text-sm text-ink-900">
              {subject.trim() || <span className="italic text-ink-muted">No subject yet</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          {DEVICES.map((d) => (
            <button
              key={d.id}
              type="button"
              onClick={() => setDevice(d.id)}
              aria-pressed={device === d.id}
              aria-label={`${d.label} preview`}
              title={`${d.label} preview`}
              className={[
                'flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150',
                device === d.id ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
              ].join(' ')}
            >
              <span className="material-symbols-outlined text-lg">{d.icon}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => setDark((v) => !v)}
            aria-pressed={dark}
            aria-label="Dark mode preview (approximate)"
            title="Dark mode preview (approximate)"
            className={[
              'flex h-10 w-10 items-center justify-center rounded-md border transition-colors duration-150',
              dark ? 'border-green-900 bg-green-900 text-white' : 'border-hairline bg-surface text-ink hover:bg-surface-low',
            ].join(' ')}
          >
            <span className="material-symbols-outlined text-lg">dark_mode</span>
          </button>
        </div>
      </div>
      <div className="flex justify-center overflow-x-auto bg-surface-low p-3">
        <iframe
          title="Email preview"
          srcDoc={html}
          style={{ width, maxWidth: '100%', height, filter: dark ? 'invert(1) hue-rotate(180deg)' : undefined }}
          className={['bg-white transition-[width] duration-200', device === 'mobile' ? 'rounded-xl border border-hairline' : ''].join(' ')}
        />
      </div>
      {dark && <p className="px-4 pb-3 text-center text-xs text-ink-muted">Approximate — inboxes differ in how they handle dark mode.</p>}
    </div>
  )
}
