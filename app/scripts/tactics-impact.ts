/* Tactics impact diagnostic — run: npx tsx scripts/tactics-impact.ts
   Creates two equal OVR-80 teams and varies ONE tactical parameter at a time
   across 500 matches, reporting goals/shots/offsides/win rate. */

import { MatchSim } from '../src/domain/engine/matchEngine'
import { FORMATIONS } from '../src/domain/engine/formations'
import type { EnginePlayer } from '../src/domain/engine/ratings'
import type { GkStats, Position } from '../src/data/types'
import type { Mentality, Tactics, TacticSliders } from '../src/domain/types'
import type { Side } from '../src/domain/engine/matchEngine'

// ── synthetic player factory ─────────────────────────────────────────────────

function makeGk(ovr: number): GkStats {
  const v = ovr * 0.75
  return { diving: v, handling: v, kicking: v, reflexes: v, speed: v, positioning: v }
}

function makePlayer(id: string, pos: Position, slotRole: Position, ovr: number): EnginePlayer {
  return {
    id, name: id, position: pos, slotRole,
    stats: { overall: ovr, pace: ovr, shooting: ovr, passing: ovr, dribbling: ovr, defending: ovr, physical: ovr },
    gk: slotRole === 'GK' ? makeGk(ovr) : null,
    form: 6, morale: 7, fitness: 100,
  }
}

function defaultTactics(mentality: Mentality = 'balanced', overrides?: Partial<TacticSliders>): Tactics {
  const sliders: TacticSliders = { width: 5, defLine: 5, press: 5, tempo: 5, aggression: 5, crossing: 5, counter: 5, ...overrides }
  return {
    style: 'balanced', press: 'mid', tempo: 'normal', mentality,
    sliders,
    setpieceOptions: { cornerDelivery: 'inswinger', fkRoutine: 'shoot', penaltyStyle: 'placed', longThrowOn: false },
    oppositionInstructions: {},
  }
}

function makeSide(teamId: string, formation: string, tactics: Tactics, ovr = 80): Side {
  const slots = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
  const starters: EnginePlayer[] = slots.map((slot, i) =>
    makePlayer(`${teamId}_p${i}`, slot.role, slot.role, ovr)
  )
  const bench: EnginePlayer[] = Array.from({ length: 5 }, (_, i) =>
    makePlayer(`${teamId}_b${i}`, 'MF', 'MF', ovr - 5)
  )
  return {
    teamId, formation, starters, bench, tactics,
    isUser: false, subsMade: 0, windowsUsed: 0, windowOpen: false,
    familiarityScore: 80,
  }
}

// ── simulation runner ─────────────────────────────────────────────────────────

interface Results {
  homeGoals: number
  awayGoals: number
  shots: number
  offsides: number
  wins: number
  draws: number
  losses: number
}

function runBatch(
  homeSideFn: (seed: number) => Side,
  awaySideFn: (seed: number) => Side,
  n = 500,
): Results {
  const r: Results = { homeGoals: 0, awayGoals: 0, shots: 0, offsides: 0, wins: 0, draws: 0, losses: 0 }
  for (let i = 0; i < n; i++) {
    const home = homeSideFn(i)
    const away = awaySideFn(i)
    const sim = new MatchSim(home, away, { knockout: false, seed: i * 7919 + 31337 })
    let guard = 0
    while (sim.phase !== 'DONE' && guard++ < 400) {
      if (sim.phase === 'HT' || sim.phase === 'BREAK_ET') sim.resumeFromBreak()
      sim.step()
    }
    r.homeGoals += sim.status.home.goals
    r.awayGoals += sim.status.away.goals
    r.shots += sim.matchStats.home.shots + sim.matchStats.away.shots
    r.offsides += sim.matchStats.home.offsides + sim.matchStats.away.offsides
    if (sim.status.home.goals > sim.status.away.goals) r.wins++
    else if (sim.status.home.goals === sim.status.away.goals) r.draws++
    else r.losses++
  }
  return r
}

