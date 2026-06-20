import type { Team } from '../../data/types'
import type { CalendarWindow, ScheduledMatch, QualGroup, NLGroup, GameDate } from './calendar.types'
import { dateToCareerDay } from './calendar.types'
import { WINDOW_DEFS, SUMMER_2027_COMP, windowStartDay } from './competitionCalendar'
import { NL_2627_GROUPS } from './nationsLeague'
import {
  drawWC2030QualGroups, buildQualFixtures, buildNLGroupFixtures,
  buildFriendlyFixtures, buildTournamentGroupFixtures,
  drawCNLGroups, buildCNLGroupFixtures,
  drawAFCONQualGroups, buildAFCONQualFixtures,
} from './qualification'

// ------------------------------------------------------------------
// Main entry point — called once by gameStore.initCareer()
// ------------------------------------------------------------------

export interface CareerCalendar {
  windows: CalendarWindow[]
  schedule: ScheduledMatch[]
  qualGroups: QualGroup[]
  nlGroups: NLGroup[]
}

export function generateCareerCalendar(teamCode: string, allTeams: Team[]): CareerCalendar {
  const team = allTeams.find((t) => t.id === teamCode)
  if (!team) throw new Error(`Unknown team: ${teamCode}`)
  const conf = team.confederation

  // WC 2026 qualifier?
  const isWC2026 = team.tournaments?.some((tr) => tr.id === 'WC_2026' && tr.qualified) ?? false
  const wc2026Group = team.tournaments?.find((tr) => tr.id === 'WC_2026')?.group ?? null

  const windows: CalendarWindow[] = []
  const schedule: ScheduledMatch[] = []
  let qualGroups: QualGroup[] = []
  const nlGroups: NLGroup[] = [...NL_2627_GROUPS]

  // ── Window 1: WC 2026 / Pre-Season (Jun–Jul 2026) ───────────────
  if (isWC2026) {
    const wcTeams = allTeams.filter((t) => t.tournaments?.some((tr) => tr.id === 'WC_2026' && tr.qualified))
    windows.push(makeWindow('WC_2026', true, wcTeams.map((t) => t.id)))
    schedule.push(...buildWC2026Fixtures(wcTeams, teamCode, wc2026Group))
  } else {
    // Non-WC teams: pre-season friendlies during Jun–Jul 2026 window.
    // Career epoch is Jun 11 so friendlies start Jun 14 (first WC day for others).
    windows.push(makeWindow('FRIENDLY_JUN_2026', true, [teamCode]))
    const friendlyOpps = pickFriendlyOpponents(teamCode, conf, allTeams, 2)
    const base = dateToCareerDay({ year: 2026, month: 6, day: 14 })
    schedule.push(...buildFriendlyFixtures(teamCode, friendlyOpps, 'FRIENDLY_JUN_2026', base))
  }

  // ── Sep-Nov 2026: All-confederation competitions ──────────────────
  // Always generate all confederation fixtures for world simulation.
  // Windows are added to user's path only for their confederation.

  // UEFA Nations League — all 14 groups
  for (const g of NL_2627_GROUPS) {
    schedule.push(...buildNLGroupFixtures(g))
  }
  if (conf === 'UEFA') {
    const nlTeamIds = NL_2627_GROUPS.flatMap((g) => g.teams)
    windows.push(makeWindow('NL_2627_GROUP', true, nlTeamIds))
    windows.push(makeWindow('NL_2627_KO', false, []))
    windows.push(makeWindow('NL_2627_FINALS', false, []))
  }

  // CONCACAF Nations League — all CONCACAF teams, 3 leagues A/B/C
  const cnlGroups = drawCNLGroups(allTeams.filter((t) => t.confederation === 'CONCACAF'))
  nlGroups.push(...cnlGroups)
  for (const g of cnlGroups) {
    schedule.push(...buildCNLGroupFixtures(g))
  }
  if (conf === 'CONCACAF') {
    const cnlTeamIds = cnlGroups.flatMap((g) => g.teams)
    windows.push(makeWindow('CNL_2627_GROUP', true, cnlTeamIds))
  }

  // CAF — AFCON 2027 Qualifying (Oct 2026 – Jun 2027)
  const afconQualGroups = drawAFCONQualGroups(allTeams.filter((t) => t.confederation === 'CAF'))
  for (const qg of afconQualGroups) {
    const fixtures = buildAFCONQualFixtures(qg)
    qg.matchIds = fixtures.map((f) => f.id)
    schedule.push(...fixtures)
    qualGroups.push(qg)
  }
  if (conf === 'CAF') {
    const cafTeamIds = allTeams.filter((t) => t.confederation === 'CAF').map((t) => t.id)
    windows.push(makeWindow('AFCON_QUAL_2627', true, cafTeamIds))
  }

  // OFC — Nations Cup 2026 (Sep-Oct 2026)
  const ofcTeams = allTeams.filter((t) => t.confederation === 'OFC')
  const ofcGroups = buildOFCNCGroups(ofcTeams)
  const ofcBase = windowStartDay('OFC_NC_2026') + 1
  for (const og of ofcGroups) {
    schedule.push(...buildTournamentGroupFixtures([og], 'OFC_NC_2026', 'OFC_NC_2026', ofcBase))
  }
  if (conf === 'OFC') {
    const ofcTeamIds = ofcTeams.map((t) => t.id)
    windows.push(makeWindow('OFC_NC_2026', true, ofcTeamIds))
  }

  // CONMEBOL & AFC: Sep 2026 post-WC friendlies (no organized competition this window)
  if (conf === 'CONMEBOL' || conf === 'AFC') {
    const base = dateToCareerDay({ year: 2026, month: 9, day: 5 })
    const opps = pickFriendlyOpponents(teamCode, conf, allTeams, 2)
    windows.push(makeWindow('FRIENDLY_SEP_2026', true, [teamCode]))
    schedule.push(...buildFriendlyFixtures(teamCode, opps, 'FRIENDLY_SEP_2026', base))
  }

  // Dec 2026: gap-filler friendly for all non-UEFA teams
  if (conf !== 'UEFA') {
    const base = dateToCareerDay({ year: 2026, month: 12, day: 2 })
    const opps = pickFriendlyOpponents(teamCode, conf, allTeams, 1)
    windows.push(makeWindow('FRIENDLY_DEC_2026', true, [teamCode]))
    schedule.push(...buildFriendlyFixtures(teamCode, opps, 'FRIENDLY_DEC_2026', base))
  }

  // ── Window 4b: Continental summer 2027 ───────────────────────────
  const summer2027Comp = SUMMER_2027_COMP[conf]
  if (summer2027Comp) {
    const compTeams = selectTournamentTeams(conf, summer2027Comp, allTeams)
    windows.push(makeWindow('SUMMER_2027', compTeams.includes(teamCode), compTeams))

    if (compTeams.includes(teamCode)) {
      const groups = buildTournamentGroups(compTeams, summer2027Comp)
      const base = windowStartDay('SUMMER_2027') + 1
      schedule.push(...buildTournamentGroupFixtures(groups, 'SUMMER_2027', summer2027Comp, base))
    }
  } else if (conf === 'UEFA') {
    // UEFA has no summer tournament — friendly window bridges NL and WC2030 qual
    windows.push(makeWindow('SUMMER_2027', true, [teamCode]))
    const base = dateToCareerDay({ year: 2027, month: 6, day: 20 })
    const opps = pickFriendlyOpponents(teamCode, conf, allTeams, 1)
    schedule.push(...buildFriendlyFixtures(teamCode, opps, 'SUMMER_2027', base))
  }

  // ── Window 5: WC 2030 Qualification ──────────────────────────────
  const confTeams = allTeams.filter((t) => t.confederation === conf)
  const wc2030Groups = drawWC2030QualGroups(conf, confTeams)
  qualGroups.push(...wc2030Groups)
  windows.push(makeWindow('WC2030_QUAL', true, confTeams.map((t) => t.id)))
  for (const qg of wc2030Groups) {
    const fixtures = buildQualFixtures(qg, 'WC2030_QUAL')
    qg.matchIds = fixtures.map((f) => f.id)
    schedule.push(...fixtures)
  }

  // ── Window 6: EURO 2028 (UEFA) ───────────────────────────────────
  if (conf === 'UEFA') {
    const euroTeams = allTeams.filter((t) => t.confederation === 'UEFA')
    windows.push(makeWindow('EURO_2028', true, euroTeams.map((t) => t.id)))
    // EURO 2028 group fixtures will be built after qual completes
    // For now stub — actual draw happens in resolveQualification
  }

  // ── Window 8: WC 2030 ────────────────────────────────────────────
  const wc2030Teams = allTeams.map((t) => t.id)  // all 211, actual field set after qual
  windows.push(makeWindow('WC_2030', false, wc2030Teams))

  return { windows, schedule, qualGroups, nlGroups }
}

