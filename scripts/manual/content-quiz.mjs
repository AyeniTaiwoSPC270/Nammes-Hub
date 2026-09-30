import { tip, note, warn, adminBox, glance, steps, bullets, table, pills, qa } from './helpers.mjs'

const PART_3 = 'Part Three · Community'
const PART_5 = 'Part Five · Admin Guide'

// Two chapters about the live quiz: the member one (Part Three) and the admin one (Part Five).
// They are spliced into the book by content-community.mjs and content-admin.mjs, so the numbers below follow that order.

export const quizChapter = {
  id: 'quizzes',
  part: PART_3,
  num: 15,
  title: 'Live Quizzes and Battles',
  intro: 'Join an event quiz from your phone, practise on your own, or challenge a friend to a head-to-head battle.',
  inThis: ['Joining a live game', 'Playing a question', 'Teams, streaks and power-ups', 'Practice mode', 'Battles: challenge, duel and bracket', 'Champions and ratings', 'Fair play and privacy'],
  html: `
<h2 class="first">Three ways to play</h2>
${glance([['Address', 'nammeshub.com.ng/play'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone, with just a phone'], ['Best for', 'Events, revision and friendly rivalry']])}
<p>The Hub has a game-show style quiz, in the spirit of Kahoot. <strong>You do not need an account</strong>: you pick a nickname and a character and you are in. There are three ways to play, and you find all of them under <strong>Community</strong> in the menu (<em>Live quiz</em> and <em>Quiz battles</em>) and in the footer.</p>
${table(['Mode', 'What it is', 'Needs a host?', 'Where'], [
  ['<strong>Live game</strong>', 'An executive shows the questions on a big screen. Everyone answers on their phone at the same time and a leaderboard builds up.', 'Yes (an executive)', '<span class="path">/play</span>'],
  ['<strong>Practice</strong>', 'Replay a quiz on your own, one question at a time, with instant feedback. Good for revision.', 'No', 'A link the executives share'],
  ['<strong>Battle</strong>', 'Take on one other person (or a computer player), or be paired off against others in a knockout.', 'Not for duels', '<span class="path">/battle</span>'],
])}

<h2>Joining a live game</h2>
<p>At an event the host shows a <strong>lobby screen</strong> with a <strong>six-digit game code</strong>, a <strong>QR code</strong> and the list of players who have arrived.</p>
${steps([
  'Scan the QR code with your phone camera, <strong>or</strong> open <strong>Community → Live quiz</strong> and type the code under <em>Game code</em>.',
  'Type a <strong>nickname</strong>. Keep it friendly: rude words are blocked, and the host can remove or rename anyone.',
  'Pick one of <strong>50 animated characters</strong>. Each has its own dance for a right answer and its own sad move for a wrong one.',
  'If the game is played in teams, pick your <strong>team</strong> or choose <em>Put me anywhere</em> and the Hub balances the teams for you.',
  'You land on a <strong>You&rsquo;re in</strong> screen. Look for your name on the big screen and wait for the host to start.',
])}
${note('Every game has a <strong>player limit</strong> set by the host. When the lobby fills up, a short countdown starts and the game begins by itself (<em>Lobby full!</em>). If the host has <strong>locked the lobby</strong>, nobody new can join.')}
${warn('Join before the first question opens. Once a game has started you cannot slip in late, and the host can remove players who break the rules.')}

<h2>Playing a question</h2>
<p>The question and the countdown appear on the big screen. <strong>Your phone shows only the answer buttons</strong>, so look up to read the question and tap down to answer.</p>
<div class="phases">
  <div class="ph">1 · Question<small>Tap your answer</small></div>
  <div class="ph">2 · Reveal<small>Right answer shown</small></div>
  <div class="ph">3 · Leaderboard<small>Top players</small></div>
  <div class="ph">4 · Next question<small>Repeat</small></div>
  <div class="ph">5 · Podium<small>Final results</small></div>
</div>
<p>You can answer with a <strong>single tap</strong> on most questions. Some ask for something different:</p>
${table(['Question type', 'What you do'], [
  ['Multiple choice', 'Tap one of two to four coloured shapes.'],
  ['True or false', 'Tap <em>True</em> or <em>False</em>.'],
  ['Number answer', 'Type just the number, with no units. A small margin of error may be allowed.'],
  ['Typed answer', 'Type a short answer. Spelling counts, capital letters do not.'],
  ['Poll', 'Vote for your opinion. A poll has no right answer and gives no points.'],
])}
<p>Some questions carry a <strong>picture</strong> (tap it to enlarge) and some use maths such as x&sup2;. After you answer, your phone says <em>Answer locked in</em>. You cannot change it, and it does not say whether you were right until the reveal.</p>

<h3>How points work</h3>
<p>A right answer earns points, and <strong>speed counts</strong>: an instant answer earns full points and a last-second answer earns about half. A wrong answer or no answer earns nothing. The timing is measured by the Hub&rsquo;s own clock, so a slow phone connection does not help or hurt anyone.</p>

<h2>Teams, streaks and power-ups</h2>
<p>Hosts can switch on extras to make a game livelier. Your phone tells you whenever one is active.</p>
${table(['Extra', 'What it does'], [
  ['<strong>Teams</strong>', 'Play class against class, hostel against hostel, or any split the host chooses. A team&rsquo;s score is usually the <strong>average</strong> of its members, so a big team does not win just by being big.'],
  ['<strong>Streak bonus</strong>', 'Answer right several times in a row and earn up to <strong>+200</strong> bonus points each time. One wrong answer resets the streak.'],
  ['<strong>Double points</strong>', 'A question marked <em>Double points</em> is worth twice as much. A banner warns you as it opens.'],
  ['<strong>Power-ups</strong>', 'Each player gets one <strong>Double down</strong> (a right answer earns double) and one <strong>50/50</strong> (two wrong answers are hidden). Use each once per game, and decide <em>before</em> you answer.'],
  ['<strong>Comeback boost</strong>', 'Players in the bottom quarter earn <strong>15% extra</strong> on right answers, shown as a <em>Comeback +15%</em> chip, so nobody gives up.'],
])}
${tip('Double down is spent the moment you tap it, even if you then run out of time. Use it only when you are sure.')}
<p>If the host pauses the game you will see <em>Paused by the host. The clock is stopped.</em> Nobody loses time. Phones also have an optional <strong>sound effects</strong> switch (off by default) that adds short sounds and a small vibration for right and wrong answers.</p>

<h2>Practice mode</h2>
<p>When the executives open a quiz for practice, they share a link of the form <span class="path">/practice/&hellip;</span>. Practice is for revision: there is no host and no crowd.</p>
${steps([
  'Open the practice link, type a <strong>nickname</strong> and pick a character.',
  'Choose <span class="btn">Start practising</span>. Questions arrive <strong>one at a time</strong>, at your own pace.',
  'After each answer you see straight away whether you were right, the correct answer and your points.',
  'At the end you get your score, accuracy and the <em>Practice top 10 (just for fun)</em>. Choose <span class="btn">Try again</span> to go again.',
])}
<p>You can also <strong>race</strong> while you practise. Pick <em>Play against</em> and choose four computer players, or <em>Race past players</em> to compete against the saved results of people who practised before. A race bar shows who is ahead after each question.</p>
${note('The practice top 10 is labelled <em>just for fun</em> because instant feedback lets you learn the answers by replaying. It is kept separate from live game results.')}

<h2>Battles</h2>
<p>A <strong>battle</strong> is a head-to-head. Open <strong>Community → Quiz battles</strong>, pick a quiz that has battles switched on, choose a nickname and a character, then choose one of these:</p>

<h3>Challenge a friend</h3>
<p>You and your friend play the <strong>same questions at different times</strong>.</p>
${steps([
  'Choose <em>Challenge a friend</em>. Answer a set of up to 10 questions.',
  'When you finish, choose <em>Share the link</em> and send it in a chat. The message reads <em>Battle me on NAMMES Hub</em>.',
  'Your friend opens the link, sees your nickname, character and <strong>only your final score</strong> (<em>Your score to beat</em>), and plays the same questions.',
  'Both of you then see the <strong>head-to-head</strong>: each score, who won each question, and the winner. You can return to the same link later to see the result.',
])}
<p>A challenge link works for <strong>7 days</strong> and can be accepted once. Changed your mind? Choose <em>Cancel this challenge</em> and the link stops working.</p>

<h3>Live duel</h3>
<p>Two people play <strong>at the same moment</strong>, with no host.</p>
${steps([
  'Choose <em>Live duel</em> and <em>Start a duel</em>. You get a short <strong>battle code</strong> and a link.',
  'Your opponent opens the link, or types the code at <span class="path">nammeshub.com.ng/battle</span>. The duel starts a few seconds after they join.',
  'Both phones open each question at the same time. A score bar shows both players; you can see that the other person has answered, but not <em>what</em> they answered.',
  'After each question the right answer and the points are shown. At the end you see the winner and the question-by-question comparison, and can start another.',
])}
<p>Nobody to play with? Choose <em>Duel a bot</em>, pick a <strong>Bot skill</strong> (from gentle to sharp) and play right away. The bot answers after a realistic thinking time.</p>
<p>The duel waits if a player goes quiet: after 20 seconds the other player sees that their opponent has dropped out, and after about 45 seconds the duel is won by default. Choose <em>Leave duel</em> if you want to quit, but remember that <strong>leaving a duel that is under way gives your opponent the win</strong>; the Hub asks you to confirm first.</p>

<h3>Knockout bracket</h3>
<p>At some events the host switches a live game into a <strong>bracket</strong>. Players are paired off at random; if the number is odd, one player gets a computer opponent so nobody sits out. Each pair is scored only against each other, the winners move on, and a bracket that fills in live is shown on the big screen. The last player standing is the champion, and the podium shows the champion, the runner-up and the semi-finalists.</p>

<h2>Champions and ratings</h2>
<p>Finished battles between two real players feed the <strong>Champions</strong> list on the battle page: the best players <strong>this week</strong> and <strong>all time</strong>, shown with character and nickname only. Everyone starts at a rating of <strong>1000</strong>; beating a stronger player earns more than beating a weaker one. Computer players are never ranked.</p>
${note('Your record follows <strong>your device</strong>, not an account. Clearing your browser history starts a new record, and the page says so. A battle against a bot, or against yourself, never counts.')}

<h2>Fair play and privacy</h2>
${bullets([
  '<strong>The server is the referee.</strong> Your phone never receives the right answer early and never decides a score.',
  '<strong>No personal data.</strong> Only a nickname, a character and your scores are stored. No email, no real name and no location.',
  '<strong>Keep it clean.</strong> Offensive nicknames are blocked and the host can remove anyone.',
  '<strong>Connection problems</strong> show <em>Connection problem. Trying again…</em> and the game carries on when your signal returns.',
])}
${qa('I typed the wrong code.', 'Check the six digits on the big screen. A code only works while its game is open, so a finished or expired game will not accept it.')}
${qa('The game says it is full or locked.', 'The host set a player limit or locked the lobby. Ask the host, or ask them to start another game.')}
${qa('My answer did not count.', 'Answers that arrive after the timer ends (plus a short grace period) are refused. Make sure you tap before time runs out.')}
${qa('Can I challenge someone who is not nearby?', 'Yes. A <em>Challenge a friend</em> link can be sent to anyone and played any time in the next 7 days.')}
`,
}

