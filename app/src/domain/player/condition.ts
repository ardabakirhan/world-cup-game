import type { Rng } from '../rng'
import { randInt } from '../rng'
import type { EnginePlayer } from '../engine/ratings'
import type { MatchEvent, PlayerState, PlayerStates, PrepAction, ScorerEntry } from '../types'

export function initialPlayerState(): PlayerState {
  return {
    form: 6, morale: 7, fitness: 100,
    goals: 0, assists: 0, yellows: 0, red: false,
    suspendedMatches: 0, injuredUntilDay: -1, minutesPlayed: 0,
    compYellows: 0, compYellowsId: '', redCards: 0,
  }
}

/** Matches required to trigger a yellow-accumulation ban for a competition. */
export function yellowThresholdFor(matchType: string): number {
  // Pure-knockout competitions are stricter (2); group/league/qual use 3.
  return matchType === 'knockout' || matchType === 'nl_final' || matchType === 'playoff' ? 2 : 3
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

export interface TeamMatchOutcome {
  teamId: string
  won: boolean
  drawn: boolean
  appeared: EnginePlayer[] // final XI + subbed-off players (fitness already drained)
  benchUnused: EnginePlayer[]
  scorers: ScorerEntry[]
  events: MatchEvent[]
  day: number
  rng: Rng
  competitionId?: string  // for yellow-card accumulation scoping
  yellowThreshold?: number // yellows that trigger an accumulation ban (default 3)
}

/** Write back fitness, form, morale, goals, cards and injuries after a match. */
export function applyMatchOutcome(states: PlayerStates, o: TeamMatchOutcome) {
  const resultForm = o.won ? 0.8 : o.drawn ? 0 : -0.8
  const resultMorale = o.won ? 1.0 : o.drawn ? 0.1 : -1.2
  const compId = o.competitionId ?? ''
  const threshold = o.yellowThreshold ?? 3
  // players sent off this match: their yellows are subsumed by the red
  const reddedThisMatch = new Set(
    o.events.filter((e) => e.type === 'red' && e.teamId === o.teamId && e.playerId).map((e) => e.playerId),
  )

  for (const ep of o.appeared) {
    const st = states[ep.id]
    if (!st) continue
    st.fitness = clamp(ep.fitness, 0, 100)
    st.minutesPlayed += 90
    st.form = clamp(st.form + resultForm, 1, 10)
    st.morale = clamp(st.morale + resultMorale, 1, 10)
  }
  for (const ep of o.benchUnused) {
    const st = states[ep.id]
    if (!st) continue
    st.form = clamp(st.form + (6 - st.form) * 0.15, 1, 10)
    st.morale = clamp(st.morale - 0.2 + (o.won ? 0.3 : 0), 1, 10)
  }
  for (const s of o.scorers.filter((x) => x.teamId === o.teamId)) {
    const st = states[s.playerId]
    if (!st) continue
    st.goals++
    st.form = clamp(st.form + 0.7, 1, 10)
    st.morale = clamp(st.morale + 0.5, 1, 10)
  }
  for (const e of o.events) {
    if (e.teamId !== o.teamId || !e.playerId) continue
    const st = states[e.playerId]
    if (!st) continue
    if (e.type === 'yellow') {
      // a second yellow that became a red is handled by the red event below
      if (reddedThisMatch.has(e.playerId)) continue
      // reset accumulation when the competition changes
      if (st.compYellowsId !== compId) { st.compYellows = 0; st.compYellowsId = compId }
      st.compYellows++
      st.yellows = st.compYellows
      if (st.compYellows >= threshold) {
        st.suspendedMatches = Math.max(st.suspendedMatches, 1)
        st.suspensionReason = 'yellows'
        st.compYellows = 0
      }
    }
    if (e.type === 'red') {
      st.red = true
      st.redCards = (st.redCards ?? 0) + 1
      const ban = e.suspension ?? 1
      st.suspendedMatches = Math.max(st.suspendedMatches, ban)
      st.suspensionReason = e.redCategory ?? 'straight'
      // a sending-off wipes the running yellow tally for this competition
      st.compYellows = 0
      st.yellows = 0
    }
    if (e.type === 'injury') {
      st.injuredUntilDay = o.day + randInt(o.rng, 2, 8)
      st.fitness = Math.min(st.fitness, 40)
    }
  }
}

/** Suspensions tick down once the player's team has played a match without him.
 *  `eligibleIds`, when given, restricts ticking to players who were already
 *  banned coming into this match — so a player sent off THIS match does not
 *  have his fresh ban decremented before he has actually served any of it.
 *  Returns the ids of players whose suspension was fully served this match. */
export function tickSuspensions(
  states: PlayerStates, teamPlayerIds: string[], appearedIds: Set<string>, eligibleIds?: Set<string>,
): string[] {
  const served: string[] = []
  for (const id of teamPlayerIds) {
    const st = states[id]
    if (!st || st.suspendedMatches <= 0 || appearedIds.has(id)) continue
    if (eligibleIds && !eligibleIds.has(id)) continue
    st.suspendedMatches--
    if (st.suspendedMatches === 0) {
      st.red = false
      st.suspensionReason = undefined
      served.push(id)
    }
  }
  return served
}

/** Daily recovery on prep days (all 48 squads). */
export function dailyRecovery(states: PlayerStates) {
  for (const st of Object.values(states)) {
    st.fitness = clamp(st.fitness + 14, 0, 100)
    st.form = clamp(st.form + (6 - st.form) * 0.06, 1, 10)
  }
}

export interface PrepEffect {
  trainingBoost?: { attack?: number; defense?: number; setpieces?: number }
  teamFitness?: number
  teamMorale?: number
  press?: number
}

export function prepActionEffect(action: PrepAction): PrepEffect {
  switch (action) {
    case 'attack': return { trainingBoost: { attack: 2 }, teamFitness: -4 }
    case 'defense': return { trainingBoost: { defense: 2 }, teamFitness: -4 }
    case 'setpieces': return { trainingBoost: { setpieces: 2 }, teamFitness: -3 }
    case 'rest': return { teamFitness: 10 }
    case 'talk': return { teamMorale: 0.6 }
    case 'press': return { press: 1, teamMorale: 0.2 }
    case 'tactics': return {} // handled separately (familiarity training)
  }
}

export function applyPrepEffect(states: PlayerStates, teamPlayerIds: string[], eff: PrepEffect) {
  for (const id of teamPlayerIds) {
    const st = states[id]
    if (!st) continue
    if (eff.teamFitness) st.fitness = clamp(st.fitness + eff.teamFitness, 0, 100)
    if (eff.teamMorale) st.morale = clamp(st.morale + eff.teamMorale, 1, 10)
  }
}
