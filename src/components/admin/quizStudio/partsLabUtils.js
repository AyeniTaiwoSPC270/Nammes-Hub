export function filterPartNames(parts, filter) {
  const query = filter.trim().toLowerCase()
  return parts.filter((name) => name.toLowerCase().includes(query))
}
