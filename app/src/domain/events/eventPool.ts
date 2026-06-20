import type { Player } from '../../data/types'
import type { Rng } from '../rng'
import { pickWeighted } from '../rng'
import type { Lineup, PlayerStates } from '../types'

export interface EventContext {
  day: number
  players: Player[] // user squad
  states: PlayerStates
  lineup: Lineup
  lastWon: boolean | null // last user match result, null before first match
  pressRelation: number
  rng: Rng
}

export interface ChoiceEffect {
  subjectMorale?: number
  subjectForm?: number
  subjectFitness?: number
  teamMorale?: number
  teamFitness?: number
  press?: number
}

export interface GameEvent {
  id: string
  weight: number
  eligible: (c: EventContext) => boolean
  pickSubject?: (c: EventContext) => Player | undefined
  choices: ChoiceEffect[] // text comes from i18n: events.{id}.c{i}
}

const starter = (c: EventContext, p: Player) => c.lineup.starters.includes(p.id)
const avail = (c: EventContext, p: Player) =>
  c.states[p.id].injuredUntilDay <= c.day && c.states[p.id].suspendedMatches <= 0

function benchedStar(c: EventContext): Player | undefined {
  return c.players
    .filter((p) => !starter(c, p) && avail(c, p))
    .sort((a, b) => b.stats.overall - a.stats.overall)
    .find((p) => p.stats.overall >= 78)
}

function randomPlayer(c: EventContext): Player {
  return pickWeighted(c.rng, c.players, () => 1)
}

export const EVENT_POOL: GameEvent[] = [
  {
    id: 'press_praise', weight: 2,
    eligible: (c) => c.lastWon === true,
    choices: [{ press: 1 }, { teamMorale: 0.4, press: -1 }],
  },
  {
    id: 'press_critic', weight: 2,
    eligible: (c) => c.lastWon === false,
    choices: [{ press: 1, teamMorale: -0.2 }, { teamMorale: 0.5, press: -1 }],
  },
  {
    id: 'star_benched', weight: 3,
    eligible: (c) => benchedStar(c) !== undefined,
    pickSubject: benchedStar,
    choices: [{ subjectMorale: 1 }, { subjectMorale: -1.5, teamMorale: 0.3 }],
  },
  {
    id: 'homesick', weight: 2,
    eligible: () => true,
    pickSubject: randomPlayer,
    choices: [{ subjectMorale: 1.2, subjectFitness: -5 }, { subjectMorale: -0.8 }],
  },
  {
    id: 'training_bustup', weight: 2,
    eligible: () => true,
    pickSubject: randomPlayer,
    choices: [{ subjectMorale: -1.5, teamMorale: 0.4 }, { subjectMorale: 0.5, teamMorale: -0.4 }],
  },
  {
    id: 'fan_welcome', weight: 2,
    eligible: () => true,
    choices: [{ teamMorale: 0.6 }, { teamFitness: 4 }],
  },
  {
    id: 'minor_knock', weight: 3,
    eligible: () => true,
    pickSubject: (c) =>
      c.players.filter((p) => starter(c, p) && avail(c, p)).sort(() => c.rng() - 0.5)[0],
    choices: [{ subjectFitness: -12 }, { subjectFitness: 5, subjectForm: -0.5 }],
  },
  {
    id: 'media_leak', weight: 1.5,
    eligible: (c) => c.pressRelation < 2,
    choices: [{ press: -1, teamMorale: -0.3 }, { press: 1, teamMorale: -0.6 }],
  },
  {
    id: 'birthday', weight: 1.5,
    eligible: () => true,
    pickSubject: randomPlayer,
    choices: [{ subjectMorale: 1.5, teamMorale: 0.3 }, { subjectMorale: 0.5 }],
  },
  {
    id: 'keeper_doubt', weight: 2,
    eligible: (c) => {
      const gk = c.players.find((p) => p.id === c.lineup.starters[0])
      return !!gk && c.states[gk.id].form < 5
    },
    pickSubject: (c) => c.players.find((p) => p.id === c.lineup.starters[0]),
    choices: [{ subjectForm: 0.8, subjectMorale: 0.5 }, { subjectMorale: -1 }],
  },
  {
    id: 'youngster_shine', weight: 2,
    eligible: () => true,
    pickSubject: (c) =>
      [...c.players].sort((a, b) => b.birthDate.localeCompare(a.birthDate))[0],
    choices: [{ subjectForm: 1, subjectMorale: 1 }, { subjectMorale: -0.5, teamMorale: 0.2 }],
  },
  {
    id: 'tactics_doubt', weight: 2,
    eligible: (c) => c.lastWon === false,
    choices: [{ teamMorale: 0.4 }, { teamMorale: -0.5, press: 1 }],
  },
  {
    id: 'captain_meeting', weight: 2,
    eligible: (c) => {
      const avg =
        c.players.reduce((s, p) => s + c.states[p.id].morale, 0) / c.players.length
      return avg < 5.5
    },
    choices: [{ teamMorale: 0.8 }, { teamMorale: -0.3 }],
  },
  {
    id: 'sponsor_day', weight: 1.5,
    eligible: () => true,
    choices: [{ teamFitness: -5, press: 1 }, { press: -1 }],
  },
  {
    id: 'illness', weight: 1.5,
    eligible: () => true,
    pickSubject: randomPlayer,
    choices: [{ subjectFitness: -20 }, { subjectFitness: -10, teamFitness: -3 }],
  },
  {
    id: 'old_rival', weight: 1.5,
    eligible: (c) => c.day > 4,
    choices: [{ teamMorale: 0.5, press: 1 }, { teamMorale: -0.2 }],
  },
]

/** Roll for an event on a prep day (~45% chance one fires). */
export function rollEvent(c: EventContext): { eventId: string; playerId?: string } | null {
  if (c.rng() > 0.45) return null
  const eligible = EVENT_POOL.filter((e) => e.eligible(c))
  if (!eligible.length) return null
  const ev = pickWeighted(c.rng, eligible, (e) => e.weight)
  const subject = ev.pickSubject?.(c)
  if (ev.pickSubject && !subject) return null
  return { eventId: ev.id, playerId: subject?.id }
}

export function getEvent(id: string): GameEvent {
  const e = EVENT_POOL.find((x) => x.id === id)
  if (!e) throw new Error(`unknown event ${id}`)
  return e
}
