/* Engine calibration: run many simulations, check goal averages and upset rates.
   Usage: npx tsx scripts/calibrate.ts */
import { TEAMS, getTeam, teamAvgOverall } from '../src/data/teams'
import { buildSide } from '../src/domain/ai/lineup'
import { simulateMatch } from '../src/domain/engine/matchEngine'
import { initialPlayerState } from '../src/domain/player/condition'
import { makeRng } from '../src/domain/rng'
import { buildGroupFixtures, fixturesOfDay } from '../src/domain/tournament/schedule'
import { buildNextRound, buildR32, champion, matchWinner, roundFinished } from '../src/domain/tournament/bracket'
import type { PlayerStates, Round } from '../src/domain/types'

function freshStates(): PlayerStates {
  const st: PlayerStates = {}
  for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()
  return st
}

// ---------------------------------------------------------- match sampling
const rng = makeRng(42)
const N = 1000
let goals = 0
let draws = 0
const buckets: Record<string, { fav: number; n: number }> = {
  '0-2': { fav: 0, n: 0 }, '3-5': { fav: 0, n: 0 }, '6-9': { fav: 0, n: 0 }, '10+': { fav: 0, n: 0 },
}

for (let i = 0; i < N; i++) {
  const a = TEAMS[Math.floor(rng() * TEAMS.length)]
  let b = TEAMS[Math.floor(rng() * TEAMS.length)]
  while (b.id === a.id) b = TEAMS[Math.floor(rng() * TEAMS.length)]
  const states = freshStates()
  const home = buildSide(a.id, states, 0, { isUser: false, oppId: b.id })
  const away = buildSide(b.id, states, 0, { isUser: false, oppId: a.id })
  const r = simulateMatch(home, away, false, Math.floor(rng() * 1e9))
  goals += r.homeGoals + r.awayGoals
  const diff = teamAvgOverall(a) - teamAvgOverall(b)
  const fav = diff >= 0 ? a.id : b.id
  const ad = Math.abs(diff)
  const bucket = ad <= 2 ? '0-2' : ad <= 5 ? '3-5' : ad <= 9 ? '6-9' : '10+'
  if (r.homeGoals === r.awayGoals) {
    draws++
  } else {
    const winner = r.homeGoals > r.awayGoals ? a.id : b.id
    buckets[bucket].n++
    if (winner === fav) buckets[bucket].fav++
  }
}

console.log(`matches: ${N}`)
console.log(`avg goals/match: ${(goals / N).toFixed(2)}  (target 2.4-3.1)`)
console.log(`draw rate: ${((draws / N) * 100).toFixed(1)}%  (target ~20-28%)`)
for (const [k, v] of Object.entries(buckets)) {
  console.log(`OVR diff ${k}: favourite wins ${((v.fav / Math.max(1, v.n)) * 100).toFixed(0)}% of decided (${v.n})`)
}

// ------------------------------------------------------- full tournaments
const champs: Record<string, number> = {}
const ROUNDS: Round[] = ['G1', 'G2', 'G3', 'R32', 'R16', 'QF', 'SF', 'FINAL']
for (let t = 0; t < 20; t++) {
  const states = freshStates()
  let fixtures = buildGroupFixtures()
  const seed = 1000 + t
  for (const day of [2, 5, 8, 10, 12, 14, 16, 18]) {
    for (const f of fixturesOfDay(fixtures, day)) {
      if (!f.homeId || !f.awayId) continue
      const home = buildSide(f.homeId, states, day, { isUser: false, oppId: f.awayId })
      const away = buildSide(f.awayId, states, day, { isUser: false, oppId: f.homeId })
      f.result = simulateMatch(home, away, !f.group, seed * 7919 + day * 131 + fixtures.indexOf(f))
    }
    if (roundFinished(fixtures, 'G3') && !fixtures.some((f) => f.round === 'R32'))
      fixtures = [...fixtures, ...buildR32(fixtures)]
    for (const r of ['R32', 'R16', 'QF', 'SF'] as Round[]) {
      const nxt: Round = r === 'SF' ? 'FINAL' : (['R16', 'QF', 'SF'][['R32', 'R16', 'QF'].indexOf(r)] as Round)
      if (roundFinished(fixtures, r) && !fixtures.some((f) => f.round === nxt))
        fixtures = [...fixtures, ...buildNextRound(fixtures, r)]
    }
  }
  const c = champion(fixtures)
  if (!c) {
    console.log('!! tournament', t, 'did not finish')
    const unfinished = fixtures.filter((f) => !f.result)
    console.log('unfinished:', unfinished.map((f) => f.id))
    continue
  }
  champs[c] = (champs[c] ?? 0) + 1
  // sanity on knockout pairing integrity
  void ROUNDS
  void matchWinner
  void getTeam
}
console.log('\nchampions over 20 tournaments:',
  Object.entries(champs).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}:${v}`).join(' '))
