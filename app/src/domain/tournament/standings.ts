import type { Fixture } from '../types'

export interface StandingRow {
  teamId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  gd: number
  points: number
}

/** Standings for one group from its (played) fixtures. */
export function groupStandings(fixtures: Fixture[], group: string, teamIds: string[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }]),
  )
  for (const f of fixtures) {
    if (f.group !== group || !f.result || !f.homeId || !f.awayId) continue
    const h = rows.get(f.homeId)!
    const a = rows.get(f.awayId)!
    const { homeGoals, awayGoals } = f.result
    h.played++; a.played++
    h.gf += homeGoals; h.ga += awayGoals
    a.gf += awayGoals; a.ga += homeGoals
    if (homeGoals > awayGoals) { h.won++; a.lost++; h.points += 3 }
    else if (homeGoals < awayGoals) { a.won++; h.lost++; a.points += 3 }
    else { h.drawn++; a.drawn++; h.points++; a.points++ }
  }
  const list = [...rows.values()]
  for (const r of list) r.gd = r.gf - r.ga
  // points > GD > goals for > head-to-head (simplified to direct result)
  list.sort((x, y) => {
    if (y.points !== x.points) return y.points - x.points
    if (y.gd !== x.gd) return y.gd - x.gd
    if (y.gf !== x.gf) return y.gf - x.gf
    const h2h = fixtures.find(
      (f) => f.group === group && f.result &&
        ((f.homeId === x.teamId && f.awayId === y.teamId) || (f.homeId === y.teamId && f.awayId === x.teamId)),
    )
    if (h2h?.result) {
      const xGoals = h2h.homeId === x.teamId ? h2h.result.homeGoals : h2h.result.awayGoals
      const yGoals = h2h.homeId === x.teamId ? h2h.result.awayGoals : h2h.result.homeGoals
      if (xGoals !== yGoals) return yGoals - xGoals > 0 ? 1 : -1
    }
    return x.teamId.localeCompare(y.teamId)
  })
  return list
}

/**
 * Third-placed teams ranked by FIFA's official WC 2026 tiebreaker order:
 * 1. Points  2. Goal difference  3. Goals scored  4. FIFA ranking (ovrOf proxy)
 * Pass `ovrOf` to enable the ranking tiebreaker; falls back to group-ID sort.
 */
export function rankedThirds(
  standingsByGroup: Map<string, StandingRow[]>,
  ovrOf?: (teamId: string) => number,
): { group: string; row: StandingRow }[] {
  const thirds = [...standingsByGroup.entries()]
    .filter(([, rows]) => rows.length >= 3)
    .map(([group, rows]) => ({ group, row: rows[2] }))
  thirds.sort((a, b) => {
    if (b.row.points !== a.row.points) return b.row.points - a.row.points
    if (b.row.gd !== a.row.gd) return b.row.gd - a.row.gd
    if (b.row.gf !== a.row.gf) return b.row.gf - a.row.gf
    if (ovrOf) {
      const aOvr = ovrOf(a.row.teamId)
      const bOvr = ovrOf(b.row.teamId)
      if (bOvr !== aOvr) return bOvr - aOvr
    }
    return a.group.localeCompare(b.group)
  })
  return thirds
}
