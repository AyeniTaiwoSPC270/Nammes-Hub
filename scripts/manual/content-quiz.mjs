import { tip, note, warn, adminBox, glance, steps, bullets, table, pills, shot, qa } from './helpers.mjs'

const PART_3 = 'Part Three · Community'
const PART_5 = 'Part Five · Admin Guide'

// Two chapters about the live quiz: the member one (Part Three) and the admin one (Part Five).
// They are spliced into the book by content-community.mjs and content-admin.mjs, so the numbers below follow that order.

export const quizChapter = {
  id: 'quizzes',
  part: PART_3,
  num: 16,
  title: 'Live Quizzes and Battles',
  intro: 'Join an event quiz from your phone, practise on your own, or challenge a friend to a head-to-head battle.',
  inThis: ['Picking a quiz to play', 'Joining a live game', 'Playing a question on your phone', 'Teams, streaks and power-ups', 'Practice mode, and quitting', 'Battles: challenge, duel and bracket', 'Result cards you can share', 'Champions, fair play and privacy'],
  html: `
<h2 class="first">Where the quizzes are</h2>
<p>Everything to do with quizzes now lives under one menu, <strong>Practice</strong>, with two pages: <strong>Quizzes and battles</strong> and <strong>CBT practice</strong>. There is no separate link for a live game, for practice or for battles.</p>
${shot('quiz-hub', 'The Practice hub. One card for quizzes and battles, one for CBT practice, one for making your own.', { url: '/quiz' })}
${glance([['Address', 'nammeshub.com.ng/quiz'], ['Sign-in needed?', 'No'], ['Who it is for', 'Everyone, with just a phone'], ['Best for', 'Events, revision and friendly rivalry']])}
<p>From the hub you can join a live game, pick a quiz to practise, or build a quiz from your own questions.</p>
${table(['Mode', 'What it is', 'Needs a host?', 'Where'], [
  ['<strong>Live game</strong>', 'An executive shows the questions on a big screen. Everyone answers on their phone at the same time and a leaderboard builds up.', 'Yes (an executive)', '<span class="path">/play</span>'],
  ['<strong>Practice</strong>', 'Replay a quiz on your own, one question at a time, with instant feedback. Good for revision.', 'No', 'From the hub, or a link the executives share'],
  ['<strong>Battle</strong>', 'Take on one other person (or a computer player), or be paired off against others in a knockout.', 'Not for duels', '<span class="path">/battle</span>'],
  ['<strong>CBT exam</strong>', 'A timed paper with a pass mark, answered only at the end.', 'No', 'Chapter 17'],
])}

<h2>Joining a live game</h2>
<p>At an event the host shows a <strong>lobby screen</strong> with a <strong>six-digit game code</strong>, a <strong>QR code</strong> and the list of players who have arrived.</p>
${shot('quiz-lobby', 'The host\'s lobby: the six-digit code, a QR code to scan, and the players who have joined.', { url: '/host/…' })}
${steps([
  'Scan the QR code with your phone camera, <strong>or</strong> open <strong>Practice &rarr; Quizzes and battles</strong> and type the code under <em>Game code</em>.',
  'Type a <strong>nickname</strong>. Keep it friendly: rude words are blocked, and the host can remove or rename anyone.',
  'Pick one of <strong>50 animated characters</strong>. Each has its own dance for a right answer and its own sad move for a wrong one.',
  'If the game is played in teams, pick your <strong>team</strong> or choose <em>Put me anywhere</em> and the Hub balances the teams for you.',
  'You land on a <strong>You&rsquo;re in</strong> screen. Look for your name on the big screen and wait for the host to start.',
])}
${note('Every game has a <strong>player limit</strong> set by the host. When the lobby fills up, a short countdown starts and the game begins by itself (<em>Lobby full!</em>). If the host has <strong>locked the lobby</strong>, nobody new can join.')}
${warn('Join before the first question opens. Once a game has started you cannot slip in late, and the host can remove players who break the rules.')}

<h2>Playing a question</h2>
<p>Your phone carries the question, the countdown, your power-ups and the answer buttons &mdash; everything you need without looking up. The projector carries the same question larger, for everyone who is watching rather than playing.</p>
${shot('quiz-projector', 'The projector during a question: the same question, larger, with the countdown and the answer shapes.', { url: '/host/…' })}
${shot('quiz-phone', 'Your phone during the same question. The question text, your timer and the answers are all here.', { phone: true })}
<p>After you answer, your phone says <em>Answer locked in</em>. You cannot change it, and it does not say whether you were right until the reveal.</p>
<p>Some questions carry a <strong>picture</strong> &mdash; tap it to enlarge &mdash; and some use maths such as x&sup2;. Tap a single option on most questions. Some ask for something different:</p>
${table(['Question type', 'What you do'], [
  ['Multiple choice', 'Tap one of two to four coloured shapes.'],
  ['True or false', 'Tap <em>True</em> or <em>False</em>.'],
  ['Number answer', 'Type just the number, with no units. A small margin of error may be allowed.'],
  ['Typed answer', 'Type a short answer. Spelling counts, capital letters do not.'],
  ['Poll', 'Vote for your opinion. A poll has no right answer and gives no points.'],
])}
<div class="phases">
  <div class="ph">1 · Question<small>Tap your answer</small></div>
  <div class="ph">2 · Reveal<small>Right answer shown</small></div>
  <div class="ph">3 · Leaderboard<small>Top players</small></div>
  <div class="ph">4 · Next question<small>Repeat</small></div>
  <div class="ph">5 · Podium<small>Final results</small></div>
</div>

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
<p>Practice is for revision: no host, no crowd, no pressure. Open <strong>Practice &rarr; Quizzes and battles</strong> and choose <strong>Pick a quiz</strong> to see every quiz the executives have opened for practice. If the executives send you a direct link of the form <span class="path">/practice/&hellip;</span>, it takes you straight there instead.</p>
${shot('practice', 'Pick a quiz to practise: one card per open quiz, each with its question count.', { url: '/practice' })}
${steps([
  'Open the practice link, or pick a quiz from the list, then type a <strong>nickname</strong> and pick a character.',
  'Choose <span class="btn">Start practising</span>. Questions arrive <strong>one at a time</strong>, at your own pace.',
  'After each answer you see straight away whether you were right, the correct answer and your points.',
  'At the end you get your score, accuracy and the <em>Practice top 10 (just for fun)</em>. Choose <span class="btn">Try again</span> to go again.',
])}
<p>You can also <strong>race</strong> while you practise. Pick <em>Play against</em> and choose four computer players, or <em>Race past players</em> to compete against the saved results of people who practised before. A race bar shows who is ahead after each question.</p>
${note('The practice top 10 is labelled <em>just for fun</em> because instant feedback lets you learn the answers by replaying. It is kept separate from live game results.')}
<h3>Stopping part way</h3>
<p>Changed your mind halfway? There is a <strong>Quit practice</strong> button at the bottom of the run. Tap it once and it asks you to confirm &mdash; <em>Tap again to quit. This run will not be saved.</em> &mdash; and a second tap ends the run and returns you to the start.</p>
${note('The warning is literal. An unfinished run is left out of the practice leaderboard and cannot be raced as a ghost, so quitting costs you nothing and changes nothing for anyone else.')}

<h2>Battles</h2>
<p>A <strong>battle</strong> is a head-to-head. Open <strong>Practice &rarr; Quizzes and battles</strong>, pick a quiz that has battles switched on, choose a nickname and a character, then choose one of these:</p>

<h3>Challenge a friend</h3>
<p>You and your friend play the <strong>same questions at different times</strong>.</p>
${steps([
  'Choose <em>Challenge a friend</em>. Answer the set of questions the quiz chose for battles.',
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

<h2>Your result card</h2>
<p>Finished a game, a practice run or a duel? You can turn the result into a <strong>card</strong>: a tall picture, built for a phone, with your character and your numbers on it.</p>
${shot('quiz-host-results', 'The final results, with the character you picked and the top three on the podium.', { url: '/play' })}
${steps([
  'On the finished screen, choose <strong>Share my result</strong>. On a duel it reads <strong>Share this duel</strong>.',
  'The card appears in a window captioned <em>Your result card</em>. Close it with the red cross or <strong>Esc</strong>.',
  'Choose <span class="btn">Share</span> to send it through your phone\'s own share sheet &mdash; WhatsApp, Instagram, X, wherever you like &mdash; or <span class="btn ghost">Save</span> to keep the picture on your device.',
])}
${shot('result-card-modal', 'The card, with Share and Save beneath it.', { url: '/play' })}
${shot('result-card', 'The finished card: character, podium, rank and score, sized for a phone.', { url: '/play' })}
${note('A card from a <strong>hosted game</strong> carries your rank and the line <em>placed 3 of 42</em>. A practice run has no rank, because there is nobody to be ranked against, so that line is simply left out.')}
${qa('There is no Share my result button.', 'Two things cause this. Either the game finished before share links existed, in which case the button is hidden rather than shown and then failing; or you are looking at a screen that has no card, such as the practice <em>Try again</em> page.')}

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
  num: 24,
  title: 'Running Live Quizzes',
  intro: 'Build a quiz, style it, host it on a projector, turn on practice and battles, and read the results.',
  inThis: ['The Live Quiz page', 'Building a quiz', 'Question banks: how long a game is', 'Importing and exporting', 'The Design Studio', 'Backdrops and result cards', 'Hosting a game', 'Ending or deleting a game', 'Test bots', 'Practice and battles', 'Reports and rankings'],
  html: `
<h2 class="first">The Live Quiz page</h2>
${shot('admin-quizzes', 'The Live Quiz page: every quiz with its question count, badges and buttons.', { url: '/admin/quizzes' })}
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

<h2>The question bank</h2>
${shot('admin-quiz-edit', 'The question editor. The Question bank panel sits between Game extras and Practice mode.', { url: '/admin/quizzes/…/edit' })}
<p>Every question in a quiz is the <strong>bank</strong>. Just below <em>Game extras</em>, the <strong>Question bank</strong> panel decides how much of it a game actually asks.</p>
${table(['Setting', 'What it does'], [
  ['<strong>Questions to ask</strong>', 'Leave it blank and every question is asked, in the order you wrote them. Set a number and each game draws a different mix from the bank.'],
  ['<strong>Questions per battle</strong>', 'Only appears once <em>Questions to ask</em> has a number. A battle is two people at their own pace, so it is usually shorter. Leave it blank to use the same number as the game.'],
  ['<strong>Shuffle the questions</strong>', 'Players get a different mix each time, so nobody can memorise question 3.'],
  ['<strong>Shuffle the answers</strong>', 'The options to each question move around, so position stops giving the answer away. Questions such as <em>All of the above</em> are never shuffled, because shuffling them would break them.'],
])}
<p>A live line underneath confirms the result in plain words: <em>This game will ask 15 of 30 questions. A battle will ask 10.</em></p>
${note('These same settings govern <strong>live games, battles and practice</strong>, so you learn them once. A game <strong>freezes its draw when it starts</strong>, so editing the quiz halfway through an event cannot change how many questions are left.')}
${adminBox('<p>A quiz with no bank settings keeps behaving exactly as it did before: every question, in order, with its answers as written. Nothing changes until an admin asks for it.</p>')}
${warn('A knockout bracket needs enough questions to knock everyone down to one. The lobby only offers match lengths that the bank can actually finish, so raising the draw count can shorten the list of choices.')}

<h2>Importing and exporting</h2>
<p><span class="btn ghost">Import from spreadsheet</span> accepts a <strong>.csv file</strong> (up to 1 MB) or text pasted straight from Excel or Google Sheets. A preview table shows every question and highlights problems by line number; <strong>nothing is saved until you confirm</strong>. Each row is one question: type, question, options A to D, the correct answer (a letter, or the number or accepted answers for typed questions), seconds and points. A quiz can have up to 200 questions. Use <em>Export</em> first to see a correctly formatted example.</p>

<h2>The Design Studio</h2>
${shot('admin-quiz-studio', 'The Design Studio, with its four tabs and a live projector preview beside the controls.', { url: '/admin/quizzes/…/studio' })}
<p>Choose <strong>Design</strong> on a quiz to style how its games look. The studio shows a live preview (a projector on one side and a phone on the other) and is split into four tabs: <strong>Look &amp; feel</strong>, <strong>Sound</strong>, <strong>Characters (50)</strong> and <strong>Result card</strong>. Inside <em>Look &amp; feel</em>:</p>
${table(['Section', 'What you can set'], [
  ['Colour scheme and accent colour', 'The overall palette, or your own custom accent colour.'],
  ['Celebration', 'The falling shapes on the podium: maths symbols, stars, petals or none.'],
  ['Event message', 'An optional headline and tagline for your event.'],
  ['Logo and sponsors', 'Upload an event logo (or keep <em>Use the NAMMES mark</em>) and up to six sponsor logos. Sponsors appear only on the big screen, never on phones.'],
  ['Sound', 'Lobby and question music (off, chill, hype, afrobeat, disco, cinematic or a track you imported) and sound effects, each of which can be switched off on its own.'],
  ['Characters (50)', 'A gallery of all 50 characters in every mood.'],
  ['Result card', 'How the shareable result picture looks. See below.'],
])}
<h3>The backdrop</h3>
<p>The <strong>Backdrop</strong> is the pattern behind the content. It is there to stop a big screen reading as a flat wall of colour, and it is deliberately faint so text stays legible. Choose a pattern &mdash; <em>My image</em>, <em>Maths symbols</em>, <em>Dots</em>, <em>Grid</em>, <em>Waves</em>, <em>Sparkles</em> or <em>Plain</em> &mdash; then set it with four controls:</p>
${table(['Control', 'What it does'], [
  ['<strong>Strength</strong>', 'How present the pattern is, 0 to 100%. The default is 8%, which is visible on a projector without competing with the text.'],
  ['<strong>Size</strong> or <strong>Zoom</strong>', 'How large the pattern repeats, or how far into your picture it zooms. The label follows your choice: <em>Size</em> for a pattern, <em>Zoom</em> for an uploaded image.'],
  ['<strong>Blur</strong>', 'Softens it, 0 to 24px. Useful for a photograph behind text.'],
  ['<strong>Fade back</strong>', 'Images only. Fades the picture towards the page colour, 0 to 90%.'],
])}
<p>Choosing <em>My image</em> reveals <strong>Upload a picture</strong> and a <strong>Fit</strong> choice: <em>Fill the screen</em>, <em>Whole picture</em> or <em>Stretch to fill</em>, each with a plain-English line saying what it does.</p>
${note('<em>Size</em>, <em>Blur</em> and <em>Fade back</em> all disappear when the pattern is <strong>Plain</strong>, because they would have nothing to act on.')}
${adminBox('<p>An uploaded backdrop picture shows on the <strong>projector only</strong>. It is never sent to players&rsquo; phones, so a large photograph costs nobody&rsquo;s data. Choosing <em>My image</em> and then removing the picture falls back to <em>Plain</em> rather than leaving a broken frame.</p>')}

<h3>The sound lab</h3>
<p>The music is generated in the browser rather than played from a recording, so the only honest way to choose a loop is to hear it. Open the <strong>Sound</strong> tab: press <em>Play</em> on any card to hear that loop for twelve seconds (one at a time, and it stops by itself), then <em>Use this</em> to pick it. Below that, every sound effect has a button of its own, grouped by when the game plays it: countdown ticks, a drum roll the answer lands on, a cheer, and the board settling. Press <span class="btn ghost">Stop the music</span> first if you want to hear an effect on its own.</p>
${note('The music plays in the lobby and during questions, quieter during questions so you can be heard, and stops for the reveal, the leaderboard and the end. <strong>Turn the projector sound on with one click</strong> when the host screen opens, because browsers block audio until you interact with the page.')}
<h3>Switching a sound off</h3>
<p>Every sound effect has a switch of its own beside its <em>Play</em> button. Anything you switch off is silent for the whole game, on the projector and on players&rsquo; phones alike, and the setting is saved with the quiz, so it follows the quiz to whichever computer you host from. <em>Play</em> still makes a sound for a switched-off effect, so you can always hear what you have just turned off. The music choice is separate and always applies.</p>
${note('Switching off <em>Drum roll</em> also removes the pause before the answer appears, so the answer goes up straight away instead of waiting for a beat that will never arrive.')}
<h3>Your own music and sound effects</h3>
<p><em>Your own audio</em> lets you import a background track and your own sound effects. Nothing is uploaded: each clip is kept in the browser on the computer you imported it on. Once a clip is imported you can play it, use it in place of a built-in sound effect from the list beside that effect, or pick it as the <em>My music</em> card for the background.</p>
${steps([
  'Press <span class="btn">Import music</span> or <span class="btn">Import sound effects</span> and choose a file. MP3, OGG, WAV and M4A all work.',
  'Play it to check it, then use it: choose a track on the <em>My music</em> card, or pick your clip from the list under a sound effect.',
  'Press <em>Delete</em> on a clip to take it off this computer. A quiz that used it falls back to the built-in sound.',
])}
${warn('Clips stay in the browser that imported them. Nothing is uploaded and no other computer gets them, so a quiz that uses one plays the built-in sounds anywhere else. Clearing this browser&rsquo;s site data deletes them for good, and a browser can still throw stored files away when a device runs out of space. Host from the computer you imported on.')}
${note('Limits: music up to 15 MB and 8 minutes, a sound effect up to 1 MB and 10 seconds, and up to 40 clips in 100 MB altogether. A clip is measured before it is stored, so a file the browser cannot play is refused rather than saved to be discovered mid-game. An imported drum roll decides how long the answer is held back, so trim yours to end on the hit. Only import audio you have the right to play.')}

<h3>The result card</h3>
${shot('admin-card-tab', 'The Result card tab. It saves separately from the rest of the look.', { url: '/admin/quizzes/…/studio' })}
<p>The <strong>Result card</strong> tab sets the picture players get at the end of a game. It has its own <strong>Save card</strong> and <strong>Reset card</strong>, so a card change never leaves the rest of the look looking unsaved.</p>
${bullets([
  '<strong>Card accent</strong>: <em>Use the look\'s accent</em> keeps the card in step with the quiz, or <em>Custom</em> gives it a colour of its own.',
  '<strong>Card background</strong>: upload, replace or remove a picture. With no picture the card uses the same maths pattern as the screens.',
  '<strong>What the card shows</strong>: six switches for <em>The cartoon character</em>, <em>The quiz title</em>, <em>Rank and "placed 3 of 42"</em>, <em>Correct answers</em>, <em>Best streak</em> and <em>Team name</em>.',
])}
<p>Beside the controls is a live <strong>Result card preview</strong>, drawn by the same server that draws the real card but with made-up numbers, so you can check the look without hosting a game.</p>
${note('Card settings are copied into each game when it starts, exactly like the theme. Editing the card never restyles a game that is already running, and never rewrites a card a player has already been given.')}

<p>Choose <span class="btn">Save look</span>. The look applies to <strong>new games</strong> only; a game already running keeps the look it started with.</p>

<h2>Hosting a game</h2>
${steps([
  'On the Live Quiz page choose <strong>Host</strong> on the quiz. In the <em>Host game</em> box set <em>Max players</em> (the default is 50) and, if you want teams, switch on <em>Play in teams</em> and pick a preset (such as levels or colours) or type your own team names (2 to 8), and choose <em>average</em> or <em>total</em> scoring.',
  'Confirm. The <strong>projector screen</strong> opens with the six-digit code, a QR code and the live player list. Put this window on the projector.',
  'Wait for players to arrive. When ready, press <strong>Start</strong>. (If the lobby fills up, it starts on its own after a short countdown.)',
  'For each question: the question and countdown show. When time ends, or everyone has answered, the answer distribution and right answer appear. Press <strong>Next</strong> for the leaderboard and again for the next question.',
  'After the last question the <strong>podium</strong> and final results appear. You can <em>Download results (CSV)</em> and open a <strong>Result card</strong> right there.',
])}
<h3>Host controls</h3>
${table(['Control', 'What it does'], [
  ['<strong>Lock lobby</strong> / Unlock', 'Stops new players joining without starting the game.'],
  ['Open a player&rsquo;s menu in the lobby', 'Choose <em>Rename to &ldquo;Player ###&rdquo;</em> for an unsuitable nickname, <em>Kick</em> to remove someone (they see a message), or <em>Kick and block</em> to also stop that nickname rejoining.'],
  ['<strong>Pause</strong> (P)', 'Freezes the clock on every screen. Nobody loses time.'],
  ['<strong>+10 s</strong> (+)', 'Adds ten seconds to the running question, up to a minute in total.'],
  ['<strong>End question</strong> (Space)', 'Closes the question early.'],
  ['<strong>Skip question</strong>', 'Discards it: no points and no change to streaks. It asks &ldquo;Sure? Skip it&rdquo; first.'],
  ['<strong>Game menu</strong> (the ⋮ button)', 'Ends or deletes the game. See below.'],
  ['<strong>Result card</strong>', 'On the final screen, opens the board card for this game so you can check it before players start sharing.'],
  ['Mute and volume', 'A speaker button on the projector screen.'],
])}
<h3>Ending or deleting a game</h3>
<p>The <strong>Game menu</strong>, behind the round <strong>⋮</strong> button in the corner of every host screen, holds two things that are worth knowing before you need them.</p>
${table(['Item', 'What it does'], [
  ['<strong>End game now</strong>', 'Stops the game where it stands. Everyone still playing sees the final results, and the report keeps everything that was played. It is hidden when the game is in a state where ending would make no sense.'],
  ['<strong>Delete this game</strong>', 'Removes the game and everything recorded for it. While still in the lobby the item reads <em>Cancel and delete this game</em>, because nothing has been played yet.'],
])}
<p>Both ask you to confirm first: <em>Yes, end it</em> or <em>Yes, delete</em>. The same two options sit on each row of <em>Recent games</em> on the Live Quiz page, and <em>Show all</em> / <em>Show fewer</em> reaches back through older games.</p>
${note('<strong>Ending keeps the report. Deleting does not.</strong> If you hosted a real event and want the results on file, end the game rather than deleting it. Deleting a finished game also removes the CSV you would otherwise have exported.')}
<h3>What the game plays by itself</h3>
<p>With sound effects switched on, the projector plays a ping each time a player joins the lobby, and a tick in the last five seconds of a question (faster in the last two). When time runs out there is a horn and a short drum roll: the right answer, the vote counts and how many people got it right are all held back until the last beat of the roll, then a happy or sad sting plays depending on how many got it right. A round most people got right also gets a cheer. The leaderboard chimes once per row that climbed, and the podium gets a fanfare and a cheer. Switch effects off and everything appears straight away with no sound, exactly as before. Nothing communicates anything on its own: every answer, score and result is on the screen as well.</p>
${note('Keyboard shortcuts on the projector screen: <strong>Space</strong> ends the question, <strong>P</strong> pauses, <strong>L</strong> locks or unlocks the lobby and <strong>+</strong> adds time.')}
${warn('Turn the projector sound on with one click when the page opens, because browsers block audio until you interact with the page. And test the venue Wi-Fi before the event: a weak connection is the most common thing that goes wrong.')}
<p>If you close the host tab by accident, open the game again from <em>Recent games</em> on the Live Quiz page. The game picks up where it was. Any admin can continue any game.</p>

<h2>Test bots</h2>
<p>In the lobby, <strong>Test bots</strong> adds computer players so that you can rehearse, or fill a small room. Choose a <em>quick amount</em> and a skill: gentle bots are right about 65% of easy questions, sharp bots about 97%, and <em>Mixed crowd</em> blends them. Bots only answer <strong>while the host page is open</strong>, and they are counted in the results, so use them for rehearsals, not for real events.</p>

<h2>Practice and battles</h2>
<p>Switch on <em>Open for practice</em> and students can replay the quiz at <span class="path">/practice/&hellip;</span> (use <em>Copy practice link</em>). Switch on <em>Open for battles</em> and it appears on the battle page for challenges and duels.</p>
<p>In the host lobby a <strong>Bracket</strong> button turns the game into a knockout: choose the match length (<em>1 question</em>, or <em>Best of 3</em> or <em>5 questions</em>) and the skill of the bot that fills an odd place. The big screen then shows the bracket live. Teams and brackets cannot be combined.</p>
<p>Choose <span class="btn ghost">Battles</span> on the Live Quiz page to see two lists:</p>
${shot('admin-battles', 'The Battles screen: ranking, recent battles, and the community quizzes people have built themselves.', { url: '/admin/quizzes/battles' })}
${bullets([
  '<strong>Ranking</strong>: the rated players. Choose <em>Remove</em> to take one player off (for example a rude nickname), or <em>Reset ranking</em> to clear <strong>everyone&rsquo;s rating</strong>.',
  '<strong>Recent battles</strong>: the latest duels and challenges, with a <em>Cancel</em> button for an open one.',
  '<strong>Community quizzes</strong>: quizzes people have built from their own questions at <span class="path">/make</span>. They are deleted after 30 days, and <em>Remove</em> takes one off if it should not be there. They appear nowhere else on the public site.',
])}
${adminBox('<p><em>Reset ranking</em> cannot be undone. It asks you to confirm (<em>Yes, reset</em>). Do it at the start of a new session, not in the middle of a competition.</p>')}

<h2>Reports</h2>
<p>When a game ends, choose <strong>Report</strong> on it (under <em>Recent games</em>) to see how it went:</p>
${bullets([
  '<strong>Summary cards</strong>: players, average score, average accuracy, average response time and how many stayed to the end.',
  '<strong>Question by question</strong>: accuracy, average time, number who answered and the spread of answers, with the hardest and easiest questions called out.',
  '<strong>Players</strong>: a sortable table of rank, nickname, score and accuracy. Team games also show team standings.',
  '<strong>Knockout bracket</strong>: who beat whom, for bracket games.',
  '<strong>Result card</strong>: opens the board card for this game, drawn by the same server that draws the card players receive.',
  '<span class="btn ghost">Export CSV</span> and <span class="btn ghost">Print / Save as PDF</span> for the department&rsquo;s records.',
])}
${shot('result-card-modal', 'A result card opened from the host screen.', { url: '/admin/quizzes/games/…' })}
<p>A report can be deleted; this removes the game, its players and all their answers for good. Nicknames on a report are whatever players typed, so handle the file with the same care as any attendance list.</p>
${adminBox('<p>Reports, rankings and the Live Quiz page are visible to <strong>admins only</strong>. Players never see other people&rsquo;s answers, and there is no public results link.</p>')}

<h2>Publishing CBT practice exams</h2>
${shot('admin-cbt', 'CBT Exams. Courses at the top, each with its own list of papers.', { url: '/admin/cbt' })}
<p>Timed practice papers live behind their own Admin tile, <strong>CBT Exams</strong>, and are entirely separate from quizzes. The difference is that a CBT paper is built from a <strong>question bank</strong> and every attempt is clocked and scored against a pass mark, rather than being played live.</p>
${steps([
  '<strong>Add a course</strong>: pick a level, type the <strong>course code</strong> (such as <code>MTH 101</code>) and the course title, then <strong>Add course</strong>.',
  'Inside the course, name the paper and choose <strong>Add exam</strong>. A house title like <em>2024/2025 CBT EXAM</em> is a good pattern.',
  'Open the exam to set its settings: <strong>Title</strong>, <em>Session</em>, and <strong>How the paper is made</strong> &mdash; a <em>Random draw from the bank</em> so every attempt differs, or a <em>Fixed paper</em> that is identical each time.',
  'Set <strong>Questions per attempt</strong>, <strong>Time allowed (minutes)</strong> and <strong>Pass mark (%)</strong>. A live line confirms <em>Each attempt will have N questions.</em>',
  'Switches: <em>Shuffle the questions</em>, <em>Shuffle the answers</em>, <em>Show explanations in the review</em>, <em>Allow study mode (no timer)</em> and <em>Published</em>.',
  'Add questions to the <strong>Question bank</strong>, then <strong>Save settings</strong>.',
])}
${shot('admin-cbt-exam', 'An exam opened for editing: its settings, and the question bank below them.', { url: '/admin/cbt' })}
<h3>The question bank</h3>
${bullets([
  '<strong>Download as spreadsheet</strong> gives the column layout: <code>type, question, option_a, option_b, option_c, option_d, correct, seconds, points, explanation, topic, no_shuffle</code>. The <code>explanation</code> column is what students see in the review afterwards.',
  '<strong>Add questions from a spreadsheet</strong> accepts pasted text or an uploaded <strong>CSV</strong>. Choose <strong>Add these questions</strong> to append, or one of the <em>Replace</em> buttons to swap the whole bank out.',
  '<strong>Show questions</strong> / <strong>Hide questions</strong> collapses the list when it is long enough to be in the way.',
])}
${warn('An exam with no questions is hidden from students even when it is marked <em>Published</em>, and the screen says so. Add questions before you tell anyone the paper is ready.')}
<h3>How students are doing</h3>
<p>Under the same panel: <strong>Attempts</strong>, <strong>Average score</strong>, <strong>Pass rate</strong>, <strong>Average time</strong>, and <strong>Most missed questions</strong>. That last one is the valuable column &mdash; a question almost everybody misses is often a wrong answer key or a badly worded question rather than a class-wide misunderstanding, so it is the first thing to check.</p>
${note('Study-mode sessions are labelled in a student&rsquo;s history but are <strong>excluded</strong> from these statistics. A student who read the answers while learning should not drag the pass rate down for the rest of the class.')}
`,
}
