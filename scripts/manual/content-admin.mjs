import { SITE, tip, note, warn, adminBox, glance, steps, bullets, table, pills, shot, path, qa } from './helpers.mjs'

export const PART_5 = 'Part Five · Admin Guide'

const DASH = [
  ['Content', 'Home Page', 'Hero banner and the president\'s welcome message.'],
  ['Content', 'Site Links', 'Newsletter, social links, contact email, maintenance mode.'],
  ['Content', 'Page Banners', 'Title, subtitle and pictures at the top of each page.'],
  ['Content', 'News', 'Publish articles and updates.'],
  ['Logistics', 'Events', 'Schedule events and manage their galleries.'],
  ['Library', 'Resources', 'Organise shared academic resources.'],
  ['Careers', 'Opportunities', 'Share scholarships and internships.'],
  ['Directory', 'Excos', 'The executive team directory.'],
  ['Directory', 'Users', 'Every account and admin access.'],
  ['Directory', 'Security', 'Two-factor login for your account.'],
  ['Directory', 'System', 'Switches, email queue, logs (owner).'],
  ['Engagement', 'Messages', 'Contact-form messages.'],
  ['Academics', 'Outlines', 'Course outlines by level and semester.'],
  ['Academics', 'Submissions', 'Approve student contributions.'],
  ['Academics', 'Timetable', 'Class and exam timetables.'],
  ['Engagement', 'Forms', 'Build forms and read responses.'],
  ['Engagement', 'Awards', 'Nominate, curate, vote, reveal.'],
  ['Engagement', 'Broadcasts', 'Email every opted-in member.'],
  ['Engagement', 'Email Templates', 'Edit broadcast email designs.'],
  ['Governance', 'Reviews', 'Approve pending edits (owner).'],
]