export const adminQuizChapter = {
  id: 'admin-quizzes',
  part: PART_5,
  admin: true,
  num: 22,
  title: 'Running Live Quizzes',
  intro: 'Build a quiz, style it, host it on a projector, turn on practice and battles, and read the results.',
  inThis: ['The Live Quiz page', 'Building a quiz', 'Importing and exporting', 'The Design Studio', 'Hosting a game', 'Test bots', 'Practice and battles', 'Reports and rankings'],
  html: `
<h2 class="first">The Live Quiz page</h2>
<p><span class="path">Admin → Live Quiz</span> (under <em>Engagement</em>) lists every quiz with its question count and small badges such as <em>Practice on</em> and <em>Battles on</em>. Across the top are <span class="btn">New quiz</span>, <span class="btn ghost">Import from spreadsheet</span> and <span class="btn ghost">Battles</span>. Beneath the list, <em>Recent games</em> shows the games you have hosted, each with a <strong>Report</strong> link.</p>
<p>Each quiz has these buttons:</p>
${table(['Button', 'What it does'], [
  ['<strong>Host</strong>', 'Starts a live game of this quiz (see below). Disabled until the quiz has at least one question.'],
  ['<strong>Edit</strong>', 'Opens the question editor.'],
  ['<strong>Design</strong>', 'Opens the Design Studio for this quiz.'],
  ['<strong>Duplicate</strong>', 'Makes a copy called &ldquo;Copy of &hellip;&rdquo; with all its questions, then opens it.'],
  ['<strong>Export</strong>', 'Downloads the quiz as a spreadsheet (CSV), useful as a backup.'],
  ['<strong>Copy practice link</strong>', 'Appears when practice is on. Copies the link to share with students.'],
  ['<strong>Archive / Restore</strong>', 'Hides a finished quiz from the main list without deleting it.'],
  ['<strong>Delete</strong>', 'Removes the quiz for good.'],
])}
<p>A <strong>search box</strong> and <strong>tag chips</strong> help you find a quiz when you have many.</p>

<h2>Building a quiz</h2>
${steps([
  'Choose <span class="btn">New quiz</span> and type a <em>Quiz title</em>. Add optional <em>Tags</em>, separated by commas (for example <em>freshers, revision</em>).',
  'Set <em>Max players</em>, the default limit for games of this quiz. You can change it each time you host.',
  'Add questions. Pick the <em>Type of the next question</em> first, then add it. Type the <em>Question</em>, fill in the answers, and <strong>tick the circle</strong> next to the correct one.',
  'Set each question&rsquo;s <strong>time limit</strong> and <strong>points</strong> and, if you like, a <strong>difficulty</strong> (this helps the test bots behave realistically).',
  'Choose save. You will see &ldquo;Quiz saved.&rdquo;',
])}
<h3>Question types</h3>
${table(['Type', 'How to set it up'], [
  ['Multiple choice', 'Two to four answers; leave a box empty for fewer than four.'],
  ['True or false', 'The two answers are filled in for you; choose which is correct.'],
  ['Number answer', 'Enter the <em>Correct answer</em> and an <em>Allowed margin (plus or minus)</em>. Put units in the question, not the answer.'],
  ['Typed answer', 'List the <em>Accepted answers</em>, one per line, up to 8. Capital letters, accents, punctuation and extra spaces are ignored when matching.'],
  ['Poll (no score)', 'Two to four options and no correct answer. Good for opinions; it never changes anyone&rsquo;s score or streak.'],
])}
<h3>Pictures, maths and double points</h3>
${bullets([
  '<strong>Add a picture</strong>: choose a file, drag one in, or paste it (JPG, PNG or WebP). It is shrunk for phones. You must <strong>describe the picture</strong> in the alt-text box so that everyone can follow the question. Use <em>Replace</em> or <em>Remove picture</em> to change it.',
  '<strong>Maths</strong>: wrap a formula in dollar signs, for example <code>Solve $x^2$</code>. A live <em>Preview</em> shows how it will look.',
  '<strong>Double points round</strong>: switch it on for a question to make it worth twice as much, with a banner for players.',
])}
<h3>Game extras and battle options</h3>
<p>At the bottom of the editor, <strong>Game extras</strong> switches the fun rules on or off for the whole quiz: <em>Streak bonus</em>, <em>Power-ups</em> (Double down and 50/50) and <em>Comeback boost</em>. Keep them off for a serious quiz.</p>
<p><strong>Practice mode</strong> has an <em>Open for practice</em> switch, and <strong>Battle mode</strong> has an <em>Open for battles</em> switch. Both are <strong>off by default</strong> for every quiz, so you decide which quizzes students may replay or duel on. Switching one off ends access immediately.</p>
${tip('To reuse questions, choose <em>Add questions from other quizzes</em>, search, tick the ones you want and add them. You do not have to retype.')}

<h2>Importing and exporting</h2>
<p><span class="btn ghost">Import from spreadsheet</span> accepts a <strong>.csv file</strong> (up to 1 MB) or text pasted straight from Excel or Google Sheets. A preview table shows every question and highlights problems by line number; <strong>nothing is saved until you confirm</strong>. Each row is one question: type, question, options A to D, the correct answer (a letter, or the number or accepted answers for typed questions), seconds and points. A quiz can have up to 200 questions. Use <em>Export</em> first to see a correctly formatted example.</p>

<h2>The Design Studio</h2>
<p>Choose <strong>Design</strong> on a quiz to style how its games look. The studio shows a live preview (a projector on one side and a phone on the other) and is split into sections:</p>
${table(['Section', 'What you can set'], [
  ['Colour scheme and accent colour', 'The overall palette, or your own custom accent colour.'],
  ['Backdrop', 'A faint pattern behind the content.'],
  ['Celebration', 'The falling shapes on the podium: maths symbols, stars, petals or none.'],
  ['Event message', 'An optional headline and tagline for your event.'],
  ['Logo and sponsors', 'Upload an event logo (or keep <em>Use the NAMMES mark</em>) and up to six sponsor logos. Sponsors appear only on the big screen, never on phones.'],
  ['Sound', 'Lobby and question music (off, chill or hype) and sound effects. Use <em>Hear the ticking</em> and <em>Hear a right answer</em> to test.'],
  ['Characters (50)', 'A gallery of all 50 characters in every mood.'],
])}
<p>Choose <span class="btn">Save look</span>. The look applies to <strong>new games</strong> only; a game already running keeps the look it started with.</p>

<h2>Hosting a game</h2>
${steps([
  'On the Live Quiz page choose <strong>Host</strong> on the quiz. In the <em>Host game</em> box set <em>Max players</em> (the default is 50) and, if you want teams, switch on <em>Play in teams</em> and pick a preset (such as levels or colours) or type your own team names (2 to 8), and choose <em>average</em> or <em>total</em> scoring.',
  'Confirm. The <strong>projector screen</strong> opens with the six-digit code, a QR code and the live player list. Put this window on the projector.',
  'Wait for players to arrive. When ready, press <strong>Start</strong>. (If the lobby fills up, it starts on its own after a short countdown.)',
  'For each question: the question and countdown show. When time ends, or everyone has answered, the answer distribution and right answer appear. Press <strong>Next</strong> for the leaderboard and again for the next question.',
  'After the last question the <strong>podium</strong> and final results appear. You can <em>Download results (CSV)</em> right there.',
])}
<h3>Host controls</h3>
${table(['Control', 'What it does'], [
  ['<strong>Lock lobby</strong> / Unlock', 'Stops new players joining without starting the game.'],
  ['Open a player&rsquo;s menu in the lobby', 'Choose <em>Rename to &ldquo;Player ###&rdquo;</em> for an unsuitable nickname, <em>Kick</em> to remove someone (they see a message), or <em>Kick and block</em> to also stop that nickname rejoining.'],
  ['<strong>Pause</strong> (P)', 'Freezes the clock on every screen. Nobody loses time.'],
  ['<strong>+10 s</strong> (+)', 'Adds ten seconds to the running question, up to a minute in total.'],
  ['<strong>End question</strong> (Space)', 'Closes the question early.'],
  ['<strong>Skip question</strong>', 'Discards it: no points and no change to streaks. It asks &ldquo;Sure? Skip it&rdquo; first.'],
  ['Mute and volume', 'A speaker button on the projector screen.'],
])}
${note('Keyboard shortcuts on the projector screen: <strong>Space</strong> ends the question, <strong>P</strong> pauses, <strong>+</strong> adds time, <strong>M</strong> mutes.')}
${warn('Turn the projector sound on with one click when the page opens, because browsers block audio until you interact with the page. And test the venue Wi-Fi before the event: a weak connection is the most common thing that goes wrong.')}
<p>If you close the host tab by accident, open the game again from <em>Recent games</em> on the Live Quiz page. The game picks up where it was. Any admin can continue any game.</p>

<h2>Test bots</h2>
<p>In the lobby, <strong>Test bots</strong> adds computer players so that you can rehearse, or fill a small room. Choose a <em>quick amount</em> and a skill: gentle bots are right about 65% of easy questions, sharp bots about 97%, and <em>Mixed crowd</em> blends them. Bots only answer <strong>while the host page is open</strong>, and they are counted in the results, so use them for rehearsals, not for real events.</p>

<h2>Practice and battles</h2>
<p>Switch on <em>Open for practice</em> and students can replay the quiz at <span class="path">/practice/&hellip;</span> (use <em>Copy practice link</em>). Switch on <em>Open for battles</em> and it appears on the battle page for challenges and duels.</p>
<p>In the host lobby a <strong>Bracket</strong> button turns the game into a knockout: choose the match length (<em>1 question</em>, or <em>Best of 3</em> or <em>5 questions</em>) and the skill of the bot that fills an odd place. The big screen then shows the bracket live. Teams and brackets cannot be combined.</p>
<p>Choose <span class="btn ghost">Battles</span> on the Live Quiz page to see two lists:</p>
${bullets([
  '<strong>Ranking</strong>: the rated players. Choose <em>Remove</em> to take one player off (for example a rude nickname), or <em>Reset ranking</em> to clear <strong>everyone&rsquo;s rating</strong>.',
  '<strong>Recent battles</strong>: the latest duels and challenges, with a <em>Cancel</em> button for an open one.',
])}
${adminBox('<p><em>Reset ranking</em> cannot be undone. It asks you to confirm (<em>Yes, reset</em>). Do it at the start of a new session, not in the middle of a competition.</p>')}

<h2>Reports</h2>
<p>When a game ends, choose <strong>Report</strong> on it (under <em>Recent games</em>) to see how it went:</p>
${bullets([
  '<strong>Summary cards</strong>: players, average score, average accuracy, average response time and how many stayed to the end.',
  '<strong>Question by question</strong>: accuracy, average time, number who answered and the spread of answers, with the hardest and easiest questions called out.',
  '<strong>Players</strong>: a sortable table of rank, nickname, score and accuracy. Team games also show team standings.',
  '<strong>Knockout bracket</strong>: who beat whom, for bracket games.',
  '<span class="btn ghost">Export CSV</span> and <span class="btn ghost">Print / Save as PDF</span> for the department&rsquo;s records.',
])}
<p>A report can be deleted; this removes the game, its players and all their answers for good. Nicknames on a report are whatever players typed, so handle the file with the same care as any attendance list.</p>
${adminBox('<p>Reports, rankings and the Live Quiz page are visible to <strong>admins only</strong>. Players never see other people&rsquo;s answers, and there is no public results link.</p>')}
`,
}
