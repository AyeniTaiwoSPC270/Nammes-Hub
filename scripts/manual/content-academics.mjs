import { tip, note, warn, glance, steps, bullets, table, pills, shot, path, qa } from './helpers.mjs'

export const PART_2 = 'Part Two · Academics'

export const chapters = [
  /* ------------------------------------------------------------------ 5 */
  {
    id: 'outlines',
    part: PART_2,
    num: 5,
    title: 'Course Outlines',
    intro: 'A one-page briefing for every course in the department: what it covers, how many units it carries, who teaches it and where to find past questions.',
    inThis: ['Finding a course: level, semester, course', 'Reading a course outline', 'Downloading outlines as PDF', 'Contributing past questions and notes'],
    html: `
<h2 class="first">What outlines are for</h2>
${glance([['Address', 'nammeshub.com.ng/outlines'], ['Sign-in needed?', 'No (only to contribute)'], ['Who it is for', 'Every student, 100 to 500 Level'], ['Best for', 'Planning your semester before lectures begin']])}
<p>A course outline answers the question <em>"what am I actually going to study in this course?"</em> in one page. Instead of hunting through old chats for a photo of a handout, you open the Hub, pick your level and semester, and read the outline for each course.</p>

<h2>Finding a course</h2>
<p>Outlines are organised as a three-step drill-down: <strong>level</strong>, then <strong>semester</strong>, then <strong>course</strong>.</p>
<div class="flow"><span class="node">Pick a level (100–500)</span><span class="arrow">›</span><span class="node">Pick a semester</span><span class="arrow">›</span><span class="node">Pick a course</span><span class="arrow">›</span><span class="node o">Read the outline</span></div>
${steps([
  'Open <strong>Academics → Outlines</strong> and choose your level under <em>Select Level</em>.',
  'Choose <strong>First Semester</strong> or <strong>Second Semester</strong>.',
  'A table lists every course with its <strong>code</strong>, <strong>title</strong>, <strong>units</strong> and a <strong>status</strong>: <strong>C</strong> means compulsory and <strong>E</strong> means elective, so you can tell which courses you must take. Type in the <em>search box</em> to filter by code or title.',
  'Choose <strong>View outline</strong> next to the course you want.',
])}
${shot('outlines-level', 'After choosing a level, pick a semester to see its course list.', { url: '/outlines/100', narrow: true })}
${shot('outlines-courses', 'The course list for 100 Level, First Semester, with search and a PDF download button.', { url: '/outlines/100/1' })}

<h2>Reading a course outline</h2>
${shot('outline-detail', 'A course outline page: units, lecturer, description and the topics covered.', { url: '/outlines/100/1/chm-cm101' })}
<p>Every outline page has the same layout:</p>
${table(['Section', 'What you get'], [
  ['Header', 'The course <strong>code</strong>, <strong>units</strong> and whether it is <strong>compulsory</strong> or an <strong>elective</strong>, the full <strong>title</strong>, the <strong>lecturer</strong> (or TBA) and the date the outline was last <strong>updated</strong>.'],
  ['Description', 'A short plain-language summary of the course.'],
  ['Topics covered', 'A bullet list of everything the course is expected to teach.'],
  ['Recommended texts', 'Textbooks to look for. When a title includes a web address, it becomes a clickable link.'],
  ['Downloads', 'Links to <strong>past exam questions</strong> and <strong>lecturer notes</strong>, when the executives have added them.'],
  ['Community contributions', 'Past questions and notes shared by other students, grouped by type.'],
])}
${tip('An outline\'s "Updated" date tells you how fresh the information is. If your lecturer changes the scheme, tell the executives so the outline can be corrected.')}

<h2>Downloading outlines as PDF</h2>
<p>You can keep outlines offline. On a single course page choose <span class="btn accent">Download PDF</span> for that course. On a semester's course list choose <span class="btn accent">Download all as PDF</span> to get every course in the semester in one neat file, handy for printing or sharing with a coursemate.</p>

<h2>Contributing past questions and notes</h2>
<p>At the bottom of every outline is a <strong>Community contributions</strong> box. If you are signed in you can add something for the next class to use:</p>
${steps([
  'Choose <span class="btn ghost">Contribute</span>.',
  'Pick a <strong>Type</strong>: <em>Past Question</em>, <em>Lecture Notes</em> or <em>Other</em>.',
  'Optionally add the <strong>session</strong> (for example <code>2023/2024</code>) and give it a clear <strong>title</strong> such as "2023 second semester exam".',
  'Either <strong>upload a file</strong> (PDF, JPG or PNG, up to 10 MB) or <strong>paste a link</strong>, for example to a Drive folder.',
  'Submit. You will see "Thanks, this is awaiting review."',
])}
${note('Contributions start as <strong>pending</strong>. An admin reviews each one and, once approved, it appears for everyone under the course. This keeps the library accurate and safe. Nothing you submit shows publicly until it is approved.')}
`,
  },

  /* ------------------------------------------------------------------ 6 */
  {
    id: 'curriculum',
    part: PART_2,
    num: 6,
    title: 'The Programme Curriculum',
    intro: 'The official national blueprint for your degree: the CCMAS document, with unit totals for every level.',
    inThis: ['What CCMAS is', 'Units per level', 'Viewing and downloading the full document'],
    html: `
<h2 class="first">What CCMAS is</h2>
${glance([['Address', 'nammeshub.com.ng/curriculum'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone, especially new students'], ['Best for', 'Seeing the whole degree at a glance']])}
<p><strong>CCMAS</strong> stands for the <strong>Core Curriculum and Minimum Academic Standards</strong>, issued by the National Universities Commission (NUC). The Curriculum page presents the official document for the <strong>B.Eng. in Materials and Metallurgical Engineering</strong>.</p>
<p>The programme covers a broad field, shown on the page as five disciplines:</p>
${pills(['Mineral Processing', 'Extractive Metallurgy', 'Physical Metallurgy', 'Materials Engineering', 'Materials Processing'])}
<p>Fifteen (15) credit units are attached to the <strong>Students Industrial Work Experience Scheme (SIWES)</strong>, which guarantees real industrial training. All 15 SIWES units are credited in the second semester of 400 Level.</p>

<h2>Units per level</h2>
${table(['Level', 'Total units'], [['100 Level', '25 units'], ['200 Level', '29 units'], ['300 Level', '27 units'], ['400 Level', '8 units'], ['500 Level', '16 units'], ['<strong>Total</strong>', '<strong>105 units</strong>']])}

<h2>The full document</h2>
<p>Scroll down and you will find the whole CCMAS PDF, with <strong>course codes, units, contact hours, learning outcomes and detailed content</strong> for every course at every level. On a computer it previews right on the page; on a phone, or if the preview does not show, use <em>Open the PDF in a new tab</em>. To keep a copy, choose <span class="btn accent">Download CCMAS PDF</span>.</p>
${shot('curriculum', 'The Curriculum page with its overview and discipline tags.', { url: '/curriculum', narrow: true })}
${tip('Curriculum answers "what does the whole degree look like?". Outlines answer "what will I study in this one course?". Use them together.')}
`,
  },

  /* ------------------------------------------------------------------ 7 */
  {
    id: 'timetable',
    part: PART_2,
    num: 7,
    title: 'The Timetable',
    intro: 'Your class schedule and exam schedule for every level, filterable by day, and downloadable.',
    inThis: ['Choosing your level', 'Class or exam? First or second semester?', 'Filtering by day', 'Downloading a PDF or image'],
    html: `
<h2 class="first">Open your timetable</h2>
${glance([['Address', 'nammeshub.com.ng/timetable'], ['Sign-in needed?', 'No'], ['Who it is for', 'Every student'], ['Best for', 'Planning your week and exam period']])}
<p>Open <strong>Academics → Timetable</strong> and pick your level. The page for that level always follows the same simple controls.</p>
${shot('timetable-level', 'The timetable controls: semester, class or exam, and a day filter. This example is a level with nothing published yet.', { url: '/timetable/100' })}

<h2>The three controls</h2>
${table(['Control', 'Options', 'What it does'], [
  ['Semester', 'First Semester · Second Semester', 'Switches between the two semesters of the session.'],
  ['Type', 'Class Timetable · Exam Timetable', 'Shows weekly lectures, or the dated exam schedule.'],
  ['Day', 'All · Mon · Tue · Wed · Thu · Fri', 'Narrows the <em>class</em> timetable to a single day of the week. It is hidden on the exam timetable.'],
])}
<p>The schedule is a table. Each row shows the <strong>time</strong> (start to end), the <strong>course code and title</strong>, the <strong>venue</strong>, and, where it applies, the <strong>lecturer</strong> and a short note such as <em>Practical Lab</em> or <em>Tutorial</em>. Class rows are sorted by day and time; the exam timetable is sorted by exam date.</p>
${note('If you see <em>"No timetable published yet"</em>, the executives simply have not added it. Check back soon. If a day has no lectures you will see <em>"No entries for this day"</em>.')}

<h2>Taking your timetable with you</h2>
<p>Once a timetable has entries, two download buttons appear beside the page title:</p>
<div class="two">
  <div class="card"><div class="tag">Format</div><h4>Download PDF</h4><p>A print-ready document. Best for pinning up, printing, or sending in a document chat.</p></div>
  <div class="card"><div class="tag">Format</div><h4>Download Image</h4><p>A picture of the timetable. Best for setting as a phone wallpaper or posting in a status.</p></div>
</div>
${tip('Download the <strong>image</strong> version and set it as your lock-screen wallpaper. You will always know where your next class is without opening anything.')}
`,
  },

  /* ------------------------------------------------------------------ 8 */
  {
    id: 'cgpa',
    part: PART_2,
    num: 8,
    title: 'The CGPA Calculator',
    intro: 'A private grade book that works out every semester\'s GPA and your cumulative CGPA, shows the trend, and tells you what you need next.',
    inThis: ['How CGPA is worked out', 'Adding semesters and courses', 'Your CGPA card and trend chart', 'Repeated courses', '"What grade do I need?"', 'Downloading your report'],
    html: `
<h2 class="first">How CGPA is worked out</h2>
${glance([['Address', 'nammeshub.com.ng/cgpa'], ['Sign-in needed?', 'Yes, so your grades follow you across devices'], ['Who it is for', 'Every student'], ['Best for', 'Tracking progress and setting targets']])}
<p>Your grades are saved to your account, so they are there whichever phone or computer you sign in on. The calculator uses the standard <strong>5-point scale</strong>:</p>
${table(['Grade', 'A', 'B', 'C', 'D', 'E', 'F'], [['Points', '5', '4', '3', '2', '1', '0']])}
<p><strong>GPA</strong> for a semester = total points ÷ total units, where each course's points are its grade points × its units. <strong>CGPA</strong> is the same calculation across every semester together. Your CGPA is then matched to a class of degree:</p>
${table(['CGPA', 'Classification'], [['4.50 – 5.00', 'First Class'], ['3.50 – 4.49', 'Second Class Upper'], ['2.40 – 3.49', 'Second Class Lower'], ['1.50 – 2.39', 'Third Class'], ['1.00 – 1.49', 'Pass'], ['Below 1.00', 'Below Pass']])}

<h2>Adding semesters and courses</h2>
${shot('cgpa', 'Signed-out visitors see this. Sign in to open your academic record.', { url: '/cgpa', narrow: true })}
${steps([
  '<strong>Add a semester.</strong> At the bottom of the page pick the <em>Level</em> and <em>Semester</em> (1 or 2) and choose <span class="btn">Add semester</span>. The same semester cannot be added twice.',
  '<strong>Add courses.</strong> Inside each semester card fill in the <em>Code</em> (for example MME 301), an optional <em>Title</em>, the <em>Units</em>, the <em>Grade</em> (A to F) and the <em>Type</em> (compulsory or elective), then choose <span class="btn">Add course</span>.',
  '<strong>Fix mistakes.</strong> Every course row has <strong>Edit</strong> and <strong>Delete</strong>; a whole semester can be taken out with <strong>Remove semester</strong>.',
])}

<h2>Your CGPA card and trend chart</h2>
<p>At the top of the page a large green card shows your <strong>cumulative GPA</strong>, a badge with your <strong>classification</strong> and the number of <strong>units completed</strong>. Each semester card also shows its own GPA. Once you have added <strong>two or more semesters</strong>, a <strong>trend chart</strong> appears so you can see, at a glance, whether you are climbing, holding steady, or slipping.</p>

<h2>Repeated courses</h2>
<p>If you type a course code you have taken in an earlier semester, the calculator notices and shows a box: <em>"You've taken this course before"</em>, with the earlier grade. You choose whether the earlier attempt still counts: <strong>Exclude that attempt from CGPA</strong> or <strong>Include in CGPA</strong>. Excluded attempts are marked so you never forget which one you dropped.</p>

<h2>"What grade do I need?"</h2>
<p>The orange box at the bottom is a goal planner. Enter a <strong>Target CGPA</strong> (say <code>4.50</code>) and the <strong>Remaining units</strong> you still have to take. It tells you the <strong>average grade point you must average</strong> on those units, or warns you when the target is <em>not achievable</em> even with straight A's, or tells you the target is already met.</p>
${tip('Use it early. Knowing you need an average of 4.6 over your last 60 units is far more useful in 200 Level than in 500 Level.')}

<h2>Downloading your report</h2>
<p>Choose <span class="btn ghost">Download report</span> at the top to get a tidy PDF of your record. It uses the <strong>full name</strong> and <strong>100 Level session</strong> from your Account page, so set those first (Chapter 4).</p>
${warn('The calculator is a planning tool. Your official result is always the one issued by the university.')}
`,
  },

  /* ------------------------------------------------------------------ 9 */
  {
    id: 'resources',
    part: PART_2,
    num: 9,
    title: 'Resources',
    intro: 'A shelf of shared study materials, organised by level and semester, opening straight into the executives\' Drive folders.',
    inThis: ['Browsing resources', 'What you will find', 'Using Drive links politely'],
    html: `
<h2 class="first">Browsing resources</h2>
${glance([['Address', 'nammeshub.com.ng/resources'], ['Sign-in needed?', 'No'], ['Who it is for', 'Every student'], ['Best for', 'Slides, notes and shared study folders']])}
<p>Resources follows the same path as outlines: choose your <strong>level</strong>, then a <strong>semester</strong>, and you land on a table of everything published for that semester.</p>
${shot('resources', 'Choose your level to begin.', { url: '/resources', narrow: true })}
${shot('resources-list', 'Each row shows a category, a title, when it was updated, and an Open link.', { url: '/resources/100/1' })}

<h2>What you will find</h2>
${table(['Column', 'Meaning'], [['Category', 'The kind of material, for example <em>Slides &amp; Notes</em>.'], ['Title', 'A clear name, such as "100L First Semester – Slides &amp; Notes".'], ['Updated', 'When the executives last refreshed the link.'], ['Action', '<strong>Open</strong> takes you to the shared Google Drive folder or file.']])}
<p>If a level and semester show <em>"No resources published yet"</em>, nothing has been added for it so far.</p>

<h2>Using Drive links politely</h2>
${bullets(['Links open in a new tab on Google Drive. You may need to sign in to Google.', 'Download what you need, but please do not delete, rename or move files in shared folders.', 'Found something wrong or out of date? Tell an executive via the Contact page.', 'Have material to share? Contribute it through the relevant course outline (Chapter 5), where it is reviewed before publishing.'])}
`,
  },
]
