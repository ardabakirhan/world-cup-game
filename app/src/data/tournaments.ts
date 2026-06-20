/**
 * Tournament registry.
 *
 * Lock mechanism: each entry is unlocked when the corresponding
 * `src/data/tournaments/{id}.json` data file exists at build time.
 * Vite resolves the glob statically — drop a JSON file here to unlock.
 * WC_2026 is always unlocked (its data lives in teams.json).
 */

export type TournamentConfederation =
  | 'ALL' | 'UEFA' | 'CAF' | 'AFC' | 'CONCACAF' | 'CONMEBOL' | 'OFC'

export interface TournamentConfig {
  id: string
  teamCount: number
  groups: number       // 0 = no group stage (league format)
  teamsPerGroup: number
  confederation: TournamentConfederation
  /** Resolved at build time: true when tournaments/{id}.json exists */
  unlocked: boolean
}

// Resolved at Vite build time — add tournaments/{id}.json to unlock
const _dataFiles = import.meta.glob('./tournaments/*.json')

function isUnlocked(id: string): boolean {
  if (id === 'WC_2026') return true   // always available — data in teams.json
  return (`./tournaments/${id}.json` in _dataFiles)
}

const _CONFIGS: Omit<TournamentConfig, 'unlocked'>[] = [
  { id: 'WC_2026',        teamCount: 48, groups: 12, teamsPerGroup: 4, confederation: 'ALL'      },
  { id: 'EURO_2028',      teamCount: 24, groups:  6, teamsPerGroup: 4, confederation: 'UEFA'     },
  { id: 'COPA_2027',      teamCount: 16, groups:  4, teamsPerGroup: 4, confederation: 'CONMEBOL' },
  { id: 'AFCON_2027',     teamCount: 24, groups:  6, teamsPerGroup: 4, confederation: 'CAF'      },
  { id: 'ASIAN_CUP_2027', teamCount: 24, groups:  6, teamsPerGroup: 4, confederation: 'AFC'      },
  { id: 'GOLD_CUP_2027',  teamCount: 16, groups:  4, teamsPerGroup: 4, confederation: 'CONCACAF' },
  { id: 'OFC_2027',       teamCount:  8, groups:  2, teamsPerGroup: 4, confederation: 'OFC'      },
  { id: 'NATIONS_LEAGUE', teamCount: 54, groups:  0, teamsPerGroup: 0, confederation: 'UEFA'     },
]

export const TOURNAMENTS: TournamentConfig[] = _CONFIGS.map((c) => ({
  ...c,
  unlocked: isUnlocked(c.id),
}))

export function getTournament(id: string): TournamentConfig | undefined {
  return TOURNAMENTS.find((t) => t.id === id)
}

// Confederation badge colours (CSS hex)
export const CONF_COLOR: Record<TournamentConfederation, string> = {
  ALL:      '#f59e0b',
  UEFA:     '#3b82f6',
  CAF:      '#f97316',
  AFC:      '#22c55e',
  CONCACAF: '#06b6d4',
  CONMEBOL: '#eab308',
  OFC:      '#a855f7',
}
