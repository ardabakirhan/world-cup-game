import type { NLGroup } from './calendar.types'

// Source: https://en.wikipedia.org/wiki/2026%E2%80%9327_UEFA_Nations_League
// Fetched 2026-06-11
export const NL_2627_GROUPS: NLGroup[] = [
  // League A — 4 groups × 4 teams
  { id: 'NL_A1', league: 'A', groupNum: 1, teams: ['FRA', 'ITA', 'BEL', 'TUR'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_A2', league: 'A', groupNum: 2, teams: ['GER', 'NED', 'SRB', 'GRE'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_A3', league: 'A', groupNum: 3, teams: ['ESP', 'CRO', 'ENG', 'CZE'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_A4', league: 'A', groupNum: 4, teams: ['POR', 'DEN', 'NOR', 'WAL'], promotionSlots: 1, relegationSlots: 1 },
  // League B — 4 groups × 4 teams
  { id: 'NL_B1', league: 'B', groupNum: 1, teams: ['SCO', 'SUI', 'SVN', 'MKD'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_B2', league: 'B', groupNum: 2, teams: ['HUN', 'UKR', 'GEO', 'NIR'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_B3', league: 'B', groupNum: 3, teams: ['ISR', 'AUT', 'IRL', 'KOS'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_B4', league: 'B', groupNum: 4, teams: ['POL', 'BIH', 'ROU', 'SWE'], promotionSlots: 1, relegationSlots: 1 },
  // League C — 4 groups × 4 teams
  { id: 'NL_C1', league: 'C', groupNum: 1, teams: ['ALB', 'FIN', 'BLR', 'SMR'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_C2', league: 'C', groupNum: 2, teams: ['MNE', 'ARM', 'CYP', 'LVA'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_C3', league: 'C', groupNum: 3, teams: ['KAZ', 'SVK', 'FRO', 'MDA'], promotionSlots: 1, relegationSlots: 1 },
  { id: 'NL_C4', league: 'C', groupNum: 4, teams: ['ISL', 'BUL', 'EST', 'LUX'], promotionSlots: 1, relegationSlots: 1 },
  // League D — 2 groups × 3 teams
  { id: 'NL_D1', league: 'D', groupNum: 1, teams: ['GIB', 'MLT', 'LIE'], promotionSlots: 1, relegationSlots: 0 },
  { id: 'NL_D2', league: 'D', groupNum: 2, teams: ['AZE', 'LTU', 'AND'], promotionSlots: 1, relegationSlots: 0 },
]

// Real 2026-27 NL matchday date ranges
export const NL_2627_DATES = {
  MD1_2:       { startDay: dateKey(2026, 9, 24),  endDay: dateKey(2026, 9, 29) },
  MD3_4:       { startDay: dateKey(2026, 10, 1),  endDay: dateKey(2026, 10, 6) },
  MD5_6:       { startDay: dateKey(2026, 11, 12), endDay: dateKey(2026, 11, 17) },
  QF_PLAYOFFS: { startDay: dateKey(2027, 3, 25),  endDay: dateKey(2027, 3, 30) },
  FINALS:      { startDay: dateKey(2027, 6, 9),   endDay: dateKey(2027, 6, 13) },
}

function dateKey(y: number, m: number, d: number) {
  return { year: y, month: m, day: d }
}

export function findNLGroup(teamCode: string): NLGroup | undefined {
  return NL_2627_GROUPS.find((g) => g.teams.includes(teamCode))
}

// All UEFA team codes in NL order (A→D, group 1→4)
export const UEFA_NL_TEAMS: string[] = NL_2627_GROUPS.flatMap((g) => g.teams)
