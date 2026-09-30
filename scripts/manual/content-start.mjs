import { SITE, tip, note, warn, glance, steps, bullets, table, pills, shot, path, qa } from './helpers.mjs'

export const PART_1 = 'Part One · Getting Started'

export const chapters = [
  /* ------------------------------------------------------------------ 1 */
  {
    id: 'welcome',
    part: PART_1,
    num: 1,
    title: 'Welcome to NAMMES Hub',
    intro: 'One website for everything the association publishes, built by students for students of Metallurgical and Materials Engineering at the University of Lagos.',
    inThis: ['What NAMMES and NAMMES Hub are', 'What you can do here, at a glance', 'How to read this handbook', 'A map of the whole Hub'],
    html: `
<h2 class="first">What is NAMMES?</h2>
<p>NAMMES is the <strong>National Association of Metallurgical and Materials Engineering Students</strong>, University of Lagos Chapter. It is the student-led voice of the department: it represents members academically, professionally and socially, organises technical workshops, leadership training and plant visits, and speaks for student welfare to the department, the faculty and the university.</p>
<p>The department itself was created in 1973 to help drive Nigeria's industrialisation. It is the link between raw mineral extraction, refinement and advanced materials design, and its members regularly stand out across the whole Faculty of Engineering.</p>

<h2>What is NAMMES Hub?</h2>
<p><strong>NAMMES Hub</strong> is the association's official website, found at <span class="path">${SITE.replace('https://', '')}</span>. Before the Hub, a course outline lived in one group chat, a timetable in another, an event flyer somewhere else. The Hub brings all of it into one place that is always up to date, works on any phone or computer, and needs nothing to be installed.</p>
${shot('home', 'The NAMMES Hub home page: a welcome banner, the latest news, upcoming events and the executives.', { url: 'nammeshub.com.ng', narrow: true })}

<h2>What you can do here</h2>
<div class="two">
  <div class="card"><div class="tag">Academics</div><h4>Study smarter</h4>${bullets(['Read a detailed <strong>outline</strong> for every course', 'Check your class and exam <strong>timetable</strong>', 'Track your grades with the <strong>CGPA calculator</strong>', 'Find shared <strong>resources</strong> and past questions'])}</div>
  <div class="card"><div class="tag">Community</div><h4>Stay in the loop</h4>${bullets(['See upcoming <strong>events</strong> and past photo galleries', 'Read department <strong>news</strong>', 'Spot <strong>scholarships</strong> and internships', 'Nominate and vote in the <strong>awards</strong>', 'Play <strong>live quizzes</strong> and battle friends'])}</div>
  <div class="card"><div class="tag">Take part</div><h4>Have your say</h4>${bullets(['Fill in surveys, registrations and applications', 'Contribute your own past questions and notes', 'Message the executives through the contact form'])}</div>
  <div class="card green"><div class="tag">Admins</div><h4>Run the association</h4>${bullets(['Publish news, events and opportunities', 'Build forms and read the responses', 'Run an awards season end to end', 'Host live quizzes at events', 'Email every member at once'])}</div>
</div>

<h2>How to read this handbook</h2>
<p>This book is written for a complete beginner. Read it front to back once, or jump straight to the chapter you need using the table of contents. Every chapter about a page starts with a small <strong>At a glance</strong> box so you know the address, whether you need to be signed in, and who the page is for.</p>
<p>Look out for these boxes as you read:</p>
${tip('Shortcuts and habits that save you time.')}
${note('Background that helps you understand why the Hub works the way it does.')}
${warn('Things that cannot be undone, or that commonly go wrong.')}
<p>Part Five of the book is written for <strong>admins</strong> (the executives and anyone they trust to run the Hub). If you are a regular member, you can stop after Part Four and still know everything you need.</p>
${note('The Hub is updated all the time by the executives. Pages that look empty in this book\'s screenshots (for example News or Opportunities) fill up as items are published. Screenshots were taken from the live site on 30 September 2026.')}

<h2>A map of the Hub</h2>
<p>Everything on the site sits under one menu bar. This is the whole map in one glance:</p>
<div class="flow"><span class="node">Home</span><span class="arrow">›</span><span class="node">About</span><span class="node">Forms</span><span class="node">Contact</span></div>
<div class="two">
  <div class="card"><div class="tag">Academics menu</div>${bullets(['<strong>Outlines</strong>: course by course', '<strong>Curriculum</strong>: the official CCMAS', '<strong>Timetable</strong>: classes and exams', '<strong>CGPA</strong>: grade tracker', '<strong>Resources</strong>: shared materials'])}</div>
  <div class="card"><div class="tag">Community menu</div>${bullets(['<strong>Events</strong>: workshops and galleries', '<strong>News</strong>: announcements', '<strong>Opportunities</strong>: deadlines', '<strong>Live quiz</strong> and <strong>Quiz battles</strong>: play from your phone', '<strong>Awards</strong>: nominate and vote'])}</div>
</div>
<p class="small">Also: <strong>Meet the Excos</strong> (the executive team), <strong>Sign In / Sign Up</strong>, your <strong>Account</strong> page, and the <strong>Admin</strong> area for executives.</p>
`,
  },

  /* ------------------------------------------------------------------ 2 */
  {
    id: 'quickstart',
    part: PART_1,
    num: 2,
    title: 'Getting Started in Five Minutes',
    intro: 'You can already read most of the Hub without an account. Here is the fastest path from "just landed" to "fully set up".',
    inThis: ['Opening the Hub on any device', 'What works without an account', 'Creating your account in five steps', 'Your first-day checklist'],
    html: `
<h2 class="first">Open the Hub</h2>
<p>Type <span class="path">${SITE.replace('https://', '')}</span> into the address bar of any modern browser (Chrome, Edge, Safari, Firefox) on a phone, tablet or computer. There is nothing to download or install, and the layout adapts to your screen automatically.</p>
${tip('On a phone, use your browser\'s <strong>Add to Home screen</strong> option. The Hub then opens from an icon like an app, with no address bar.')}

<h2>What works without an account</h2>
<p>Most of the Hub is open to everyone. You only need an account for things that are personal to you or need to be fair (one vote each, your own grades).</p>
${table(['You can…', 'Without an account', 'With an account'], [
  ['Read outlines, timetables, resources, events, news and opportunities', 'Yes', 'Yes'],
  ['Meet the excos and send a contact message', 'Yes', 'Yes'],
  ['Fill in a form', 'Only forms that do not ask for sign-in', 'Every open form'],
  ['Use the CGPA calculator', 'No, sign-in required', 'Yes'],
  ['Contribute a past question or notes to a course', 'No', 'Yes'],
  ['Nominate or vote in the awards', 'No', 'Yes (department matric number needed)'],
  ['Join a live quiz, practise or battle a friend', 'Yes', 'Yes'],
  ['Get email alerts for new News and Events', 'No', 'Yes, if you keep the setting on'],
])}

<h2>Create your account in five steps</h2>
${steps([
  '<strong>Open Sign Up.</strong> Choose <span class="btn">Sign In</span> at the top right, then <em>Create an account</em>, or go straight to <span class="path">/signup</span>.',
  '<strong>Fill in the form.</strong> Your full name, your department <em>matric number</em> (see the next chapter), your email, and a password of at least 8 characters, typed twice.',
  '<strong>Tick "Verify you are human".</strong> This small check stops automated bots from creating fake accounts.',
  '<strong>Confirm your email.</strong> The Hub sends a confirmation email. Open it and click the link to activate your account.',
  '<strong>Sign in.</strong> Return to the Hub, choose Sign In, and enter your email and password. Done!',
])}
${shot('signup', 'The Create account page. Every field is required.', { url: 'nammeshub.com.ng/signup', crop: 44 })}

<h2>Your first-day checklist</h2>
<ul class="checks">
  <li>Sign in and follow the short <strong>welcome tour</strong> that appears the first time.</li>
  <li>Open <span class="path">Account</span> and set your <strong>100 Level session</strong> (you will need this for your CGPA report).</li>
  <li>Find your level in <span class="path">Outlines</span> and <span class="path">Timetable</span>.</li>
  <li>Add your first semester to the <span class="path">CGPA</span> calculator.</li>
  <li>Check <span class="path">Forms</span> for anything you need to fill in this week.</li>
  <li>Decide whether you want <strong>email alerts</strong> and set the switch on your Account page.</li>
</ul>
`,
  },

  /* ------------------------------------------------------------------ 3 */
  {
    id: 'navigating',
    part: PART_1,
    num: 3,
    title: 'Finding Your Way Around',
    intro: 'The menu bar, the phone menu, dark mode, the footer and the little helpers that keep you oriented on every page.',
    inThis: ['The menu bar on a computer', 'The menu on a phone', 'Light and dark mode', 'Breadcrumbs, footer and the welcome tour', 'Maintenance and "page not found" screens'],
    html: `
<h2 class="first">The menu bar on a computer</h2>
<p>The menu bar is pinned to the top of every page. It never disappears when you scroll, so you can always jump somewhere else.</p>
<figure class="mock"><div class="panel">
  <div class="mock-nav"><span class="brand"><img src="../../../public/logo-small.png" alt="">NAMMES Hub</span>
    <span class="it">About</span><span class="it hl">Academics ▾ <span class="callout-tag">1</span></span><span class="it hl">Community ▾ <span class="callout-tag">2</span></span><span class="it">Forms</span><span class="it">Contact</span>
    <span class="signin">Sign In <span class="callout-tag" style="background:#fff;color:#ae3200">3</span></span><span class="it">◐ <span class="callout-tag">4</span></span></div>
  <div class="legend">
    <div><span class="callout-tag">1</span><span><strong>Academics</strong> opens Outlines, Curriculum, Timetable, CGPA and Resources.</span></div>
    <div><span class="callout-tag">2</span><span><strong>Community</strong> opens Events, News, Opportunities, Awards, the Live quiz and Quiz battles.</span></div>
    <div><span class="callout-tag">3</span><span><strong>Sign In</strong> becomes your account menu once you are signed in.</span></div>
    <div><span class="callout-tag">4</span><span><strong>Sun / moon</strong> switches between light and dark mode.</span></div>
  </div>
</div><figcaption>The menu bar, redrawn for clarity.</figcaption></figure>
<p>The <strong>Academics</strong> and <strong>Community</strong> entries are drop-downs: click one to see its pages. Click anywhere else, or pick a page, and the drop-down closes. The page you are on is underlined so you always know where you are.</p>
<p>When you are signed in, <strong>Sign In</strong> turns into your <strong>account menu</strong>, with links to your Account page and (for admins only) the Admin area, plus <em>Sign out</em>.</p>

<h2>The menu on a phone</h2>
<div class="side">
  ${shot('m-menu', 'The phone menu.', { phone: true })}
  <div>
    <p>On a narrow screen the menu collapses into the <strong>☰ menu button</strong> at the top right. Tap it and the whole map slides down: <em>About</em>, then the <em>Academics</em> and <em>Community</em> groups with every page listed, then <em>Forms</em>, <em>Contact</em> and <em>Sign in</em>.</p>
    <p>Tap a page to go there; the menu closes by itself. You can also press <strong>Esc</strong> or tap the button again to close it.</p>
    ${tip('The sun/moon button sits right next to the menu button, so you can switch to dark mode at night without opening the menu.')}
  </div>
</div>

<h2>Light and dark mode</h2>
<p>Tap the <strong>sun / moon</strong> button to switch between a light theme and a dark theme. The Hub remembers your choice on that device. If you have never chosen, it follows your phone or computer's own setting. Dark mode is easier on the eyes at night; light mode reads best in bright rooms and on printouts.</p>

<h2>Breadcrumbs, footer and the welcome tour</h2>
<h3>Breadcrumbs</h3>
<p>On pages that go several levels deep (Outlines, Resources, Timetable, Events, News) a trail such as <span class="path">Outlines › 100 Level › First Semester</span> appears above the title. Every part of the trail is clickable, so you can step back up one level at a time.</p>
<h3>The footer</h3>
<p>The dark green strip at the bottom of every page has, from top to bottom: a <em>Reach an Exco</em> link, the <strong>newsletter sign-up</strong> (the NAMMES Communiqué on Substack), the association's <strong>social media icons</strong>, a short list of quick links, and the handbook download.</p>
<h3>The welcome tour</h3>
<p>The first time you sign in, a short tour introduces the <strong>Academics</strong> menu, the <strong>Community</strong> menu and your <strong>Account</strong> in three quick steps. It only appears once per account on each device.</p>
${note('If a small message says a new version of the site is available, choose <strong>Refresh</strong>. It loads the latest version so you always see current content.')}

<h2>Maintenance and "page not found"</h2>
<p>Occasionally the executives switch the Hub into <strong>maintenance mode</strong> while they make big changes. Visitors then see a green <em>We'll be right back</em> page with a contact email; admins can still sign in and work. If you type an address that does not exist you will land on a friendly <em>page not found</em> screen with a <span class="btn">Back to home</span> button.</p>
`,
  },

  /* ------------------------------------------------------------------ 4 */
  {
    id: 'account',
    part: PART_1,
    num: 4,
    title: 'Your Account',
    intro: 'Signing up, signing in, resetting a forgotten password, and the three settings on your Account page.',
    inThis: ['Signing up and your matric number', 'Signing in and forgotten passwords', 'The Account page settings', 'Signing out and keeping your account safe'],
    html: `
<h2 class="first">Signing up and your matric number</h2>
${glance([['Address', 'nammeshub.com.ng/signup'], ['Sign-in needed?', 'No, this is how you get one'], ['Fields', 'Name, matric number, email, password'], ['Takes', 'About two minutes']])}
<p>To sign up you provide your <strong>full name</strong>, <strong>matric number</strong>, <strong>email</strong> and a <strong>password</strong> (at least 8 characters, entered twice so a typo cannot lock you out). Tick the <em>Verify you are human</em> box and choose <span class="btn">Create account</span>.</p>
<h3>Your matric number</h3>
<p>The Hub asks for your <strong>department matric number</strong>. It follows the pattern <code>YY0406XXX</code>: two digits for your entry year, then <code>0406</code> (the department code), then three digits. For example, <code>240406012</code> or <code>260406009</code>.</p>
<p>Your matric number is what proves you are a real member of the department. It is used, for example, to make sure the awards stay fair: one member, one vote.</p>
${warn('Your matric number is saved once, at sign-up, and you <strong>cannot change it yourself</strong> afterwards. Double-check it before you submit. If a typo slips through, contact an executive through the Contact page so an admin can correct it.')}
<p>After you submit, the Hub emails you a link to <strong>confirm your address</strong>. Your account is only active once you have clicked it, so check your spam folder if it does not arrive within a few minutes.</p>

<h2>Signing in and forgotten passwords</h2>
<div class="side">
  ${shot('login', 'The Sign In page.', { url: '/login' })}
  <div>
    ${steps(['Choose <span class="btn">Sign In</span> in the menu.', 'Enter your <strong>email</strong> and <strong>password</strong>.', 'Tick <em>Verify you are human</em>.', 'Choose <span class="btn">Sign In</span>.'])}
  </div>
</div>
<h3>If you forget your password</h3>
${steps([
  'On the Sign In page choose <strong>Forgot password?</strong> (next to the password box).',
  'Type the email you signed up with and submit. The Hub emails you a reset link.',
  'Open the email, click the link, and choose a <strong>new password</strong> of at least 8 characters.',
  'You are sent back to Sign In with a confirmation. Sign in with the new password.',
])}
${note('Admins who have switched on two-factor login are also asked for a 6-digit code from their authenticator app after their password. See Chapter 24.')}

<h2>The Account page settings</h2>
<p>Once signed in, open your account menu and choose <strong>Account</strong> (or go to <span class="path">/account</span>). It shows the email you signed up with and three settings:</p>
${table(['Setting', 'What it does', 'When to change it'], [
  ['Full name', 'Shown on your CGPA report and to admins.', 'If you signed up with a nickname or misspelled your name.'],
  ['100 Level session', 'The year you started 100 Level. It lets the CGPA report label every level with the right academic session. Starting in 2024 means 100L is 2024/2025, 200L is 2025/2026, and so on.', 'Once, right after you sign up.'],
  ['Email notifications', 'A single switch. On means you receive alerts about new News and Events and department broadcasts from the executives.', 'Any time you want fewer (or more) emails.'],
])}
${tip('Turn <strong>email notifications</strong> on if you never want to miss an exam notice or event. You can switch them off again at any time from the same page.')}

<h2>Signing out and keeping your account safe</h2>
<p>Open the account menu and choose <strong>Sign out</strong>. Always sign out on a shared or public computer. Because the Hub holds your grades, never share your password, and use one that you do not reuse on other sites.</p>
`,
  },
]