export const chapters = [
  /* ------------------------------------------------------------------ 16 */
  {
    id: 'admin-start',
    part: PART_5,
    admin: true,
    num: 16,
    title: 'Before You Begin',
    intro: 'Who admins are, how to open the Admin area, and the one editing pattern you will use everywhere.',
    inThis: ['Owner and admin: who can do what', 'Signing in to the Admin area', 'The dashboard', 'Add, edit and delete: the common pattern', 'Golden rules for admins'],
    html: `
<h2 class="first">Owner and admin: who can do what</h2>
<p>The Hub has two levels of executive power. Every <strong>admin</strong> can run the site's content. The <strong>owner</strong> is a single trusted admin who can additionally approve changes and manage people. When the leadership changes, ownership can be handed over (Chapter 22).</p>
${table(['Power', 'Admin', 'Owner'], [
  ['Open the Admin dashboard and all content sections', 'Yes', 'Yes'],
  ['Publish Resources, Opportunities, Excos, Outlines, Timetables, Banners, Links, Home page', 'Immediately', 'Immediately'],
  ['Create or edit <strong>News</strong>, <strong>Events</strong> and <strong>Award seasons</strong>', 'Goes to the <em>Review queue</em> for approval', 'Published immediately'],
  ['Delete content', 'Yes', 'Yes'],
  ['Approve or reject pending edits (Reviews)', 'No', 'Yes'],
  ['Make or remove admins, transfer ownership, delete or anonymise accounts', 'No', 'Yes'],
  ['Disable or enable a member\'s account', 'Yes', 'Yes'],
  ['System page: switches, email queue, logs', 'No', 'Yes'],
  ['Read Messages, run Broadcasts, build Forms, run Awards stages', 'Yes', 'Yes'],
])}

<h2>Signing in to the Admin area</h2>
${steps([
  'Sign in at <span class="path">/login</span> with your normal account.',
  'Open your <strong>account menu</strong> (top right) and choose <strong>Admin</strong>, or go to <span class="path">/admin</span>.',
  'If you have switched on two-factor login you are now asked for the <strong>6-digit code</strong> from your authenticator app.',
  'The <strong>Admin Dashboard</strong> opens.',
])}
${note('Anyone can sign up for an account, but only people who have been made admins can open <span class="path">/admin</span>. Everyone else is sent back to the home page.')}

<h2>The dashboard</h2>
<p>The dashboard is a grid of tiles, one per job, labelled by category. Choose a tile to open that section. The <strong>Submissions</strong> tile shows a badge with the number of student contributions waiting for you. The owner also sees the <strong>Reviews</strong> tile.</p>
<figure class="mock"><div class="panel"><div class="dash">
${DASH.map(([c, n, d]) => `<div class="tile${n === 'Reviews' || n === 'System' ? ' owner' : ''}"><div class="cat">${c}</div><div class="nm">Manage ${n}</div><div class="ds">${d}</div></div>`).join('')}
</div></div><figcaption>The twenty dashboard tiles, redrawn for clarity. Gold-edged tiles are for the owner.</figcaption></figure>

<h2>Add, edit and delete: the common pattern</h2>
<p>Most sections (News, Events, Resources, Opportunities, Excos, Outlines, Timetable) share the same screen, so you learn it once:</p>
${steps([
  '<strong>Open the section</strong> from the dashboard. You see a list of everything that exists.',
  'Choose <span class="btn">Add [Section]</span> to create something. A form opens; fill it in and choose <span class="btn">Save changes</span>.',
  'To change something, choose the <strong>pencil (Edit)</strong> icon on its row, change the fields and save.',
  'To remove something, choose the <strong>bin (Delete)</strong> icon. Click again on <strong>Confirm delete</strong>. Nothing is removed until you confirm.',
  'Use <strong>Back to Admin</strong> at the top to return to the dashboard.',
])}
<p>Long lists such as Outlines and Timetable have <strong>filter chips</strong> (for example <em>100 Level</em>, <em>200 Level</em>) above the list, so you can work on one level at a time.</p>
${warn('The red <strong>Delete All</strong> button at the top of a section removes <strong>every item in the whole list</strong>, or every item in the level you have filtered to. It asks you to confirm, but there is no undo. Read the confirmation message twice, and never use it just to tidy up.')}

<h3>Pictures</h3>
<p>Every photo upload (news, events, galleries, excos, nominees) must be <strong>JPEG or PNG and no larger than 5 MB</strong>. If one is refused, compress or convert it and try again.</p>

<h2>Golden rules for admins</h2>
<ul class="checks">
  <li><strong>Proofread before you publish.</strong> Members treat the Hub as official.</li>
  <li><strong>Turn on two-factor login</strong> for your admin account (Chapter 22).</li>
  <li><strong>Never share your login.</strong> Ask the owner to add your colleague.</li>
  <li><strong>Use maintenance mode</strong> before big changes.</li>
  <li><strong>Edit rather than delete,</strong> and keep members' data private.</li>
</ul>
`,
  },

  /* ------------------------------------------------------------------ 17 */
  {
    id: 'admin-content',
    part: PART_5,
    admin: true,
    num: 17,
    title: 'Managing the Site\'s Content',
    intro: 'The home page, links, banners, news, events, resources, opportunities and the excos: everything members see first.',
    inThis: ['Home page', 'Site links and maintenance mode', 'Page banners', 'News', 'Events and event galleries', 'Resources, Opportunities and Excos', 'The Handbook: edit this book'],
    html: `
<h2 class="first">Home page</h2>
<p><span class="path">Admin → Home Page</span> edits the two big things on the front page.</p>
${table(['Block', 'Fields'], [
  ['Hero banner', '<strong>Title</strong> and <strong>Subtitle</strong> (both required) and a <strong>Background image</strong> (a dark green overlay is added so the white text stays readable).'],
  ['President\'s message', 'The president\'s <strong>Name</strong> and <strong>Role</strong>, the <strong>Message</strong> itself and a <strong>Photo</strong>.'],
])}
<p>Choose <span class="btn">Save</span> and you will see "Home page content updated." The change is live at once.</p>
${tip('Refresh the president\'s message at the start of every session, and use a landscape, high-resolution hero picture for the best result on big screens.')}

<h2>Site links and maintenance mode</h2>
<p><span class="path">Admin → Site Links</span> holds settings that appear across the whole site.</p>
${table(['Setting', 'Where it appears'], [
  ['Contact email', 'Shown on the maintenance page.'],
  ['Substack URL', 'Powers the newsletter sign-up box in the footer.'],
  ['Social media links', 'WhatsApp community, X, Instagram, LinkedIn and YouTube icons in the footer and on the Contact page. Only links you fill in are shown.'],
  ['Maintenance mode', 'A switch that shows the <em>We\'ll be right back</em> page to every visitor <strong>except signed-in admins</strong>, with your own <strong>Status message</strong>. It saves instantly when you flip it.'],
])}
${warn('Maintenance mode takes effect the moment you flip the switch. Members cannot use the Hub until you switch it off again, so flip it back when you are finished.')}

<h2>Page banners</h2>
<p><span class="path">Admin → Page Banners</span> controls the title, subtitle and pictures at the top of eleven pages: <strong>About, CGPA Calculator, Contact, Curriculum, Events, Meet the Excos, News, Opportunities, Outlines, Resources</strong> and <strong>Timetable</strong>.</p>
${bullets(['<strong>Title</strong> and <strong>Subtitle</strong>: the words on the banner (the CGPA banner is pictures only).', '<strong>Images</strong>: add one for a still banner, or several for a slideshow.', '<strong>Transition</strong>: <em>Fade</em> or <em>Slide</em> between pictures.', '<strong>Seconds per slide</strong>: how long each picture stays (default 5).'])}

<h2>News</h2>
<p><span class="path">Admin → News</span>. Add an article with these fields:</p>
${table(['Field', 'Notes'], [
  ['Title', 'A clear headline. It also identifies the article in the list.'],
  ['Category', 'Academics, Governance, Welfare, Industry, Call for papers or Resources. Members filter by this.'],
  ['Card color', 'Green, orange or neutral, the accent on the article card.'],
  ['Date', 'Publication date; newest first on the site.'],
  ['Author', 'Who wrote it.'],
  ['Body', 'The article text. Web addresses become links.'],
  ['Badge (optional) and Badge label', 'A "New" or "Updated" tag on the card, with your own wording.'],
  ['Image', 'The story photo; adjust its width with the slider.'],
])}
${adminBox('<p>Admins\' new articles and edits show as <strong>Pending review</strong> and go live only after the owner approves them. You will see them listed under <em>Awaiting the owner\'s approval</em>. The owner\'s own edits publish immediately.</p>', 'Review gate')}

<h2>Events and event galleries</h2>
<p><span class="path">Admin → Events</span>. Fields: <strong>Title</strong>, <strong>Date label</strong>, <strong>Card color</strong> (green or orange), <strong>Location / time</strong> (optional), <strong>Description</strong> and <strong>Photo</strong> (the flyer or cover picture).</p>
${warn('Type the date in a way people <em>and</em> the Hub can read, such as <code>3rd October 2026</code> or <code>3 October 2026</code>. The Hub uses it to move the event from Upcoming to Past automatically. A date it cannot understand leaves the event in Upcoming.')}
<p>Each event row also has a <strong>Gallery</strong> icon. Choose it to open that event's gallery page:</p>
${steps(['Choose the upload area, or drag pictures in. You can <strong>select many photos at once</strong> (JPEG or PNG, up to 5 MB each).', 'Wait for "N photos added."', 'To remove a photo, choose the <strong>×</strong> on it. You will see "Photo removed."'])}
<p>The photos appear on the event's public <em>Gallery</em> tab straight away. Events, like News, go through the owner's review when created or edited by an admin.</p>

<h2>Resources, Opportunities and Excos</h2>
${table(['Section', 'Fields to fill in', 'Tips'], [
  ['Resources', 'Level (100-500), Semester (1 or 2), Category, Title, Updated date, Drive link', 'Paste a Drive share link set to <em>Anyone with the link can view</em>, or members will be blocked.'],
  ['Opportunities', 'Title, Organization, Type (Scholarship or Internship), Deadline, Apply link', 'Members see the list sorted by soonest deadline. Remove entries once their deadline has passed.'],
  ['Excos', 'Role, Name (optional), Display order, Email, Phone, Photo', 'Display order is a number: <strong>1</strong> appears first. A role with no name shows a placeholder, so you can list vacancies.'],
])}
${tip('When a new executive council takes over, edit the existing Exco rows (name, photo, contact) instead of deleting them, and update the session label in the Page Banners for Meet the Excos.')}

<h2>The Handbook: edit this book</h2>
<p><span class="path">Admin &rarr; Handbook</span> lets you change the wording of this very handbook. The list on the left starts with the covers and front pages (front cover, title page, copyright, foreword, contents, <em>Meet the authors</em>, back cover), then every chapter and appendix. A small <strong>Edited</strong> tag marks pages you have changed.</p>
${steps(['Choose a page and click into the text. Use the toolbar for bold, italic, headings, lists, links and <strong>Add box</strong> (Tip, Careful and so on). Screenshots are fixed; captions can be edited.', 'Choose <strong>Save changes</strong>. The download has not changed yet, and <strong>Restore original text</strong> undoes your edits to a page.', 'When you have finished, choose <strong>Rebuild PDF</strong> at the top and wait a minute or two. The footer and About page then serve the new version, with the contents renumbered.'])}
${tip('<strong>New executive council?</strong> Open <em>Meet the authors</em>, change the team name and session, then choose <em>Load from Meet the Excos</em> or edit each name, role and photo by hand. Save and rebuild: the covers, title page, foreword and contents pick up the new names and session by themselves.')}
`,
  },

  /* ------------------------------------------------------------------ 18 */
  {
    id: 'admin-academics',
    part: PART_5,
    admin: true,
    num: 18,
    title: 'Managing Academics',
    intro: 'Outlines, timetables and the approval queue for student contributions.',
    inThis: ['Outlines', 'Submissions: the approval queue', 'Timetables'],
    html: `
<h2 class="first">Outlines</h2>
<p><span class="path">Admin → Outlines</span> holds one entry per course. Use the <strong>level filter chips</strong> to work on one level at a time.</p>
${table(['Field', 'Notes'], [
  ['Level, Semester', 'Level 100-500 and semester 1 or 2. These place the course in the right list.'],
  ['Course code, Title, Units', 'For example <em>CHM-CM 101</em>, <em>General Chemistry I</em>, 2 units.'],
  ['Lecturer', 'Optional. Members see "TBA" style placeholders if it is empty.'],
  ['Updated date', 'When the outline was last revised.'],
  ['Description', 'A short summary of the course.'],
  ['Topics', 'A list: <strong>one topic per line</strong>.'],
  ['Recommended texts', 'A list, one book per line. Include a web address in a line to make it a clickable link.'],
  ['Past exam questions link and file name; Lecturer notes link and file name', 'Optional Drive links and the label members see on the button.'],
])}
${tip('Fill in topics and recommended texts carefully. They are what students actually read and print. The <em>Download PDF</em> button on the public site is built from these same fields.')}

<h2>Submissions: the approval queue</h2>
<p><span class="path">Admin → Submissions</span> is where student contributions arrive. The dashboard tile and the navigation menu show a red badge with the number waiting.</p>
${steps([
  'Open the <strong>Pending</strong> tab (its title shows the count).',
  'Open each contribution: check the <strong>type</strong>, <strong>session</strong>, <strong>title</strong> and the file or link.',
  'Choose <strong>Approve</strong> if it is genuine and useful. It appears on that course\'s outline page immediately.',
  'Choose <strong>Reject</strong> if it is wrong, spam, duplicated or unsafe.',
  'The <strong>Approved / rejected</strong> tab keeps the history. You can delete an entry from there if it should never have been published.',
])}
${warn('Open every file or link before approving it. Make sure it is the right course, readable, and does not contain personal information or unsafe links.')}

<h2>Timetables</h2>
<p><span class="path">Admin → Timetable</span> uses one row per lecture or exam, with level filter chips. Set <strong>Type</strong> first, because it decides which of two fields you need.</p>
${table(['Field', 'Class entries', 'Exam entries'], [
  ['Level, Semester, Type', 'Required', 'Required'],
  ['Day (Monday to Friday)', 'Required', 'Leave empty'],
  ['Date', 'Leave empty', 'Required'],
  ['Start time, End time', 'Required', 'Required'],
  ['Course code, Course title, Venue', 'Required', 'Required'],
  ['Lecturer, Notes', 'Optional (notes such as <em>Practical Lab</em> or <em>Tutorial</em>)', 'Optional'],
])}
<p>The public page sorts rows for you: class entries by day and time, exams by date. Members can then download a PDF or an image straight from the page.</p>
`,
  },

  /* ------------------------------------------------------------------ 19 */
  {
    id: 'admin-forms',
    part: PART_5,
    admin: true,
    num: 19,
    title: 'Building Forms',
    intro: 'Create registrations, surveys and applications, style them to match your event, share them by link or QR code, and read the answers.',
    inThis: ['The Forms list', 'Creating a form', 'Question types', 'Designing how it looks', 'Sharing a form', 'Reading responses and exporting'],
    html: `
<h2 class="first">The Forms list</h2>
<p><span class="path">Admin → Forms</span> lists every form with a status label: <strong>Accepting</strong> or <strong>Closed</strong>. Each form has buttons to <strong>Share</strong>, <strong>Edit</strong>, view <strong>Responses</strong> and <strong>Delete</strong>. Choose <span class="btn">New form</span> to start.</p>
${warn('Deleting a form permanently removes <strong>all its questions and all its responses</strong>. Export the responses first if you might need them.')}

<h2>Creating a form</h2>
<h3>Step 1: the basics</h3>
${table(['Setting', 'What it does'], [
  ['Title (required)', 'The form\'s name, shown at the top and in the list.'],
  ['Description', 'Optional intro text under the title.'],
  ['Category', 'Event, Application, Survey or Other, shown as a badge on the Forms page.'],
  ['Accepting responses', 'Switch off to close the form immediately.'],
  ['Require sign-in to respond', 'Only signed-in members can answer. Leave off for public sign-ups; anonymous answers are protected by the human check.'],
  ['Limit to one response per person', 'Available when sign-in is required. Stops duplicate answers.'],
  ['Allow editing a response after submit', 'Lets members correct their answers later.'],
  ['Closes at', 'Optional date and time when the form closes by itself.'],
])}
<h3>Step 2: add questions</h3>
<p>Choose to add a question, then type it (<em>Question</em>), add optional <em>Helper text</em>, pick a type, and set the <strong>Required</strong> switch. Drag the handle (⋮⋮) on the left of any question to <strong>reorder</strong> them; use the arrow to expand or collapse a question, and the bin to remove it. Every question needs a label, and questions with options need at least one option.</p>

<h2>Question types</h2>
${table(['Type', 'Use it for', 'Extra settings'], [
  ['Short answer', 'A name, matric number, phone number.', '-'],
  ['Paragraph', 'Feedback or long explanations.', '-'],
  ['Multiple choice', 'Pick exactly one option.', 'Your list of options'],
  ['Checkboxes', 'Pick any number of options.', 'Your list of options'],
  ['Dropdown', 'One option from a long list (levels, hostels).', 'Your list of options'],
  ['Linear scale', 'Ratings, such as 1 to 5.', 'Minimum, Maximum, and labels for each end'],
  ['File upload', 'Receipts, CVs, screenshots.', '-'],
  ['Date', 'Birthdays, availability.', '-'],
  ['Time', 'Preferred time slots.', '-'],
])}
<p>Each question can also carry its own <strong>image</strong> and its own <strong>text style</strong>, marked <em>Customized</em> when you have changed it.</p>

<h2>Designing how it looks</h2>
<p>Choose <strong>Design</strong> in the editor to open the design studio. Use <em>Controls</em> to change things and <em>Preview</em> (on a phone) to see the result. It has six tabs:</p>
${table(['Tab', 'What you can change'], [
  ['Themes', 'One-tap presets: NAMMES, NAMMES Dark, Classic, Midnight, Ocean, Forest, Sunset, Lavender, Rose, Paper, Slate, Mint, Noir and Glass.'],
  ['Background', 'Page background as a default, a solid colour, a gradient (with angle) or an image.'],
  ['Cards', 'Card colour, opacity, corner roundness, border, shadow and card size.'],
  ['Text', 'Colour, size, bold, italic, underline and alignment for the title, description and questions.'],
  ['Header', 'A header picture, cropped to a ratio such as 1:1, 4:3, 16:9, 21:9 or 3:1.'],
  ['Layout', 'Form width: narrow, medium or wide.'],
])}
${tip('Start with the <strong>NAMMES</strong> theme so the form matches the Hub, then tweak only what your event needs. Presets only set the starting look; every value stays editable.')}

<h2>Sharing a form</h2>
<p>Choose <strong>Share</strong> on the list or inside the editor. A window shows the form's <strong>direct link</strong> and a <strong>QR code</strong> you can <strong>download as a picture</strong> for flyers, slides and posters. The form also appears automatically on the public Forms page while it is open.</p>

<h2>Reading responses and exporting</h2>
<p>Choose <strong>Responses</strong> on a form. The page has three tabs:</p>
${table(['Tab', 'Best for'], [['Summary', 'Charts and totals for each question, to spot the big picture at a glance.'], ['Table', 'Every response in a spreadsheet-style grid.'], ['Individual', 'Reading one person\'s full answers at a time.']])}
<p>Choose <span class="btn ghost">Export CSV</span> to download every response as a spreadsheet file that opens in Excel or Google Sheets, named after the form. The button is greyed out until at least one response exists.</p>
${adminBox('<p>Responses may contain names, matric numbers and contact details. Download only what you need, store the file somewhere private, and delete it when you are done.</p>', 'Handle with care')}
`,
  },

  /* ------------------------------------------------------------------ 20 */
  {
    id: 'admin-awards',
    part: PART_5,
    admin: true,
    num: 20,
    title: 'Running the Awards',
    intro: 'Create a season, move it through five stages, curate the shortlist and reveal the winners.',
    inThis: ['Creating a season', 'Moving through the stages', 'Curating the shortlist', 'Results and the reveal'],
    html: `
<h2 class="first">Creating a season</h2>
<p><span class="path">Admin → Awards</span> lists every season with its current stage. Choose <span class="btn">New season</span>.</p>
${steps(['Give the season a <strong>Title</strong>, for example <em>Materials Horizon Awards 2026</em>.', 'Add <strong>categories</strong>. Each has a title (such as "Most Innovative Student") and an optional description. Add as many as you need.', 'Save. The season begins in the <strong>nominating</strong> stage.'])}
${note('You can only change a season\'s categories while it is in the <strong>nominating</strong> stage. After that they are locked so nobody\'s nominations are disturbed. Admins\' edits go through the owner\'s review.')}

<h2>Moving through the stages</h2>
<p>Open a season to edit it. A green badge shows the stage, and one button advances it to the next. The buttons are worded to say exactly what happens:</p>
<div class="phases">
  <div class="ph">Nominating<small>Members suggest</small></div>
  <div class="ph">Curating<small>You build shortlists</small></div>
  <div class="ph">Voting<small>Members vote once</small></div>
  <div class="ph">Closed<small>Votes counted</small></div>
  <div class="ph">Revealed<small>Public results</small></div>
</div>
${table(['Current stage', 'Button', 'What happens next'], [
  ['Nominating', '<strong>Close nominations &amp; start curating</strong>', 'Members can no longer nominate. You build the shortlist.'],
  ['Curating', '<strong>Open voting</strong>', 'The ballot goes live with your shortlist.'],
  ['Voting', '<strong>Close voting</strong>', 'Members can no longer vote.'],
  ['Closed', '<strong>Reveal results</strong>', 'Winners and tallies become public.'],
])}
<p>You will see "Phase advanced." after each move. The stage only moves forward, so double-check before you press.</p>

<h2>Curating the shortlist</h2>
<p>During <em>curating</em>, open each category and choose <strong>Curate</strong>. The screen shows the <strong>Shortlist</strong> at the top and, beneath it, the <strong>raw nominations</strong> members submitted, grouped when several people nominated the same name.</p>
${steps(['Read the raw nominations and spot the leading names.', 'Choose <strong>add to shortlist</strong> for each name you want on the ballot. A nominee photo is used if one was supplied, and you can upload or replace it (JPEG or PNG, 5 MB).', 'Remove a nominee from the shortlist if you added the wrong one.', 'Repeat for every category before you open voting.'])}

<h2>Results and the reveal</h2>
<p>Choose <strong>Results</strong> on the season row to see the vote tallies per category. Members only see results after you press <strong>Reveal results</strong>. At that point the public page changes to <em>Results revealed</em>, showing each winner with their vote count.</p>
${adminBox('<p>Deleting a season removes <strong>all its categories, nominations and votes</strong> and cannot be undone. Only members with a department matric number can nominate or vote, and each member can vote once, so please do not run votes for anything that must allow other groups to take part.</p>', 'Be careful')}
`,
  },

  /* ------------------------------------------------------------------ 21 */
  {
    id: 'admin-comms',
    part: PART_5,
    admin: true,
    num: 21,
    title: 'Talking to Members',
    intro: 'Read what members send you, and send announcements to everyone who wants them.',
    inThis: ['Messages', 'Broadcasts: email everyone', 'Email templates'],
    html: `
<h2 class="first">Messages</h2>
<p><span class="path">Admin → Messages</span> lists everything sent through the Contact page, newest first, with the <strong>time received</strong>, <strong>name</strong>, <strong>email</strong> and the full <strong>message</strong>. Reply from your own email using the address shown. Delete a message once it has been dealt with.</p>

<h2>Broadcasts: email everyone</h2>
<p><span class="path">Admin → Broadcasts</span> is an email designer and sender in one. You build an announcement, see it exactly as members will, and send it to <strong>every member who has left email notifications on</strong>. Use it for exam changes, event invitations and important notices. The screen has the editor on the left and a <strong>live preview</strong> on the right.</p>
${steps([
  'Under <strong>Look</strong>, pick one of the seven templates. Hover over a template to read what it is for.',
  'Type the <strong>Subject</strong>.',
  'Build the <strong>Content</strong> from blocks (see below).',
  'Watch the <strong>preview</strong> update as you type.',
  'Choose <span class="btn ghost">Send test to me</span> to receive a copy in your own inbox first. It is the safest way to check how it looks on a phone.',
  'Choose <span class="btn">Send broadcast</span>, then confirm with <strong>Yes, send to everyone</strong>. You will see "Queued for N recipients. Delivery starts within a minute or two."',
])}
<h3>Content blocks</h3>
<p>Instead of one big text box, the email is made of blocks that you add, edit and reorder. Nine kinds are available:</p>
${pills(['Heading', 'Text', 'Image', 'Button', 'Highlight box', 'List', 'Divider', 'Spacer', 'Two columns'])}
<h3>Customize design, saved styles and drafts</h3>
${bullets([
  '<strong>Customize design</strong> opens the design studio for this one email: layout, colours, fonts, header (NAMMES logo, your own logo or none), banner image, call-to-action button, footer and card style. Only fonts that every inbox can show are offered, so the email looks the same for everyone.',
  '<strong>Save as style</strong> stores a look you like under a name such as <em>Exam notice</em>. It then appears under <strong>Saved styles</strong> so any admin can apply it in one tap.',
  '<strong>Save draft</strong> keeps an unfinished email (<em>Update draft</em> after the first save). Your drafts are listed under <strong>Drafts</strong> below the editor and are private to you.',
  '<strong>History</strong> lists every broadcast sent, with its subject, template, number of recipients and date.',
])}
<h3>The seven templates</h3>
${table(['Template', 'Look', 'Use it for'], [
  ['Default', 'Dark green header bar with an "Official Notice" tag', 'Everyday announcements'],
  ['Bold', 'High-contrast orange header, large headline', 'Notices that must stand out'],
  ['Minimal', 'Text first, no coloured header', 'Quiet, businesslike messages'],
  ['Event Invite', 'Date badge, big image and button', 'Events and invitations'],
  ['Urgent Alert', 'Red accent bar and warning tag', 'Time-sensitive or safety notices'],
  ['Newsletter Digest', 'Editorial layout with dated eyebrow', 'Weekly or roundup updates'],
  ['Celebration', 'Festive orange and green accents', 'Wins, results and congratulations'],
])}
${adminBox('<p>A broadcast <strong>cannot be recalled</strong> once you send it. Always send yourself a test first, and reread the subject and every block before you confirm. The owner can switch broadcasts off entirely from the System page if something goes wrong.</p>', 'Cannot be undone')}

<h2>Email templates</h2>
<p><span class="path">Admin → Email Templates</span> is where the standing designs live: the seven broadcast templates plus the <strong>automatic emails</strong> the Hub sends by itself, namely the <strong>Welcome email</strong> (sent when someone creates an account) and the <strong>new content alerts</strong> for News and Events. Choose one on the left to see it beside a live preview with sample content.</p>
${bullets([
  '<strong>Design</strong> opens the same design studio, applied to the template itself, so every future email that uses it picks up the change ("Design saved.").',
  '<strong>Switch back to the HTML template</strong> undoes a design and returns to the original HTML, and the reset button restores the built-in look.',
  'For admins comfortable with HTML, a template can also be edited as raw HTML and saved ("Template saved."). Six <strong>placeholder tokens</strong> are swapped for real content each time an email is sent:',
])}
${table(['Token', 'Replaced with'], [
  ['<code>{{subject}}</code>', 'The broadcast subject.'],
  ['<code>{{body}}</code>', 'The body text, turned into paragraphs with links.'],
  ['<code>{{image}}</code>', 'The uploaded image, or nothing if none was attached.'],
  ['<code>{{date}}</code>', 'Today\'s date, short form.'],
  ['<code>{{date_full}}</code>', 'Today\'s date, long form.'],
  ['<code>{{site_url}}</code>', 'The Hub\'s web address, for links and the logo.'],
])}
${warn('If you edit the raw HTML, leave the <code>{{body}}</code> token in place or your message text will not appear in the email. If you are unsure, use the design studio instead of the HTML.')}
`,
  },

  /* ------------------------------------------------------------------ 22 */
  {
    id: 'admin-people',
    part: PART_5,
    admin: true,
    num: 22,
    title: 'People, Security and the System',
    intro: 'Managing accounts and admins, protecting your own login, approving changes, and keeping the site healthy.',
    inThis: ['Users and admin access', 'Security: two-factor login', 'Reviews: approving changes', 'The System page', 'Fixing a member\'s details', 'When something goes wrong'],
    html: `
<h2 class="first">Users and admin access</h2>
<p><span class="path">Admin → Users</span> lists every registered account with its <strong>name, matric number, join date, last seen, status</strong> and <strong>role</strong>, plus action buttons.</p>
${table(['Action', 'Who can do it', 'What it does'], [
  ['Make admin', 'Owner', 'Gives a member admin powers. They must have signed up first.'],
  ['Remove admin', 'Owner', 'Takes admin powers away from an admin.'],
  ['Disable / Enable', 'Any admin', 'Blocks or restores a member\'s ability to sign in without deleting anything.'],
  ['Make owner', 'Owner', 'Transfers ownership to another admin. <strong>You lose owner status.</strong> Use it when the leadership changes.'],
  ['Delete', 'Owner', 'Permanently deletes a member\'s account. Cannot be undone.'],
  ['Anonymise', 'Owner', 'Removes the name, matric number, CGPA data and email, and blocks sign-in, while keeping their votes and contributions.'],
])}
<h3>Adding a new admin</h3>
${steps(['Ask the person to <strong>sign up</strong> for an ordinary account first.', 'Sign in as the owner and open <strong>Admin → Users</strong>.', 'Find them (name or matric number) and choose <strong>Make admin</strong>. You will see "Admin access granted."'])}
<p>They can now see the Admin link. You cannot remove yourself, and the owner cannot be removed or disabled by anyone else.</p>
${warn('Prefer <strong>Disable</strong> or <strong>Anonymise</strong> to <strong>Delete</strong>. Deleting a member removes their account entirely, and it cannot be brought back.')}

<h2>Security: two-factor login</h2>
<p><span class="path">Admin → Security</span> lets you add a second step to your admin sign-in, so a stolen password alone is not enough. Everyone with admin powers is strongly encouraged to do this.</p>
${steps(['Open <strong>Security</strong> and choose to turn on two-factor login.', 'Open an authenticator app (Google Authenticator, Microsoft Authenticator or Authy).', 'Scan the QR code, or choose "enter a setup key" and type the key shown under it.', 'Type the 6-digit code the app shows and confirm. You will see "Two-factor login is now on."'], 'orange')}
${tip('Copy the <strong>setup key</strong> into a password manager. If you lose your phone, it lets you set the app up again on a new one.')}
<p>From then on, signing in to the Admin area asks for the current code. To switch it off, choose <strong>Turn off</strong> on the same page. When the owner turns on the <em>Require two-factor login for admin powers</em> switch (System page), an admin who has not set it up cannot make changes.</p>

<h2>Reviews: approving changes</h2>
<p><span class="path">Admin → Reviews</span> (owner only) is the queue of <strong>News, Events and Awards changes</strong> that other admins have submitted. Each request shows what would change, field by field, so you can compare before and after.</p>
${steps(['Read the changes carefully, including the text and pictures.', 'Choose <strong>Approve</strong> to publish them ("Approved and published."), or <strong>Reject</strong> and type a <strong>reason</strong> for the admin.', 'The admin sees their request as <em>Pending review</em> until you decide.'])}

<h2>The System page</h2>
<p><span class="path">Admin → System</span> is for the owner. It has five tabs:</p>
${table(['Tab', 'What it shows'], [
  ['Switches', 'Master on/off switches for <strong>award voting</strong>, <strong>award nominations</strong>, <strong>member file uploads</strong>, <strong>email broadcasts</strong>, the <strong>contact form and public form responses</strong>, and <strong>required two-factor login for admin powers</strong>. Each asks you to confirm.'],
  ['Email queue', 'Emails waiting to be delivered and their status.'],
  ['Activity', 'A log of who did what in the admin area.'],
  ['Server errors', 'Problems recorded by the site\'s back end.'],
  ['App errors', 'Problems members\' browsers ran into.'],
])}
<p>A <strong>System test</strong> button in the same area checks that the site can write to, and read back from, its error log.</p>
${adminBox('<p>The switches are an emergency brake. If a vote is being abused, a form is being flooded with spam, or a broadcast went wrong, flip the matching switch to stop it instantly, then investigate.</p>', 'Emergency brake')}

<h2>Fixing a member's details</h2>
<p>A member cannot change their own <strong>matric number</strong>. If someone made a typo, or an older account has none, the owner corrects it directly in the project's database dashboard (Supabase → <em>Table Editor</em> → <code>profiles</code> table → the person's <code>student_id</code>). It must match the department pattern <code>YY0406XXX</code> or the save is rejected. The Table Editor is also the fallback for anything the admin screens do not cover, and it needs no code.</p>

<h2>When something goes wrong</h2>
${table(['Problem', 'What to try'], [
  ['"No changes were saved. Your account may not have admin access."', 'Sign out and in again; check you are still an admin (ask the owner); if two-factor is required, complete the code step.'],
  ['An upload is rejected', 'The file is over 5 MB (10 MB for student contributions) or is not JPEG/PNG (PDF for contributions). Compress or convert it.'],
  ['My News or Event edit did not appear', 'It is waiting in the review queue. Ask the owner to approve it.'],
  ['An event is stuck in "Upcoming"', 'Its date label is unreadable. Edit it to a normal format like <code>3 October 2026</code>.'],
  ['Members see "We\'ll be right back"', 'Maintenance mode is on. Switch it off in Site Links.'],
  ['A broadcast is not arriving', 'Delivery takes a minute or two. Check the Email queue tab, and that broadcasts are switched on.'],
  ['A student cannot vote or nominate', 'Their account has no valid department matric number. Fix it as described above.'],
])}
`,
  },
]

