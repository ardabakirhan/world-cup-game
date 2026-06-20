import type { Player, Position } from '../data/types'

/** Visual fit indicator shown on pitch chips. */
export type PosFit = 'green' | 'yellow' | 'red'

/** Detailed grade used for OVR penalties and engine effectiveness multipliers. */
export type FitGrade = 'natural' | 'adjacent' | 'wrong' | 'gk_swap'

/** All canonical FC26 detailed position codes. */
const CANON = new Set([
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM',
  'LM', 'RM', 'LW', 'RW', 'CF', 'ST', 'SS',
])

/** Formation slot labels → canonical FC26 code. */
const LABEL_TO_CANON: Record<string, string> = {
  GK: 'GK',
  RB: 'RB', LB: 'LB', CB: 'CB',
  RWB: 'RWB', LWB: 'LWB',
  DM: 'CDM', CDM: 'CDM',
  CM: 'CM', RCM: 'CM', LCM: 'CM',
  RM: 'RM', LM: 'LM',
  CAM: 'CAM', AM: 'CAM',
  // 4-2-3-1 wide attacking mids: left=LM, right=RM
  RAM: 'RM', LAM: 'LM',
  RW: 'RW', LW: 'LW',
  ST: 'ST', CF: 'CF', SS: 'SS',
}

/** Broad role fallback when no positions[] available. */
const BROAD_TO_CANON: Record<Position, string> = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' }

/**
 * Adjacent positions per canonical slot: playing in this slot with one of
 * these positions earns only a minor (-3 OVR) penalty, not the full wrong-pos
 * penalty. List is asymmetric by design — a CAM can drop to CM but a pure CDM
 * is not comfortable in a CAM role.
 */
const ADJ: Record<string, string[]> = {
  GK:  [],
  CB:  ['RB', 'LB'],
  RB:  ['CB', 'RWB'],
  LB:  ['CB', 'LWB'],
  RWB: ['RB', 'RM', 'RW'],
  LWB: ['LB', 'LM', 'LW'],
  CDM: ['CM', 'CB'],
  CM:  ['CDM', 'CAM', 'RM', 'LM'],
  CAM: ['CM', 'RW', 'LW', 'SS'],
  RM:  ['RW', 'CM', 'RB', 'CAM'],
  LM:  ['LW', 'CM', 'LB', 'CAM'],
  RW:  ['RM', 'CAM', 'ST', 'LW'],
  LW:  ['LM', 'CAM', 'ST', 'RW'],
  SS:  ['CAM', 'ST'],
  ST:  ['SS', 'CAM', 'RW', 'LW'],
  CF:  ['ST', 'CAM', 'SS'],
}

/** Resolve a formation slot label to its canonical FC26 position code. */
export function slotCanon(label: string): string {
  const up = label.toUpperCase()
  return LABEL_TO_CANON[up] ?? (CANON.has(up) ? up : 'CM')
}

/** The player's detailed FC26 positions (canonical), with broad-role fallback. */
export function playerPositions(p: Pick<Player, 'positions' | 'primaryPosition' | 'position'>): string[] {
  const raw = (p.positions && p.positions.length ? p.positions : null)
    ?? (p.primaryPosition ? [p.primaryPosition] : null)
  if (raw) return raw.map((c) => c.toUpperCase()).filter((c) => CANON.has(c))
  return [BROAD_TO_CANON[p.position]]
}

/**
 * Three-tier visual fit for pitch chip color-coding:
 * green = natural, yellow = adjacent, red = wrong / GK swap.
 */
export function positionFit(
  slotLabel: string,
  p: Pick<Player, 'positions' | 'primaryPosition' | 'position'>,
): PosFit {
  const grade = positionFitGrade(slotLabel, p)
  if (grade === 'natural') return 'green'
  if (grade === 'adjacent') return 'yellow'
  return 'red'
}

/**
 * Four-tier grade used for OVR penalty and engine effectiveness:
 * - natural  — player's positions[] contains the slot code            → 0 OVR penalty
 * - adjacent — one of the player's positions is adjacent to the slot  → −3 OVR
 * - wrong    — no match or adjacency                                  → −10 OVR
 * - gk_swap  — GK playing outfield or outfield player in GK slot      → −20 OVR
 */
export function positionFitGrade(
  slotLabel: string,
  p: Pick<Player, 'positions' | 'primaryPosition' | 'position'>,
): FitGrade {
  const slot = slotCanon(slotLabel)
  const pos  = playerPositions(p)

  // GK swap is always the harshest case
  if (slot === 'GK' && !pos.includes('GK')) return 'gk_swap'
  if (pos.includes('GK') && slot !== 'GK')   return 'gk_swap'

  if (pos.includes(slot)) return 'natural'

  const adj = ADJ[slot] ?? []
  if (pos.some((c) => adj.includes(c))) return 'adjacent'

  return 'wrong'
}

/** Flat OVR points subtracted from display effective-OVR. */
export const OVR_PENALTY: Record<FitGrade, number> = {
  natural:  0,
  adjacent: 3,
  wrong:    10,
  gk_swap:  20,
}

/**
 * Engine effectiveness multiplier per grade, calibrated at OVR ≈ 75:
 * adjacent → ×0.96 (≈ −3), wrong → ×0.87 (≈ −10), gk_swap → ×0.73 (≈ −20).
 */
export const EFF_MULT: Record<FitGrade, number> = {
  natural:  1.00,
  adjacent: 0.96,
  wrong:    0.87,
  gk_swap:  0.73,
}

export const POS_FIT_COLOR: Record<PosFit, string> = {
  green:  '#34c46a',
  yellow: '#e6b23a',
  red:    '#e0485a',
}
