import { isHexColor } from './quizTheme.js'
import { isQuizImagePath } from './quizImage.js'

// How the result card is designed. Separate from the theme: theme drives the projector and phone screens, card
// drives one exported image, and the theme column has a size cap this must not eat into.
export const DEFAULT_CARD = Object.freeze({
  accent: null,
  background: null,
  showCharacter: true,
  showTitle: true,
  showPlacement: true,
  showAccuracy: true,
  showStreak: true,
  showTeam: true,
})

// Any value that is not literal false leaves the line on, so a hand-edited row can only ever hide a line.
function flag(value) {
  return value !== false
}

// Anything goes in, a complete valid card comes out (bad or missing values fall back to the defaults).
export function sanitizeCard(input, { quizId } = {}) {
  const c = input && typeof input === 'object' && !Array.isArray(input) ? input : {}
  return {
    accent: isHexColor(c.accent) ? c.accent.toLowerCase() : null,
    background: isQuizImagePath(c.background, quizId) ? c.background.toLowerCase() : null,
    showCharacter: flag(c.showCharacter),
    showTitle: flag(c.showTitle),
    showPlacement: flag(c.showPlacement),
    showAccuracy: flag(c.showAccuracy),
    showStreak: flag(c.showStreak),
    showTeam: flag(c.showTeam),
  }
}