import { renderEmail, renderBlocksHtml, presetDesign, DEFAULT_DESIGN } from '../../api/_lib/emailDesign.js'
import { renderBroadcastTemplate } from '../../api/_lib/emailTemplateHtml.js'

/**
 * The HTML the admin previews. Mirrors what the server sends: a design renders the designed layout;
 * without one, a hand-edited HTML template gets the blocks dropped into its {{body}}; otherwise the
 * built-in look for the template is used.
 */
export function buildEmailPreviewHtml({ subject, blocks, design, customHtml, templateId }) {
  const content = { subject: subject.trim() || 'Your subject line', blocks }
  if (design) return renderEmail({ design, content })
  if (customHtml) {
    return renderBroadcastTemplate(customHtml, { subject: content.subject, body: '', imageUrl: undefined, bodyHtml: renderBlocksHtml(blocks, DEFAULT_DESIGN) })
  }
  return renderEmail({ design: presetDesign(templateId), content })
}
