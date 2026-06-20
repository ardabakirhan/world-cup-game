/* Verifies the unified matchEngine ⇄ pitch system. matchEngine is the single
   source of truth: every ball/player coordinate is produced there and the pitch
   only renders it. These checks assert the spec's hard rules hold across many
   full matches.  Usage: npx tsx scripts/unified-pitch.ts */
import { TEAMS } from '../src/data/teams'
import { buildSide } from '../src/domain/ai/lineup'
import { MatchSim, matchMinute } from '../src/domain/engine/matchEngine'
import { attackAxis } from '../src/domain/engine/pitch2d'
import { initialPlayerState } from '../src/domain/player/condition'
import type { PlayerStates } from '../src/domain/types'

const st: PlayerStates = {}
for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()

const SHOT_EVENTS = new Set(['goal', 'pen_goal', 'pen_miss', 'save', 'miss', 'woodwork', 'wonder_shot', 'free_kick_goal', 'free_kick_saved'])
const RESULT_EVENTS = new Set([...SHOT_EVENTS, 'yellow', 'red'])

let gkCrossHalf = 0
let shotBelow60 = 0
let boxNotShot = 0
let boxShots = 0
let goalNotInMouth = 0
let goals = 0
let phantomShot = 0
let eventMismatch = 0

// NEW: offside, foul, weather checks
let offsideBallForward = 0   // offside event: ball must NOT be deep in goal (attack axis < 90)
let foulBallInBox = 0        // foul/free_kick event: ball must NOT be in the box (> 92)
let weatherUndefined = 0     // sim.weather must always be set

// Calibration counters (400+ match sample)
let totalMatches = 0
let totalGoals = 0
let totalOffsides = 0
let totalFouls = 0
let totalYellows = 0
let totalReds = 0
let totalPens = 0
let totalInjuries = 0
let totalBigChances = 0
let totalFkGoals = 0

const SAMPLE = 120  // ~400 match-minutes × 90 per match ≈ good statistical base

