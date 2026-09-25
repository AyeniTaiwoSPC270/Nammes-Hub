import juice from 'juice'
import { buildWelcomeEmailHtml, buildNewContentEmailHtml, buildBroadcastEmailHtml } from './emailTemplateHtml.js'

export { SITE_URL, escapeHtml, BROADCAST_TEMPLATES } from './emailTemplateHtml.js'

export function renderWelcomeEmail(args) {
  return juice(buildWelcomeEmailHtml(args))
}

export function renderNewContentEmail(args) {
  return juice(buildNewContentEmailHtml(args))
}

export function renderBroadcastEmail(args) {
  return juice(buildBroadcastEmailHtml(args))
}
