export function splitFeaturedExcos(rows, featuredCount = 3) {
  const list = rows || []
  return {
    featured: list.slice(0, featuredCount),
    rest: list.slice(featuredCount),
  }
}
