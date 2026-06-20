/** Primary kit colour per team — used as the UI accent colour. */
export const TEAM_COLORS: Record<string, string> = {
  MEX: '#0b6b4f', KOR: '#d2233c', RSA: '#0a7a4b', CZE: '#d6273b',
  CAN: '#d52b1e', SUI: '#d6273b', QAT: '#7d1c2c', BIH: '#1f3a93',
  BRA: '#f5c518', MAR: '#c1272d', SCO: '#1f3a93', HAI: '#1f4fc1',
  USA: '#1f3a93', TUR: '#d6273b', AUS: '#f5c518', PAR: '#d2233c',
  GER: '#e8eaf0', ECU: '#f5c518', CIV: '#f08c1e', CUW: '#1f4fc1',
  NED: '#f08c1e', JPN: '#1f3a93', TUN: '#d2233c', SWE: '#f5c518',
  BEL: '#d2233c', IRN: '#2ea36b', EGY: '#d2233c', NZL: '#e8eaf0',
  ESP: '#d2233c', URU: '#5aa9e6', KSA: '#2ea36b', CPV: '#1f4fc1',
  FRA: '#1f3a93', SEN: '#2ea36b', NOR: '#d2233c', IRQ: '#2ea36b',
  ARG: '#75c4ee', ALG: '#2ea36b', AUT: '#d2233c', JOR: '#d2233c',
  POR: '#a4262c', COL: '#f5c518', UZB: '#5aa9e6', COD: '#1f4fc1',
  ENG: '#e8eaf0', CRO: '#d2233c', PAN: '#d2233c', GHA: '#e8eaf0',
}

export function teamColor(id: string): string {
  return TEAM_COLORS[id] ?? '#e11d2e'
}