export const APPENDIX = 'Appendices'

export const appendices = [
  {
    id: 'ref-pages',
    part: APPENDIX,
    letter: 'A',
    title: 'Quick Reference: Every Page',
    html: `
<h2 class="first">Public pages</h2>
${table(['Page', 'Address', 'Sign in?', 'One-line purpose'], [
  ['Home', '/', 'No', 'News, events and executives at a glance.'],
  ['About', '/about', 'No', 'History, mission, vision and values.'],
  ['Meet the Excos', '/excos', 'No', 'The Executive Council, with contact details.'],
  ['Contact', '/contact', 'No', 'Message the executives.'],
  ['Outlines', '/outlines', 'No*', 'Course-by-course outlines. *Sign in to contribute.'],
  ['Curriculum', '/curriculum', 'No', 'The official CCMAS document.'],
  ['Timetable', '/timetable', 'No', 'Class and exam schedules.'],
  ['CGPA', '/cgpa', 'Yes', 'Track GPA and plan targets.'],
  ['Resources', '/resources', 'No', 'Shared study materials.'],
  ['Events', '/events', 'No', 'Programmes and photo galleries.'],
  ['News', '/news', 'No', 'Department announcements.'],
  ['Opportunities', '/opportunities', 'No', 'Scholarships and internships.'],
  ['Awards', '/awards', 'Yes', 'Nominate and vote.'],
  ['Forms', '/forms', 'Varies', 'Registrations, surveys, applications.'],
  ['Sign In', '/login', '-', 'Enter your account.'],
  ['Sign Up', '/signup', '-', 'Create an account.'],
  ['Forgot password', '/forgot-password', '-', 'Get a reset link by email.'],
  ['Account', '/account', 'Yes', 'Name, 100 Level session, email alerts.'],
])}
<h2>Admin pages</h2>
<p class="small">All begin with <span class="path">/admin</span> and need an admin account.</p>
${table(['Section', 'Address', 'Purpose'], [
  ['Dashboard', '/admin', 'All the tiles.'],
  ['Home Page', '/admin/home', 'Hero and president\'s message.'],
  ['Site Links', '/admin/links', 'Newsletter, socials, maintenance mode.'],
  ['Page Banners', '/admin/banners', 'Top-of-page pictures and text.'],
  ['News · Events · Opportunities · Resources · Excos', '/admin/news …', 'Add, edit, delete content.'],
  ['Handbook', '/admin/handbook', 'Edit this handbook and rebuild its PDF.'],
  ['Event Gallery', '/admin/events/…/gallery', 'Photos for one event.'],
  ['Outlines · Submissions · Timetable', '/admin/outlines …', 'Academics management.'],
  ['Forms', '/admin/forms', 'List, new, edit, responses.'],
  ['Awards', '/admin/awards', 'Seasons, curate, results.'],
  ['Messages · Broadcasts · Email Templates', '/admin/messages …', 'Communications.'],
  ['Users · Security · Reviews · System', '/admin/users …', 'People and safety.'],
])}
`,
  },
  {
    id: 'glossary',
    part: APPENDIX,
    letter: 'B',
    title: 'Glossary',
    html: `
<h2 class="first">Words used in this handbook</h2>
${table(['Term', 'Meaning'], [
  ['Admin', 'An executive or trusted member allowed to open the Admin area and manage content.'],
  ['Owner', 'The one admin who also approves changes, manages people and controls the System page.'],
  ['{{team}} {{session}}', 'The name of the current Executive Council, for the {{session_long}} session.'],
  ['Breadcrumbs', 'The clickable trail (Outlines › 100 Level › …) that shows where you are.'],
  ['Broadcast', 'One announcement email sent to every member who has notifications on.'],
  ['CCMAS', 'Core Curriculum and Minimum Academic Standards, the NUC\'s official degree blueprint.'],
  ['CGPA / GPA', 'Cumulative Grade Point Average across all your semesters, and the Grade Point Average of a single semester.'],
  ['Curating', 'The awards stage where admins turn raw nominations into a shortlist.'],
  ['Excos', 'The Executive Council: the students elected to run NAMMES.'],
  ['Matric number', 'Your department student number, in the form YY0406XXX.'],
  ['Maintenance mode', 'A switch that shows visitors a "be right back" page while admins work.'],
  ['NAMMES', 'National Association of Metallurgical and Materials Engineering Students, UNILAG Chapter.'],
  ['Outline', 'A one-page summary of a course: topics, units, texts and links.'],
  ['Review queue', 'The list of admin edits waiting for the owner to approve.'],
  ['SIWES', 'Students Industrial Work Experience Scheme: industrial training built into the degree.'],
  ['Two-factor login', 'Signing in with your password plus a 6-digit code from an app on your phone.'],
])}
`,
  },
  {
    id: 'faq',
    part: APPENDIX,
    letter: 'C',
    title: 'Questions and Troubleshooting',
    html: `
<h2 class="first">Common questions</h2>
${qa('I did not get my confirmation email.', 'Wait a few minutes, then check your spam or junk folder. Make sure you typed the email correctly. If it still does not arrive, contact an executive through the Contact page.')}
${qa('I typed my matric number wrongly at sign-up. Can I fix it?', 'Not yourself. Message the executives through the Contact page and an admin will correct it for you.')}
${qa('The CGPA page just asks me to sign in.', 'That is normal: the calculator saves your grades to your account. Sign in and it opens your academic record.')}
${qa('Why can\'t I vote or nominate?', 'The awards are for members with a department matric number (YY0406XXX). If your account has none, or the season is not in the right stage, the page tells you.')}
${qa('A page says "Nothing published yet".', 'The executives have not added anything there yet. Come back later, or ask through the Contact page.')}
${qa('How do I stop the emails?', 'Open Account and switch Email notifications off. You can turn them on again at any time.')}
${qa('A file will not upload.', 'Check its size and type: student contributions accept PDF, JPG or PNG up to 10 MB; photos accept JPEG or PNG up to 5 MB.')}
${qa('Who do I contact about a mistake on the site?', 'Use the Contact page, or open Meet the Excos and reach the right executive directly.')}
<div class="callout"><div class="ct"><span>Still stuck?</span></div><p>Open <span class="path">${SITE.replace('https://', '')}/contact</span>, describe what you were doing and what you saw, and one of the executives will help.</p></div>
`,
  },
]
