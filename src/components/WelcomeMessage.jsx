export default function WelcomeMessage() {
  return (
    <div className="mx-auto max-w-[880px] px-5 py-14 sm:px-6">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-start">
        <div className="mx-auto flex h-[220px] w-[180px] shrink-0 items-center justify-center rounded-sm border-4 border-white bg-green-100 sm:mx-0">
          <span className="px-4 text-center font-mono text-xs uppercase tracking-[.04em] text-ink-muted">
            Photo coming soon
          </span>
        </div>
        <div>
          <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
            Welcome message
          </div>
          <h2 className="mt-1.5 text-[28px]">A note from your NAMMES leadership</h2>
          <div className="mt-4 flex max-w-2xl flex-col gap-3 text-ink">
            <p>
              [Placeholder] On behalf of the Executive Council, it is my honor to welcome you to
              the official digital home of NAMMES. This platform exists to put everything the
              department publishes — outlines, events, opportunities, and news — in one place.
            </p>
            <p>
              [Placeholder] Replace this section with a real message, photo, name, and role once
              leadership has one ready.
            </p>
          </div>
          <div className="mt-5">
            <div className="font-semibold text-green-900">[Placeholder] Leader Name</div>
            <div className="mt-0.5 font-mono text-xs uppercase tracking-[.04em] text-ink-muted">
              President, NAMMES · 2025/2026 Session
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
