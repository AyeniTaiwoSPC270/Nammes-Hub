export function isGoogleDriveUrl(url) {
  return /(drive|docs)\.google\.com/i.test(url)
}
