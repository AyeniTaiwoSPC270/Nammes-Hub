import { splitParagraphs } from '../data/siteContent'

export default function WelcomeMessage({ name, role, message, photoUrl }) {
  const paragraphs = splitParagraphs(message)

  return (
    <section className="w-full bg-green-900 py-16">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 flex flex-col md:flex-row gap-10 items-center">
        <div className="w-full md:w-1/3 shrink-0">
          <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border-4 border-white/20 bg-white/10 shadow-md">
            {photoUrl && <img src={photoUrl} alt="" className="h-full w-full object-cover" />}
          </div>
        </div>
        <div className="w-full md:w-2/3 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">A Message from the President</h2>
          <div className="flex max-w-2xl flex-col gap-3 text-white/80 mb-6">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
          <div>
            <p className="font-bold text-white">{name}</p>
            <p className="text-orange-500">{role}</p>
          </div>
        </div>
      </div>
    </section>
  )
}
