import { quizChapter } from './content-quiz.mjs'
import { tip, note, warn, glance, steps, bullets, table, pills, shot, path, qa } from './helpers.mjs'
import { AUTHORS } from './data/authors.mjs'

export const PART_3 = 'Part Three · Community'
export const PART_4 = 'Part Four · The Association'

export const chapters = [
  /* ------------------------------------------------------------------ 11 */
  {
    id: 'events',
    part: PART_3,
    num: 11,
    title: 'Events',
    intro: 'Workshops, seminars and gatherings, with a photo gallery for every event once it has happened.',
    inThis: ['The Events page: upcoming and past', 'An event\'s detail page', 'Browsing and saving gallery photos'],
    html: `
<h2 class="first">The Events page</h2>
${glance([['Address', 'nammeshub.com.ng/events'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone'], ['Best for', 'Never missing a programme; reliving the ones you did']])}
<p>The Events page splits everything into two lists: <strong>Upcoming Events</strong> (still ahead) and <strong>Past Events</strong> (already happened, newest first). Each event is a card with its <strong>flyer or photo</strong>, its <strong>date</strong>, its <strong>title</strong> and a short <strong>description</strong>. A short preview of events also appears on the home page.</p>
${shot('events', 'The Events page. Past events show below the upcoming ones.', { url: '/events', crop: 46 })}
${note('The Hub decides "upcoming" or "past" from the event\'s date, so an event moves down to Past Events automatically once its day has gone by.')}
${note('Departmental events also appear on the <strong>academic calendar</strong> alongside senate dates, so one grid shows both. See <strong>Chapter 5</strong>.')}

<h2>An event's detail page</h2>
<p>Choose an event card to open its page. It has two tabs:</p>
${table(['Tab', 'What is inside'], [
  ['Details', 'The full flyer, the date, the <strong>time and location</strong> line (when given) and the complete description. Web addresses in the text are clickable.'],
  ['Gallery', 'A grid of photos from the event. The tab title shows how many photos there are, for example <em>Gallery (295)</em>. Until photos are uploaded it reads <em>"No photos yet"</em>.'],
])}
${shot('event-detail', 'The event page: Details and Gallery tabs sit under the title.', { url: '/events/materials-horizon-3-0', crop: 50 })}

<h2>Browsing and saving photos</h2>
${steps([
  'Open an event and choose the <strong>Gallery</strong> tab.',
  'Tap any photo to open it large in the <strong>lightbox</strong>.',
  'Move to the next or previous photo by <strong>swiping</strong> on a phone, or with the on-screen and keyboard arrow keys on a computer. Press <strong>Esc</strong> to close.',
  'Choose the <strong>download</strong> button in the corner to save the photo to your device.',
])}
${tip('Looking for a registration link? Executives often attach a <strong>form</strong> to an event. Check the description, or open the <strong>Forms</strong> page (Chapter 15).')}
`,
  },

  /* ------------------------------------------------------------------ 12 */
  {
    id: 'news',
    part: PART_3,
    num: 12,
    title: 'Department News',
    intro: 'Announcements from the executives, organised by category so you can read only what matters to you.',
    inThis: ['The News page and its filters', 'Categories explained', 'Reading a story', 'Getting news by email'],
    html: `
<h2 class="first">The News page</h2>
${glance([['Address', 'nammeshub.com.ng/news'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone'], ['Best for', 'Official announcements, jointly posted with the PRO']])}
<p>The newest story appears first as a large <strong>featured</strong> card; the rest follow underneath in a grid. Each card has a photo, a category, a headline and the opening lines. A small coloured <strong>badge</strong> such as <span class="pill">New</span> or <span class="pill o">Updated</span> shows which stories are fresh.</p>
${shot('news', 'The News page with its category filter chips.', { url: '/news', crop: 70 })}

<h2>Categories explained</h2>
<p>Use the chips above the stories to filter. Choose <em>All</em> to see everything again.</p>
${table(['Category', 'Typical stories'], [
  ['Academics', 'Lecture changes, exam notices, course updates.'],
  ['Governance', 'Executive decisions, elections, general meetings.'],
  ['Welfare', 'Support for members and welfare programmes.'],
  ['Industry', 'Plant visits, company partnerships, career talks.'],
  ['Call for papers', 'Conference and journal calls for student authors.'],
  ['Resources', 'New study materials and how to get them.'],
])}
<p>A category filter is kept in the web address (for example <span class="path">/news?category=Welfare</span>), so you can share a filtered view with a friend.</p>

<h2>Reading a story</h2>
<p>Choose a card, or <em>Read more</em>, to open the full article with its category, badge, headline, date and author. Use the trail above the headline to come back to the News page.</p>

<h2>Getting news by email</h2>
<p>You do not have to keep checking the page. There are two ways to have news come to you:</p>
${bullets(['<strong>Email notifications</strong>: with the switch on in your Account page, new News and Events alerts land in your inbox (Chapter 4).', '<strong>The newsletter</strong>: type your email into the <em>Stay Connected With Us</em> box in the footer to subscribe to the NAMMES Communiqué on Substack.'])}
`,
  },

  /* ------------------------------------------------------------------ 13 */
  {
    id: 'opportunities',
    part: PART_3,
    num: 13,
    title: 'Opportunities',
    intro: 'Scholarships and internships that are worth applying for, sorted by the ones closing soonest.',
    inThis: ['How the list is sorted', 'Reading a row', 'Applying without missing the deadline'],
    html: `
<h2 class="first">The Opportunities page</h2>
${glance([['Address', 'nammeshub.com.ng/opportunities'], ['Sign-in needed?', 'No'], ['Who it is for', 'Every student, especially finalists'], ['Best for', 'Scholarships, internships, research roles']])}
<p>Opportunities is one clean table under the heading <strong>Current listings</strong>. It is <strong>sorted by the soonest deadline first</strong>, so the most urgent item is always at the top.</p>
${shot('opportunities', 'The Opportunities page. Listings appear as soon as the executives publish them.', { url: '/opportunities', crop: 70 })}

<h2>Reading a row</h2>
${table(['Column', 'What it tells you'], [['Deadline', 'The last day to apply.'], ['Type', 'A <em>Scholarship</em> or an <em>Internship</em>.'], ['Title &amp; Org', 'What the opportunity is and which organisation is offering it.'], ['Apply', 'A link that takes you to the organisation\'s own application page.']])}

<h2>Applying without missing the deadline</h2>
${steps(['Check the deadline first. Nothing else matters if it has already passed.', 'Choose <strong>Apply</strong>. You go to the organisation\'s site, since applications are handled by them, not by NAMMES.', 'Prepare documents early (CV, transcript, references) and apply well before the closing day.'])}
${tip('Turn on <strong>email notifications</strong> in your Account page, and executives can also send a broadcast the moment something important is posted.')}
${warn('NAMMES lists opportunities to help you find them. It does not run the applications and cannot guarantee any outcome. Always read the offer carefully and never pay anyone to "secure" a place.')}
`,
  },

  /* ------------------------------------------------------------------ 14 */
  {
    id: 'awards',
    part: PART_3,
    num: 14,
    title: 'The Awards',
    intro: 'The department\'s annual poll: members nominate, the executives shortlist, everyone votes once, and the winners are revealed.',
    inThis: ['The five stages of an awards season', 'Nominating', 'Voting', 'Results', 'Who can take part'],
    html: `
<h2 class="first">How an awards season works</h2>
${glance([['Address', 'nammeshub.com.ng/awards'], ['Sign-in needed?', 'Yes, to take part'], ['Who it is for', 'Members with a department matric number'], ['Best for', 'Celebrating your peers']])}
<p>The Awards page always shows the <strong>current stage</strong> of the season, and every stage looks different. A season moves through five stages, in order, controlled by the executives:</p>
<div class="phases">
  <div class="ph">1 · Nominating<small>You suggest names</small></div>
  <div class="ph">2 · Curating<small>Shortlist built</small></div>
  <div class="ph">3 · Voting<small>You vote once</small></div>
  <div class="ph">4 · Closed<small>Votes counted</small></div>
  <div class="ph">5 · Revealed<small>Winners shown</small></div>
</div>
${shot('awards', 'When no season is running, the page says so. The screen changes at every stage.', { url: '/awards', narrow: true })}

<h2>Stage 1: Nominating</h2>
<p>Each award category is shown with a box where you type the name of the person you would nominate and <strong>upload a photo of your nominee</strong> (a clear headshot is preferred; JPEG or PNG, up to 5 MB). A counter tells you how many categories you have answered (for example <em>3 of 8</em>).</p>
${steps(['Sign in and open <strong>Awards</strong>.', 'For each category you care about, type your nominee&rsquo;s name and upload their photo. A category counts as answered once it has both. You do not have to answer every category.', 'Choose <span class="btn">Save nominations</span>. You will see "Nominations saved, thank you!"', 'Changed your mind? Come back and edit. <strong>You can change your nominees until nominations close.</strong>'])}

<h2>Stage 2: Curating</h2>
<p>Nominations are closed. The page shows <em>"Nominations closed: the shortlist is being finalized, voting opens soon."</em> Behind the scenes the executives are turning your raw suggestions into a fair shortlist for each category, sometimes with nominee photos.</p>

<h2>Stage 3: Voting</h2>
<p>The ballot shows every category with its shortlisted nominees and their photos. Each nominee has a <strong>share</strong> option that makes a picture card you can post to encourage others to vote. A green banner confirms that your <strong>matric number is verified</strong> and reminds you there is <strong>one vote per student</strong>.</p>
${steps(['Pick <strong>one nominee per category</strong>.', 'Review your choices.', 'Choose <span class="btn">Submit ballot</span> to send the whole ballot at once.', 'After voting you will see <em>"You\'ve already voted"</em> and cannot vote again.'])}
${warn('A submitted ballot is final. Take a moment to check every choice before you press <strong>Submit ballot</strong>.')}

<h2>Stages 4 and 5: Closed and Revealed</h2>
<p>When voting ends the page says <em>"Voting closed: results will be announced soon."</em> Once the executives reveal the results, the page turns into a results board titled <em>Results revealed</em> with the <strong>winner and vote tally</strong> for each category and the number of ballots cast. Each category also has a <strong>winner card</strong> that you can download as an image to celebrate the result.</p>

<h2>Who can take part</h2>
<p>Only students whose account has a <strong>department matric number</strong> (<code>YY0406XXX</code>) can nominate or vote. This is checked automatically. If your account has none on file, the page explains that it cannot take part and asks you to contact an executive, who can fix it (Chapter 4).</p>
`,
  },

  /* ------------------------------------------------------------------ 15 */
  {
    id: 'forms',
    part: PART_3,
    num: 15,
    title: 'Forms',
    intro: 'Event registrations, surveys and applications, all in one place, each styled by the executives who made it.',
    inThis: ['The Forms page', 'Filling in a form', 'Closed forms, sign-in and editing', 'Using a shared link or QR code'],
    html: `
<h2 class="first">The Forms page</h2>
${glance([['Address', 'nammeshub.com.ng/forms'], ['Sign-in needed?', 'Depends on the form'], ['Who it is for', 'Everyone invited to respond'], ['Best for', 'RSVPs, surveys, applications']])}
<p>The Forms page lists every form that is <strong>currently accepting responses</strong>. Across the top are three numbers: how many forms are <em>open now</em>, the <em>responses so far</em>, and the <em>next deadline</em>. Each form appears as a card with a <strong>category badge</strong> (<span class="pill">Event</span>, <span class="pill o">Application</span>, Survey or Other), a title, a short description, and a <span class="btn">Fill form</span> button.</p>
${shot('forms', 'The Forms page, with the open-form counts across the top.', { url: '/forms' })}
<p>The page says <em>"No open forms right now"</em> when nothing is open. Check back later.</p>
${note('The Forms page also has a banner of its own, which the executives can reword or replace with pictures without touching the page below it.')}

<h2>Filling in a form</h2>
${shot('form-detail', 'An example form. The executives choose its colours, background and layout, so every form can look different.', { url: '/forms/…', crop: 96 })}
${steps(['Choose <strong>Fill form</strong> on the card you want.', 'Answer the questions. A <strong>progress bar</strong> near the top shows how many you have answered (for example <em>0 of 9 answered</em>). Questions marked with an asterisk (<strong>*</strong>) are required.', 'Choose the submit button at the bottom. You will see "Response submitted, thank you!"'])}
<p>Forms can ask for many kinds of answers:</p>
${pills(['Short answer', 'Paragraph', 'Multiple choice', 'Checkboxes', 'Dropdown', 'Linear scale', 'File upload', 'Date', 'Time'])}

<h2>Closed forms, sign-in and editing</h2>
${table(['You see…', 'It means'], [
  ['<em>Sign in to respond to this form</em>', 'The executives required sign-in for this form. Sign in, then open it again.'],
  ['<em>This form is closed</em>', 'It stopped accepting responses, either manually or because its closing time passed.'],
  ['Your previous answers with an <strong>Edit response</strong> button', 'The form allows one response per person, and lets you edit yours after submitting.'],
  ['Your previous answers with no edit button', 'One response per person, and editing is switched off. Contact an executive if you must change something.'],
])}

<h2>Using a shared link or QR code</h2>
<p>Executives can share any form with a <strong>direct link</strong> or a <strong>QR code</strong> (they download it as a picture for flyers). Opening either takes you straight to that form without having to browse the Forms page.</p>
${tip('Scanning a QR code on a poster with your phone camera is the quickest way to reach an event registration form.')}

<h2>A form with no menu around it</h2>
<p>Some forms are built to be filled in without distraction: a registration on your phone while you queue, a survey during a meeting. For those, the executives can switch on <strong>Hide the navbar while filling</strong>, and the page drops the menu bar and the footer entirely so only the form is left, with a <strong>Back to Forms</strong> link in the header.</p>
${note('Only the filling-in screen goes bare. A closed form, a form that needs you to sign in, and the page that shows your submitted answers all keep the menu bar, so there is always a way back. Editing a response you already sent is the same plain screen as filling it in the first time.')}
`,
  },

  quizChapter,

  /* ------------------------------------------------------------------ 17 */
  {
    id: 'practice-exams',
    part: PART_3,
    num: 17,
    title: 'Practice Exams and Your Own Questions',
    intro: 'Timed exam papers that behave like the real CBT, with a clock and a pass mark. You can sit one the department has published, or build your own from your own questions.',
    inThis: ['Finding an exam', 'Starting, flagging and submitting', 'Reading your result', 'Making your own practice exam', 'Making your own quiz and sharing it'],
    html: `
<h2 class="first">Practice exams</h2>
${glance([['Address', 'nammeshub.com.ng/cbt'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone'], ['Best for', 'Timing yourself before the real thing']])}
<p>A <strong>CBT practice exam</strong> is a timed paper that behaves like the real thing: one paper, a countdown, and answers revealed only at the end. It is open to everyone and needs no account.</p>
${shot('cbt', 'The CBT practice list. Each row shows how long the paper is and what you need to pass.', { url: '/cbt' })}
${shot('m-cbt', 'The same list on a phone, where the exam code box sits above it.', { url: '/cbt', phone: true, crop: 40 })}

<h2>Finding an exam</h2>
${steps([
  'Open <strong>Practice &rarr; CBT practice</strong>, or go to <span class="path">/cbt</span>.',
  'Search by <strong>course code</strong> (for example <code>MTH 101</code>) if you want one course, or use the level tabs &mdash; <em>All levels</em>, <em>100 Level</em>, <em>200 Level</em> and so on, up to <em>Other</em>.',
  'Each row tells you <em>N questions</em>, <em>M min</em> and <em>pass P%</em>, so you know what you are walking into. Choose <strong>Start &rarr;</strong>.',
])}
${note('If you were given an exam <strong>code</strong> instead of a link, type it into the <em>Have an exam code?</em> box at the top of the page and choose <strong>Open</strong>.')}
${note('<strong>My progress on this device</strong> keeps your attempts, your best score and your latest one. It lives in your browser, not on an account: clearing your browser data clears it too.')}

<h2>Before you start</h2>
<p>The exam's own page gives you four facts and no surprises: how many <strong>Questions</strong>, the <strong>Time</strong> allowed, the <strong>Pass mark</strong>, and how big the <strong>Question bank</strong> behind it is.</p>
${shot('cbt-start', 'The start page for one exam.', { url: '/cbt/HMFP68' })}
${bullets([
  '<strong>Start exam</strong> begins the paper and starts the clock.',
  '<strong>Study mode: no timer, see each answer</strong>, where the paper offers it, lets you read the answer immediately with no clock. Good for learning rather than timing.',
  '<strong>Continue exam</strong> appears if you left one unfinished. <em>Forget it and start fresh</em> throws the old attempt away.',
  '<strong>Your attempts on this device</strong> lists up to eight, each marked <em>Passed</em> or <em>Not passed</em>.',
])}

<h2>Sitting the paper</h2>
${shot('cbt-exam', 'An exam in progress: the countdown, the question navigator on the right, and the flag button.', { url: '/cbt/…/exam' })}
${bullets([
  'The <strong>countdown</strong> is at the top. When it reaches zero the paper is submitted for you.',
  '<strong>Flag for review</strong> marks a question you want to come back to. The button then reads <em>Flagged</em>.',
  'The <strong>navigator</strong> on the right is a grid of every question, with <em>Answered</em>, <em>Not answered</em> and <em>Flagged</em> shown by colour. Tap any number to jump there.',
  '<strong>Previous</strong> and <strong>Next</strong> move through the paper. <strong>Clear answer</strong> wipes the answer you gave.',
  'The line under the navigator says <em>All answers saved</em>. If it ever says <em>Not saved yet. Retrying&hellip;</em>, wait &mdash; it is trying again.',
  'When you are ready, choose <strong>Review and submit</strong>. A confirmation counts what you answered, what you left blank and what you flagged, with <strong>Submit now</strong> or <em>Keep working</em>.',
])}
${note('<strong>The clock belongs to the server, not to your tab.</strong> Closing the app or losing signal does not stop it, and a refresh brings you back to the same paper with the same time left. That is deliberate: it is the only way an exam can be timed fairly when half the hall is on patchy data.')}
${note('During a timed attempt the right answers never reach your device at all. The server holds them and grades only when you submit, so nothing you do to your phone can reveal them.')}

<h2>Your result</h2>
<p>You get your score, <em>Passed</em> or <em>Not passed</em> against the pass mark, and the time you took. From there you can <strong>Retake</strong>, go back to <strong>All exams</strong>, or <strong>Share result</strong>. The review below the score filters to <em>All</em>, <em>Wrong</em>, <em>Unanswered</em> or <em>Flagged</em> questions, which is the fastest way to see the ones that cost you marks.</p>

<h2>Making your own practice exam</h2>
<p>If the department has not published a paper for your course yet, you can build one. Your questions stay in your browser until you create the exam, and no account is needed.</p>
${shot('cbt-make', 'Make your own practice exam.', { url: '/cbt/make' })}
${steps([
  'Open <strong>Practice &rarr; CBT practice</strong> and choose <em>Make your own practice exam</em> at the bottom, or go to <span class="path">/cbt/make</span>.',
  'Give it a <strong>Name your exam</strong> title.',
  'Add questions by <strong>pasting them</strong> into <em>Your questions</em>, or by choosing <strong>Upload a CSV file</strong>. <strong>Download a template</strong> gives you the exact column layout.',
  'A live count reads <em>N questions ready</em>. Anything the reader could not make sense of is listed with its row number, so nothing is silently dropped.',
  'Set <strong>Time allowed (minutes)</strong>, <strong>Pass mark (%)</strong>, whether to <strong>Shuffle the questions</strong> and the <strong>answers</strong>, and <strong>Keep this quiz for</strong> 30, 90 or 180 days.',
  'Choose <span class="btn">Make my exam</span>. You get a six-character code and a link.',
])}

<h2>Making your own quiz</h2>
<p>The same importer also builds a <strong>quiz</strong> rather than an exam, for practising on your own or racing bots and friends. It lives at <span class="path">/make</span>.</p>
${shot('make', 'Make a quiz from a spreadsheet.', { url: '/make' })}
<p>Your quiz opens on its own page, and from there you can do any of three things with it:</p>
${table(['Button', 'What it does'], [
  ['<strong>Take it as a timed CBT exam</strong>', 'Runs it as a clocked paper with a pass mark, exactly like a published exam.'],
  ['<strong>Practise it</strong>', 'Replays it one question at a time with the answer shown after each one. No clock, no pressure.'],
  ['<strong>Challenge a friend or duel</strong>', 'Opens the battle page with your quiz selected, so someone else can be challenged on it.'],
])}
${bullets([
  '<strong>Share this quiz</strong> sends the link to someone. It works for anyone, on any device.',
  '<strong>Keep it longer</strong> buys 90 or 180 days instead of the standard 30.',
  '<strong>Delete this quiz</strong> removes it and its questions for good, and asks you to confirm.',
])}
${note('A quiz or exam you made is <strong>private to its link</strong>. It is not listed on the CBT page or anywhere else on the site, which is why an admin may need to send you the code or link directly. Only the code or the link finds it.')}
${tip('The best use of this is a revision set from your coursemates\' past questions: one person builds it, shares the link in the class chat, and everyone races each other on it.')}
`,
  },

  /* ------------------------------------------------------------------ 18 */
  {
    id: 'association',
    part: PART_4,
    num: 18,
    title: 'About, the Excos and Contact',
    intro: 'Who NAMMES is, who is running it this session, and how to reach them.',
    inThis: ['The About page', 'Meet the Excos', 'The Contact page', 'Social media and the newsletter'],
    html: `
<h2 class="first">The About page</h2>
${glance([['Address', 'nammeshub.com.ng/about'], ['Sign-in needed?', 'No'], ['Who it is for', 'New members, visitors, sponsors'], ['Best for', 'Understanding what NAMMES stands for']])}
<p>The About page tells the story of the department and the association, and sets out what NAMMES believes in:</p>
${shot('about', 'The About page: who we are, our vision, mission and the six values we work by.', { url: '/about', crop: 88 })}
${bullets(['<strong>Who We Are</strong>: the history of the department (created in 1973) and what NAMMES does.', '<strong>Vision</strong>: an inclusive, innovative and industrious community committed to academic excellence, technical mastery and professional growth.', '<strong>Mission</strong>: to advance members\' intellectual and professional development through skill-building, industry exposure and welfare support, while representing student interests.'])}
<p>Six <strong>core values</strong> guide the association:</p>
${pills(['Unity', 'Integrity', 'Leadership', 'Excellence', 'Innovation', 'Advocacy'], true)}

<h2>Meet the Excos</h2>
<p>The <strong>Excos</strong> are the Executive Council: the students elected to run NAMMES for the session, currently <strong>{{team}} {{session}}</strong>. The <em>Meet the Excos</em> page shows each of them on a card with their <strong>photo, name and role</strong>, plus an <strong>email</strong> and <strong>phone number</strong> when they have chosen to share them (tap to write or call).</p>
${shot('excos', '{{team}} {{session}}, the Executive Council for the {{session_long}} session.', { url: '/excos', crop: 88 })}
<p>A shorter version, <em>Our Executives</em>, also appears near the bottom of the home page. The names and roles of the ten people who wrote this handbook are in Appendix D.</p>

<h2>The Contact page</h2>
<p>Have a question, a suggestion or a problem with the Hub? Open <strong>Contact</strong> in the menu.</p>
${steps(['Enter your <strong>name</strong> and <strong>email</strong>.', 'Write your <strong>message</strong> (up to 5,000 characters).', 'Tick <em>Verify you are human</em> and choose <span class="btn">Send message</span>.'])}
<p>Your message goes straight to the admins' <strong>Messages</strong> inbox. For a question about a specific role (say, welfare or sports) use the <em>Prefer to reach someone directly?</em> box on the same page to jump to the Excos and contact that person.</p>
${shot('contact', 'The Contact page: a simple form on the left, direct routes and social links on the right.', { url: '/contact', crop: 84 })}

<h2>Social media and the newsletter</h2>
<p>The association's channels are shown as icons on the Contact page and in the footer of every page. Depending on what the executives have connected, these can include the <strong>WhatsApp community</strong>, <strong>X</strong>, <strong>Instagram</strong>, <strong>LinkedIn</strong> and <strong>YouTube</strong>. The <em>Stay Connected With Us</em> box in the footer lets you subscribe to the <strong>NAMMES Communiqué</strong> newsletter.</p>
`,
  },
]
