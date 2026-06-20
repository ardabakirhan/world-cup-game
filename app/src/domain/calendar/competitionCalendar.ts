import { dateToCareerDay, type GameDate } from './calendar.types'

// Each competition window with fixed real-world dates
export interface WindowDef {
  id: string
  label: string
  type: 'wc' | 'tournament' | 'nations_league' | 'qual' | 'friendly'
  startDate: GameDate
  endDate: GameDate
  // which confederations participate (empty = all)
  confederations: string[]
  subCompetitions?: string[]  // for SUMMER_2027: ['AFCON_2027','COPA_2027',...]
}

export const WINDOW_DEFS: WindowDef[] = [
  {
    id: 'WC_2026',
    label: 'FIFA World Cup 2026',
    type: 'wc',
    startDate: { year: 2026, month: 6,  day: 11 },
    endDate:   { year: 2026, month: 7,  day: 19 },
    confederations: [],  // all — but only 48 WC-qualified teams
  },
  {
    id: 'FRIENDLY_JUN_2026',
    label: 'Pre-Season Friendlies',
    type: 'friendly',
    startDate: { year: 2026, month: 6,  day: 11 },
    endDate:   { year: 2026, month: 7,  day: 19 },
    confederations: [],
  },
  {
    id: 'FRIENDLY_SEP_2026',
    label: 'International Friendly Window',
    type: 'friendly',
    startDate: { year: 2026, month: 9,  day: 1 },
    endDate:   { year: 2026, month: 10, day: 10 },
    confederations: [],
  },
  {
    id: 'CNL_2627_GROUP',
    label: 'CONCACAF Nations League 2026-27',
    type: 'nations_league',
    startDate: { year: 2026, month: 9,  day: 4 },
    endDate:   { year: 2026, month: 11, day: 17 },
    confederations: ['CONCACAF'],
  },
  {
    id: 'AFCON_QUAL_2627',
    label: 'AFCON 2027 Qualifying',
    type: 'qual',
    startDate: { year: 2026, month: 10, day: 1 },
    endDate:   { year: 2027, month: 6,  day: 15 },
    confederations: ['CAF'],
  },
  {
    id: 'OFC_NC_2026',
    label: 'OFC Nations Cup 2026',
    type: 'tournament',
    startDate: { year: 2026, month: 9,  day: 1 },
    endDate:   { year: 2026, month: 10, day: 15 },
    confederations: ['OFC'],
  },
  {
    id: 'FRIENDLY_AUG_2026',
    label: 'International Friendly Window',
    type: 'friendly',
    startDate: { year: 2026, month: 8,  day: 15 },
    endDate:   { year: 2026, month: 8,  day: 20 },
    confederations: [],
  },
  {
    id: 'NL_2627_GROUP',
    label: 'UEFA Nations League 2026-27',
    type: 'nations_league',
    startDate: { year: 2026, month: 9,  day: 24 },
    endDate:   { year: 2026, month: 11, day: 17 },
    confederations: ['UEFA'],
  },
  {
    id: 'FRIENDLY_DEC_2026',
    label: 'International Friendly Window',
    type: 'friendly',
    startDate: { year: 2026, month: 12, day: 1 },
    endDate:   { year: 2026, month: 12, day: 5 },
    confederations: [],
  },
  {
    id: 'NL_2627_KO',
    label: 'UEFA Nations League Knockouts',
    type: 'nations_league',
    startDate: { year: 2027, month: 3,  day: 25 },
    endDate:   { year: 2027, month: 3,  day: 30 },
    confederations: ['UEFA'],
  },
  {
    id: 'NL_2627_FINALS',
    label: 'UEFA Nations League Finals',
    type: 'nations_league',
    startDate: { year: 2027, month: 6,  day: 9 },
    endDate:   { year: 2027, month: 6,  day: 13 },
    confederations: ['UEFA'],
  },
  {
    id: 'SUMMER_2027',
    label: 'Continental Tournaments 2027',
    type: 'tournament',
    startDate: { year: 2027, month: 6,  day: 19 },
    endDate:   { year: 2027, month: 7,  day: 18 },
    confederations: ['CAF', 'AFC', 'CONCACAF', 'CONMEBOL', 'OFC'],
    subCompetitions: ['AFCON_2027', 'ASIAN_CUP_2027', 'GOLD_CUP_2027', 'COPA_2027', 'OFC_2027'],
  },
  {
    id: 'WC2030_QUAL',
    label: 'WC 2030 Qualification',
    type: 'qual',
    startDate: { year: 2027, month: 9,  day: 1 },
    endDate:   { year: 2029, month: 3,  day: 31 },
    confederations: [],
  },
  {
    id: 'EURO_2028',
    label: 'UEFA Euro 2028',
    type: 'tournament',
    startDate: { year: 2028, month: 6,  day: 1 },
    endDate:   { year: 2028, month: 7,  day: 14 },
    confederations: ['UEFA'],
  },
  {
    id: 'WC_2030',
    label: 'FIFA World Cup 2030',
    type: 'wc',
    startDate: { year: 2030, month: 6,  day: 1 },
    endDate:   { year: 2030, month: 7,  day: 13 },
    confederations: [],
  },
]

