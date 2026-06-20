import { GROUPS, groupTeams } from '../../data/teams'
import type { Fixture, MatchResult, Round } from '../types'
import { ROUND_DAY } from './schedule'
import { groupStandings, rankedThirds } from './standings'

/**
 * Round-of-32 template, modelled on the official FIFA 2026 bracket shape:
 * 12 group winners, 12 runners-up and the 8 best third-placed teams.
 * 'T' slots receive a third (host group winner never meets a team
 * from its own group). The official 495-combination allocation table is
 * approximated by constrained assignment (documented simplification).
 */
const R32_TEMPLATE: [string, string][] = [
  ['2A', '2B'], ['1E', 'T'], ['1F', '2C'], ['1C', '2F'],
  ['1I', 'T'], ['2E', '2I'], ['1A', 'T'], ['1L', 'T'],
  ['1D', 'T'], ['1G', 'T'], ['2K', '2L'], ['1B', 'T'],
  ['1J', '2H'], ['1H', '2J'], ['1K', 'T'], ['2D', '2G'],
]

export function matchWinner(f: Fixture): string | null {
  if (!f.result || !f.homeId || !f.awayId) return null
  const r = f.result
  if (r.homeGoals !== r.awayGoals) return r.homeGoals > r.awayGoals ? f.homeId : f.awayId
  if (r.pens) return r.pens.home > r.pens.away ? f.homeId : f.awayId
  return null
}

export function matchLoser(f: Fixture): string | null {
  const w = matchWinner(f)
  if (!w || !f.homeId || !f.awayId) return null
  return w === f.homeId ? f.awayId : f.homeId
}

/** Assign qualified thirds to T-slots so nobody meets its own group (backtracking). */
function assignThirds(hostGroups: string[], thirdGroups: string[]): Map<string, string> | null {
  const result = new Map<string, string>()
  const used = new Set<string>()
  const solve = (i: number): boolean => {
    if (i === hostGroups.length) return true
    for (const tg of thirdGroups) {
      if (used.has(tg) || tg === hostGroups[i]) continue
      used.add(tg)
      result.set(hostGroups[i], tg)
      if (solve(i + 1)) return true
      used.delete(tg)
      result.delete(hostGroups[i])
    }
    return false
  }
  return solve(0) ? result : null
}

export function buildR32(fixtures: Fixture[]): Fixture[] {
  const standings = new Map(
    GROUPS.map((g) => [g, groupStandings(fixtures, g, groupTeams(g).map((t) => t.id))]),
  )
  const thirds = rankedThirds(standings).slice(0, 8)
  const thirdGroups = thirds.map((t) => t.group)
  const hostGroups = R32_TEMPLATE.filter(([, away]) => away === 'T').map(([home]) => home[1])
  const assignment =
    assignThirds(hostGroups, thirdGroups) ??
    // fall back: ignore the same-group constraint (cannot happen with 8 of 12, kept for safety)
    new Map(hostGroups.map((h, i) => [h, thirdGroups[i]]))

  const teamAt = (slot: string, hostGroup?: string): { id: string; label: string } => {
    if (slot === 'T') {
      const tg = assignment.get(hostGroup!)!
      return { id: standings.get(tg)![2].teamId, label: `3${tg}` }
    }
    const rank = Number(slot[0]) - 1
    return { id: standings.get(slot[1])![rank].teamId, label: slot }
  }

  return R32_TEMPLATE.map(([home, away], i) => {
    const h = teamAt(home)
    const a = teamAt(away, home[1])
    return {
      id: `R32-${i + 1}`,
      round: 'R32' as Round,
      day: ROUND_DAY.R32,
      homeId: h.id,
      awayId: a.id,
      slotHome: h.label,
      slotAway: a.label,
    }
  })
}

const NEXT: Partial<Record<Round, { round: Round; prefix: string }>> = {
  R32: { round: 'R16', prefix: 'R16' },
  R16: { round: 'QF', prefix: 'QF' },
  QF: { round: 'SF', prefix: 'SF' },
}

/** Pair winners of round N sequentially (1v2, 3v4, ...) into round N+1. */
export function buildNextRound(fixtures: Fixture[], finished: Round): Fixture[] {
  if (finished === 'SF') {
    const sf = fixtures.filter((f) => f.round === 'SF').sort((a, b) => a.id.localeCompare(b.id))
    return [
      {
        id: 'THIRD-1', round: 'THIRD', day: ROUND_DAY.THIRD,
        homeId: matchLoser(sf[0]), awayId: matchLoser(sf[1]),
        slotHome: 'SF1L', slotAway: 'SF2L',
      },
      {
        id: 'FINAL-1', round: 'FINAL', day: ROUND_DAY.FINAL,
        homeId: matchWinner(sf[0]), awayId: matchWinner(sf[1]),
        slotHome: 'SF1W', slotAway: 'SF2W',
      },
    ]
  }
  const next = NEXT[finished]
  if (!next) return []
  const prev = fixtures
    .filter((f) => f.round === finished)
    .sort((a, b) => Number(a.id.split('-')[1]) - Number(b.id.split('-')[1]))
  const out: Fixture[] = []
  for (let i = 0; i < prev.length; i += 2) {
    out.push({
      id: `${next.prefix}-${i / 2 + 1}`,
      round: next.round,
      day: ROUND_DAY[next.round],
      homeId: matchWinner(prev[i]),
      awayId: matchWinner(prev[i + 1]),
      slotHome: `W${prev[i].id}`,
      slotAway: `W${prev[i + 1].id}`,
    })
  }
  return out
}

export function roundFinished(fixtures: Fixture[], round: Round): boolean {
  const fs = fixtures.filter((f) => f.round === round)
  return fs.length > 0 && fs.every((f) => f.result)
}

export function champion(fixtures: Fixture[]): string | null {
  const final = fixtures.find((f) => f.round === 'FINAL')
  return final ? matchWinner(final) : null
}

export function resultLabel(r: MatchResult): string {
  let s = `${r.homeGoals} - ${r.awayGoals}`
  if (r.finishedAfter === 'AET') s += ' (AET)'
  if (r.finishedAfter === 'PENS' && r.pens) s += ` (${r.pens.home}-${r.pens.away} P)`
  return s
}
