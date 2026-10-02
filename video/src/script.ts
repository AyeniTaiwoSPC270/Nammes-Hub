import { BEAT_SECONDS, SceneId } from './constants'

// Narration, one line per beat. The same text drives the burned-in captions, captions.srt and voiceover-script.md.
// Timing for each beat is in constants.ts. Keep lines to roughly 2.6 words per second or less so a voice can read
// them comfortably (`npm run docs` warns when a line is too long for its beat).
// Rule of thumb for this project: never promise more than the Hub does. Say "members", not "everyone", for Awards.

type Script = { [S in SceneId]: { [B in keyof (typeof BEAT_SECONDS)[S]]: string } }

export const VO: Script = {
  cold: {
    chat: 'Who has the outline?',
    photo: 'Is this the timetable?',
    deadline: 'Due today?!',
    stamp: "Where's the outline? When's the exam?",
    logo: 'NAMMES Hub. One address.',
  },
  meet: {
    home: 'Meet NAMMES Hub, the website of NAMMES, UNILAG chapter.',
    map: 'Academics, Community, Forms, Contact. No more wahala.',
    account: "You don't need an account to browse. Signing up takes about a minute.",
  },
  academics: {
    outlines: 'Pick your level, then semester, then course. C is compulsory, E is elective.',
    detail: 'Open a course for its topics, recommended texts and past questions.',
    curriculum: 'The official CCMAS curriculum, right there.',
    timetable: 'Class and exam timetables. No more asking around.',
    cgpa: 'Punch in your grades and watch your CGPA count up. Sign in to save them, then download your report.',
    resources: 'Resources: Shared Drive links and materials, one tap away.',
  },
  community: {
    events: 'Events, with photo galleries so you can relive the day.',
    news: 'News, straight from the excos.',
    opportunities: 'Opportunities, sorted by soonest deadline.',
    awards:
      'Five stages, from nominating to revealed. Members with a department matric number get one vote each.',
    forms: 'Forms: fill one in, or share it by link or QR.',
  },
  quiz: {
    lobby: 'Live quiz! Scan the code, pop into the lobby and pick your fighter. Fifty characters to choose from.',
    question: 'Question up, timer running. Tap your answer fast!',
    reveal: "Bars rise, the leaderboard shuffles. Who's on top?",
    powers: 'Play in teams, build a streak for bonus points, go double or 50/50.',
    duel: 'Quiz battles: challenge a friend to a duel.',
    bracket: 'Or run a knockout bracket.',
    champion: 'Last one standing takes the podium.',
    share: 'No account. Just a nickname. Send the link and let us go.',
  },
  behind: {
    dashboard: 'The excos run it all from one dashboard.',
    news: 'Publish news.',
    form: 'Design a form.',
    season: 'Move awards through the stages.',
    host: 'Host a live quiz.',
  },
  close: {
    excos: 'Meet the excos, the AEGIS 26/27 council.',
    built: 'Built by students, for students.',
    endcard: 'NAMMES Hub, at nammeshub.com.ng. Grab the Handbook in the footer.',
  },
}
