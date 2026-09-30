import { normalizeImage, aspectRatioOf, imageFilter } from '../../lib/formTheme'

const ALIGN_MARGIN = { left: '0 auto 0 0', center: '0 auto', right: '0 0 0 auto' }

// Renders an image with its saved crop (aspect + pan + zoom), rotation, flips and colour adjustments.
// The original file is never altered: all of it is CSS, so it can be re-adjusted at any time.
export default function AdjustableImage({ image, className = '', fill = false }) {
  const img = normalizeImage(image)
  if (!img) return null

  const ratio = aspectRatioOf(img)
  const flip = `scale(${img.flipH ? -1 : 1}, ${img.flipV ? -1 : 1})`
  const sideways = img.rotate === 90 || img.rotate === 270
  const filter = imageFilter(img)

  const wrapperStyle = {
    width: fill ? '100%' : `${img.widthPct}%`,
    margin: fill ? undefined : ALIGN_MARGIN[img.align],
    borderRadius: `${img.radius}px`,
    overflow: 'hidden',
  }

  // No crop: show the whole picture at its natural shape (rotation needs a fixed frame, so it is ignored).
  if (ratio === null) {
    return (
      <div className={className} style={wrapperStyle}>
        <img
          src={img.url}
          alt={img.alt}
          loading="lazy"
          draggable={false}
          style={{ display: 'block', width: '100%', height: 'auto', filter, transform: flip }}
        />
      </div>
    )
  }

  const imgStyle = {
    position: 'absolute',
    left: '50%',
    top: '50%',
    width: sideways ? '100cqh' : '100%',
    height: sideways ? '100cqw' : '100%',
    maxWidth: 'none',
    objectFit: 'cover',
    objectPosition: `${img.x}% ${img.y}%`,
    transformOrigin: `${img.x}% ${img.y}%`,
    transform: `translate(-50%, -50%) rotate(${img.rotate}deg) scale(${img.zoom}) ${flip}`,
    filter,
  }

  return (
    <div className={className} style={wrapperStyle}>
      <div style={{ position: 'relative', aspectRatio: String(ratio), containerType: 'size', overflow: 'hidden' }}>
        <img src={img.url} alt={img.alt} loading="lazy" draggable={false} style={imgStyle} />
      </div>
    </div>
  )
}