/** Career-global day offset for a date (day 0 = June 11, 2026) */
export function windowStartDay(id: string): number {
  const w = WINDOW_DEFS.find((x) => x.id === id)
  return w ? dateToCareerDay(w.startDate) : 0
}

export function windowEndDay(id: string): number {
  const w = WINDOW_DEFS.find((x) => x.id === id)
  return w ? dateToCareerDay(w.endDate) : 0
}

// Sub-competition label per confederation in SUMMER_2027
export const SUMMER_2027_COMP: Record<string, string> = {
  CAF:      'AFCON_2027',
  AFC:      'ASIAN_CUP_2027',
  CONCACAF: 'GOLD_CUP_2027',
  CONMEBOL: 'COPA_2027',
  OFC:      'OFC_2027',
}

// Continental tournament team counts (approximate — determines group count)
export const TOURNAMENT_SIZE: Record<string, { groups: number; teamsPerGroup: number; koStart: number }> = {
  AFCON_2027:     { groups: 6, teamsPerGroup: 4, koStart: 16 },
  ASIAN_CUP_2027: { groups: 6, teamsPerGroup: 4, koStart: 16 },
  GOLD_CUP_2027:  { groups: 4, teamsPerGroup: 4, koStart: 8 },
  COPA_2027:      { groups: 4, teamsPerGroup: 4, koStart: 8 },
  OFC_2027:       { groups: 2, teamsPerGroup: 4, koStart: 4 },
  EURO_2028:      { groups: 6, teamsPerGroup: 4, koStart: 16 },
  WC_2026:        { groups: 12, teamsPerGroup: 4, koStart: 32 },
  WC_2030:        { groups: 12, teamsPerGroup: 4, koStart: 32 },
}

// WC 2030 qualification format per confederation
export interface QualFormat {
  confederation: string
  teams: number
  directSlots: number
  playoffSlots: number
  rounds: 1 | 2 | 3
  groupCount: number
}

export const WC2030_QUAL_FORMATS: QualFormat[] = [
  { confederation: 'UEFA',     teams: 54, directSlots: 16, playoffSlots: 4, rounds: 1, groupCount: 12 },
  { confederation: 'CONMEBOL', teams: 10, directSlots: 6,  playoffSlots: 1, rounds: 1, groupCount: 1  },
  { confederation: 'CAF',      teams: 54, directSlots: 9,  playoffSlots: 0, rounds: 2, groupCount: 9  },
  { confederation: 'AFC',      teams: 46, directSlots: 8,  playoffSlots: 1, rounds: 3, groupCount: 9  },
  { confederation: 'CONCACAF', teams: 41, directSlots: 6,  playoffSlots: 1, rounds: 2, groupCount: 8  },
  { confederation: 'OFC',      teams: 11, directSlots: 1,  playoffSlots: 0, rounds: 1, groupCount: 3  },
]