// ------------------------------------------------------------------
// WC 2026 fixture builder (mirrors existing schedule.ts buildGroupFixtures
// but returns ScheduledMatch instead of Fixture)
// ------------------------------------------------------------------

function buildWC2026Fixtures(
  wcTeams: Team[],
  _userTeam: string,
  _userGroup: string | null,
): ScheduledMatch[] {
  // 12 groups, 4 teams each, 3 group matchdays
  const groups = new Map<string, Team[]>()
  for (const t of wcTeams) {
    const g = t.tournaments?.find((tr) => tr.id === 'WC_2026')?.group
    if (!g) continue
    if (!groups.has(g)) groups.set(g, [])
    groups.get(g)!.push(t)
  }

  const WC_ROUND_DAYS: Record<string, number> = {
    G1: dateToCareerDay({ year: 2026, month: 6, day: 14 }),
    G2: dateToCareerDay({ year: 2026, month: 6, day: 20 }),
    G3: dateToCareerDay({ year: 2026, month: 6, day: 26 }),
    R32: dateToCareerDay({ year: 2026, month: 7, day: 1 }),
    R16: dateToCareerDay({ year: 2026, month: 7, day: 5 }),
    QF: dateToCareerDay({ year: 2026, month: 7, day: 8 }),
    SF: dateToCareerDay({ year: 2026, month: 7, day: 12 }),
    FINAL: dateToCareerDay({ year: 2026, month: 7, day: 19 }),
  }

  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]], [[0, 2], [3, 1]], [[0, 3], [1, 2]],
  ]
  const matches: ScheduledMatch[] = []

  groups.forEach((ts, g) => {
    pairs.forEach((roundPairs, ri) => {
      const round = `G${ri + 1}`
      for (const [a, b] of roundPairs) {
        if (!ts[a] || !ts[b]) continue
        matches.push({
          id: `WC2026-${round}-${g}-${ts[a].id}-${ts[b].id}`,
          round,
          day: WC_ROUND_DAYS[round],
          group: g,
          homeId: ts[a].id,
          awayId: ts[b].id,
          windowId: 'WC_2026',
          competition: 'WC_2026',
          matchType: 'group',
          simulated: false,
        })
      }
    })
  })

  // Placeholder R32 entries (homeId/awayId filled by progressBracket equivalent)
  for (let i = 1; i <= 16; i++) {
    matches.push({
      id: `WC2026-R32-${i}`,
      round: 'R32',
      day: WC_ROUND_DAYS.R32,
      homeId: null,
      awayId: null,
      windowId: 'WC_2026',
      competition: 'WC_2026',
      matchType: 'knockout',
      simulated: false,
    })
  }

  return matches
}

