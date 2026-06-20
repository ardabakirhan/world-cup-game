import type { Team } from '../../data/types'
import type { QualGroup, ScheduledMatch, NLGroup, CompetitionResult } from './calendar.types'
import { dateToCareerDay } from './calendar.types'
import { WC2030_QUAL_FORMATS } from './competitionCalendar'
import type { Difficulty } from '../types'

// ------------------------------------------------------------------
// Qual group draw (seeded by ranking_pts descending)
// ------------------------------------------------------------------

export function seedSort(teams: Team[]): Team[] {
  return [...teams].sort((a, b) => {
    const apts = (a as unknown as { ranking_pts?: number }).ranking_pts ?? 0
    const bpts = (b as unknown as { ranking_pts?: number }).ranking_pts ?? 0
    return bpts - apts
  })
}

export function distributeIntoGroups(teams: Team[], numGroups: number): Team[][] {
  const groups: Team[][] = Array.from({ length: numGroups }, () => [])
  const seeded = seedSort(teams)
  // snake-seed: pot 1 distributed left-to-right, pot 2 right-to-left, etc.
  let forward = true
  let gi = 0
  for (const t of seeded) {
    groups[gi].push(t)
    if (forward) {
      gi++
      if (gi >= numGroups) { gi = numGroups - 1; forward = false }
    } else {
      gi--
      if (gi < 0) { gi = 0; forward = true }
    }
  }
  return groups
}

export function drawWC2030QualGroups(confederation: string, teams: Team[]): QualGroup[] {
  const fmt = WC2030_QUAL_FORMATS.find((f) => f.confederation === confederation)
  if (!fmt) return []

  let groups: Team[][]
  if (fmt.groupCount === 1) {
    // CONMEBOL: single round-robin of all 10
    groups = [seedSort(teams)]
  } else {
    groups = distributeIntoGroups(teams, fmt.groupCount)
  }

  return groups.map((g, i) => {
    const letter = String.fromCharCode(65 + i)  // A, B, C...
    const id = `WC2030_${confederation}_${letter}`
    return {
      id,
      confederation,
      teams: g.map((t) => t.id),
      matchIds: [],
      directSlots: Math.floor(fmt.directSlots / fmt.groupCount),
      playoffSlots: i < (fmt.playoffSlots || 0) ? 1 : 0,
    }
  })
}

// ------------------------------------------------------------------
// Qual fixture generation
// ------------------------------------------------------------------

// Career day base offsets for qual matchdays (monthly windows Sep 2027 onwards)
const QUAL_MD_OFFSETS = [
  dateToCareerDay({ year: 2027, month: 9,  day: 4 }),
  dateToCareerDay({ year: 2027, month: 10, day: 9 }),
  dateToCareerDay({ year: 2027, month: 11, day: 13 }),
  dateToCareerDay({ year: 2028, month: 3,  day: 21 }),
  dateToCareerDay({ year: 2028, month: 6,  day: 6 }),
  dateToCareerDay({ year: 2028, month: 9,  day: 6 }),
  dateToCareerDay({ year: 2028, month: 10, day: 11 }),
  dateToCareerDay({ year: 2028, month: 11, day: 15 }),
  dateToCareerDay({ year: 2029, month: 3,  day: 21 }),
]

export function buildQualFixtures(group: QualGroup, windowId: string): ScheduledMatch[] {
  const { teams, id: groupId } = group
  const n = teams.length
  const matches: ScheduledMatch[] = []

  // Round-robin H/A: each pair plays home and away
  let mdIdx = 0
  const pairings: [number, number][] = []
  for (let a = 0; a < n; a++)
    for (let b = a + 1; b < n; b++)
      pairings.push([a, b])

  for (const [a, b] of pairings) {
    const dayH = QUAL_MD_OFFSETS[mdIdx % QUAL_MD_OFFSETS.length]
    const dayA = QUAL_MD_OFFSETS[(mdIdx + 1) % QUAL_MD_OFFSETS.length]
    mdIdx += 2

    const mH: ScheduledMatch = {
      id: `${groupId}-${teams[a]}-${teams[b]}-H`,
      round: `QUAL_MD${mdIdx - 1}`,
      day: dayH,
      group: groupId,
      homeId: teams[a],
      awayId: teams[b],
      windowId,
      competition: groupId,
      matchType: 'qual',
      simulated: false,
    }
    const mA: ScheduledMatch = {
      id: `${groupId}-${teams[b]}-${teams[a]}-A`,
      round: `QUAL_MD${mdIdx}`,
      day: dayA,
      group: groupId,
      homeId: teams[b],
      awayId: teams[a],
      windowId,
      competition: groupId,
      matchType: 'qual',
      simulated: false,
    }
    matches.push(mH, mA)
  }
  return matches
}

