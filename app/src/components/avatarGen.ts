/** Procedural flat-style face generator (Football Agent vibe).
 *  Pure string output so both the React component and node scripts can use it.
 *  Palettes MUST stay in sync with avatars.py. */

export interface AvatarParams {
  skinTone: number // 0..7
  hairStyle: string
  hairColor: string
  beard: string  // 'none' | 'stubble' | 'full' | 'mustache' | 'goatee'
  glasses?: string  // 'none' | 'normal' | 'sunglasses'
  fromPhoto?: boolean
}

export const SKIN = ['#f6dcc8', '#f0c8a4', '#e3b087', '#cb9268',
  '#ad7150', '#8d5638', '#6e3f29', '#4f2b1d']

export const HAIR_COLORS: Record<string, string> = {
  black: '#1d1a17', darkbrown: '#4a3220', brown: '#7a5230',
  blonde: '#c9a45c', red: '#8f4a26', gray: '#9a9a9a',
}

function shade(hex: string, f: number): string {
  const n = (i: number) => Math.max(0, Math.min(255,
    Math.round(parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) * f)))
  return `rgb(${n(0)},${n(1)},${n(2)})`
}

/** viewBox 0 0 64 64; head centered, shoulders at bottom. */
export function avatarSvg(p: AvatarParams, size: number): string {
  const skin = SKIN[Math.max(0, Math.min(7, p.skinTone))] ?? SKIN[3]
  const hair = HAIR_COLORS[p.hairColor] ?? HAIR_COLORS.black
  const dark = shade(skin, 0.72) // ears/feature outline tone
  const parts: string[] = []

  // shoulders / shirt
  parts.push(`<path d="M10 64 Q12 50 32 50 Q52 50 54 64 Z" fill="#2a3040"/>`)
  // neck
  parts.push(`<rect x="27" y="40" width="10" height="12" rx="3" fill="${skin}"/>`)
  // ears
  parts.push(`<circle cx="15.5" cy="29" r="3.4" fill="${skin}"/>`)
  parts.push(`<circle cx="48.5" cy="29" r="3.4" fill="${skin}"/>`)
  // head
  parts.push(`<ellipse cx="32" cy="28" rx="14.5" ry="17" fill="${skin}"/>`)

  // beard (under hair so hairline overlaps cleanly)
  const beardC = hair
  if (p.beard === 'stubble') {
    parts.push(`<ellipse cx="32" cy="37.5" rx="9" ry="5" fill="${beardC}" opacity="0.3"/>`)
    parts.push(`<ellipse cx="32" cy="35.5" rx="6" ry="2" fill="${beardC}" opacity="0.2"/>`)
  }
  if (p.beard === 'full') {
    parts.push(`<path d="M18.5 30 Q19 46 32 46.5 Q45 46 45.5 30 Q45 41 32 41.5 Q19 41 18.5 30 Z" fill="${beardC}"/>`)
    parts.push(`<path d="M25 36.5 Q32 39.5 39 36.5 L39 35 Q32 37.5 25 35 Z" fill="${beardC}"/>`)
  } else if (p.beard === 'goatee') {
    parts.push(`<path d="M27.5 40 Q32 44.5 36.5 40 Q36 43.5 32 44 Q28 43.5 27.5 40 Z" fill="${beardC}"/>`)
  }
  if (p.beard === 'mustache' || p.beard === 'full') {
    parts.push(`<path d="M26 35.2 Q32 33 38 35.2 Q32 37.6 26 35.2 Z" fill="${beardC}"/>`)
  }

  // eyes + brows
  parts.push(`<circle cx="26" cy="27" r="1.7" fill="#241f1c"/>`)
  parts.push(`<circle cx="38" cy="27" r="1.7" fill="#241f1c"/>`)
  parts.push(`<rect x="22.6" y="22.6" width="7" height="1.7" rx="0.8" fill="${p.hairStyle === 'bald' ? dark : hair}"/>`)
  parts.push(`<rect x="34.4" y="22.6" width="7" height="1.7" rx="0.8" fill="${p.hairStyle === 'bald' ? dark : hair}"/>`)
  // nose
  parts.push(`<path d="M32 28 L30.6 32.8 L33.4 32.8 Z" fill="${dark}"/>`)
  // mouth (skip when covered by full beard's lip bar)
  if (p.beard !== 'full' && p.beard !== 'mustache') {
    parts.push(`<rect x="28" y="36.6" width="8" height="1.6" rx="0.8" fill="${dark}"/>`)
  }

  // hair
  const H = hair
  switch (p.hairStyle) {
    case 'bald':
      break
    case 'receding':
      parts.push(`<path d="M17.5 26 Q17 16 24 13.5 L25.5 19 Q20 21 19.5 27 Z" fill="${H}"/>`)
      parts.push(`<path d="M46.5 26 Q47 16 40 13.5 L38.5 19 Q44 21 44.5 27 Z" fill="${H}"/>`)
      break
    case 'buzz':
      parts.push(`<path d="M18 24 Q19 12.5 32 12 Q45 12.5 46 24 Q44 16.5 32 16 Q20 16.5 18 24 Z" fill="${H}"/>`)
      break
    case 'short':
      parts.push(`<path d="M17.5 25 Q17.5 10.5 32 10.5 Q46.5 10.5 46.5 25 Q45 16 32 15.5 Q19 16 17.5 25 Z" fill="${H}"/>`)
      break
    case 'fade':
      parts.push(`<path d="M18 25 Q18 10 32 10 Q46 10 46 25 Q46 14.5 32 14 Q18 14.5 18 25 Z" fill="${H}"/>`)
      parts.push(`<rect x="22" y="10.5" width="20" height="5.5" rx="2.5" fill="${H}"/>`)
      break
    case 'wavy':
      parts.push(`<path d="M17.5 27 Q16.5 10 32 10.5 Q47.5 10 46.5 27 Q46 18 40 17 Q44 14.5 36 14 Q40 12.5 30 13 Q34 11.5 24 15 Q27 13 20 18.5 Q18.5 21 17.5 27 Z" fill="${H}"/>`)
      break
    case 'curly':
      parts.push(`<circle cx="22" cy="16.5" r="5" fill="${H}"/>`)
      parts.push(`<circle cx="30" cy="13.5" r="5.4" fill="${H}"/>`)
      parts.push(`<circle cx="38" cy="14" r="5" fill="${H}"/>`)
      parts.push(`<circle cx="44" cy="18" r="4.4" fill="${H}"/>`)
      parts.push(`<circle cx="19" cy="21" r="4" fill="${H}"/>`)
      break
    case 'afro':
      parts.push(`<circle cx="32" cy="16" r="13.5" fill="${H}"/>`)
      parts.push(`<circle cx="20.5" cy="20.5" r="6.5" fill="${H}"/>`)
      parts.push(`<circle cx="43.5" cy="20.5" r="6.5" fill="${H}"/>`)
      break
    case 'long':
      parts.push(`<path d="M17 27 Q15.5 9.5 32 9.5 Q48.5 9.5 47 27 L47.5 38 Q44.5 40 43.5 37 L43 23 Q38 16.5 32 16.5 Q26 16.5 21 23 L20.5 37 Q19.5 40 16.5 38 Z" fill="${H}"/>`)
      break
    case 'bun':
      parts.push(`<path d="M18 24.5 Q18 11.5 32 11.5 Q46 11.5 46 24.5 Q44.5 16 32 15.5 Q19.5 16 18 24.5 Z" fill="${H}"/>`)
      parts.push(`<circle cx="32" cy="8.5" r="4.6" fill="${H}"/>`)
      break
    default:
      parts.push(`<path d="M17.5 25 Q17.5 10.5 32 10.5 Q46.5 10.5 46.5 25 Q45 16 32 15.5 Q19 16 17.5 25 Z" fill="${H}"/>`)
  }

  // glasses (rendered last so they sit on top of eyes)
  if (p.glasses === 'normal') {
    parts.push(`<rect x="20" y="24.2" width="9.5" height="6" rx="1.8" fill="none" stroke="#2a2a2a" stroke-width="1.4"/>`)
    parts.push(`<rect x="34.5" y="24.2" width="9.5" height="6" rx="1.8" fill="none" stroke="#2a2a2a" stroke-width="1.4"/>`)
    parts.push(`<line x1="29.5" y1="27.2" x2="34.5" y2="27.2" stroke="#2a2a2a" stroke-width="1.2"/>`)
    parts.push(`<line x1="13.5" y1="27.2" x2="20" y2="27.2" stroke="#2a2a2a" stroke-width="1.2"/>`)
    parts.push(`<line x1="44" y1="27.2" x2="50.5" y2="27.2" stroke="#2a2a2a" stroke-width="1.2"/>`)
  } else if (p.glasses === 'sunglasses') {
    parts.push(`<rect x="20" y="24.2" width="9.5" height="6" rx="1.8" fill="#111" fill-opacity="0.87"/>`)
    parts.push(`<rect x="34.5" y="24.2" width="9.5" height="6" rx="1.8" fill="#111" fill-opacity="0.87"/>`)
    parts.push(`<line x1="29.5" y1="27.2" x2="34.5" y2="27.2" stroke="#333" stroke-width="1.4"/>`)
    parts.push(`<line x1="13.5" y1="27.2" x2="20" y2="27.2" stroke="#333" stroke-width="1.4"/>`)
    parts.push(`<line x1="44" y1="27.2" x2="50.5" y2="27.2" stroke="#333" stroke-width="1.4"/>`)
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${parts.join('')}</svg>`
}