function fmt(r: Results, n = 500, label: string) {
  const gpg = ((r.homeGoals + r.awayGoals) / n).toFixed(2)
  const spg = (r.shots / n).toFixed(1)
  const opg = (r.offsides / n).toFixed(1)
  const winPct = ((r.wins / n) * 100).toFixed(0)
  const drawPct = ((r.draws / n) * 100).toFixed(0)
  const hgpg = (r.homeGoals / n).toFixed(2)
  const agpg = (r.awayGoals / n).toFixed(2)
  console.log(`  ${label.padEnd(28)} GPG:${gpg}  H:${hgpg} A:${agpg}  SPG:${spg}  OPG:${opg}  W:${winPct}% D:${drawPct}%`)
}

const N = 500
console.log('\n══════════════════════════════════════════════════════════════')
console.log('  TACTICS IMPACT DIAGNOSTIC  (n=500 per test)')
console.log('══════════════════════════════════════════════════════════════\n')

// ── TEST A: Formation back-line (same balanced mentality) ───────────────────
console.log('TEST A — Formation (4-3-3 vs 5-3-2, both balanced)')
{
  const a433 = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics()),
    () => makeSide('away', '4-3-3', defaultTactics()),
  )
  const a433v532 = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics()),
    () => makeSide('away', '5-3-2', defaultTactics()),
  )
  const a532v433 = runBatch(
    () => makeSide('home', '5-3-2', defaultTactics()),
    () => makeSide('away', '4-3-3', defaultTactics()),
  )
  fmt(a433,     N, '4-3-3 vs 4-3-3 (baseline)')
  fmt(a433v532, N, '4-3-3 (home) vs 5-3-2')
  fmt(a532v433, N, '5-3-2 (home) vs 4-3-3')
  // home=4-3-3, away=5-3-2: homeGoals = 4-3-3 scores (=what 5-3-2 concedes)
  // baseline: 4-3-3 vs 4-3-3, homeGoals = 4-3-3 scores against 4-3-3
  const scoreVs433 = a433.homeGoals / N          // 4-3-3 scores against 4-3-3
  const scoreVs532 = a433v532.homeGoals / N      // 4-3-3 scores against 5-3-2
  const reduc = ((1 - scoreVs532 / scoreVs433) * 100).toFixed(0)
  console.log(`  → 5-3-2 concedes ${reduc}% fewer goals vs 4-3-3 (target: 18-25%)`)
}

// ── TEST B: Mentality extremes ──────────────────────────────────────────────
console.log('\nTEST B — Mentality (Gung-Ho vs Ultra Defensive, 4-3-3)')
{
  const gh = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('gung_ho')),
    () => makeSide('away', '4-3-3', defaultTactics('gung_ho')),
  )
  const ud = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('ultra_defensive')),
    () => makeSide('away', '4-3-3', defaultTactics('ultra_defensive')),
  )
  const bal = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced')),
    () => makeSide('away', '4-3-3', defaultTactics('balanced')),
  )
  fmt(ud,  N, 'Ultra Def vs Ultra Def')
  fmt(bal, N, 'Balanced vs Balanced')
  fmt(gh,  N, 'Gung-Ho vs Gung-Ho')
  const ghGPG = (gh.homeGoals + gh.awayGoals) / N
  const udGPG = (ud.homeGoals + ud.awayGoals) / N
  console.log(`  → Gung-Ho GPG: ${ghGPG.toFixed(2)} (target: 3.2+)`)
  console.log(`  → Ultra Def GPG: ${udGPG.toFixed(2)} (target: ≤1.4)`)
}

// ── TEST C: Press slider ─────────────────────────────────────────────────────
console.log('\nTEST C — Press slider (1 vs 10, same formation+mentality)')
{
  const lo = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { press: 1 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { press: 1 })),
  )
  const hi = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { press: 10 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { press: 10 })),
  )
  fmt(lo, N, 'Press=1 (both teams)')
  fmt(hi, N, 'Press=10 (both teams)')
  const hiShots = hi.shots / N
  const loShots = lo.shots / N
  const diff = ((hiShots / loShots - 1) * 100).toFixed(0)
  console.log(`  → High press: ${diff}% more shots/match (target: 15-25% more chances)`)
}

