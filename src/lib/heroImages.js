// The hero image list is the new source of truth, but rows saved before the slideshow existed only have
// the single `hero_image_url`. Both the admin editor and Home resolve the pair through this function so
// they cannot disagree about whether an old row has a hero.
export function heroImages(content) {
  const urls = Array.isArray(content?.hero_image_urls) ? content.hero_image_urls.filter(Boolean) : []
  if (urls.length > 0) return urls
  return content?.hero_image_url ? [content.hero_image_url] : []
}
