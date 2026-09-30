import { avatarInfo } from '../../data/quiz'

// One of the 50 quiz characters, drawn as SVG (no image files). `mood` changes the face and the movement:
// idle, happy, dance, sad or wave. Which character it is comes from `id` (0 to 49).

// Per body shape: where the top of the head is (hats sit there) and the row the eyes are on.
const SHAPES = [
  { top: 18, eyeY: 50 }, // blob
  { top: 26, eyeY: 48 }, // robot
  { top: 24, eyeY: 52 }, // cat
  { top: 34, eyeY: 58 }, // bunny
  { top: 18, eyeY: 50 }, // ghost
]

function Body({ speciesIndex, color }) {
  const line = { stroke: color.dark, strokeWidth: 2.5, strokeLinejoin: 'round' }
  switch (speciesIndex) {
    case 0:
      return (
        <>
          <ellipse cx="38" cy="86" rx="9" ry="5" fill={color.dark} />
          <ellipse cx="62" cy="86" rx="9" ry="5" fill={color.dark} />
          <path d="M50 18c-19 0-30 15-30 34 0 17 11 30 30 30s30-13 30-30c0-19-11-34-30-34z" fill={color.main} {...line} />
        </>
      )
    case 1:
      return (
        <>
          <line x1="50" y1="26" x2="50" y2="12" stroke={color.dark} strokeWidth="3" strokeLinecap="round" />
          <circle cx="50" cy="10" r="5" fill={color.light} stroke={color.dark} strokeWidth="2.5" />
          <rect x="15" y="44" width="8" height="18" rx="3" fill={color.dark} />
          <rect x="77" y="44" width="8" height="18" rx="3" fill={color.dark} />
          <rect x="22" y="26" width="56" height="56" rx="15" fill={color.main} {...line} />
        </>
      )
    case 2:
      return (
        <>
          <polygon points="22,36 25,10 43,26" fill={color.main} {...line} />
          <polygon points="78,36 75,10 57,26" fill={color.main} {...line} />
          <polygon points="27,28 28,18 36,25" fill={color.light} />
          <polygon points="73,28 72,18 64,25" fill={color.light} />
          <path d="M50 24c-20 0-31 14-31 32s11 28 31 28 31-10 31-28-11-32-31-32z" fill={color.main} {...line} />
        </>
      )
    case 3:
      return (
        <>
          <rect x="31" y="3" width="14" height="38" rx="7" fill={color.main} {...line} />
          <rect x="55" y="3" width="14" height="38" rx="7" fill={color.main} {...line} />
          <rect x="35" y="8" width="6" height="26" rx="3" fill={color.light} />
          <rect x="59" y="8" width="6" height="26" rx="3" fill={color.light} />
          <ellipse cx="50" cy="60" rx="30" ry="27" fill={color.main} {...line} />
        </>
      )
    default:
      return (
        <path d="M21 86V52c0-19 13-34 29-34s29 15 29 34v34l-9.7-7-9.7 7-9.6-7-9.6 7-9.7-7-9.7 7z" fill={color.main} {...line} />
      )
  }
}

function Face({ mood, eyeY, color }) {
  const happy = mood === 'happy' || mood === 'dance'
  const sad = mood === 'sad'
  const mouthY = eyeY + 15
  return (
    <>
      {happy ? (
        <>
          <path d={`M31 ${eyeY + 2}q7-10 14 0`} fill="none" stroke="#1f2937" strokeWidth="3.4" strokeLinecap="round" />
          <path d={`M55 ${eyeY + 2}q7-10 14 0`} fill="none" stroke="#1f2937" strokeWidth="3.4" strokeLinecap="round" />
        </>
      ) : (
        <>
          <circle cx="38" cy={eyeY} r="7" fill="#fff" />
          <circle cx="62" cy={eyeY} r="7" fill="#fff" />
          <circle cx={sad ? 38 : 39} cy={eyeY + (sad ? 2.5 : 0.5)} r="3.6" fill="#1f2937" />
          <circle cx={sad ? 62 : 63} cy={eyeY + (sad ? 2.5 : 0.5)} r="3.6" fill="#1f2937" />
          <circle cx="40" cy={eyeY - 1.5} r="1.2" fill="#fff" />
          <circle cx="64" cy={eyeY - 1.5} r="1.2" fill="#fff" />
        </>
      )}
      {sad && <path d={`M33 ${eyeY - 6}l10-4M67 ${eyeY - 6}l-10-4`} stroke="#1f2937" strokeWidth="2.6" strokeLinecap="round" />}
      {sad && <path d={`M33 ${eyeY + 8}q-3 6 0 9q3-3 0-9z`} fill="#7dd3fc" />}
      <circle cx="28" cy={eyeY + 9} r="4.5" fill={color.dark} opacity="0.22" />
      <circle cx="72" cy={eyeY + 9} r="4.5" fill={color.dark} opacity="0.22" />
      {happy ? (
        <path d={`M40 ${mouthY - 2}q10 16 20 0z`} fill="#7f1d1d" stroke="#1f2937" strokeWidth="2" strokeLinejoin="round" />
      ) : sad ? (
        <path d={`M42 ${mouthY + 5}q8-8 16 0`} fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      ) : (
        <path d={`M42 ${mouthY}q8 7 16 0`} fill="none" stroke="#1f2937" strokeWidth="3" strokeLinecap="round" />
      )}
    </>
  )
}