for (let s = 0; s < SAMPLE; s++) {
  const A = TEAMS[(s * 7) % TEAMS.length]
  let B = TEAMS[(s * 13 + 3) % TEAMS.length]
  if (B.id === A.id) B = TEAMS[(s * 13 + 4) % TEAMS.length]
  const home = buildSide(A.id, st, 0, { isUser: false, oppId: B.id })
  const away = buildSide(B.id, st, 0, { isUser: false, oppId: A.id })
  const sim = new MatchSim(home, away, { knockout: false, seed: (s * 2654435761) >>> 0 })

  totalMatches++

  // Weather must always be set
  if (!sim.weather) weatherUndefined++

  let g = 0
  while (sim.phase !== 'DONE' && g++ < 400) {
    if (sim.phase === 'HT' || sim.phase === 'BREAK_ET') sim.resumeFromBreak()
    sim.step()
    if (sim.phase === 'DONE') break
    const m = sim.minute
    const mm = matchMinute(sim, m)
    const evs = sim.events.filter((e) => e.minute === m)

    // 1) GK never crosses the halfway line
    for (const d of Object.values(mm.players)) {
      if (!d.isGK) continue
      if (d.team === 'home' && d.x >= 50) gkCrossHalf++
      if (d.team === 'away' && d.x <= 50) gkCrossHalf++
    }

    const teamAxis = attackAxis(mm.ballX, mm.possession)
    const isShot = mm.action === 'shot'

    // 2) a shot is never struck from below attack-axis 60
    if (isShot && teamAxis < 60) shotBelow60++

    // 3) in the box (axis > 80) the acting player shoots/crosses — never passes back
    if (teamAxis > 80) {
      if (mm.action === 'pass' || mm.action === 'dribble') boxNotShot++
      else boxShots++
    }

    // 4) a scored goal → the ball travels into the goal mouth
    const scored = evs.find((e) => e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal')
    if (scored) {
      goals++
      const goalX = mm.possession === 'home' ? 100 : 0
      if (mm.ballTargetX == null || Math.abs(mm.ballTargetX - goalX) > 3) goalNotInMouth++
    }

    // 5) commentary ⇄ pitch: no phantom shots, and every result event shows on the pitch
    if (isShot && !evs.some((e) => SHOT_EVENTS.has(e.type))) phantomShot++
    if (evs.some((e) => RESULT_EVENTS.has(e.type)) && !mm.event) eventMismatch++

    // 6) NEW: offside — ball must go BACKWARD (attack axis < 88, not at goal mouth)
    const offsideEv = evs.find((e) => e.type === 'offside')
    if (offsideEv) {
      totalOffsides++
      // Ball should be in the final-third-ish range but NOT at the goal line
      // (it snaps to where the pass was played from, not where the receiver was)
      if (teamAxis >= 88) offsideBallForward++
    }

    // 7) NEW: foul/free_kick — ball must NOT be in the penalty box
    const foulFkEv = evs.find((e) => e.type === 'free_kick')
    if (foulFkEv && mm.event === 'foul') {
      // Ball should be at the foul location (not randomly in the box — box fouls → penalty)
      if (teamAxis > 92) foulBallInBox++
      totalFouls++
    }
    if (foulFkEv && (mm.event === 'yellow' || mm.event === 'red')) {
      totalFouls++  // card + FK (counted once)
    }

    // Calibration counters
    for (const e of evs) {
      if (e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal') totalGoals++
      if (e.type === 'yellow') totalYellows++
      if (e.type === 'red') totalReds++
      if (e.type === 'pen_goal' || e.type === 'pen_miss') totalPens++
      if (e.type === 'injury') totalInjuries++
      if (e.type === 'big_chance_miss') totalBigChances++
      if (e.type === 'free_kick_goal') totalFkGoals++
      if (e.type === 'offside') {
        // already counted above
      }
    }
    // fouls from standalone free_kick events (no shot resolved)
    if (foulFkEv && mm.event === 'foul') {
      // already counted
    }
  }
}

// Count fouls from matchStats (more accurate)
// (We use totalFouls from the event loop above as an approximation)

const avg = (n: number) => (n / totalMatches).toFixed(2)
const line = (label: string, v: number, extra = '') =>
  console.log(`${v === 0 ? '✅' : '❌'} ${label}: ${v}${extra}`)
const stat = (label: string, v: number, lo: number, hi: number) => {
  const ok = v >= lo && v <= hi
  console.log(`${ok ? '✅' : '⚠️ '} ${label}: ${v.toFixed(2)}/match [target ${lo}-${hi}]`)
}

console.log('=== UNIFIED PITCH ===')
line('GK crossed halfway', gkCrossHalf)
line('shot from below axis 60', shotBelow60)
line('in-box pass/dribble (no shot)', boxNotShot, `   (in-box shots seen: ${boxShots})`)
line('scored goal not in goal mouth', goalNotInMouth, `   (goals seen: ${goals})`)
line('phantom shot (no commentary)', phantomShot)
line('result event missing on pitch', eventMismatch)
line('offside ball at goal mouth (≥88 axis)', offsideBallForward, `   (offsides seen: ${totalOffsides})`)
line('foul ball in penalty box (>92)', foulBallInBox, `   (FK events seen: ${totalFouls})`)
line('weather undefined on sim', weatherUndefined)

console.log('\n=== CALIBRATION (per match, ' + totalMatches + ' matches) ===')
stat('Goals', totalGoals / totalMatches, 2.4, 3.2)
stat('Offsides', totalOffsides / totalMatches, 2.0, 5.0)
stat('Fouls (from FK events)', totalFouls / totalMatches, 6.0, 16.0)
stat('Yellow cards', totalYellows / totalMatches, 1.5, 3.5)
stat('Red cards', totalReds / totalMatches, 0.03, 0.20)
stat('Penalties', totalPens / totalMatches, 0.10, 0.40)
stat('Injuries', totalInjuries / totalMatches, 0.05, 0.25)
stat('Big chances missed', totalBigChances / totalMatches, 3.0, 9.0)
stat('Free kick goals', totalFkGoals / totalMatches, 0.05, 0.50)

const specPass = gkCrossHalf === 0 && shotBelow60 === 0 && boxNotShot === 0 &&
  goalNotInMouth === 0 && phantomShot === 0 && eventMismatch === 0 &&
  offsideBallForward === 0 && foulBallInBox === 0 && weatherUndefined === 0

console.log(specPass ? '\nSPEC PASS ✅' : '\nSPEC FAIL ❌')
process.exit(specPass ? 0 : 1)
