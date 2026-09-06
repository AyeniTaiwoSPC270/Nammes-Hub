import juice from 'juice'

export const SITE_URL = 'https://www.nammeshub.com.ng'

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function textToParagraphs(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br>')}</p>`)
    .join('\n')
}

const WORDMARK_LOGO = `<img src="${SITE_URL}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" />`

const SHARED_STYLE = `
*,*::before,*::after{box-sizing:border-box;}
body{margin:0;padding:48px 16px;background-color:#f6f3f2;font-family:'Public Sans',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#000904;-webkit-font-smoothing:antialiased;line-height:1.6;}
.email-container{max-width:600px;margin:0 auto;background-color:#ffffff;border:1px solid #c2c8c1;border-radius:8px;overflow:hidden;}
.wordmark{font-size:19px;font-weight:700;letter-spacing:-0.02em;text-decoration:none;color:#0b2417;}
.wordmark img{vertical-align:middle;margin-right:8px;}
.wordmark span{vertical-align:middle;}
.cta-container{margin:28px 0 12px 0;}
.cta-button{display:inline-block;background-color:#ae3200;color:#ffffff !important;font-size:15px;font-weight:600;text-decoration:none;padding:12px 28px;border-radius:9999px;letter-spacing:.01em;}
.email-footer{padding:24px 40px 32px 40px;background-color:#faf8f7;border-top:1px solid #ece8e4;font-size:12px;line-height:1.6;color:#6b6558;}
.footer-link{color:#6b6558;text-decoration:underline;}
@media (max-width:640px){body{padding:16px 8px;}.email-body{padding:28px 24px 32px 24px !important;}.email-footer{padding:20px 24px 28px 24px;}.cta-button{display:block;text-align:center;}}
`

export function renderWelcomeEmail({ fullName }) {
  const name = escapeHtml(fullName || 'there')
  return juice(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Welcome to NAMMES Hub</title>
<style>
${SHARED_STYLE}
.email-header{padding:36px 40px 24px 40px;border-bottom:1px solid #f0edea;}
.email-body{padding:36px 40px 40px 40px;}
.meta-tag{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#424843;margin-bottom:8px;}
.greeting{font-size:24px;font-weight:700;line-height:1.25;color:#0b2417;margin:0 0 16px 0;letter-spacing:-.015em;}
.paragraph{font-size:15px;line-height:1.65;color:#191813;margin:0 0 28px 0;}
.signoff{font-size:14px;color:#424843;margin:32px 0 0 0;padding-top:24px;border-top:1px solid #f0edea;}
.signoff-team{font-weight:600;color:#0b2417;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <a href="${SITE_URL}" class="wordmark">${WORDMARK_LOGO}<span>NAMMES Hub</span></a>
    </div>
    <div class="email-body">
      <div class="meta-tag">Membership Activation</div>
      <h1 class="greeting">Welcome to the hub, ${name}.</h1>
      <p class="paragraph">Welcome to <strong>NAMMES Hub</strong> — your official student departmental portal for the National Association of Metallurgical and Materials Engineering Students. Your account is now active, giving you access to lecture timetables, course outlines, past exam papers, and opportunity listings.</p>
      <div class="cta-container">
        <a href="${SITE_URL}" class="cta-button">Visit NAMMES Hub &rarr;</a>
      </div>
      <div class="signoff">Sincerely,<br><span class="signoff-team">The Aegis 2026/2027</span></div>
    </div>
    <div class="email-footer">
      <div>National Association of Metallurgical and Materials Engineering Students (NAMMES)</div>
      <div>Faculty of Engineering, University of Lagos</div>
      <div style="margin-top:8px;">You received this transactional email because you created an account on NAMMES Hub. <a href="${SITE_URL}/account" class="footer-link">Notification preferences</a></div>
    </div>
  </div>
</body>
</html>`)
}

export function renderNewContentEmail({ eyebrow, title, url, imageUrl }) {
  const safeEyebrow = escapeHtml(eyebrow)
  const safeTitle = escapeHtml(title)
  const imageHtml = imageUrl
    ? `<img src="${imageUrl}" alt="" width="520" class="content-image" />`
    : ''
  const postedAt = new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Africa/Lagos',
  }).format(new Date())
  return juice(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>New Update - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.email-header{padding:24px 40px 20px 40px;border-bottom:1px solid #f0edea;}
.header-time{font-family:'IBM Plex Mono',monospace;font-size:11px;color:#6b6558;}
.email-body{padding:36px 40px 40px 40px;}
.eyebrow-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:#ae3200;background-color:#fff0e6;border:1px solid rgba(174,50,0,.18);padding:4px 10px;border-radius:4px;margin-bottom:16px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:0 0 20px 0;}
.headline-title{font-size:22px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 14px 0;letter-spacing:-.015em;}
.supporting-copy{font-size:15px;line-height:1.6;color:#424843;margin:0 0 28px 0;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="${SITE_URL}" class="wordmark">${WORDMARK_LOGO}<span>NAMMES Hub</span></a></td>
        <td align="right" class="header-time">${postedAt}</td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="eyebrow-badge">${safeEyebrow}</div>
      ${imageHtml}
      <h1 class="headline-title">${safeTitle}</h1>
      <p class="supporting-copy">A new update was just posted on NAMMES Hub.</p>
      <div class="cta-container">
        <a href="${url}" class="cta-button">Read more &rarr;</a>
      </div>
    </div>
    <div class="email-footer">
      <div>This is an automated departmental content alert from NAMMES Hub.</div>
      <div>To customize what alerts you receive, <a href="${SITE_URL}/account" class="footer-link">manage notification preferences</a>.</div>
    </div>
  </div>
</body>
</html>`)
}

export function renderBroadcastEmail({ subject, body }) {
  const safeSubject = escapeHtml(subject)
  const contentHtml = textToParagraphs(body)
  return juice(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.header-bar{background-color:#0b2417;padding:24px 40px;}
.header-bar .wordmark{color:#ffffff;}
.header-tag{font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#9cd6b2;background-color:rgba(255,255,255,.08);padding:4px 8px;border-radius:4px;}
.email-body{padding:40px 40px 36px 40px;}
.subject-title{font-size:23px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 24px 0;letter-spacing:-.015em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="${SITE_URL}" class="wordmark">${WORDMARK_LOGO}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Notice</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <h1 class="subject-title">${safeSubject}</h1>
      <div class="content-area">${contentHtml}</div>
    </div>
    <div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="${SITE_URL}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>
  </div>
</body>
</html>`)
}
