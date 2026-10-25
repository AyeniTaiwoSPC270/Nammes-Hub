import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadInter } from '@remotion/google-fonts/Inter'
import { useEffect, useState } from 'react'
import { continueRender, delayRender } from 'remotion'

const playfair = loadPlayfair('normal', { weights: ['700', '800'], subsets: ['latin'] })
const inter = loadInter('normal', {
  weights: ['500', '600', '700', '800', '900'],
  subsets: ['latin'],
})

export const FONT = {
  serif: `${playfair.fontFamily}, Georgia, 'Times New Roman', serif`,
  sans: `${inter.fontFamily}, 'Segoe UI', Arial, sans-serif`,
}

/**
 * Remotion does not wait for webfonts on its own. Without this gate the first
 * rendered frame uses the fallback and every text metric is measured wrong.
 * A failed download falls through to the fallback stack rather than hanging the
 * render, so the studio still opens offline.
 */
export const FontGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [handle] = useState(() => delayRender('Loading fonts'))
  const [ready, setReady] = useState(false)

  useEffect(() => {
    Promise.all([playfair.waitUntilDone(), inter.waitUntilDone()])
      .catch(() => undefined)
      .then(() => {
        setReady(true)
        continueRender(handle)
      })
  }, [handle])

  if (!ready) return null
  return <>{children}</>
}