// ── TEST D: Defensive line slider ────────────────────────────────────────────
console.log('\nTEST D — Defensive line (1 vs 10)')
{
  const lo = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { defLine: 1 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { defLine: 1 })),
  )
  const hi = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { defLine: 10 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { defLine: 10 })),
  )
  fmt(lo, N, 'DefLine=1 (both)')
  fmt(hi, N, 'DefLine=10 (both)')
  const hiOfs = hi.offsides / N
  const loOfs = lo.offsides / N
  const ratio = (hiOfs / Math.max(0.01, loOfs)).toFixed(1)
  console.log(`  → High line offsides: ${hiOfs.toFixed(1)}/match vs ${loOfs.toFixed(1)} (target: ≥2x ratio, got ${ratio}x)`)
}

// ── TEST E: Width slider ─────────────────────────────────────────────────────
console.log('\nTEST E — Width slider (1 vs 10)')
{
  const lo = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { width: 1 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { width: 1 })),
  )
  const hi = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced', { width: 10 })),
    () => makeSide('away', '4-3-3', defaultTactics('balanced', { width: 10 })),
  )
  fmt(lo, N, 'Width=1 (both)')
  fmt(hi, N, 'Width=10 (both)')
  // Width drives attMult, so goals scored should be higher with width=10
  const hiGPG = (hi.homeGoals + hi.awayGoals) / N
  const loGPG = (lo.homeGoals + lo.awayGoals) / N
  const diff = ((hiGPG / loGPG - 1) * 100).toFixed(0)
  console.log(`  → Width=10: ${diff}% more goals/match (drives attMult/crossing)`)
}

// ── TEST F: 3-back vs 4-back vs 5-back ───────────────────────────────────────
console.log('\nTEST F — Back-line comparison (home attacks away, both equal tactics)')
{
  // All vs 4-3-3 opponent to isolate home formation
  const b3 = runBatch(
    () => makeSide('home', '3-4-3', defaultTactics()),
    () => makeSide('away', '4-3-3', defaultTactics()),
  )
  const b4 = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics()),
    () => makeSide('away', '4-3-3', defaultTactics()),
  )
  const b5 = runBatch(
    () => makeSide('home', '5-3-2', defaultTactics()),
    () => makeSide('away', '4-3-3', defaultTactics()),
  )
  fmt(b3, N, '3-back home vs 4-3-3')
  fmt(b4, N, '4-back home vs 4-3-3 (base)')
  fmt(b5, N, '5-back home vs 4-3-3')
  const hg3 = b3.homeGoals / N
  const hg4 = b4.homeGoals / N
  const hg5 = b5.homeGoals / N
  const ag3 = b3.awayGoals / N
  const ag4 = b4.awayGoals / N
  const ag5 = b5.awayGoals / N
  console.log(`  → 3-back scores: ${hg3.toFixed(2)} concedes: ${ag3.toFixed(2)}`)
  console.log(`  → 4-back scores: ${hg4.toFixed(2)} concedes: ${ag4.toFixed(2)}`)
  console.log(`  → 5-back scores: ${hg5.toFixed(2)} concedes: ${ag5.toFixed(2)}`)
  const scoreDiff = ((hg3 / Math.max(0.01, hg5) - 1) * 100).toFixed(0)
  const concDiff = ((ag3 / Math.max(0.01, ag5) - 1) * 100).toFixed(0)
  console.log(`  → 3-back vs 5-back: scores ${scoreDiff}% more, concedes ${concDiff}% more (target 20-30%)`)
}

// ── CALIBRATION CHECK ────────────────────────────────────────────────────────
console.log('\nCALIBRATION CHECK — balanced vs balanced (4-3-3, should be 2.4-3.0 GPG)')
{
  const base = runBatch(
    () => makeSide('home', '4-3-3', defaultTactics('balanced')),
    () => makeSide('away', '4-3-3', defaultTactics('balanced')),
    1000,
  )
  fmt(base, 1000, 'Balanced 4-3-3 (n=1000)')
  const gpg = (base.homeGoals + base.awayGoals) / 1000
  const ok = gpg >= 2.4 && gpg <= 3.2
  console.log(`  → GPG: ${gpg.toFixed(2)} ${ok ? '✓ IN RANGE' : '✗ OUT OF RANGE (target 2.4-3.2)'}`)
}

console.log('\n══════════════════════════════════════════════════════════════\n')
