import juice from 'juice'
import { buildWelcomeEmailHtml, buildNewContentEmailHtml, buildBroadcastEmailHtml, renderBroadcastTemplate } from './emailTemplateHtml.js'
import { renderEmail, renderBlocksHtml, welcomeContent, newContentEmailContent, normalizeBlocks } from './emailDesign.js'

export {
  SITE_URL,
  escapeHtml,
  BROADCAST_TEMPLATES,
  BROADCAST_TEMPLATE_TOKENS,
  DEFAULT_BROADCAST_TEMPLATE_HTML,
} from './emailTemplateHtml.js'

/** The saved design for an email, or null. Never throws: a missing design must not stop an email going out. */
export async function loadEmailDesign(client, templateId) {
  try {
    const { data } = await client.from('email_templates').select('design').eq('template_id', templateId).maybeSingle()
    return data?.design ?? null
  } catch {
    return null
  }
}

// `design` is the saved design for this email (email_templates.design). Without one, the original
// hand-written HTML is used, so nothing changes until an admin designs the email.
export function renderWelcomeEmail(args, design) {
  if (design) return juice(renderEmail({ design, content: welcomeContent(args) }))
  return juice(buildWelcomeEmailHtml(args))
}

export function renderNewContentEmail(args, design) {
  if (design) return juice(renderEmail({ design, content: newContentEmailContent(args) }))
  return juice(buildNewContentEmailHtml(args))
}

export function renderBroadcastEmail(args) {
  return juice(buildBroadcastEmailHtml(args))
}

/**
 * A broadcast written with blocks. Uses the design when there is one; otherwise the template's raw
 * HTML (with the blocks rendered into its {{body}}), so hand-edited HTML templates keep working.
 */
export function renderBlocksBroadcast({ subject, blocks, design, templateId, customHtml, allowedHosts }) {
  if (design || !customHtml) {
    return juice(renderEmail({ design, content: { subject, blocks }, allowedHosts }))
  }
  const safeBlocks = normalizeBlocks(blocks, allowedHosts)
  const bodyHtml = renderBlocksHtml(safeBlocks, undefined)
  return juice(renderBroadcastTemplate(customHtml, { subject, body: '', imageUrl: undefined, bodyHtml }))
}
