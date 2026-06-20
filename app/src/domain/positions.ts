import type { Player, Position } from '../data/types'

/** Detailed position fit of a player for a given formation slot. */
export type PosFit = 'green' | 'yellow' | 'red'

/** Canonical detailed FC26 position codes. */
const CANON = new Set([
  'GK', 'CB', 'LB', 'RB', 'LWB', 'RWB', 'CDM', 'CM', 'CAM', 'LM', 'RM', 'LW', 'RW', 'CF', 'ST',
])

/** Formation slot labels (formations.ts) → canonical FC26 code. */
const LABEL_TO_CANON: Record<string, string> = {
  GK: 'GK',
  RB: 'RB', LB: 'LB', CB: 'CB',
  RWB: 'RWB', LWB: 'LWB',
  DM: 'CDM', CDM: 'CDM',
  CM: 'CM', RCM: 'CM', LCM: 'CM',
  RM: 'RM', LM: 'LM',
  CAM: 'CAM', AM: 'CAM',
  RAM: 'RM', LAM: 'LM',
  RW: 'RW', LW: 'LW',
  ST: 'ST', CF: 'CF',
}

/** Broad role → representative canonical code (fallback when no positions[]). */
const BROAD_TO_CANON: Record<Position, string> = { GK: 'GK', DF: 'CB', MF: 'CM', FW: 'ST' }

/** Positions considered "adjacent" (competent, → yellow) for each canonical slot. */
const ADJ: Record<string, string[]> = {
  GK: [],
  CB: ['LB', 'RB', 'CDM', 'LWB', 'RWB'],
  LB: ['CB', 'LWB', 'LM', 'LW'],
  RB: ['CB', 'RWB', 'RM', 'RW'],
  LWB: ['LB', 'LM', 'LW', 'CB'],
  RWB: ['RB', 'RM', 'RW', 'CB'],
  CDM: ['CM', 'CB', 'CAM'],
  CM: ['CDM', 'CAM', 'LM', 'RM'],
  CAM: ['CM', 'CDM', 'CF', 'LW', 'RW', 'LM', 'RM', 'ST'],
  LM: ['LW', 'CM', 'LWB', 'LB', 'CAM'],
  RM: ['RW', 'CM', 'RWB', 'RB', 'CAM'],
  LW: ['LM', 'CAM', 'ST', 'CF', 'LWB', 'RW'],
  RW: ['RM', 'CAM', 'ST', 'CF', 'RWB', 'LW'],
  CF: ['ST', 'CAM', 'LW', 'RW'],
  ST: ['CF', 'LW', 'RW', 'CAM'],
}

/** Canonicalize a formation slot label to an FC26 code. */
export function slotCanon(label: string): string {
  const up = label.toUpperCase()
  return LABEL_TO_CANON[up] ?? (CANON.has(up) ? up : 'CM')
}

/** The player's detailed positions (canonical), with a broad-role fallback. */
export function playerPositions(p: Pick<Player, 'positions' | 'primaryPosition' | 'position'>): string[] {
  const raw = (p.positions && p.positions.length ? p.positions : null)
    ?? (p.primaryPosition ? [p.primaryPosition] : null)
  if (raw) return raw.map((c) => c.toUpperCase()).filter((c) => CANON.has(c))
  return [BROAD_TO_CANON[p.position]]
}

/**
 * Green  = player can play the slot's exact position.
 * Yellow = player plays an adjacent position.
 * Red    = neither (out of position).
 */
export function positionFit(slotLabel: string, p: Pick<Player, 'positions' | 'primaryPosition' | 'position'>): PosFit {
  const slot = slotCanon(slotLabel)
  const pos = playerPositions(p)
  if (pos.includes(slot)) return 'green'
  const adj = ADJ[slot] ?? []
  if (pos.some((c) => adj.includes(c))) return 'yellow'
  return 'red'
}

export const POS_FIT_COLOR: Record<PosFit, string> = {
  green: '#34c46a',
  yellow: '#e6b23a',
  red: '#e0485a',
}
