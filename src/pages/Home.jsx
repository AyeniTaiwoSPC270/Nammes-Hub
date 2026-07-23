import { useNavigate } from 'react-router-dom'
import Button from '../components/ui/Button'
import Card from '../components/ui/Card'
import Badge from '../components/ui/Badge'

const excos = [
  { role: 'President', id: 'exco-president' },
  { role: 'Vice President', id: 'exco-vp' },
  { role: 'General Secretary', id: 'exco-secgen' },
  { role: 'Assistant General Secretary', id: 'exco-asstsecgen', name: 'Ayeni Taiwo' },
  { role: 'Financial Secretary', id: 'exco-finsec' },
  { role: 'Treasurer', id: 'exco-treasurer' },
  { role: 'Welfare Secretary', id: 'exco-welfare' },
  { role: 'Social Secretary', id: 'exco-social' },
  { role: 'Sports Secretary', id: 'exco-sports' },
  { role: 'PRO', id: 'exco-pro' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div>
      <div className="relative overflow-hidden bg-orange-500 px-6 py-14 sm:px-8">
        <div
          aria-hidden="true"
          className="absolute -top-[90px] -right-[70px] h-[260px] w-[260px] rounded-full bg-green-700"
        />
        <div className="relative mx-auto max-w-[720px]">
          <div className="inline-block w-fit whitespace-nowrap rounded-full bg-white px-3.5 py-1 font-mono text-[13px] font-bold uppercase text-green-900">
            NAMMES · 2025/2026 SESSION
          </div>
          <h1 className="mt-5 text-[30px] text-white sm:text-[44px]">
            Everything the department publishes, in one place.
          </h1>
          <p className="mt-3 max-w-[560px] text-[17px] text-white/90">
            Course outlines, event records, drive links, department news and opportunities —
            built for finding what you need in seconds.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button variant="primary" onClick={() => navigate('/outlines')}>
              Browse outlines
            </Button>
            <Button variant="secondary" onClick={() => navigate('/events')}>
              See events
            </Button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] px-5 pt-14 pb-18 sm:px-6">
        <div className="mb-6 flex items-baseline justify-between gap-4">
          <div>
            <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
              Department news
            </div>
            <h2 className="mt-1.5 text-[28px]">What&rsquo;s happening in the department</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate('/news')}>
            View all news
          </Button>
        </div>

        <Card tone="green" eyebrow="Academics" title="2025/2026 Second Semester Exam Timetable Released" meta="Jul 20, 2026">
          Second semester exams begin Aug 4. Check the pinned drive folder for your level&rsquo;s
          full schedule and venue allocations. <Badge tone="new">New</Badge>
        </Card>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card eyebrow="Governance" title="NAMMES General Assembly & Elections Notice" meta="Jul 15, 2026">
            All levels required to attend. New Exco nominations open at the assembly.
          </Card>
          <Card eyebrow="Academics" title="Departmental Seminar Series Resumes" meta="Jul 10, 2026">
            Weekly seminars on corrosion engineering and welding metallurgy start this Thursday, 2 PM.
          </Card>
          <Card tone="orange" eyebrow="Call for papers" title="Materials Science Undergraduate Symposium" meta="Jul 05, 2026">
            Submit abstracts by Jul 30. <Badge tone="updated">Updated</Badge>
          </Card>
          <Card eyebrow="Resources" title="400 Level Drive Folder Updated" meta="Jun 28, 2026">
            Design project templates and past FYP reports added to the shared drive.
          </Card>
          <Card eyebrow="Welfare" title="Textbook Donation Drive" meta="Jun 20, 2026">
            Drop off or request departmental textbooks at the NAMMES office, Rm 214.
          </Card>
          <Card tone="green" eyebrow="Industry" title="Site Visit to Dangote Cement Slated for August" meta="Jun 12, 2026">
            Interest form for 300/400 level students closes Jul 31.
          </Card>
        </div>
      </div>

      <div className="mx-auto max-w-[880px] px-5 pb-18 sm:px-6">
        <div className="font-mono text-xs font-bold uppercase tracking-[.04em] text-green-700">
          Executives · 2025/2026
        </div>
        <h2 className="mt-1.5 mb-6 text-[28px]">Meet the Excos</h2>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          {excos.map((x) => (
            <div key={x.id} className="flex flex-col items-center gap-2.5">
              <div className="flex h-[120px] w-[120px] items-center justify-center rounded-full bg-green-100 font-display text-2xl text-green-700">
                {(x.name || x.role).charAt(0)}
              </div>
              <div className="text-center">
                <div className="text-[15px] font-semibold">{x.name || 'Name Surname'}</div>
                <div className="mt-0.5 font-mono text-xs text-ink-muted">{x.role}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
