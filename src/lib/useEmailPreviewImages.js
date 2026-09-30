import { useCallback, useEffect, useRef, useState } from 'react'
import { adjustKey, bakeImage, collectImages, isDefaultAdjust } from './emailImage'

/**
 * Keeps the live preview honest: while an image's crop/adjustments differ from what is already baked
 * into its file, a temporary local render (a blob URL) stands in for it. Nothing is uploaded until the
 * email is sent, saved or test-sent. Returns a function that swaps the stand-ins into rendered HTML.
 */
export function useEmailPreviewImages(blocks, design) {
  const [ready, setReady] = useState({}) // adjustKey -> blob URL
  const inflight = useRef(new Set())
  const made = useRef([])

  const images = collectImages(blocks, design)
  const pending = images
    .filter((img) => !isDefaultAdjust(img.adjust))
    .map((img) => ({ img, key: adjustKey(img.src, img.adjust) }))
    .filter(({ img, key }) => img.bakeKey !== key)
  const signature = pending.map((p) => p.key).join('\n')

  useEffect(() => {
    if (!pending.length) return undefined
    const timer = setTimeout(() => {
      for (const { img, key } of pending) {
        if (ready[key] || inflight.current.has(key)) continue
        inflight.current.add(key)
        bakeImage(img.src, img.adjust, 700)
          .then((blob) => {
            const url = URL.createObjectURL(blob)
            made.current.push(url)
            setReady((prev) => ({ ...prev, [key]: url }))
          })
          .catch(() => {})
          .finally(() => inflight.current.delete(key))
      }
    }, 250)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature])

  useEffect(
    () => () => {
      made.current.forEach((u) => URL.revokeObjectURL(u))
    },
    [],
  )

  return useCallback(
    (html) => {
      let out = html
      for (const { img, key } of pending) {
        if (ready[key]) out = out.replaceAll(`"${img.url}"`, `"${ready[key]}"`)
      }
      return out
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [signature, ready],
  )
}