// ------------------------------------------------------------------
// NL fixture generation (home & away round-robin, 6 MD for groups of 4)
// ------------------------------------------------------------------

export function buildNLGroupFixtures(group: NLGroup): ScheduledMatch[] {
  const { teams, id: gid } = group
  // MD dates from nationsLeague.ts
  const MD_DAYS = [
    dateToCareerDay({ year: 2026, month: 9,  day: 25 }),
    dateToCareerDay({ year: 2026, month: 9,  day: 28 }),
    dateToCareerDay({ year: 2026, month: 10, day: 2 }),
    dateToCareerDay({ year: 2026, month: 10, day: 5 }),
    dateToCareerDay({ year: 2026, month: 11, day: 13 }),
    dateToCareerDay({ year: 2026, month: 11, day: 16 }),
  ]
  // For groups of 3 (League D), use fewer rounds
  const n = teams.length
  const pairs: [number, number][][] = n === 4
    ? [[[0,1],[2,3]],[[0,2],[3,1]],[[0,3],[1,2]],[[1,0],[3,2]],[[2,0],[1,3]],[[3,0],[2,1]]]
    : [[[0,1]],[[1,2]],[[0,2]],[[1,0]],[[2,1]],[[2,0]]]

  const matches: ScheduledMatch[] = []
  pairs.forEach((mdPairs, mdIdx) => {
    const day = MD_DAYS[mdIdx] ?? MD_DAYS[MD_DAYS.length - 1]
    for (const [a, b] of mdPairs) {
      matches.push({
        id: `${gid}-MD${mdIdx + 1}-${teams[a]}-${teams[b]}`,
        round: `NL_MD${mdIdx + 1}`,
        day,
        group: gid,
        homeId: teams[a],
        awayId: teams[b],
        windowId: 'NL_2627_GROUP',
        competition: gid,
        matchType: 'group',
        simulated: false,
      })
    }
  })
  return matches
}

// ------------------------------------------------------------------
// Friendly fixture generation (1-2 matches)
// ------------------------------------------------------------------

export function buildFriendlyFixtures(
  teamCode: string,
  opponents: string[],
  windowId: string,
  baseDayOffset: number,
): ScheduledMatch[] {
  return opponents.slice(0, 2).map((opp, i) => ({
    id: `FRIENDLY-${windowId}-${teamCode}-${opp}-${i}`,
    round: 'FRIENDLY',
    day: baseDayOffset + i * 3,
    homeId: i === 0 ? teamCode : opp,
    awayId: i === 0 ? opp : teamCode,
    windowId,
    competition: 'Friendly',
    matchType: 'friendly' as const,
    simulated: false,
  }))
}

// ------------------------------------------------------------------
// Tournament group fixture generation (reusable for AFCON/Copa/etc.)
// ------------------------------------------------------------------

export function buildTournamentGroupFixtures(
  groups: { id: string; teams: string[] }[],
  windowId: string,
  competition: string,
  baseDayOffset: number,
): ScheduledMatch[] {
  const matches: ScheduledMatch[] = []
  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]], [[0, 2], [3, 1]], [[0, 3], [1, 2]],
  ]
  groups.forEach((g) => {
    pairs.forEach((roundPairs, ri) => {
      for (const [a, b] of roundPairs) {
        if (a >= g.teams.length || b >= g.teams.length) continue
        matches.push({
          id: `${competition}-${g.id}-G${ri + 1}-${g.teams[a]}-${g.teams[b]}`,
          round: `G${ri + 1}`,
          day: baseDayOffset + ri * 4,
          group: g.id,
          homeId: g.teams[a],
          awayId: g.teams[b],
          windowId,
          competition,
          matchType: 'group',
          simulated: false,
        })
      }
    })
  })
  return matches
}