function Accessory({ kind, top, eyeY }) {
  switch (kind) {
    case 'cap':
      return (
        <g>
          <path d={`M37 ${top + 4}v10q13 8 26 0v-10z`} fill="#1f2937" />
          <path d={`M50 ${top - 10}L79 ${top + 2}L50 ${top + 13}L21 ${top + 2}z`} fill="#374151" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
          <line x1="74" y1={top + 3} x2="74" y2={top + 17} stroke="#fbbf24" strokeWidth="2" />
          <circle cx="74" cy={top + 19} r="2.6" fill="#fbbf24" />
        </g>
      )
    case 'glasses':
      return (
        <g fill="none" stroke="#111827" strokeWidth="2.8">
          <circle cx="38" cy={eyeY} r="10" />
          <circle cx="62" cy={eyeY} r="10" />
          <line x1="48" y1={eyeY} x2="52" y2={eyeY} />
        </g>
      )
    case 'headphones':
      return (
        <g>
          <path d={`M22 ${eyeY - 4}C22 ${top - 10} 78 ${top - 10} 78 ${eyeY - 4}`} fill="none" stroke="#111827" strokeWidth="5" strokeLinecap="round" />
          <rect x="15" y={eyeY - 4} width="10" height="18" rx="4" fill="#ef4444" stroke="#111827" strokeWidth="2" />
          <rect x="75" y={eyeY - 4} width="10" height="18" rx="4" fill="#ef4444" stroke="#111827" strokeWidth="2" />
        </g>
      )
    case 'bowtie':
      return (
        <g stroke="#7f1d1d" strokeWidth="1.5" strokeLinejoin="round">
          <path d="M50 76l-12-7v14z" fill="#dc2626" />
          <path d="M50 76l12-7v14z" fill="#dc2626" />
          <circle cx="50" cy="76" r="3.4" fill="#b91c1c" />
        </g>
      )
    default:
      return (
        <g>
          <path d={`M50 ${top - 16}L65 ${top + 5}Q50 ${top + 10} 35 ${top + 5}z`} fill="#f59e0b" stroke="#b45309" strokeWidth="1.5" strokeLinejoin="round" />
          <path d={`M44 ${top - 4}l12 4M41 ${top + 1}l18 5`} stroke="#fff" strokeWidth="2" opacity="0.8" />
          <circle cx="50" cy={top - 17} r="3.5" fill="#ec4899" />
        </g>
      )
  }
}

export default function Character({ id, mood = 'idle', className = 'h-full w-full', title }) {
  const info = avatarInfo(id)
  const shape = SHAPES[info.speciesIndex]
  const { color } = info
  return (
    <svg
      viewBox="0 0 100 100"
      className={`qz-char qz-mood-${mood} ${className}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse cx="50" cy="90" rx="24" ry="4" fill="#000" opacity="0.12" />
      <g className="qz-body">
        <g className="qz-arm qz-arm-l">
          <line x1="24" y1="70" x2="12" y2="74" stroke={color.dark} strokeWidth="9" strokeLinecap="round" />
          <line x1="24" y1="70" x2="12" y2="74" stroke={color.main} strokeWidth="5.5" strokeLinecap="round" />
        </g>
        <g className="qz-arm qz-arm-r">
          <line x1="76" y1="70" x2="88" y2={mood === 'wave' ? 56 : 74} stroke={color.dark} strokeWidth="9" strokeLinecap="round" />
          <line x1="76" y1="70" x2="88" y2={mood === 'wave' ? 56 : 74} stroke={color.main} strokeWidth="5.5" strokeLinecap="round" />
        </g>
        <Body speciesIndex={info.speciesIndex} color={color} />
        <Face mood={mood} eyeY={shape.eyeY} color={color} />
        <Accessory kind={info.accessory} top={shape.top} eyeY={shape.eyeY} />
      </g>
    </svg>
  )
}