// ------------------------------------------------------------------
// Tournament team selection (first N by ranking_pts in confederation)
// Copa América: all 10 CONMEBOL + 6 top CONCACAF guests = 16 teams
// ------------------------------------------------------------------

function rankTeams(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const apts = (a as unknown as { ranking_pts?: number }).ranking_pts ?? 0
    const bpts = (b as unknown as { ranking_pts?: number }).ranking_pts ?? 0
    return bpts - apts
  })
}

function selectTournamentTeams(conf: string, comp: string, allTeams: Team[]): string[] {
  if (comp === 'COPA_2027') {
    // All 10 CONMEBOL teams + 6 top CONCACAF guests (Copa América format)
    const conmebol = rankTeams(allTeams.filter((t) => t.confederation === 'CONMEBOL'))
    const concacaf = rankTeams(allTeams.filter((t) => t.confederation === 'CONCACAF')).slice(0, 6)
    return [...conmebol, ...concacaf].map((t) => t.id)
  }
  const sizes: Record<string, number> = {
    AFCON_2027: 24, ASIAN_CUP_2027: 24, GOLD_CUP_2027: 16, OFC_2027: 8,
  }
  const size = sizes[comp] ?? 16
  return rankTeams(allTeams.filter((t) => t.confederation === conf))
    .slice(0, size)
    .map((t) => t.id)
}

function buildTournamentGroups(
  teamCodes: string[],
  comp: string,
): { id: string; teams: string[] }[] {
  const groupCounts: Record<string, number> = {
    AFCON_2027: 6, ASIAN_CUP_2027: 6, GOLD_CUP_2027: 4,
    COPA_2027: 4, OFC_2027: 2, EURO_2028: 6,
  }
  const n = groupCounts[comp] ?? 4
  const groupLetters = 'ABCDEFGHIJKL'.slice(0, n)
  const groups: { id: string; teams: string[] }[] = groupLetters.split('').map((l) => ({
    id: `${comp}_GRP_${l}`, teams: [],
  }))
  // Pot-based seeding: split teams into pots of n, assign one per group in order
  // This guarantees each group gets exactly Math.ceil(teams/n) teams and distributes
  // top seeds evenly. For Copa (16 teams, 4 groups): pots of 4 → 4 per group.
  for (let i = 0; i < teamCodes.length; i++) {
    const pot = Math.floor(i / n)
    const posInPot = i % n
    // Alternate direction per pot (snake) so pot 0 fills A-B-C-D, pot 1 fills D-C-B-A
    const gi = pot % 2 === 0 ? posInPot : n - 1 - posInPot
    if (groups[gi]) groups[gi].teams.push(teamCodes[i])
  }
  return groups
}

