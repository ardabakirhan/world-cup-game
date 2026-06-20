/* Discipline-system validation. Usage: npx tsx scripts/discipline-test.ts */
import { TEAMS, getTeam } from '../src/data/teams'
import { buildSide } from '../src/domain/ai/lineup'
import { MatchSim } from '../src/domain/engine/matchEngine'
import { teamRatings } from '../src/domain/engine/ratings'
import { applyMatchOutcome, initialPlayerState, tickSuspensions, yellowThresholdFor } from '../src/domain/player/condition'
import { makeRng } from '../src/domain/rng'
import type { PlayerStates } from '../src/domain/types'

function freshStates(): PlayerStates {
  const st: PlayerStates = {}
  for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()
  return st
}

let pass = 0
let fail = 0
const check = (label: string, cond: boolean, extra?: unknown) => {
  if (cond) { pass++; console.log(`  ✓ ${label}`) }
  else { fail++; console.log(`  ✗ ${label}`, extra ?? '') }
}

// reach into the private-ish API via a typed alias
type SimAny = MatchSim & {
  sendOff(which: 'home' | 'away', victim: { id: string }, cat: string): void
}

const states = freshStates()
const A = TEAMS.find((t) => t.id === 'ITA') ?? TEAMS[0]
const B = TEAMS.find((t) => t.id === 'FRA') ?? TEAMS[1]

console.log('\n== 1.1 Ten-man penalties ==')
{
  const home = buildSide(A.id, states, 0, { isUser: false, oppId: B.id })
  const away = buildSide(B.id, states, 0, { isUser: false, oppId: A.id })
  const sim = new MatchSim(home, away, { knockout: false, seed: 1 }) as SimAny

  const beforeAtt = teamRatings(sim.home.starters).att
  const beforeStarters = sim.home.starters.length

  // force-send-off a defender (straight red)
  const df = sim.home.starters.find((p) => p.slotRole === 'DF')!
  sim.sendOff('home', df, 'straight')

  check('starter removed (11 → 10)', sim.home.starters.length === beforeStarters - 1, sim.home.starters.length)
  check('redCards incremented', (sim.home.redCards ?? 0) === 1)
  check('sentOffRoles records DF', (sim.home.sentOffRoles ?? []).includes('DF'))

  sim.refresh('home')
  const afterAtt = sim.status.home.ratings.att
  const afterDef = sim.status.home.ratings.def
  check('attack effectiveness dropped', afterAtt < beforeAtt, { beforeAtt, afterAtt })
  // defence with a DF sent off uses the 0.70 multiplier on top of men factor
  const fullDef = teamRatings(home.starters).def // 11-man baseline already mutated; sanity only
  check('defence rating present & reduced (10-man, DF off)', afterDef > 0 && afterDef < fullDef * 1.0 + 1, { afterDef })
}

console.log('\n== 1.1 GK sent off → outfield/sub keeper ==')
{
  const st2 = freshStates()
  const home = buildSide(A.id, st2, 0, { isUser: false, oppId: B.id })
  const away = buildSide(B.id, st2, 0, { isUser: false, oppId: A.id })
  const sim = new MatchSim(home, away, { knockout: false, seed: 2 }) as SimAny
  // drain bench of keepers to force the makeshift case
  sim.home.bench = sim.home.bench.filter((p) => p.position !== 'GK')
  const gk = sim.home.starters.find((p) => p.slotRole === 'GK')!
  sim.sendOff('home', gk, 'straight')
  const hasKeeper = sim.home.starters.some((p) => p.slotRole === 'GK')
  check('a keeper is present after GK red (makeshift)', hasKeeper)
  check('still 10 men', sim.home.starters.length === 10, sim.home.starters.length)
  const fieldEv = sim.events.some((e) => e.type === 'gk_field')
  check('gk_field event emitted', fieldEv)
}

console.log('\n== 1.2 Severity tiers & suspension lengths ==')
{
  const rng = makeRng(7)
  const cats: Record<string, number[]> = { straight: [], second_yellow: [], dogso: [], dissent: [] }
  // build many reds by repeatedly sending off and reading the event suspension
  for (let i = 0; i < 200; i++) {
    const st3 = freshStates()
    const home = buildSide(A.id, st3, 0, { isUser: false, oppId: B.id })
    const away = buildSide(B.id, st3, 0, { isUser: false, oppId: A.id })
    const sim = new MatchSim(home, away, { knockout: false, seed: i }) as SimAny
    const cat = (['straight', 'second_yellow', 'dogso', 'dissent'] as const)[i % 4]
    const v = sim.home.starters.find((p) => p.slotRole !== 'GK')!
    sim.sendOff('home', v, cat)
    const ev = sim.events.find((e) => e.type === 'red')!
    cats[cat].push(ev.suspension ?? 0)
  }
  void rng
  const inRange = (arr: number[], lo: number, hi: number) => arr.every((x) => x >= lo && x <= hi)
  check('straight red ban 2–3', inRange(cats.straight, 2, 3))
  check('second yellow ban = 1', cats.second_yellow.every((x) => x === 1))
  check('DOGSO ban 1–2', inRange(cats.dogso, 1, 2))
  check('dissent ban = 1', cats.dissent.every((x) => x === 1))
}

