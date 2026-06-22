import { getTeam, teamAvgOverall } from '../../data/teams'
import type { Player, Position } from '../../data/types'
import { FORMATIONS, FORMATION_BIAS } from '../engine/formations'
import { makeEnginePlayer, type EnginePlayer } from '../engine/ratings'
import type { Side } from '../engine/matchEngine'
import type { Lineup, Mentality, PlayerStates, RegenPlayer, Tactics } from '../types'
import { MENTALITY_SLIDER_PRESETS } from '../types'

export function isAvailable(p: Player, states: PlayerStates, day: number): boolean {
  const st = states[p.id]
  if (!st) return true
  if (st.retiredInternational) return false
  return st.injuredUntilDay <= day && st.suspendedMatches <= 0
}

/** All eligible players for a team: base roster (minus retired) plus any promoted regens. */
export function getEffectivePlayers(
  teamId: string,
  states: PlayerStates,
  regenPool?: Record<string, RegenPlayer>,
): Player[] {
  const base = getTeam(teamId).players.filter(
    (p) => !states[p.id]?.retiredInternational,
  )
  if (!regenPool) return base
  const regens = Object.values(regenPool).filter(
    (r) => r.teamId === teamId && r.squadLevel === 'senior',
  )
  return [...base, ...regens]
}


/** Rough per-role score used for AI selection and sorting suggestions. */
export function roleScore(p: Player, role: Position): number {
  const s = p.stats
  if (role === 'GK') {
    return p.gkStats
      ? (p.gkStats.diving + p.gkStats.reflexes + p.gkStats.positioning + p.gkStats.handling) / 4
      : s.overall * 0.4
  }
  if (p.position === 'GK') return s.overall * 0.4
  const v = {
    DF: (s.defending ?? 40) * 0.6 + (s.physical ?? 50) * 0.25 + (s.pace ?? 50) * 0.15,
    MF: (s.passing ?? 45) * 0.45 + (s.dribbling ?? 45) * 0.3 + (s.defending ?? 40) * 0.25,
    FW: (s.shooting ?? 40) * 0.45 + (s.dribbling ?? 45) * 0.3 + (s.pace ?? 50) * 0.25,
  }[role]
  return p.position === role ? v : v * 0.88
}

/** Role score adjusted for current form and fatigue — used by auto-pick. */
export function pickScore(p: Player, role: Position, states: PlayerStates): number {
  const st = states[p.id]
  if (!st) return roleScore(p, role)
  const form = 1 + (st.form - 6) * 0.02
  const fit = st.fitness >= 70 ? 1 : 0.8 + 0.2 * (st.fitness / 70)
  return roleScore(p, role) * form * fit
}

/** Greedy best XI for a formation. Returns aligned player-id array. */
export function autoPickXI(teamId: string, states: PlayerStates, day: number, formation: string, regenPool?: Record<string, RegenPlayer>): (string | null)[] {
  const slots = FORMATIONS[formation]
  const pool = getEffectivePlayers(teamId, states, regenPool).filter((p) => isAvailable(p, states, day))
  const used = new Set<string>()
  return slots.map((slot) => {
    const best = pool
      .filter((p) => !used.has(p.id))
      .sort((a, b) => pickScore(b, slot.role, states) - pickScore(a, slot.role, states))[0]
    if (!best) return null
    used.add(best.id)
    return best.id
  })
}

export function defaultLineup(teamId: string, states: PlayerStates, day: number, regenPool?: Record<string, RegenPlayer>): Lineup {
  return {
    formation: '4-3-3',
    starters: autoPickXI(teamId, states, day, '4-3-3', regenPool),
    roles: Array(11).fill(null),
    setpieces: { corner: null, freekick: null, penalty: null, longThrow: null },
    captainId: null,
    viceCaptainId: null,
  }
}

export function aiTactics(teamId: string, oppId: string): Tactics {
  const diff = teamAvgOverall(getTeam(teamId)) - teamAvgOverall(getTeam(oppId))
  const mentality: Mentality = diff > 4 ? 'attacking' : diff < -4 ? 'defensive' : 'balanced'
  return {
    style: diff > 4 ? 'attacking' : diff < -4 ? 'defensive' : 'balanced',
    press: diff > 6 ? 'high' : 'mid',
    tempo: 'normal',
    mentality,
    sliders: MENTALITY_SLIDER_PRESETS[mentality],
    setpieceOptions: { cornerDelivery: 'inswinger', fkRoutine: 'shoot', penaltyStyle: 'placed', longThrowOn: false },
    oppositionInstructions: {},
  }
}