// ------------------------------------------------------------------
// CONCACAF Nations League 2026-27 draw and fixtures
// ------------------------------------------------------------------

const CNL_MD_DAYS = [
  dateToCareerDay({ year: 2026, month: 9,  day: 4 }),
  dateToCareerDay({ year: 2026, month: 9,  day: 7 }),
  dateToCareerDay({ year: 2026, month: 10, day: 8 }),
  dateToCareerDay({ year: 2026, month: 10, day: 11 }),
  dateToCareerDay({ year: 2026, month: 11, day: 12 }),
  dateToCareerDay({ year: 2026, month: 11, day: 15 }),
]

export function drawCNLGroups(teams: Team[]): NLGroup[] {
  const sorted = seedSort(teams)
  const groups: NLGroup[] = []

  // League A: top 8 → 2 groups of 4
  const aTeams = distributeIntoGroups(sorted.slice(0, 8), 2)
  aTeams.forEach((g, i) => {
    groups.push({ id: `CNL_A${i + 1}`, league: 'A', groupNum: i + 1, teams: g.map((t) => t.id), promotionSlots: 1, relegationSlots: 1 })
  })

  // League B: next 12 → 3 groups of 4
  const bTeams = distributeIntoGroups(sorted.slice(8, 20), 3)
  bTeams.forEach((g, i) => {
    if (g.length > 0) groups.push({ id: `CNL_B${i + 1}`, league: 'B', groupNum: i + 1, teams: g.map((t) => t.id), promotionSlots: 1, relegationSlots: 1 })
  })

  // League C: remainder in groups of 4 (last group may be 3)
  const cTeams = sorted.slice(20)
  if (cTeams.length > 0) {
    const numCGroups = Math.max(1, Math.ceil(cTeams.length / 4))
    const cGroups = distributeIntoGroups(cTeams, numCGroups)
    cGroups.forEach((g, i) => {
      if (g.length > 0) groups.push({ id: `CNL_C${i + 1}`, league: 'C', groupNum: i + 1, teams: g.map((t) => t.id), promotionSlots: 1, relegationSlots: 0 })
    })
  }

  return groups
}

export function buildCNLGroupFixtures(group: NLGroup): ScheduledMatch[] {
  const { teams, id: gid } = group
  const n = teams.length
  // Full H+A round-robin (6 MD for groups of 4, 6 MD for groups of 3)
  const pairs: [number, number][][] = n === 4
    ? [[[0,1],[2,3]],[[0,2],[3,1]],[[0,3],[1,2]],[[1,0],[3,2]],[[2,0],[1,3]],[[3,0],[2,1]]]
    : n === 3
    ? [[[0,1]],[[1,2]],[[0,2]],[[1,0]],[[2,1]],[[2,0]]]
    : /* other sizes: single round-robin */ (() => {
        const p: [number, number][][] = []
        for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) p.push([[a, b]])
        return p
      })()

  const matches: ScheduledMatch[] = []
  pairs.forEach((mdPairs, mdIdx) => {
    const day = CNL_MD_DAYS[mdIdx % CNL_MD_DAYS.length]
    for (const [a, b] of mdPairs) {
      if (a >= teams.length || b >= teams.length) continue
      matches.push({
        id: `${gid}-MD${mdIdx + 1}-${teams[a]}-${teams[b]}`,
        round: `CNL_MD${mdIdx + 1}`,
        day,
        group: gid,
        homeId: teams[a],
        awayId: teams[b],
        windowId: 'CNL_2627_GROUP',
        competition: gid,
        matchType: 'group',
        simulated: false,
      })
    }
  })
  return matches
}

// ------------------------------------------------------------------
// AFCON 2027 Qualifying draw and fixtures (Oct 2026 – Jun 2027)
// ------------------------------------------------------------------

const AFCON_QUAL_MD_DAYS = [
  dateToCareerDay({ year: 2026, month: 10, day: 2 }),
  dateToCareerDay({ year: 2026, month: 10, day: 5 }),
  dateToCareerDay({ year: 2026, month: 11, day: 13 }),
  dateToCareerDay({ year: 2026, month: 11, day: 16 }),
  dateToCareerDay({ year: 2027, month: 3,  day: 25 }),
  dateToCareerDay({ year: 2027, month: 3,  day: 28 }),
  dateToCareerDay({ year: 2027, month: 6,  day: 2 }),
  dateToCareerDay({ year: 2027, month: 6,  day: 5 }),
]

