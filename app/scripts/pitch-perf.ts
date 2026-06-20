/* Proves the incremental precompute: each minute is built once; repeated lookups
   (what every re-render / animation frame triggers) are near-free O(1).
   Usage: npx tsx scripts/pitch-perf.ts */
import { TEAMS } from '../src/data/teams'
import { buildSide } from '../src/domain/ai/lineup'
import { MatchSim, matchMinute } from '../src/domain/engine/matchEngine'
import { initialPlayerState } from '../src/domain/player/condition'
import type { PlayerStates } from '../src/domain/types'

function freshStates(): PlayerStates {
  const st: PlayerStates = {}
  for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()
  return st
}
const states = freshStates()
const home = buildSide('BRA', states, 0, { isUser: false, oppId: 'ARG' })
const away = buildSide('ARG', states, 0, { isUser: false, oppId: 'BRA' })
const sim = new MatchSim(home, away, { knockout: false, seed: 12345 })

// play the whole match, building each minute's record once (cold build) ──────────
let coldCalls = 0
let coldTime = 0
let guard = 0
while (sim.phase !== 'DONE' && guard++ < 400) {
  if (sim.phase === 'HT' || sim.phase === 'BREAK_ET') sim.resumeFromBreak()
  sim.step()
  if (sim.phase === 'DONE') break
  const t0 = performance.now()
  matchMinute(sim, sim.minute) // first time this minute is reached → builds it
  coldTime += performance.now() - t0
  coldCalls++
}

// warm path: a finished match, re-read every minute 2000× (≈ what playback +
// React re-renders + frame ticks hammer). Should be pure array lookups.
const lastMin = sim.minute
let warmCalls = 0
const w0 = performance.now()
for (let pass = 0; pass < 2000; pass++) {
  for (let m = 1; m <= lastMin; m++) { matchMinute(sim, m); warmCalls++ }
}
const warmTime = performance.now() - w0

console.log('=== PITCH PERF ===')
console.log(`cold: built ${coldCalls} minutes once, total ${coldTime.toFixed(1)}ms, avg ${(coldTime / coldCalls).toFixed(4)}ms/minute`)
console.log(`warm: ${warmCalls} lookups, total ${warmTime.toFixed(1)}ms, avg ${(warmTime / warmCalls * 1000).toFixed(2)}µs/lookup`)
const perFrameBudgetMs = 1000 / 60
console.log(`warm lookup is ${((warmTime / warmCalls) / perFrameBudgetMs * 100).toFixed(3)}% of a 16.67ms (60fps) frame budget`)
console.log((warmTime / warmCalls) < 0.05 ? 'PASS ✅ (lookup ≪ 60fps budget)' : 'CHECK ⚠️')
