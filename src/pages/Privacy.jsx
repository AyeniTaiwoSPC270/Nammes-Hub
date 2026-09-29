import { Link } from 'react-router-dom'

const SECTIONS = [
  {
    title: 'What we collect',
    body: [
      'Account details: your name, matric number, email address, and the year you started 100 Level.',
      'What you save or submit: CGPA calculator semesters, form responses, award nominations and votes, and course outline submissions.',
      'Messages you send through the Contact form: your name, email and message.',
      'Technical records: when you last visited, and error reports that help us fix problems. Error reports are cleaned of personal details before they are stored.',
    ],
  },
  {
    title: 'Why we use it',
    body: [
      'To run your account, show your CGPA report, run department forms and awards, send notifications you have not switched off, and answer your messages. We do not sell your data or use it for advertising.',
    ],
  },
  {
    title: 'Who handles it for us',
    body: [
      'Supabase stores the database and files. Vercel hosts the website. Resend sends our emails. Sentry receives error reports. Cloudflare Turnstile checks that a visitor is not a bot on sign-in and public forms.',
    ],
  },
  {
    title: 'How long we keep it',
    body: [
      'Contact messages are deleted after 12 months. Server error entries are deleted after 30 days.',
      'Your account and what you saved stay until you ask for them to be removed. If we cannot delete an account because votes or submissions are linked to it, we anonymise it: your name, matric number, CGPA data and email are removed and the records stay without your identity.',
    ],
  },
  {
    title: 'Award votes',
    body: ['Votes are kept secret. They are not included in your data export and are not shown to other members.'],
  },
]

export default function Privacy() {
  return (
    <div className="mx-auto max-w-[720px] px-5 py-12 sm:px-6">
      <h1 className="text-3xl font-bold text-ink-900">Privacy</h1>
      <p className="mt-1 text-ink-muted">How NAMMES Hub handles your personal information.</p>

      {SECTIONS.map((section) => (
        <section key={section.title} className="mt-8">
          <h2 className="text-xl font-bold text-ink-900">{section.title}</h2>
          {section.body.map((text) => (
            <p key={text} className="mt-2 text-ink">
              {text}
            </p>
          ))}
        </section>
      ))}

      <section className="mt-8">
        <h2 className="text-xl font-bold text-ink-900">Your choices</h2>
        <p className="mt-2 text-ink">
          Signed-in members can download or email themselves a copy of their data, and switch off email notifications,
          on the{' '}
          <Link to="/account" className="font-semibold text-orange-600 hover:underline">
            Account page
          </Link>
          . To correct your details, or to ask us to delete or anonymise your account, use the{' '}
          <Link to="/contact" className="font-semibold text-orange-600 hover:underline">
            Contact page
          </Link>
          .
        </p>
      </section>
    </div>
  )
}
