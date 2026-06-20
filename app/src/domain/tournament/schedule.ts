import { GROUPS, groupTeams } from '../../data/teams'
import type { Fixture, Round, TimelineDay } from '../types'

/**
 * Simplified tournament calendar (one game-day per round):
 *  d0 prep, d1 prep, d2 G1, d3 prep, d4 prep, d5 G2, d6 prep, d7 prep, d8 G3,
 *  d9 prep, d10 R32, d11 prep, d12 R16, d13 prep, d14 QF,
 *  d15 prep, d16 SF, d17 prep, d18 THIRD+FINAL
 */
export const TIMELINE: TimelineDay[] = [
  { day: 0, kind: 'prep' }, { day: 1, kind: 'prep' }, { day: 2, kind: 'match', round: 'G1' },
  { day: 3, kind: 'prep' }, { day: 4, kind: 'prep' }, { day: 5, kind: 'match', round: 'G2' },
  { day: 6, kind: 'prep' }, { day: 7, kind: 'prep' }, { day: 8, kind: 'match', round: 'G3' },
  { day: 9, kind: 'prep' }, { day: 10, kind: 'match', round: 'R32' },
  { day: 11, kind: 'prep' }, { day: 12, kind: 'match', round: 'R16' },
  { day: 13, kind: 'prep' }, { day: 14, kind: 'match', round: 'QF' },
  { day: 15, kind: 'prep' }, { day: 16, kind: 'match', round: 'SF' },
  { day: 17, kind: 'prep' }, { day: 18, kind: 'match', round: 'FINAL' },
]

export const ROUND_DAY: Record<Round, number> = {
  G1: 2, G2: 5, G3: 8, R32: 10, R16: 12, QF: 14, SF: 16, THIRD: 18, FINAL: 18, FRIENDLY: 0,
}

/** Group fixtures: rounds (1v2,3v4) / (1v3,4v2) / (1v4,2v3) within each group. */
export function buildGroupFixtures(): Fixture[] {
  const pairs: [number, number][][] = [
    [[0, 1], [2, 3]],
    [[0, 2], [3, 1]],
    [[0, 3], [1, 2]],
  ]
  const fixtures: Fixture[] = []
  for (const g of GROUPS) {
    const ts = groupTeams(g)
    pairs.forEach((roundPairs, i) => {
      const round = (`G${i + 1}`) as Round
      for (const [a, b] of roundPairs) {
        fixtures.push({
          id: `${round}-${g}-${ts[a].id}-${ts[b].id}`,
          round,
          day: ROUND_DAY[round],
          group: g,
          homeId: ts[a].id,
          awayId: ts[b].id,
        })
      }
    })
  }
  return fixtures
}

export function fixturesOfDay(fixtures: Fixture[], day: number): Fixture[] {
  return fixtures.filter((f) => f.day === day)
}

export function teamFixture(fixtures: Fixture[], teamId: string, day: number): Fixture | undefined {
  return fixtures.find((f) => f.day === day && (f.homeId === teamId || f.awayId === teamId))
}

export function nextTeamFixture(fixtures: Fixture[], teamId: string, fromDay: number): Fixture | undefined {
  return fixtures
    .filter((f) => f.day >= fromDay && !f.result && (f.homeId === teamId || f.awayId === teamId))
    .sort((a, b) => a.day - b.day)[0]
}
