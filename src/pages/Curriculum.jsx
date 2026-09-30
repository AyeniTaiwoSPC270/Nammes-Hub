import PageBanner from '../components/PageBanner'
import Reveal from '../components/ui/Reveal'
import { usePageBanner } from '../data/pageBanners'

const CCMAS_PDF = '/documents/mme-ccmas.pdf'

const LEVEL_UNITS = [
  { level: '100', units: 25 },
  { level: '200', units: 29 },
  { level: '300', units: 27 },
  { level: '400', units: 8 },
  { level: '500', units: 16 },
]

const DISCIPLINES = [
  'Mineral Processing',
  'Extractive Metallurgy',
  'Physical Metallurgy',
  'Materials Engineering',
  'Materials Processing',
]

export default function Curriculum() {
  const banner = usePageBanner('curriculum')

  return (
    <div>
      <PageBanner
        images={banner?.image_urls}
        transition={banner?.transition}
        intervalSeconds={banner?.interval_seconds}
        title={banner?.title ?? 'Programme Curriculum (CCMAS)'}
        subtitle={
          banner?.subtitle ??
          'The official NUC Core Curriculum and Minimum Academic Standards for Materials and Metallurgical Engineering.'
        }
      />

      <Reveal className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-6 shadow-md sm:p-8">
          <h2 className="text-2xl font-bold text-brand">Overview</h2>
          <p className="leading-relaxed text-ink">
            This curriculum is designed for the Bachelor of Engineering (B.Eng.) degree programme in Materials
            and Metallurgical Engineering &mdash; an exceptionally broad field spanning mineral processing,
            extractive metallurgy, physical metallurgy, materials engineering, and materials processing. Fifteen
            (15) credit units are attached to Students Industrial Work Experience Scheme (SIWES) throughout the
            programme to guarantee robust industrial training.
          </p>
          <div className="flex flex-wrap gap-2">
            {DISCIPLINES.map((d) => (
              <span
                key={d}
                className="rounded-full border border-hairline bg-surface-low px-3 py-1 text-xs font-semibold text-ink-muted"
              >
                {d}
              </span>
            ))}
          </div>
        </div>
      </Reveal>

      <Reveal className="w-full bg-surface-low py-12">
        <div className="mx-auto max-w-[900px] px-5 sm:px-6">
          <h2 className="mb-6 text-center text-2xl font-bold text-brand">Global Course Structure</h2>
          <div className="overflow-hidden rounded-lg border border-hairline bg-surface shadow-md">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-hairline bg-surface-low">
                  <th className="border-r border-hairline p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">
                    Level
                  </th>
                  <th className="p-4 text-xs font-bold uppercase tracking-[.05em] text-ink">Total Units</th>
                </tr>
              </thead>
              <tbody>
                {LEVEL_UNITS.map((row, i) => (
                  <tr
                    key={row.level}
                    className={[
                      'transition-colors hover:bg-surface-low',
                      i < LEVEL_UNITS.length - 1 ? 'border-b border-hairline' : '',
                    ].join(' ')}
                  >
                    <td className="border-r border-hairline p-4 font-semibold text-ink-900">{row.level} Level</td>
                    <td className="p-4 text-ink">{row.units} units</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-hairline bg-surface-low">
                  <td className="border-r border-hairline p-4 font-bold text-ink-900">Total</td>
                  <td className="p-4 font-bold text-ink-900">105 units</td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-center text-sm text-ink-muted">
            All 15 SIWES units are credited in the second semester of 400 Level.
          </p>
        </div>
      </Reveal>

      <Reveal className="mx-auto max-w-[900px] px-5 py-12 sm:px-6">
        <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-6 shadow-md sm:p-8">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-brand">Full Document</h2>
            <p className="text-ink-muted">
              Course codes, units, contact hours, learning outcomes, and detailed content for every course at
              every level are in the full document below.
            </p>
          </div>
          <a
            href={CCMAS_PDF}
            download="MME-CCMAS-Course-Outline.pdf"
            className="inline-flex w-fit items-center gap-2 rounded-md border border-orange-500 bg-orange-500 px-7 py-3.5 font-body text-base font-bold text-white no-underline transition-[background-color,border-color,transform] duration-150 ease-out hover:scale-[1.03] hover:border-orange-600 hover:bg-orange-600 active:scale-[0.98]"
          >
            <span className="material-symbols-outlined text-xl">download</span>
            Download CCMAS PDF
          </a>

          <div className="mt-2 hidden overflow-hidden rounded-lg border border-hairline md:block">
            <iframe src={CCMAS_PDF} title="MME CCMAS Course Outline" className="h-[80dvh] w-full" loading="lazy" />
          </div>
          <p className="text-sm text-ink-muted">
            Can&rsquo;t see the preview?{' '}
            <a href={CCMAS_PDF} target="_blank" rel="noopener noreferrer" className="font-semibold text-orange-600 hover:underline">
              Open the PDF in a new tab
            </a>{' '}
            instead.
          </p>
        </div>
      </Reveal>
    </div>
  )
}
