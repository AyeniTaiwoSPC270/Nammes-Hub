// The routes that own their own look system: the projector, the phones, the battle and practice
// screens, and the editors that feed them. Holiday decoration and the holiday page background are
// both site-wide and never render on these — one list, so the two exclusions cannot drift apart
// (the snow-over-a-live-game bug report).
export const QUIZ_PREFIXES = ['/host', '/play', '/battle', '/practice', '/make', '/set', '/cbt']

export function isQuizPath(pathname) {
  return QUIZ_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
}
