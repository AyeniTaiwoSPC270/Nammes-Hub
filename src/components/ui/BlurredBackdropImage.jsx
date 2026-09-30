import ImageReveal from './ImageReveal'

// Shows the whole image (object-contain, never cropped) and fills any leftover space
// with a blurred, enlarged copy of the same image instead of a flat grey bar.
// `className` sizes the frame (aspect ratio / height / width); the frame clips overflow.
export default function BlurredBackdropImage({ src, className = '', reveal = true }) {
  const Foreground = reveal ? ImageReveal : 'img'

  return (
    <div className={['relative overflow-hidden bg-surface-low', className].join(' ')}>
      <img
        src={src}
        loading="lazy"
        decoding="async"
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover blur-xl saturate-150"
      />
      <Foreground
        src={src}
        loading="lazy"
        decoding="async"
        alt=""
        className="relative h-full w-full object-contain"
      />
    </div>
  )
}