// ------------------------------------------------------------------
// OFC Nations Cup group builder (snake-seeded groups of 3-4)
// ------------------------------------------------------------------

function buildOFCNCGroups(teams: Team[]): { id: string; teams: string[] }[] {
  if (teams.length === 0) return []
  const sorted = rankTeams(teams)
  const numGroups = Math.max(2, Math.ceil(sorted.length / 4))
  const groups: string[][] = Array.from({ length: numGroups }, () => [])
  let forward = true, gi = 0
  for (const t of sorted) {
    groups[gi].push(t.id)
    if (forward) { gi++; if (gi >= numGroups) { gi = numGroups - 1; forward = false } }
    else { gi--; if (gi < 0) { gi = 0; forward = true } }
  }
  return groups
    .filter((g) => g.length > 0)
    .map((g, i) => ({ id: `OFC_NC_GRP_${String.fromCharCode(65 + i)}`, teams: g }))
}

// ------------------------------------------------------------------
// Friendly opponent picker
// ------------------------------------------------------------------

function pickFriendlyOpponents(
  teamCode: string,
  _conf: string,
  allTeams: Team[],
  count: number,
): string[] {
  // Pick nearby-ranked teams from any confederation, not the user's team
  const sorted = allTeams
    .filter((t) => t.id !== teamCode)
    .sort((a, b) => {
      const apts = (a as unknown as { ranking_pts?: number }).ranking_pts ?? 0
      const bpts = (b as unknown as { ranking_pts?: number }).ranking_pts ?? 0
      return Math.abs(apts - 1000) - Math.abs(bpts - 1000)  // closest to middle
    })
  // Simple deterministic pick based on teamCode hash
  let h = 0
  for (let i = 0; i < teamCode.length; i++) h = (h * 31 + teamCode.charCodeAt(i)) >>> 0
  const start = h % Math.max(1, sorted.length - count * 2)
  return sorted.slice(start, start + count).map((t) => t.id)
}

// ------------------------------------------------------------------
// Helper: make a CalendarWindow from a WINDOW_DEFS entry
// ------------------------------------------------------------------

function makeWindow(id: string, userParticipates: boolean, teamsInvolved: string[]): CalendarWindow {
  const def = WINDOW_DEFS.find((w) => w.id === id)!
  return {
    id,
    type: def.type,
    competition: def.label,
    dateStart: def.startDate,
    dateEnd: def.endDate,
    userParticipates,
    teamsInvolved,
  }
}

// ------------------------------------------------------------------
// simulateWindow — auto-sim all non-user matches in a window
// Returns top-5 world news strings
// ------------------------------------------------------------------

import { simulateMatch } from '../engine/matchEngine'
import { buildSide } from '../ai/lineup'
import type { PlayerStates } from '../types'

