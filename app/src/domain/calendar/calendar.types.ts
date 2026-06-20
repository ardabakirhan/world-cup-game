import type { MatchResult } from '../types'

export interface GameDate {
  year: number
  month: number
  day: number
}

// Career epoch: career-global day 0 = June 11, 2026
export const CAREER_EPOCH: GameDate = { year: 2026, month: 6, day: 11 }

export function dateToCareerDay(d: GameDate): number {
  const epoch = new Date(CAREER_EPOCH.year, CAREER_EPOCH.month - 1, CAREER_EPOCH.day)
  const target = new Date(d.year, d.month - 1, d.day)
  return Math.round((target.getTime() - epoch.getTime()) / 86400000)
}

export function careerDayToDate(n: number): GameDate {
  const d = new Date(CAREER_EPOCH.year, CAREER_EPOCH.month - 1, CAREER_EPOCH.day + n)
  return { year: d.getFullYear(), month: d.getMonth() + 1, day: d.getDate() }
}

export function formatGameDate(d: GameDate, lang: 'tr' | 'en' = 'en'): string {
  const locale = lang === 'tr' ? 'tr-TR' : 'en-GB'
  return new Date(d.year, d.month - 1, d.day).toLocaleDateString(locale, {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export type WindowType = 'wc' | 'tournament' | 'nations_league' | 'qual' | 'friendly'

export interface CalendarWindow {
  id: string
  type: WindowType
  competition: string
  dateStart: GameDate
  dateEnd: GameDate
  userParticipates: boolean
  teamsInvolved: string[]
}

export type MatchType = 'group' | 'knockout' | 'qual' | 'friendly' | 'playoff' | 'nl_final'

// Extended Fixture — fully compatible with existing engine (has all Fixture fields)
export interface ScheduledMatch {
  id: string
  round: string          // reuse Round values + 'NL_MD1'..'NL_MD6', 'QUAL_MD1'..
  day: number            // career-global day
  group?: string
  homeId: string | null
  awayId: string | null
  slotHome?: string
  slotAway?: string
  result?: MatchResult
  // calendar extensions
  windowId: string
  competition: string
  matchType: MatchType
  leg?: 1 | 2
  simulated: boolean
}

export interface QualGroup {
  id: string             // e.g. "WC2030_UEFA_A"
  confederation: string
  teams: string[]
  matchIds: string[]
  directSlots: number
  playoffSlots: number
}

export interface NLGroup {
  id: string             // "NL_A1" | "NL_B3" | ...
  league: 'A' | 'B' | 'C' | 'D'
  groupNum: number
  teams: string[]
  promotionSlots: number
  relegationSlots: number
}

export type CompetitionOutcome =
  | 'winner' | 'finalist' | 'semifinal' | 'quarter'
  | 'group_stage' | 'qual_success' | 'qual_fail' | 'relegated' | 'did_not_qualify'

export interface CompetitionResult {
  competition: string
  windowId: string
  outcome: CompetitionOutcome
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  day: number
}
