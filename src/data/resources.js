// Sample/placeholder resource data. Swap for real Supabase-backed content once
// the department's shared Drive folders are scoped for the Admin CRUD flow.

export { LEVELS, SEMESTER_LABELS } from './outlines'

export const resources = {
  100: {
    1: [
      {
        category: 'Lecture Notes',
        title: 'MME 101 — Introduction to Materials & Metallurgical Engineering',
        updated: 'Jul 12, 2026',
        link: 'https://drive.google.com/drive/folders/100l-sem1-mme101',
      },
      {
        category: 'Past Questions',
        title: '100L First Semester — Past Exam Questions (2021–2025)',
        updated: 'Jul 05, 2026',
        link: 'https://drive.google.com/drive/folders/100l-sem1-past-questions',
      },
      {
        category: 'Slides & Handouts',
        title: 'PHY-CM 101 — General Physics I Slides',
        updated: 'Jun 30, 2026',
        link: 'https://drive.google.com/drive/folders/100l-sem1-phy101',
      },
    ],
    2: [
      {
        category: 'Lecture Notes',
        title: 'MME 102 — Materials Science Foundations',
        updated: 'Jul 02, 2026',
        link: 'https://drive.google.com/drive/folders/100l-sem2-mme102',
      },
      {
        category: 'Past Questions',
        title: '100L Second Semester — Past Exam Questions (2021–2025)',
        updated: 'Jun 20, 2026',
        link: 'https://drive.google.com/drive/folders/100l-sem2-past-questions',
      },
    ],
  },
  200: {
    1: [
      {
        category: 'Lecture Notes',
        title: '200L First Semester — Lecture Note Bundle',
        updated: 'Jul 14, 2026',
        link: 'https://drive.google.com/drive/folders/200l-sem1-notes',
      },
      {
        category: 'Reading List',
        title: 'GST 201 — Recommended Reading List',
        updated: 'Jun 18, 2026',
        link: 'https://drive.google.com/drive/folders/200l-sem1-gst201',
      },
    ],
    2: [
      {
        category: 'Past Questions',
        title: '200L Second Semester — Past Exam Questions',
        updated: 'Jun 25, 2026',
        link: 'https://drive.google.com/drive/folders/200l-sem2-past-questions',
      },
      {
        category: 'Lab Manual',
        title: 'Materials Lab I — Lab Manual & Report Templates',
        updated: 'Jun 15, 2026',
        link: 'https://drive.google.com/drive/folders/200l-sem2-lab-manual',
      },
    ],
  },
  300: {
    1: [
      {
        category: 'Lecture Notes',
        title: '300L First Semester — Lecture Note Bundle',
        updated: 'Jul 09, 2026',
        link: 'https://drive.google.com/drive/folders/300l-sem1-notes',
      },
      {
        category: 'Past Questions',
        title: '300L First Semester — Past Exam Questions',
        updated: 'Jun 27, 2026',
        link: 'https://drive.google.com/drive/folders/300l-sem1-past-questions',
      },
    ],
    2: [
      {
        category: 'Slides & Handouts',
        title: '300L Second Semester — Slide Decks',
        updated: 'Jun 22, 2026',
        link: 'https://drive.google.com/drive/folders/300l-sem2-slides',
      },
    ],
  },
  400: {
    1: [
      {
        category: 'Lecture Notes',
        title: '400L First Semester — Lecture Note Bundle',
        updated: 'Jun 28, 2026',
        link: 'https://drive.google.com/drive/folders/400l-sem1-notes',
      },
      {
        category: 'Lab Manual',
        title: 'Industrial Attachment — Logbook Template',
        updated: 'Jun 10, 2026',
        link: 'https://drive.google.com/drive/folders/400l-sem1-siwes',
      },
    ],
    2: [
      {
        category: 'Past Questions',
        title: '400L Second Semester — Past Exam Questions',
        updated: 'Jun 08, 2026',
        link: 'https://drive.google.com/drive/folders/400l-sem2-past-questions',
      },
    ],
  },
  500: {
    1: [
      {
        category: 'Lecture Notes',
        title: '500L First Semester — Lecture Note Bundle',
        updated: 'Jul 01, 2026',
        link: 'https://drive.google.com/drive/folders/500l-sem1-notes',
      },
      {
        category: 'Reading List',
        title: 'Final Year Project — Reference & Format Guide',
        updated: 'Jun 24, 2026',
        link: 'https://drive.google.com/drive/folders/500l-sem1-fyp',
      },
    ],
    2: [
      {
        category: 'Past Questions',
        title: '500L Second Semester — Past Exam Questions',
        updated: 'Jun 12, 2026',
        link: 'https://drive.google.com/drive/folders/500l-sem2-past-questions',
      },
    ],
  },
}

export function getResources(level, semester) {
  return resources[level]?.[semester] || []
}
