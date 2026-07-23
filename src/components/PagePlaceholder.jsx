export default function PagePlaceholder({ eyebrow, title, description }) {
  return (
    <div className="mx-auto max-w-[880px] px-6 py-12 sm:px-8">
      <p className="mb-2 font-mono text-xs uppercase tracking-wide text-orange-600">
        {eyebrow}
      </p>
      <h1 className="mb-3 text-3xl sm:text-4xl">{title}</h1>
      <p className="max-w-2xl leading-relaxed text-ink-muted">{description}</p>
    </div>
  )
}
