/* Validates the two bug fixes:
   1. Mutual exclusion: no game-minute has goal-scoring chances for BOTH teams,
      and every penalty belongs to the single attacking team that minute.
   2. Penalty zone gate: penalties still occur at a sane rate; goal/penalty
      averages stay within calibration.
   Usage: npx tsx scripts/bug-validate.ts */
import { TEAMS } from '../src/data/teams'
import { buildSide } from '../src/domain/ai/lineup'
import { MatchSim } from '../src/domain/engine/matchEngine'
import { initialPlayerState } from '../src/domain/player/condition'
import { makeRng } from '../src/domain/rng'
import type { PlayerStates } from '../src/domain/types'

const SHOT = new Set(['goal', 'pen_goal', 'pen_miss', 'save', 'miss', 'woodwork', 'wonder_shot'])

function freshStates(): PlayerStates {
  const st: PlayerStates = {}
  for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()
  return st
}

const rng = makeRng(7)
const N = 400
let matches = 0
let goals = 0
let pens = 0
let penGoals = 0
let bothTeamsChanceSameMinute = 0
let penWrongTeam = 0
let totalMinutes = 0

for (let i = 0; i < N; i++) {
  const a = TEAMS[Math.floor(rng() * TEAMS.length)]
  let b = TEAMS[Math.floor(rng() * TEAMS.length)]
  while (b.id === a.id) b = TEAMS[Math.floor(rng() * TEAMS.length)]
  const states = freshStates()
  const home = buildSide(a.id, states, 0, { isUser: false, oppId: b.id })
  const away = buildSide(b.id, states, 0, { isUser: false, oppId: a.id })
  const sim = new MatchSim(home, away, { knockout: false, seed: Math.floor(rng() * 1e9) })

  let guard = 0
  while (sim.phase !== 'DONE' && guard++ < 400) {
    if (sim.phase === 'HT' || sim.phase === 'BREAK_ET') sim.resumeFromBreak()
    const before = sim.events.length
    sim.step()
    const minuteEvents = sim.events.slice(before)
    if (minuteEvents.length === 0) continue
    totalMinutes++

    // Mutual exclusion: shot/chance events must all belong to one team this minute
    const shotTeams = new Set(minuteEvents.filter((e) => SHOT.has(e.type) && e.teamId).map((e) => e.teamId!))
    if (shotTeams.size > 1) bothTeamsChanceSameMinute++

    // Penalty possession sanity: a penalty's team must be the only shooting team
    for (const e of minuteEvents) {
      if (e.type === 'pen_goal' || e.type === 'pen_miss') {
        pens++
        if (e.type === 'pen_goal') penGoals++
        const others = [...shotTeams].filter((tid) => tid !== e.teamId)
        if (others.length > 0) penWrongTeam++
      }
    }
  }

  matches++
  goals += sim.status.home.goals + sim.status.away.goals
}

console.log(`matches: ${matches}`)
console.log(`avg goals/match: ${(goals / matches).toFixed(2)}  (calibration target 2.4-3.1)`)
console.log(`penalties: ${pens} total, ${(pens / matches).toFixed(3)}/match, conversion ${((penGoals / Math.max(1, pens)) * 100).toFixed(0)}%`)
console.log(`minutes with events: ${totalMinutes}`)
console.log(`VIOLATION both teams had a chance same minute: ${bothTeamsChanceSameMinute}  (must be 0)`)
console.log(`VIOLATION penalty awarded to a non-attacking team: ${penWrongTeam}  (must be 0)`)
console.log(bothTeamsChanceSameMinute === 0 && penWrongTeam === 0 ? 'PASS ✅' : 'FAIL ❌')