export function simulateWindowMatches(
  windowId: string,
  userTeam: string,
  schedule: ScheduledMatch[],
  playerStates: PlayerStates,
  careerSeed: number,
  currentDay: number,
): { updatedSchedule: ScheduledMatch[]; worldNews: string[] } {
  const updated = structuredClone(schedule) as ScheduledMatch[]
  const news: string[] = []

  for (const m of updated) {
    if (m.windowId !== windowId) continue
    if (m.simulated) continue
    if (!m.homeId || !m.awayId) continue
    if (m.homeId === userTeam || m.awayId === userTeam) continue
    if (m.day > currentDay) continue   // date gate: never simulate ahead of the user

    const isKO = m.matchType === 'knockout' || m.matchType === 'playoff' || m.matchType === 'nl_final'
    const home = buildSide(m.homeId, playerStates, currentDay, { isUser: false, oppId: m.awayId })
    const away = buildSide(m.awayId, playerStates, currentDay, { isUser: false, oppId: m.homeId })
    const seed = hashStr(m.id) ^ careerSeed
    const result = simulateMatch(home, away, isKO, seed >>> 0)
    m.result = result
    m.simulated = true

    // Generate world news for notable results
    const total = result.homeGoals + result.awayGoals
    if (total >= 5 || result.homeGoals === 0 || result.awayGoals === 0) {
      news.push(`${m.homeId} ${result.homeGoals}-${result.awayGoals} ${m.awayId}`)
    }
  }

  return { updatedSchedule: updated, worldNews: news.slice(0, 5) }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

// ------------------------------------------------------------------
// getNextUserMatch
// ------------------------------------------------------------------

export function getNextUserMatch(
  schedule: ScheduledMatch[],
  teamId: string,
  fromDay: number,
): ScheduledMatch | undefined {
  return schedule
    .filter((m) => !m.simulated && !m.result && m.day >= fromDay &&
      (m.homeId === teamId || m.awayId === teamId) &&
      m.matchType !== 'friendly')
    .sort((a, b) => a.day - b.day)[0]
}

export function getNextFriendly(
  schedule: ScheduledMatch[],
  teamId: string,
  fromDay: number,
): ScheduledMatch | undefined {
  return schedule
    .filter((m) => !m.simulated && m.matchType === 'friendly' && m.day >= fromDay &&
      (m.homeId === teamId || m.awayId === teamId))
    .sort((a, b) => a.day - b.day)[0]
}

export function getTeamSchedule(schedule: ScheduledMatch[], teamId: string): ScheduledMatch[] {
  return schedule
    .filter((m) => m.homeId === teamId || m.awayId === teamId)
    .sort((a, b) => a.day - b.day)
}

// ------------------------------------------------------------------
// Competition label helpers
// ------------------------------------------------------------------

export function currentWindowLabel(windowId: string, qualGroups: QualGroup[], teamId: string): string {
  const def = WINDOW_DEFS.find((w) => w.id === windowId)
  if (!def) return windowId
  if (windowId === 'WC2030_QUAL') {
    const qg = qualGroups.find((g) => g.teams.includes(teamId))
    if (qg) return `WC 2030 Qual · Group ${qg.id.split('_').pop()}`
  }
  return def.label
}

export function matchCompetitionLabel(m: ScheduledMatch): string {
  if (m.competition === 'Friendly') return 'Friendly'
  if (m.windowId === 'WC_2026') return 'World Cup 2026'
  if (m.windowId === 'WC_2030') return 'World Cup 2030'
  if (m.windowId === 'NL_2627_GROUP') return `Nations League · ${m.group ?? ''}`
  if (m.windowId === 'NL_2627_FINALS') return 'Nations League Finals'
  if (m.windowId === 'SUMMER_2027') return m.competition.replace(/_/g, ' ')
  if (m.windowId === 'WC2030_QUAL') return `WC 2030 Qual · ${m.group ?? ''}`
  if (m.windowId === 'EURO_2028') return 'UEFA Euro 2028'
  return m.competition
}

// Importance indicator (1-4 stars)
export function matchImportance(m: ScheduledMatch): number {
  if (m.matchType === 'friendly') return 1
  if (m.matchType === 'group') {
    if (m.windowId === 'WC_2026' || m.windowId === 'WC_2030' || m.windowId === 'EURO_2028') return 4
    return 3
  }
  if (m.matchType === 'qual') return 3
  if (m.matchType === 'knockout' || m.matchType === 'nl_final' || m.matchType === 'playoff') return 4
  return 2
}

export { dateToCareerDay }

// ── Tournament squad-lock detection ─────────────────────────────────────────

export interface UpcomingTournamentInfo {
  windowId: string
  competition: string
  firstMatchDay: number
}

/**
 * Returns the next major tournament (wc / tournament type) that the user hasn't
 * played any matches in yet, or null if none upcoming.
 */
export function getNextMajorTournamentInfo(
  schedule: ScheduledMatch[],
  windows: CalendarWindow[],
  teamId: string,
  currentDay: number,
): UpcomingTournamentInfo | null {
  const upcoming = schedule
    .filter((m) => (m.homeId === teamId || m.awayId === teamId) && !m.result && m.day > currentDay)
    .sort((a, b) => a.day - b.day)

  for (const match of upcoming) {
    const win = windows.find((w) => w.id === match.windowId)
    if (!win || (win.type !== 'wc' && win.type !== 'tournament')) continue
    // Only if no matches in this window have been played yet (first encounter)
    const played = schedule.filter(
      (m) => m.windowId === win.id && (m.homeId === teamId || m.awayId === teamId) && m.result,
    )
    if (played.length === 0) {
      return { windowId: win.id, competition: win.competition, firstMatchDay: match.day }
    }
  }
  return null
}
export type { GameDate }
