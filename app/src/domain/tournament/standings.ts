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

/** Third-placed teams of all groups ranked: points > GD > GF. */
export function rankedThirds(standingsByGroup: Map<string, StandingRow[]>): { group: string; row: StandingRow }[] {
  const thirds = [...standingsByGroup.entries()].map(([group, rows]) => ({ group, row: rows[2] }))
  thirds.sort((a, b) =>
    b.row.points - a.row.points || b.row.gd - a.row.gd || b.row.gf - a.row.gf ||
    a.group.localeCompare(b.group))
  return thirds
}
