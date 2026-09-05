export default function WelcomeMessage() {
  return (
    <section className="w-full bg-green-900 py-16">
      <div className="mx-auto max-w-[1200px] px-5 sm:px-6 flex flex-col md:flex-row gap-10 items-center">
        <div className="w-full md:w-1/3 shrink-0">
          <div className="flex aspect-[3/4] w-full items-center justify-center overflow-hidden rounded-lg border-4 border-white/20 bg-white/10 shadow-md">
            <img
              src="https://randomuser.me/api/portraits/women/44.jpg"
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        </div>
        <div className="w-full md:w-2/3 text-white">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-4">A Message from the President</h2>
          <div className="flex max-w-2xl flex-col gap-3 text-white/80 mb-6">
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
          <div>
            <p className="font-bold text-white">Soyemi Eniola</p>
            <p className="text-orange-500">President, NAMMES &middot; 2026/2027 Session</p>
          </div>
        </div>
      </div>
    </section>
  )
}
