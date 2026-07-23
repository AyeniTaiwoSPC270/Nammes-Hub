import Card from '../components/ui/Card'

export default function Events() {
  return (
    <div className="mx-auto max-w-[880px] px-5 py-12 sm:px-6">
      <h1 className="text-[32px]">Events</h1>
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Card tone="orange" eyebrow="Nov 14" title="Metallurgy Career Fair" meta="Main Auditorium · 10:00 AM">
          Meet recruiters from steel, cement and mining employers.
        </Card>
        <Card tone="green" eyebrow="Dec 02" title="Exco Elections">
          General assembly, all levels welcome.
        </Card>
      </div>
    </div>
  )
}
