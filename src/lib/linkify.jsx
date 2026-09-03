const URL_PATTERN = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi

// Turns plain-text URLs typed into an admin field (e.g. "RSVP at https://...")
// into clickable links when rendered.
export function linkifyText(text) {
  if (!text) return text

  const nodes = []
  let lastIndex = 0
  let match

  while ((match = URL_PATTERN.exec(text)) !== null) {
    let url = match[0]
    const trailing = url.match(/[.,;:!?)\]}'"]+$/)
    if (trailing) url = url.slice(0, -trailing[0].length)

    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index))
    }

    const href = url.startsWith('www.') ? `https://${url}` : url
    nodes.push(
      <a
        key={match.index}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-green-900 underline underline-offset-2 hover:text-green-700"
      >
        {url}
      </a>,
    )

    lastIndex = match.index + url.length
    URL_PATTERN.lastIndex = lastIndex
  }

  if (lastIndex < text.length) nodes.push(text.slice(lastIndex))

  return nodes
}
