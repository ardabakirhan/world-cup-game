import type { GkStats, Player, PlayerStats, Position } from '../../data/types'
import type { Mentality, PlayerState, Tactics } from '../types'

/** A player as the match engine sees him: base stats + live condition. */
export interface EnginePlayer {
  id: string
  name: string
  position: Position
  slotRole: Position // role he is fielded in
  stats: PlayerStats
  gk: GkStats | null
  form: number
  morale: number
  fitness: number // mutates during the match
}

export interface TeamRatings {
  att: number
  mid: number
  def: number
  gk: number
}

export function makeEnginePlayer(p: Player, st: PlayerState, slotRole: Position): EnginePlayer {
  return {
    id: p.id, name: p.name, position: p.position, slotRole,
    stats: p.stats, gk: p.gkStats,
    form: st.form, morale: st.morale, fitness: st.fitness,
  }
}

function stat(p: EnginePlayer, v: number | null): number {
  return v ?? p.stats.overall * 0.55 // GK fielded outfield etc.
}

/** Form/morale/fatigue multiplier. Fatigue thresholds: 0-40% no penalty;
 *  41-60% → -4%; 61-75% → -9%; 76-85% → -16%; 86-100% → -24%. */
export function conditionFactor(p: EnginePlayer): number {
  const form = 1 + (p.form - 6) * 0.02
  const morale = 1 + (p.morale - 6) * 0.012
  const fatigue = 100 - p.fitness  // 0 = fresh, 100 = exhausted
  const fitMult = fatigue <= 40 ? 1.00
    : fatigue <= 60 ? 0.96
    : fatigue <= 75 ? 0.91
    : fatigue <= 85 ? 0.84
    : 0.76
  return form * morale * fitMult
}

/** Penalty for playing out of natural position (also used by the UI to show
 *  the reduced effective overall on the pitch view). */
export function positionPenalty(natural: Position, slotRole: Position): number {
  if (natural === slotRole) return 1
  if (natural === 'GK' || slotRole === 'GK') return 0.5
  const order: Position[] = ['DF', 'MF', 'FW']
  const dist = Math.abs(order.indexOf(natural) - order.indexOf(slotRole))
  return dist >= 2 ? 0.85 : 0.93
}

function positionFactor(p: EnginePlayer): number {
  return positionPenalty(p.position, p.slotRole)
}

export function effectiveness(p: EnginePlayer): number {
  return conditionFactor(p) * positionFactor(p)
}

function avg(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 50
}

export function teamRatings(xi: EnginePlayer[]): TeamRatings {
  const by = (role: Position) => xi.filter((p) => p.slotRole === role)
  const gkP = by('GK')[0]
  const dfs = by('DF')
  const mfs = by('MF')
  const fws = by('FW')

  const gk = gkP
    ? (gkP.gk
        ? (gkP.gk.diving + gkP.gk.reflexes + gkP.gk.positioning + gkP.gk.handling) / 4
        : gkP.stats.overall * 0.6) * effectiveness(gkP)
    : 40

  const defCore = avg(dfs.map((p) =>
    (stat(p, p.stats.defending) * 0.55 + stat(p, p.stats.physical) * 0.25 + stat(p, p.stats.pace) * 0.2) * effectiveness(p)))
  const defMf = avg(mfs.map((p) => stat(p, p.stats.defending) * effectiveness(p)))
  const def = defCore * 0.78 + defMf * 0.22

  const mid = avg(mfs.map((p) =>
    (stat(p, p.stats.passing) * 0.5 + stat(p, p.stats.dribbling) * 0.3 + stat(p, p.stats.physical) * 0.2) * effectiveness(p)))

  const attCore = avg(fws.map((p) =>
    (stat(p, p.stats.shooting) * 0.45 + stat(p, p.stats.dribbling) * 0.3 + stat(p, p.stats.pace) * 0.25) * effectiveness(p)))
  const attMf = avg(mfs.map((p) =>
    (stat(p, p.stats.passing) * 0.5 + stat(p, p.stats.dribbling) * 0.5) * effectiveness(p)))
  const att = attCore * 0.75 + attMf * 0.25

  // 10 (or fewer) men hurt everything
  const menFactor = Math.pow(0.93, Math.max(0, 11 - xi.length))
  return { att: att * menFactor, mid: mid * menFactor, def: def * menFactor, gk }
}

export interface TacticEffect {
  attMult: number
  defMult: number
  chanceMult: number   // own chance creation rate
  oppMidMult: number   // pressure on opponent build-up
  fatigueMult: number
  aggMult: number      // yellow/red card probability multiplier
}

// Mentality drives chance-creation rate independently of sliders.
// Only chanceMult is used — attMult/defMult from mentality are intentionally
// omitted because convPower=2 squares small ratio changes into large goal swings,
// and the slider presets already capture the full tactical range.
const MENTALITY_CHANCE_MULT: Record<Mentality, number> = {
  ultra_defensive: 0.50,
  defensive:       0.74,
  balanced:        1.00,
  attacking:       1.26,
  gung_ho:         1.55,
}

export function tacticEffect(t: Tactics): TacticEffect {
  const e: TacticEffect = { attMult: 1, defMult: 1, chanceMult: 1, oppMidMult: 1, fatigueMult: 1, aggMult: 1 }

  // ── Mentality layer (always applied) ────────────────────────────────────────
  e.chanceMult *= MENTALITY_CHANCE_MULT[t.mentality] ?? 1

  if (t.sliders) {
    const s = t.sliders
    const n = (v: number) => (v - 1) / 9   // normalize 1..10 → 0..1

    // Width drives attacking width & crossing opportunity
    e.attMult    *= (0.88 + n(s.width) * 0.24) * (0.97 + n(s.crossing) * 0.06)
    // Wide teams more exposed defensively; counter speed adds defensive solidity
    e.defMult    *= (1.10 - n(s.width) * 0.20) * (0.96 + n(s.counter) * 0.08)
    // High defLine + high press disrupts opponent build-up
    e.oppMidMult *= (1.06 - n(s.defLine) * 0.12) * (1.05 - n(s.press) * 0.10)
    // Tempo drives own chance creation; press adds ball-recovery chances
    e.chanceMult *= (0.88 + n(s.tempo) * 0.24) * (0.92 + n(s.press) * 0.16) * (0.95 + n(s.counter) * 0.10)
    e.fatigueMult = (0.85 + n(s.press) * 0.40) * (0.90 + n(s.tempo) * 0.28)
    e.aggMult     = 0.70 + n(s.aggression) * 0.60   // 0.70..1.30
  } else {
    // Legacy fallback (no sliders)
    if (t.style === 'defensive') { e.attMult *= 0.9; e.defMult *= 1.08; e.chanceMult *= 0.88 }
    if (t.style === 'attacking') { e.attMult *= 1.08; e.defMult *= 0.93; e.chanceMult *= 1.1 }
    if (t.press === 'high') { e.oppMidMult = 0.95; e.fatigueMult *= 1.25 }
    if (t.press === 'low') { e.oppMidMult = 1.03; e.fatigueMult *= 0.88 }
    if (t.tempo === 'fast') { e.chanceMult *= 1.1; e.fatigueMult *= 1.18 }
    if (t.tempo === 'slow') { e.chanceMult *= 0.92; e.fatigueMult *= 0.9 }
  }
  return e
}
