// Plain-text rules shared by nicknames and team names (no Node-only imports, so the browser can use them too).

// Nicknames are shown on a projector to a room, so keep them short, plain and free of the obvious rude words.
const BLOCKED = ['fuck', 'shit', 'bitch', 'cunt', 'nigg', 'dick', 'pussy', 'whore', 'slut', 'rape', 'asshole']

// True if the text hides one of the obvious rude words (spacing, symbols and capitals do not help).
export function hasBlockedWord(text) {
  const squashed = String(text).toLowerCase().replace(/[^a-z]/g, '')
  return BLOCKED.some((word) => squashed.includes(word))
}

