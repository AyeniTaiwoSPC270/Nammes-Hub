export default function PageHeader({ eyebrow, title, subtitle }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-green-900 via-green-700 to-orange-600 px-6 py-14 sm:px-8">
      <div className="relative mx-auto max-w-[880px]">
        {eyebrow && (
          <div className="font-mono text-xs font-semibold uppercase tracking-[.04em] text-orange-400">
            {eyebrow}
          </div>
        )}
        <h1 className="mt-2 text-3xl text-white sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-white/90">{subtitle}</p>}
      </div>
    </div>
  )
}
