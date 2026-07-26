// Sample/placeholder news data. Swap for real Supabase-backed content once
// news posts are scoped for the Admin CRUD flow.

export const NEWS_CATEGORIES = ['Academics', 'Governance', 'Welfare', 'Industry', 'Call for papers', 'Resources']

export const news = [
  {
    id: 'exam-timetable-2025-2026-s2',
    category: 'Academics',
    tone: 'green',
    date: 'Jul 20, 2026',
    title: '2025/2026 Second Semester Exam Timetable Released',
    body:
      "Second semester exams begin Aug 4. Check the pinned drive folder for your level's full schedule and venue allocations.",
    author: 'NAMMES PRO Office',
    badge: { tone: 'new', label: 'New' },
  },
  {
    id: 'general-assembly-elections-notice',
    category: 'Governance',
    tone: 'neutral',
    date: 'Jul 15, 2026',
    title: 'NAMMES General Assembly & Elections Notice',
    body: 'All levels required to attend. New Exco nominations open at the assembly.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'seminar-series-resumes',
    category: 'Academics',
    tone: 'neutral',
    date: 'Jul 10, 2026',
    title: 'Departmental Seminar Series Resumes',
    body: 'Weekly seminars on corrosion engineering and welding metallurgy start this Thursday, 2 PM.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'materials-science-symposium',
    category: 'Call for papers',
    tone: 'orange',
    date: 'Jul 05, 2026',
    title: 'Materials Science Undergraduate Symposium',
    body: 'Submit abstracts by Jul 30.',
    author: 'NAMMES PRO Office',
    badge: { tone: 'updated', label: 'Updated' },
  },
  {
    id: 'resource-drive-400l-update',
    category: 'Resources',
    tone: 'neutral',
    date: 'Jun 28, 2026',
    title: '400 Level Drive Folder Updated',
    body: 'Design project templates and past FYP reports added to the shared drive.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'textbook-donation-drive',
    category: 'Welfare',
    tone: 'neutral',
    date: 'Jun 20, 2026',
    title: 'Textbook Donation Drive',
    body: 'Drop off or request departmental textbooks at the NAMMES office, Rm 214.',
    author: 'NAMMES PRO Office',
  },
  {
    id: 'dangote-site-visit',
    category: 'Industry',
    tone: 'green',
    date: 'Jun 12, 2026',
    title: 'Site Visit to Dangote Cement Slated for August',
    body: 'Interest form for 300/400 level students closes Jul 31.',
    author: 'NAMMES PRO Office',
  },
]

export function getNews() {
  return news
}

export function getNewsById(id) {
  return news.find((n) => n.id === id)
}

export function filterNewsByCategory(list, category) {
  if (!category || category === 'All' || !NEWS_CATEGORIES.includes(category)) return list
  return list.filter((n) => n.category === category)
}