/** AI shape choice: outgunned sides park the bus, favourites push up. */
export function aiFormation(teamId: string, oppId: string): string {
  const diff = teamAvgOverall(getTeam(teamId)) - teamAvgOverall(getTeam(oppId))
  if (diff <= -7) return '5-4-1'
  if (diff <= -4) return '4-5-1'
  if (diff >= 7) return '3-4-3'
  if (diff >= 4) return '4-3-3'
  return ['4-4-2', '4-3-3', '4-2-3-1'][Math.abs(teamId.charCodeAt(0) + oppId.charCodeAt(2)) % 3]
}

/** Build an engine Side from a lineup (user) or auto-picked XI (AI). */
export function buildSide(
  teamId: string,
  states: PlayerStates,
  day: number,
  opts: { isUser: boolean; lineup?: Lineup; tactics?: Tactics; oppId: string; familiarityScore?: number; regenPool?: Record<string, RegenPlayer>; playerRelationships?: Record<string, number> },
): Side {
  const regenPool = opts.regenPool
  const effectivePlayers = getEffectivePlayers(teamId, states, regenPool)
  const findPlayer = (id: string) => effectivePlayers.find((p) => p.id === id) ?? regenPool?.[id]

  const formation = opts.isUser && opts.lineup
    ? opts.lineup.formation
    : aiFormation(teamId, opts.oppId)
  const slots = FORMATIONS[formation]
  let ids = opts.isUser && opts.lineup ? [...opts.lineup.starters] : autoPickXI(teamId, states, day, formation, regenPool)

  // patch holes / unavailable picks (injury or suspension since last selection)
  const usable = (id: string | null) => {
    if (!id) return false
    const p = findPlayer(id)
    return !!p && isAvailable(p, states, day)
  }
  if (ids.some((id, i) => !usable(id) || ids.indexOf(id) !== i)) {
    const auto = autoPickXI(teamId, states, day, formation, regenPool)
    ids = ids.map((id, i) => (usable(id) && ids.indexOf(id) === i ? id : auto[i]))
    // ensure uniqueness after patching
    const seen = new Set<string>()
    ids = ids.map((id) => {
      if (!id || seen.has(id)) return null
      seen.add(id)
      return id
    })
  }

  const starters: EnginePlayer[] = []
  ids.forEach((id, i) => {
    if (!id) return
    const p = findPlayer(id)
    if (!p) return
    const st = states[p.id] ?? { form: 6, morale: 7, fitness: 100, goals: 0, assists: 0,
      yellows: 0, red: false, suspendedMatches: 0, injuredUntilDay: -1, minutesPlayed: 0,
      compYellows: 0, compYellowsId: '', redCards: 0 }
    // Apply aging decay: reduce overall by accumulated decay
    const decay = st.overallDecay ?? 0
    const adjustedPlayer: Player = decay > 0
      ? { ...p, stats: { ...p.stats, overall: Math.max(40, p.stats.overall - decay) } }
      : p
    const rel = opts.isUser ? (opts.playerRelationships?.[p.id] ?? 50) : undefined
    starters.push(makeEnginePlayer(adjustedPlayer, st, slots[i].role, slots[i].label, rel))
  })
  const inXI = new Set(ids.filter(Boolean) as string[])
  const bench = effectivePlayers
    .filter((p) => !inXI.has(p.id) && isAvailable(p, states, day))
    .map((p) => {
      const st = states[p.id]
      const decay = st?.overallDecay ?? 0
      const adj = decay > 0 ? { ...p, stats: { ...p.stats, overall: Math.max(40, p.stats.overall - decay) } } : p
      return makeEnginePlayer(adj, st ?? { form: 6, morale: 7, fitness: 100, goals: 0, assists: 0,
        yellows: 0, red: false, suspendedMatches: 0, injuredUntilDay: -1, minutesPlayed: 0,
        compYellows: 0, compYellowsId: '', redCards: 0 }, p.position)
    })

  const tactics = opts.tactics ?? aiTactics(teamId, opts.oppId)
  return {
    teamId,
    formation,
    starters,
    bench,
    tactics,
    isUser: opts.isUser,
    subsMade: 0,
    windowsUsed: 0,
    windowOpen: false,
    redCards: 0,
    sentOffRoles: [],
    formationBias: FORMATION_BIAS[formation] ?? 0,
    penaltyTakerId: opts.isUser ? (opts.lineup?.setpieces?.penalty ?? undefined) : undefined,
    markedOpponents: opts.isUser
      ? Object.fromEntries(
          Object.entries(tactics.oppositionInstructions ?? {})
            .filter(([, v]) => v !== 'normal')
            .map(([k, v]) => [k, v as 'tight' | 'space'])
        )
      : undefined,
    captainId: opts.isUser ? (opts.lineup?.captainId ?? null) : null,
    viceCaptainId: opts.isUser ? (opts.lineup?.viceCaptainId ?? null) : null,
    familiarityScore: opts.isUser ? opts.familiarityScore : undefined,
  }
}
