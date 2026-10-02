import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay'
import { loadFont as loadPublicSans } from '@remotion/google-fonts/PublicSans'

export const C = {
  green950: '#04160c',
  green900: '#0b2417',
  green800: '#0c4a24',
  green700: '#145c30',
  green100: '#e6f0ea',
  orange: '#ff5a1f',
  orangeDark: '#ae3200',
  orangeTint: '#fff0e6',
  gold: '#f4c430',
  paper: '#fcf9f8',
  ink: '#1c1b1b',
  white: '#ffffff',
} as const

const playfair = loadPlayfair('normal', { weights: ['700', '800', '900'], subsets: ['latin'] })
const publicSans = loadPublicSans('normal', { weights: ['400', '500', '600', '700', '800'], subsets: ['latin'] })

export const FONT_HEAD = `${playfair.fontFamily}, Georgia, serif`
export const FONT_BODY = `${publicSans.fontFamily}, 'Segoe UI', Arial, sans-serif`

export const SHADOW = '0 18px 40px rgba(4,22,12,0.18), 0 4px 10px rgba(4,22,12,0.10)'
export const SHADOW_SOFT = '0 8px 22px rgba(4,22,12,0.12)'