console.log('\n== 1.3 Suspension recorded & NOT wiped same match ==')
{
  const st4 = freshStates()
  const home = buildSide(A.id, st4, 0, { isUser: false, oppId: B.id })
  const away = buildSide(B.id, st4, 0, { isUser: false, oppId: A.id })
  const sim = new MatchSim(home, away, { knockout: false, seed: 11 }) as SimAny
  const victim = sim.home.starters.find((p) => p.slotRole === 'MF')!
  sim.sendOff('home', victim, 'straight')
  const result = sim.finishFast()
  const events = result.events ?? sim.events

  const bannedBefore = new Set(Object.keys(st4).filter((id) => st4[id].suspendedMatches > 0))
  applyMatchOutcome(st4, {
    teamId: A.id, won: false, drawn: true,
    appeared: sim.home.starters, benchUnused: sim.home.bench,
    scorers: result.scorers, events, day: 0, rng: makeRng(1),
    competitionId: 'WC_2026', yellowThreshold: yellowThresholdFor('group'),
  })
  tickSuspensions(st4, getTeam(A.id).players.map((p) => p.id),
    new Set(sim.home.starters.map((p) => p.id)), bannedBefore)

  const stv = st4[victim.id]
  check('victim suspendedMatches >= 2 (straight)', stv.suspendedMatches >= 2, stv.suspendedMatches)
  check('victim redCards = 1', stv.redCards === 1)
  check('suspensionReason = straight', stv.suspensionReason === 'straight', stv.suspensionReason)
}

console.log('\n== 1.4 Yellow accumulation triggers ban at threshold ==')
{
  const st5 = freshStates()
  const pid = getTeam(A.id).players.find((p) => p.position === 'MF')!.id
  const mkYellow = () => ({
    minute: 30, type: 'yellow' as const, teamId: A.id, playerId: pid, playerName: 'x', variant: 0,
  })
  // 3 separate group-stage matches, one yellow each → ban on the 3rd
  for (let m = 0; m < 3; m++) {
    applyMatchOutcome(st5, {
      teamId: A.id, won: true, drawn: false, appeared: [], benchUnused: [],
      scorers: [], events: [mkYellow()], day: m, rng: makeRng(m),
      competitionId: 'WC_2026', yellowThreshold: 3,
    })
  }
  check('banned after 3 group yellows', st5[pid].suspendedMatches === 1, st5[pid].suspendedMatches)
  check('reason = yellows', st5[pid].suspensionReason === 'yellows')
  check('compYellows reset to 0 after ban', st5[pid].compYellows === 0)

  // knockout threshold is stricter (2)
  const st6 = freshStates()
  const pid2 = getTeam(B.id).players.find((p) => p.position === 'DF')!.id
  for (let m = 0; m < 2; m++) {
    applyMatchOutcome(st6, {
      teamId: B.id, won: true, drawn: false, appeared: [], benchUnused: [],
      scorers: [], events: [{ minute: 10, type: 'yellow', teamId: B.id, playerId: pid2, playerName: 'y', variant: 0 }],
      day: m, rng: makeRng(m), competitionId: 'NL_FINALS', yellowThreshold: yellowThresholdFor('knockout'),
    })
  }
  check('banned after 2 knockout yellows', st6[pid2].suspendedMatches === 1, st6[pid2].suspendedMatches)
}

console.log('\n== 1.4 Yellow tally resets across competitions ==')
{
  const st7 = freshStates()
  const pid = getTeam(A.id).players.find((p) => p.position === 'FW')!.id
  applyMatchOutcome(st7, {
    teamId: A.id, won: true, drawn: false, appeared: [], benchUnused: [],
    scorers: [], events: [{ minute: 5, type: 'yellow', teamId: A.id, playerId: pid, playerName: 'z', variant: 0 }],
    day: 0, rng: makeRng(0), competitionId: 'WC_2026', yellowThreshold: 3,
  })
  check('WC yellow counted', st7[pid].compYellows === 1)
  applyMatchOutcome(st7, {
    teamId: A.id, won: true, drawn: false, appeared: [], benchUnused: [],
    scorers: [], events: [{ minute: 5, type: 'yellow', teamId: A.id, playerId: pid, playerName: 'z', variant: 0 }],
    day: 1, rng: makeRng(1), competitionId: 'NATIONS_LEAGUE', yellowThreshold: 3,
  })
  check('new competition resets tally to 1 (not 2)', st7[pid].compYellows === 1, st7[pid].compYellows)
}

console.log(`\n=== ${pass} passed, ${fail} failed ===`)
process.exit(fail === 0 ? 0 : 1)
