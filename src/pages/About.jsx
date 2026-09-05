import PageBanner from '../components/PageBanner'

const missionVision = [
  {
    icon: 'visibility',
    title: 'Vision Statement',
    body: 'To foster an inclusive, innovative, and industrious community of materials and metallurgical engineering students committed to academic excellence, technical mastery, and professional growth.',
  },
  {
    icon: 'flag',
    title: 'Mission Statement',
    body: 'To advance the intellectual and professional development of our members by providing platforms for skill-building, industry exposure, and welfare support, while representing student interests within the department, faculty, and university.',
  },
]

const coreValues = [
  {
    icon: 'groups',
    title: 'Unity',
    body: 'Fostering camaraderie and inclusive collaboration among materials and metallurgical engineering students.',
  },
  {
    icon: 'verified',
    title: 'Integrity',
    body: 'Upholding honesty and the reputation of the department and the university at all times.',
  },
  {
    icon: 'military_tech',
    title: 'Leadership',
    body: 'Equipping members with leadership experience through executive roles, committees, and event organizing.',
  },
  {
    icon: 'workspace_premium',
    title: 'Excellence',
    body: 'Championing academic rigor and technical skill as the standard for every member.',
  },
  {
    icon: 'lightbulb',
    title: 'Innovation',
    body: 'Encouraging original thinking and hands-on engagement with emerging materials technologies.',
  },
  {
    icon: 'shield',
    title: 'Advocacy',
    body: 'Representing student interests and welfare to departmental and faculty leadership.',
  },
]

export default function About() {
  return (
    <div>
      <PageBanner
        image="https://images.unsplash.com/photo-1584365098838-50ccef838f4a?auto=format&fit=crop&w=1600&q=80"
        title="About NAMMES"
        subtitle="Learn more about NAMMES, our mission and values."
        size="lg"
      />

      <div className="mx-auto max-w-[900px] px-5 py-14 sm:px-6">
        <h2 className="text-center text-2xl sm:text-[28px] font-bold text-green-900 mb-6">Who We Are</h2>
        <div className="flex flex-col gap-4 rounded-lg border border-hairline bg-surface p-6 shadow-md sm:p-8">
          <p className="leading-relaxed text-ink">
            Created in 1973 to catalyze Nigeria&rsquo;s industrialization, the Department of
            Metallurgical and Materials Engineering forms the critical link between raw mineral
            extraction, refinement, and advanced materials design. The curriculum encompasses
            physical metallurgy, extractive processes, thermodynamics, and advanced composite
            characterization.
          </p>
          <p className="leading-relaxed text-ink">
            The National Association of Metallurgical and Materials Engineering Students (NAMMES)
            UNILAG Chapter organizes zonal technical workshops, leadership training, and plant
            visits to steelworks. NAMMES promotes highly multi-disciplinary skills, with its
            members frequently excelling across the entire engineering faculty.
          </p>
          <p className="leading-relaxed text-ink">
            <strong className="text-ink-900">Excellence Highlight:</strong> The department&rsquo;s
            absolute dominance was cemented recently when Clinton Mekwunye emerged not only as the
            Best Graduating Student of the Department of Metallurgical and Materials Engineering
            but as the overall Best Graduating Student in the entire Faculty of Engineering.
          </p>
        </div>
      </div>

      <div className="w-full bg-surface-low py-14">
        <div className="mx-auto max-w-[1000px] px-5 sm:px-6">
          <h2 className="text-center text-2xl sm:text-[28px] font-bold text-green-900 mb-8">
            Our Mission &amp; Vision
          </h2>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {missionVision.map((item) => (
              <div key={item.title} className="rounded-lg border border-hairline bg-surface p-6 shadow-md">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-900">
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                </span>
                <h3 className="mt-4 text-lg font-bold text-ink-900">{item.title}</h3>
                <p className="mt-2 leading-relaxed text-ink-muted">{item.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1100px] px-5 py-14 sm:px-6">
        <h2 className="text-center text-2xl sm:text-[28px] font-bold text-green-900 mb-2">Our Core Values</h2>
        <p className="mb-8 text-center text-ink-muted">
          The principles NAMMES is built upon, guiding how we work and represent our members.
        </p>
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {coreValues.map((item) => (
            <div key={item.title} className="rounded-lg border border-hairline bg-surface p-6 shadow-md">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-600">
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
              </span>
              <h3 className="mt-4 text-lg font-bold text-ink-900">{item.title}</h3>
              <p className="mt-2 leading-relaxed text-ink-muted">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
