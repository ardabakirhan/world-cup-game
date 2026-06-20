/** Round SVG country flags (circle-flags, all 211 teams). */

// FIFA trigram -> ISO/circle-flags file name
export const FIFA_TO_ISO: Record<string, string> = {
  // ── WC 2026 original 48 ──────────────────────────────────────────────
  MEX: 'mx', KOR: 'kr', RSA: 'za', CZE: 'cz',
  CAN: 'ca', SUI: 'ch', QAT: 'qa', BIH: 'ba',
  BRA: 'br', MAR: 'ma', SCO: 'gb-sct', HAI: 'ht',
  AUS: 'au', PAR: 'py', TUR: 'tr', USA: 'us',
  CIV: 'ci', CUW: 'cw', ECU: 'ec', GER: 'de',
  JPN: 'jp', NED: 'nl', SWE: 'se', TUN: 'tn',
  BEL: 'be', EGY: 'eg', IRN: 'ir', NZL: 'nz',
  CPV: 'cv', ESP: 'es', KSA: 'sa', URU: 'uy',
  FRA: 'fr', IRQ: 'iq', NOR: 'no', SEN: 'sn',
  ALG: 'dz', ARG: 'ar', AUT: 'at', JOR: 'jo',
  COD: 'cd', COL: 'co', POR: 'pt', UZB: 'uz',
  CRO: 'hr', ENG: 'gb-eng', GHA: 'gh', PAN: 'pa',
  // ── UEFA (additional) ────────────────────────────────────────────────
  ALB: 'al', AND: 'ad', ARM: 'am', AZE: 'az',
  BLR: 'by', BUL: 'bg', CYP: 'cy', DEN: 'dk',
  EST: 'ee', FIN: 'fi', FRO: 'fo', GEO: 'ge',
  GIB: 'gi', GRE: 'gr', HUN: 'hu', IRL: 'ie',
  ISL: 'is', ISR: 'il', ITA: 'it', KAZ: 'kz',
  KOS: 'xk', LIE: 'li', LTU: 'lt', LUX: 'lu',
  LVA: 'lv', MDA: 'md', MKD: 'mk', MLT: 'mt',
  MNE: 'me', NIR: 'gb-nir', POL: 'pl', ROU: 'ro',
  RUS: 'ru', SRB: 'rs', SVK: 'sk', SVN: 'si',
  SMR: 'sm', UKR: 'ua', WAL: 'gb-wls',
  // ── CAF (Africa) ─────────────────────────────────────────────────────
  ANG: 'ao', BDI: 'bi', BEN: 'bj', BOT: 'bw',
  BFA: 'bf', CGO: 'cg', CHA: 'td', CMR: 'cm',
  COM: 'km', CTA: 'cf', DJI: 'dj', EQG: 'gq',
  ERI: 'er', ETH: 'et', GAB: 'ga', GAM: 'gm',
  GNB: 'gw', GUI: 'gn', KEN: 'ke', LBA: 'ly',
  LBR: 'lr', LES: 'ls', MAD: 'mg', MAW: 'mw',
  MLI: 'ml', MOZ: 'mz', MRI: 'mu', MTN: 'mr',
  NAM: 'na', NGA: 'ng', NIG: 'ne', RWA: 'rw',
  SDN: 'sd', SEY: 'sc', SLE: 'sl', SOM: 'so',
  SSD: 'ss', STP: 'st', SWZ: 'sz', TAN: 'tz',
  TOG: 'tg', UGA: 'ug', ZAM: 'zm', ZIM: 'zw',
  // ── AFC (Asia) ───────────────────────────────────────────────────────
  AFG: 'af', BAN: 'bd', BHR: 'bh', BHU: 'bt',
  BRU: 'bn', CAM: 'kh', CHN: 'cn', GUM: 'gu',
  HKG: 'hk', IDN: 'id', IND: 'in', KGZ: 'kg',
  KUW: 'kw', LAO: 'la', LIB: 'lb', MAC: 'mo',
  MAS: 'my', MDV: 'mv', MNG: 'mn', MYA: 'mm',
  NEP: 'np', OMA: 'om', PAK: 'pk', PHI: 'ph',
  PLE: 'ps', PRK: 'kp', SGP: 'sg', SRI: 'lk',
  SYR: 'sy', THA: 'th', TJK: 'tj', TKM: 'tm',
  TLS: 'tl', TPE: 'tw', UAE: 'ae', VIE: 'vn',
  YEM: 'ye',
  // ── CONCACAF ─────────────────────────────────────────────────────────
  AIA: 'ai', ARU: 'aw', ATG: 'ag', BAH: 'bs',
  BER: 'bm', BLZ: 'bz', BRB: 'bb', CAY: 'ky',
  CRC: 'cr', CUB: 'cu', DMA: 'dm', DOM: 'do',
  GRN: 'gd', GUA: 'gt', GUY: 'gy', HON: 'hn',
  JAM: 'jm', LCA: 'lc', MSR: 'ms', NCA: 'ni',
  PUR: 'pr', SKN: 'kn', SLV: 'sv', SUR: 'sr',
  TCA: 'tc', TRI: 'tt', VGB: 'vg', VIN: 'vc',
  VIR: 'vi',
  // ── CONMEBOL ─────────────────────────────────────────────────────────
  BOL: 'bo', CHI: 'cl', PER: 'pe', VEN: 've',
  // ── OFC (Oceania) ────────────────────────────────────────────────────
  ASA: 'as', COK: 'ck', FIJ: 'fj', NCL: 'nc',
  PNG: 'pg', SAM: 'ws', SOL: 'sb', TAH: 'pf',
  TGA: 'to', VAN: 'vu',
}

const FLAG_URLS = import.meta.glob('../assets/flags/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

function urlFor(fifaCode: string): string | null {
  const iso = FIFA_TO_ISO[fifaCode]
  if (!iso) return null
  return FLAG_URLS[`../assets/flags/${iso}.svg`] ?? null
}

export function Flag(props: { code: string; size: number; className?: string }) {
  const url = urlFor(props.code)
  if (!url) {
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--card2)] text-[8px] font-bold text-[var(--muted)] ${props.className ?? ''}`}
        style={{ width: props.size, height: props.size }}
      >
        {props.code}
      </span>
    )
  }
  return (
    <img
      src={url}
      alt={props.code}
      className={`inline-block shrink-0 rounded-full ${props.className ?? ''}`}
      style={{ width: props.size, height: props.size }}
      draggable={false}
    />
  )
}
