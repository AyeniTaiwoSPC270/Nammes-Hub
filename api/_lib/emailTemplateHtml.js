export const SITE_URL = 'https://www.nammeshub.com.ng'

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const LINK_STYLE = 'color:#ae3200;text-decoration:underline;'

function linkify(escapedText) {
  const withMarkdownLinks = escapedText.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    (_match, linkText, url) => `<a href="${url}" style="${LINK_STYLE}">${linkText}</a>`,
  )
  return withMarkdownLinks.replace(
    /(?<!href=")https?:\/\/[^\s<]+/g,
    (url) => `<a href="${url}" style="${LINK_STYLE}">${url}</a>`,
  )
}

function textToParagraphs(text) {
  return text
    .trim()
    .split(/\n{2,}/)
    .map((block) => `<p>${linkify(escapeHtml(block)).replace(/\n/g, '<br>')}</p>`)
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

export function buildWelcomeEmailHtml({ fullName }) {
  const name = escapeHtml(fullName || 'there')
  return `<!DOCTYPE html>
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
</html>`
}

export function buildNewContentEmailHtml({ eyebrow, title, url, imageUrl }) {
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
  return `<!DOCTYPE html>
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
</html>`
}

function broadcastImageHtml(imageUrl, className = 'content-image') {
  return imageUrl ? `<img src="${imageUrl}" alt="" width="520" class="${className}" />` : ''
}

export const BROADCAST_TEMPLATES = [
  { id: 'default', label: 'Default', description: 'Dark green header bar with an "Official Notice" tag. The current standard look.' },
  { id: 'bold', label: 'Bold', description: 'High-contrast orange header, large headline — for announcements that need to stand out.' },
  { id: 'minimal', label: 'Minimal', description: 'Text-first, no colored header — quiet and businesslike.' },
  { id: 'event', label: 'Event Invite', description: 'Date badge + prominent image and CTA — for events and invites.' },
  { id: 'alert', label: 'Urgent Alert', description: 'Red accent bar and warning tag — for time-sensitive or safety notices.' },
  { id: 'digest', label: 'Newsletter Digest', description: 'Editorial layout with a dated eyebrow — for weekly/roundup-style updates.' },
  { id: 'celebration', label: 'Celebration', description: 'Festive orange + green accents — for wins, results, and congratulations.' },
]

// Broadcast templates are plain HTML strings with placeholder tokens, so admins can
// edit every byte of them (Admin > Email Templates) instead of only subject/body/image.
export const BROADCAST_TEMPLATE_TOKENS = [
  { token: '{{subject}}', description: 'The broadcast subject line (HTML-escaped).' },
  { token: '{{body}}', description: 'The broadcast body, converted to paragraphs with links.' },
  { token: '{{image}}', description: 'The uploaded image as an <img> tag, or nothing if no image was attached.' },
  { token: '{{date}}', description: 'Today’s date, short form (e.g. "Mar 5, 2026").' },
  { token: '{{date_full}}', description: 'Today’s date, long form (e.g. "Thursday, March 5, 2026").' },
  { token: '{{site_url}}', description: 'The site’s base URL, for links and the logo image.' },
]

const WORDMARK_TOKEN_HTML = `<img src="{{site_url}}/logo.png" width="22" height="22" alt="NAMMES Hub" style="border-radius:4px;" />`

const BROADCAST_FOOTER_TOKEN_HTML = `<div class="email-footer">
      <div>You're receiving this because you're a NAMMES Hub member — <a href="{{site_url}}/account" class="footer-link">manage your notification preferences</a>.</div>
      <div style="margin-top:6px;">National Association of Metallurgical and Materials Engineering Students · Faculty of Engineering, University of Lagos</div>
    </div>`

export const DEFAULT_BROADCAST_TEMPLATE_HTML = {
  default: `<!DOCTYPE html>
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
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:23px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 24px 0;letter-spacing:-.015em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
</style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Notice</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  bold: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.header-bar{background-color:#ff5a1f;padding:18px 40px;}
.header-bar .wordmark{color:#ffffff;}
.header-tag{display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#ffffff;background-color:rgba(255,255,255,.18);padding:4px 10px;border-radius:4px;}
.email-body{padding:24px 40px 40px 40px;}
.eyebrow-row{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ae3200;margin-bottom:14px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:28px;font-weight:800;line-height:1.15;color:#0b2417;margin:0 0 20px 0;letter-spacing:-.02em;}
.content-area{font-size:16px;line-height:1.75;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
</style>
</head>
<body>
  <div class="email-container">
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Bulletin</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="eyebrow-row">Announcement · {{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}" class="cta-button">Visit NAMMES Hub &rarr;</a>
      </div>
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  minimal: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Announcement - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.email-header{padding:32px 40px 20px 40px;}
.header-label{font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#6b6558;}
.header-divider{height:1px;background-color:#ece8e4;margin:0 40px;}
.email-body{padding:24px 40px 44px 40px;}
.eyebrow-row{font-size:12px;color:#6b6558;margin-bottom:16px;}
.content-image-sm{width:100%;max-width:280px;height:auto;border-radius:6px;display:block;margin:24px 0 0 0;}
.subject-title{font-size:20px;font-weight:700;line-height:1.35;color:#0b2417;margin:0 0 20px 0;letter-spacing:-.01em;padding-bottom:20px;border-bottom:1px solid #f0edea;}
.content-area{font-size:15px;line-height:1.75;color:#1c1b1b;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-label">Notice</span></td>
      </tr></table>
    </div>
    <div class="header-divider"></div>
    <div class="email-body">
      <div class="eyebrow-row">{{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  event: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Event - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.email-header{padding:28px 40px 0 40px;}
.header-tag{display:inline-block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#ae3200;background-color:#fff0e6;border:1px solid rgba(174,50,0,.18);padding:4px 10px;border-radius:4px;}
.email-body{padding:20px 40px 40px 40px;}
.date-badge{display:inline-block;font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#ae3200;background-color:#fff0e6;border:1px solid rgba(174,50,0,.18);padding:5px 10px;border-radius:4px;margin-bottom:16px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:24px;font-weight:700;line-height:1.3;color:#0b2417;margin:0 0 14px 0;letter-spacing:-.015em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Official Invitation</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="date-badge">{{date}}</div>
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}/events" class="cta-button">See events &rarr;</a>
      </div>
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  alert: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Urgent - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.top-strip{height:6px;background-color:#ba1a1a;}
.header-bar{background-color:#ba1a1a;padding:14px 40px;}
.header-bar .wordmark{color:#ffffff;font-size:15px;}
.header-tag{display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:#ffffff;background-color:rgba(255,255,255,.18);padding:4px 10px;border-radius:9999px;}
.email-body{padding:28px 40px 40px 40px;}
.alert-card{background-color:#f6f3f2;border-left:4px solid #ba1a1a;border-radius:0 8px 8px 0;padding:24px 28px;}
.callout{background-color:#ffdad6;border-radius:8px;padding:14px 16px;margin-top:16px;}
.callout-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#ba1a1a;margin-bottom:6px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:22px;font-weight:800;line-height:1.3;color:#000904;margin:0;letter-spacing:-.01em;}
.content-area{font-size:15px;line-height:1.7;color:#191813;}
.content-area p{margin:0 0 18px 0;}
.content-area p:last-child{margin-bottom:0;}
.content-area a{${LINK_STYLE}}
</style>
</head>
<body>
  <div class="email-container">
    <div class="top-strip"></div>
    <div class="header-bar">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td><a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a></td>
        <td align="right"><span class="header-tag">Urgent Notice</span></td>
      </tr></table>
    </div>
    <div class="email-body">
      <div class="alert-card">
        <h1 class="subject-title">{{subject}}</h1>
        <div class="callout">
          <span class="callout-label">Please read carefully</span>
          <div class="content-area">{{body}}</div>
        </div>
        {{image}}
      </div>
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  digest: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Digest - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.email-header{padding:28px 40px 16px 40px;text-align:center;border-bottom:1px solid #f0edea;}
.email-header .wordmark{display:inline-block;}
.eyebrow{display:block;margin-top:6px;font-family:'IBM Plex Mono',monospace;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:#6b6558;}
.email-body{padding:36px 44px 40px 44px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:22px auto 0 auto;}
.subject-title{font-size:26px;font-weight:700;line-height:1.25;color:#0b2417;margin:0 0 22px 0;letter-spacing:-.02em;text-align:center;}
.divider{width:48px;height:2px;background-color:#ff5a1f;margin:0 auto 26px auto;}
.content-area{font-size:15px;line-height:1.8;color:#1c1b1b;max-width:480px;margin:0 auto;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
.cta-container{text-align:center;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a>
      <span class="eyebrow">Weekly Dispatch · {{date_full}}</span>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="divider"></div>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}" class="cta-button">Read more on NAMMES Hub &rarr;</a>
      </div>
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,

  celebration: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Celebration - NAMMES Hub</title>
<style>
${SHARED_STYLE}
.stripe{height:6px;background:linear-gradient(90deg,#ff5a1f 0%,#ff5a1f 50%,#0b2417 50%,#0b2417 100%);}
.email-header{padding:26px 40px 12px 40px;}
.header-tag{display:inline-block;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.08em;color:#1c6b3a;background-color:#e6f0ea;border:1px solid rgba(28,107,58,.18);padding:4px 10px;border-radius:9999px;margin-top:14px;}
.email-body{padding:16px 40px 40px 40px;}
.content-image{width:100%;max-width:520px;height:auto;border-radius:8px;display:block;margin:20px 0 0 0;}
.subject-title{font-size:25px;font-weight:800;line-height:1.25;color:#0b2417;margin:0 0 18px 0;letter-spacing:-.015em;text-align:center;}
.content-area{font-size:15px;line-height:1.7;color:#191813;max-width:480px;margin:0 auto;}
.content-area p{margin:0 0 18px 0;}
.content-area a{${LINK_STYLE}}
.cta-container{text-align:center;}
</style>
</head>
<body>
  <div class="email-container">
    <div class="stripe"></div>
    <div class="email-header">
      <a href="{{site_url}}" class="wordmark">${WORDMARK_TOKEN_HTML}<span>NAMMES Hub</span></a>
      <div><span class="header-tag">Congratulations</span></div>
    </div>
    <div class="email-body">
      <h1 class="subject-title">{{subject}}</h1>
      <div class="content-area">{{body}}</div>
      {{image}}
      <div class="cta-container">
        <a href="{{site_url}}/awards" class="cta-button">View all results &rarr;</a>
      </div>
    </div>
    ${BROADCAST_FOOTER_TOKEN_HTML}
  </div>
</body>
</html>`,
}

export function renderBroadcastTemplate(html, { subject, body, imageUrl }) {
  const safeSubject = escapeHtml(subject)
  const contentHtml = textToParagraphs(body)
  const imageHtml = broadcastImageHtml(imageUrl)
  const dateShort = new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeZone: 'Africa/Lagos' }).format(new Date())
  const dateFull = new Intl.DateTimeFormat('en-US', { dateStyle: 'full', timeZone: 'Africa/Lagos' }).format(new Date())
  return html
    .replaceAll('{{subject}}', safeSubject)
    .replaceAll('{{body}}', contentHtml)
    .replaceAll('{{image}}', imageHtml)
    .replaceAll('{{date_full}}', dateFull)
    .replaceAll('{{date}}', dateShort)
    .replaceAll('{{site_url}}', SITE_URL)
}

export function buildBroadcastEmailHtml({ subject, body, imageUrl, templateId = 'default', customHtml }) {
  const html = customHtml || DEFAULT_BROADCAST_TEMPLATE_HTML[templateId] || DEFAULT_BROADCAST_TEMPLATE_HTML.default
  return renderBroadcastTemplate(html, { subject, body, imageUrl })
}