export function drawAFCONQualGroups(teams: Team[]): QualGroup[] {
  // 54 CAF teams → 13 groups; distributeIntoGroups gives some groups of 4, some of 5
  const numGroups = Math.ceil(teams.length / 4)
  const groups = distributeIntoGroups(seedSort(teams), numGroups)
  return groups
    .filter((g) => g.length > 0)
    .map((g, i) => ({
      id: `AFCON_QUAL_${String.fromCharCode(65 + i)}`,
      confederation: 'CAF',
      teams: g.map((t) => t.id),
      matchIds: [],
      directSlots: 2,
      playoffSlots: 0,
    }))
}

export function buildAFCONQualFixtures(group: QualGroup): ScheduledMatch[] {
  const { teams, id: groupId } = group
  const matches: ScheduledMatch[] = []
  let mdIdx = 0
  // Single round-robin (each pair meets once)
  for (let a = 0; a < teams.length; a++) {
    for (let b = a + 1; b < teams.length; b++) {
      const day = AFCON_QUAL_MD_DAYS[mdIdx % AFCON_QUAL_MD_DAYS.length]
      matches.push({
        id: `${groupId}-${teams[a]}-${teams[b]}`,
        round: `AFCON_MD${mdIdx + 1}`,
        day,
        group: groupId,
        homeId: teams[a],
        awayId: teams[b],
        windowId: 'AFCON_QUAL_2627',
        competition: groupId,
        matchType: 'qual',
        simulated: false,
      })
      mdIdx++
    }
  }
  return matches
}

// ------------------------------------------------------------------
// Firing check after each competition
// ------------------------------------------------------------------

export function checkFiringAfterCompetition(
  result: CompetitionResult,
  teamFIFARank: number,
  history: CompetitionResult[],
  difficulty: Difficulty,
  hasTrophyPass: boolean,
): 'fired' | 'warned' | 'free_pass_used' | 'ok' {
  const major = ['WC_2026', 'WC_2030', 'EURO_2028', 'AFCON_2027', 'COPA_2027', 'NL_2627_FINALS']

  // Trophy win → set pass
  if (result.outcome === 'winner' && major.includes(result.competition)) {
    return 'ok'  // caller sets trophyPass flag
  }

  // Qual failure for highly-ranked teams
  if (result.outcome === 'qual_fail') {
    const rankThreshold = difficulty === 'hard' ? 10 : 5
    if (teamFIFARank <= rankThreshold) {
      if (hasTrophyPass) return 'free_pass_used'
      return 'fired'
    }
    if (teamFIFARank <= 20) return 'warned'
    return 'ok'
  }

  // Consecutive D/F grades
  const recent = [...history, result].slice(-3)
  const badCount = recent.filter((r) => r.grade === 'D' || r.grade === 'F').length
  if (badCount >= 3) return 'fired'
  if (badCount >= 2) return 'warned'

  return 'ok'
}

// ------------------------------------------------------------------
// Grade calculation for a competition result
// ------------------------------------------------------------------

export function calcCompetitionGrade(
  outcome: CompetitionResult['outcome'],
  teamRank: number,
): 'A' | 'B' | 'C' | 'D' | 'F' {
  // Winner always A; finalist B+; etc. adjusted by rank
  const base: Record<CompetitionResult['outcome'], number> = {
    winner: 5, finalist: 4, semifinal: 3, quarter: 2,
    group_stage: 1, qual_success: 3, qual_fail: 0,
    relegated: 0, did_not_qualify: 1,
  }
  const score = base[outcome]
  // Bonus/penalty for rank vs. result
  const expected = teamRank <= 5 ? 4 : teamRank <= 20 ? 3 : teamRank <= 50 ? 2 : 1
  const delta = score - expected
  if (delta >= 2) return 'A'
  if (delta >= 1) return 'B'
  if (delta >= 0) return 'C'
  if (delta >= -1) return 'D'
  return 'F'
}
