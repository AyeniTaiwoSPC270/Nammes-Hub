// Splits quiz text into plain pieces and maths pieces. Maths goes between single dollar signs: "Solve $x^2 = 4$".
// A backslash before a dollar sign keeps it as an ordinary dollar sign, so prices still work (write \$5 for $5).

const BACKSLASH = '\\'

export function splitMath(text) {
  const source = String(text ?? '')
  const parts = []
  let plain = ''
  let i = 0
  const flush = () => {
    if (plain) parts.push({ type: 'text', value: plain })
    plain = ''
  }
  while (i < source.length) {
    const ch = source[i]
    if (ch === BACKSLASH && source[i + 1] === '$') {
      plain += '$'
      i += 2
    } else if (ch === '$') {
      let j = i + 1
      while (j < source.length && source[j] !== '$' && source[j] !== '\n') j += source[j] === BACKSLASH && j + 1 < source.length ? 2 : 1
      const inner = source.slice(i + 1, j)
      if (source[j] === '$' && inner.trim() !== '') {
        flush()
        parts.push({ type: 'math', value: inner })
        i = j + 1
      } else {
        plain += ch
        i += 1
      }
    } else {
      plain += ch
      i += 1
    }
  }
  flush()
  return parts
}

export function hasMath(text) {
  return splitMath(text).some((p) => p.type === 'math')
}
