/**
 * Aging, retirement, and regen system for the national team career.
 */
import type { Player, Position } from '../../data/types'
import type { PlayerState, YouthPlayer } from '../types'
import { makeRng, randInt, type Rng } from '../rng'
import nameSeeds from '../../data/nameSeed.json'

// ── confederation → default skin tone for avatar generation ──────────────────
const CONF_SKIN: Record<string, number> = {
  UEFA: 1, CONMEBOL: 3, CONCACAF: 3, CAF: 6, AFC: 4, OFC: 4,
}

// ── OVR decay per year by age bracket ────────────────────────────────────────

export function annualOvrDecay(position: Position, ageAtStartOfYear: number): number {
  if (position === 'GK') {
    // GK peak is 28-34; decay starts at 35
    if (ageAtStartOfYear < 35) return 0
    if (ageAtStartOfYear <= 37) return 2
    return 3
  }
  if (ageAtStartOfYear < 27) return 0
  if (ageAtStartOfYear <= 29) return 2
  if (ageAtStartOfYear <= 31) return 3
  if (ageAtStartOfYear <= 33) return 4
  return 6
}

/** Player's age at the start of a given calendar year. */
export function ageInYear(birthDateStr: string, year: number): number {
  const birthYear = parseInt(birthDateStr.slice(0, 4), 10)
  return year - birthYear
}

/** Effective overall = base overall minus accumulated aging decay. */
export function effectiveOverall(baseOverall: number, state: PlayerState): number {
  return Math.max(40, baseOverall - (state.overallDecay ?? 0))
}

// ── retirement probability ────────────────────────────────────────────────────

export function retirementProbability(position: Position, age: number, effectiveOvr: number): number {
  if (position === 'GK') {
    // GKs retire later
    if (age < 38) return 0
    if (age === 38) return effectiveOvr < 75 ? 0.30 : 0
    if (age === 39) return 0.55
    if (age === 40) return 0.85
    return 1.0
  }
  // Field players
  if (age < 35) return 0
  if (age === 35) return effectiveOvr < 75 ? 0.30 : 0
  if (age === 36) return effectiveOvr < 78 ? 0.55 : 0.20
  if (age === 37) return 0.85
  return 1.0
}

// ── regen player generation ───────────────────────────────────────────────────

interface RegenOpts {
  teamId: string
  confederation: string
  position: Position
  currentYear: number
  hasYouthAcademy: boolean
  rng: Rng
}

/** Standout stat ranges by position for new youth talent. */
function standoutStat(pos: Position, statKey: string, rng: Rng): number {
  const isStandout = (pos === 'FW' && (statKey === 'shooting' || statKey === 'pace'))
    || (pos === 'MF' && (statKey === 'passing' || statKey === 'dribbling'))
    || (pos === 'DF' && (statKey === 'defending' || statKey === 'physical'))
  if (isStandout) return 55 + randInt(rng, 0, 18)     // 55-73 (standout)
  return 35 + randInt(rng, 0, 20)                       // 35-55 (raw)
}

export function generateRegenPlayer(opts: RegenOpts): Player {
  const { teamId, confederation, position, currentYear, hasYouthAcademy, rng } = opts

  const age = 16 + (rng() < 0.55 ? 1 : rng() < 0.7 ? 2 : 3)   // weighted: 17 most likely
  const birthYear = currentYear - age
  const birthDate = `${birthYear}-${String(1 + randInt(rng, 0, 11)).padStart(2, '0')}-${String(1 + randInt(rng, 0, 27)).padStart(2, '0')}`

  const baseOvr = 45 + randInt(rng, 0, 17)                       // 45-62
  const potBonus = hasYouthAcademy ? 5 : 0
  const potential = Math.min(92, 65 + randInt(rng, 0, 23) + potBonus)  // 65-88 (+5 with academy)

  // Stats for non-GKs
  const pace     = standoutStat(position, 'pace',     rng)
  const shooting = position === 'GK' ? null : standoutStat(position, 'shooting', rng)
  const passing  = standoutStat(position, 'passing',  rng)
  const dribbling = position === 'GK' ? null : standoutStat(position, 'dribbling', rng)
  const defending = standoutStat(position, 'defending', rng)
  const physical  = standoutStat(position, 'physical',  rng)

  const gkStats = position === 'GK' ? {
    diving:      40 + randInt(rng, 0, 20),
    handling:    40 + randInt(rng, 0, 20),
    kicking:     40 + randInt(rng, 0, 15),
    reflexes:    45 + randInt(rng, 0, 20),
    speed:       50 + randInt(rng, 0, 15),
    positioning: 40 + randInt(rng, 0, 20),
  } : null

  // Generate a realistic name from nameSeed
  const seeds = (nameSeeds as Record<string, { first: string[]; last: string[] }>)[teamId]
  let name: string
  if (seeds) {
    const first = seeds.first[randInt(rng, 0, seeds.first.length - 1)]
    const last  = seeds.last[randInt(rng, 0, seeds.last.length - 1)]
    name = `${first} ${last}`
  } else {
    name = `Youth ${teamId} ${randInt(rng, 10, 99)}`
  }

  // Young avatar: no beard if under 20
  const skinTone = CONF_SKIN[confederation] ?? 3
  const hairStyles = ['short', 'fade', 'buzz', 'curly']
  const hairColors = ['black', 'darkbrown', 'brown']
  const avatar = {
    skinTone: Math.max(0, Math.min(7, skinTone + randInt(rng, -1, 1))),
    hairStyle: hairStyles[randInt(rng, 0, hairStyles.length - 1)],
    hairColor: hairColors[randInt(rng, 0, hairColors.length - 1)],
    beard: age < 20 ? 'none' : rng() < 0.6 ? 'none' : 'stubble',
  }

  const id = `${teamId.toLowerCase()}_regen_${birthDate.replace(/-/g, '')}_${randInt(rng, 100, 999)}`

  return {
    id,
    name,
    number: 99,
    position,
    birthDate,
    club: 'Youth',
    caps: 0,
    goals: 0,
    stats: {
      overall: baseOvr,
      potential,
      pace: position === 'GK' ? null : pace,
      shooting,
      passing,
      dribbling,
      defending,
      physical,
    },
    gkStats,
    skillMoves: 2,
    weakFoot: 3,
    preferredFoot: rng() < 0.8 ? 'Right' : 'Left',
    estimated: true,
    source: 'regen',
    avatar,
  }
}

// ── annual development for youth players ─────────────────────────────────────

/** Each year, young regens develop toward their potential. */
export function developRegenPlayer(player: Player, currentYear: number, rng: Rng): Player {
  const age = ageInYear(player.birthDate, currentYear)
  if (age > 28) return player   // growth stops

  const potential = player.stats.potential ?? 75
  const current   = player.stats.overall
  if (current >= potential) return player

  // Faster growth up to 24, slower 24-28
  const maxGrowth = age < 24 ? randInt(rng, 2, 4) : randInt(rng, 0, 2)
  const actualGrowth = Math.min(maxGrowth, potential - current)

  // Also grow individual stats proportionally
  const growStat = (v: number | null, pct: number) =>
    v !== null ? Math.min(99, Math.round(v + actualGrowth * pct)) : null

  const isStandoutPace     = player.position === 'FW'
  const isStandoutShooting = player.position === 'FW'
  const isStandoutPassing  = player.position === 'MF'
  const isStandoutDribbling = player.position === 'MF'
  const isStandoutDef      = player.position === 'DF'
  const isStandoutPhysical = player.position === 'DF'

  return {
    ...player,
    stats: {
      ...player.stats,
      overall: current + actualGrowth,
      pace:      growStat(player.stats.pace,      isStandoutPace     ? 0.8 : 0.4),
      shooting:  growStat(player.stats.shooting,  isStandoutShooting ? 0.8 : 0.4),
      passing:   growStat(player.stats.passing,   isStandoutPassing  ? 0.8 : 0.5),
      dribbling: growStat(player.stats.dribbling, isStandoutDribbling ? 0.8 : 0.4),
      defending: growStat(player.stats.defending, isStandoutDef      ? 0.8 : 0.4),
      physical:  growStat(player.stats.physical,  isStandoutPhysical ? 0.8 : 0.5),
    },
  }
}

// ── annual aging pass results ─────────────────────────────────────────────────

export interface AgingPassResult {
  decayUpdates: Record<string, number>      // playerId → new overallDecay value
  retiredIds: string[]                       // players who retire from intl football
}

/**
 * Run one year of the aging pass across all players in all teams.
 * Returns changes to apply; caller applies to GameState.
 */
export function runAgingPass(
  allPlayers: Array<{ id: string; birthDate: string; position: Position; stats: { overall: number } }>,
  currentStates: Record<string, { overallDecay?: number; retiredInternational?: boolean }>,
  currentYear: number,
  rng: Rng,
): AgingPassResult {
  const decayUpdates: Record<string, number> = {}
  const retiredIds: string[] = []

  for (const p of allPlayers) {
    const st = currentStates[p.id]
    if (st?.retiredInternational) continue  // already retired

    const age = ageInYear(p.birthDate, currentYear)
    const existingDecay = st?.overallDecay ?? 0
    const yearDecay = annualOvrDecay(p.position, age)
    const newDecay = existingDecay + yearDecay
    if (newDecay !== existingDecay) {
      decayUpdates[p.id] = newDecay
    }

    // Retirement check
    const effOvr = Math.max(40, p.stats.overall - newDecay)
    const prob = retirementProbability(p.position, age, effOvr)
    if (prob > 0 && rng() < prob) {
      retiredIds.push(p.id)
    }
  }

  return { decayUpdates, retiredIds }
}

// ── seed rng for aging (deterministic per year) ──────────────────────────────
export function agingRng(careerSeed: number, year: number): Rng {
  return makeRng((careerSeed ^ (year * 2654435761)) >>> 0)
}

// ── potential stars display ───────────────────────────────────────────────────
export function calcPotentialStars(potential: number): 1 | 2 | 3 | 4 | 5 {
  if (potential >= 85) return 5
  if (potential >= 80) return 4
  if (potential >= 74) return 3
  if (potential >= 68) return 2
  return 1
}

// ── youth player generation ───────────────────────────────────────────────────

interface YouthOpts {
  teamId: string
  confederation: string
  position: Position
  ageGroup: 'U17' | 'U21'
  currentYear: number
  hasYouthAcademy: boolean
  scoutingNetworkOwned: boolean
  rng: Rng
}

export function generateYouthPlayer(opts: YouthOpts): YouthPlayer {
  const { teamId, confederation, position, ageGroup, currentYear, hasYouthAcademy, scoutingNetworkOwned, rng } = opts

  // Age: U17 = 14-16 weighted toward 15, U21 = 17-21
  const age = ageGroup === 'U17'
    ? 14 + (rng() < 0.15 ? 0 : rng() < 0.65 ? 1 : 2)
    : 17 + randInt(rng, 0, 4)
  const birthYear = currentYear - age
  const birthDate = `${birthYear}-${String(1 + randInt(rng, 0, 11)).padStart(2, '0')}-${String(1 + randInt(rng, 0, 27)).padStart(2, '0')}`

  // OVR: U17 lower, U21 higher
  const baseOvr = ageGroup === 'U17'
    ? 42 + randInt(rng, 0, 16)   // 42-58
    : 55 + randInt(rng, 0, 13)   // 55-68

  // Potential with academy bonus
  const potBase = ageGroup === 'U17'
    ? 62 + randInt(rng, 0, 20)   // 62-82
    : 65 + randInt(rng, 0, 20)   // 65-85
  const potential = Math.min(98, potBase + (hasYouthAcademy ? 5 : 0))

  // Stats
  const pace      = standoutStat(position, 'pace',      rng)
  const shooting  = position === 'GK' ? null : standoutStat(position, 'shooting', rng)
  const passing   = standoutStat(position, 'passing',   rng)
  const dribbling = position === 'GK' ? null : standoutStat(position, 'dribbling', rng)
  const defending = standoutStat(position, 'defending', rng)
  const physical  = standoutStat(position, 'physical',  rng)

  const gkStats = position === 'GK' ? {
    diving:      38 + randInt(rng, 0, 18),
    handling:    38 + randInt(rng, 0, 18),
    kicking:     38 + randInt(rng, 0, 15),
    reflexes:    42 + randInt(rng, 0, 18),
    speed:       48 + randInt(rng, 0, 15),
    positioning: 38 + randInt(rng, 0, 18),
  } : null

  // Name
  const seeds = (nameSeeds as Record<string, { first: string[]; last: string[] }>)[teamId]
  const name = seeds
    ? `${seeds.first[randInt(rng, 0, seeds.first.length - 1)]} ${seeds.last[randInt(rng, 0, seeds.last.length - 1)]}`
    : `Youth ${teamId} ${randInt(rng, 10, 99)}`

  // Avatar (young, no beard under 19)
  const skinTone = CONF_SKIN[confederation] ?? 3
  const avatar = {
    skinTone: Math.max(0, Math.min(7, skinTone + randInt(rng, -1, 1))),
    hairStyle: (['short', 'fade', 'buzz', 'curly'] as const)[randInt(rng, 0, 3)],
    hairColor: (['black', 'darkbrown', 'brown'] as const)[randInt(rng, 0, 2)],
    beard: age < 19 ? 'none' : rng() < 0.7 ? 'none' : 'stubble',
  }

  const id = `${teamId.toLowerCase()}_youth_${birthDate.replace(/-/g, '')}_${randInt(rng, 100, 999)}`

  // U21 players may already have a few caps
  const caps = ageGroup === 'U21' && rng() < 0.3 ? randInt(rng, 1, 5) : 0

  const devPhase: YouthPlayer['developmentPhase'] = age <= 16 ? 'raw' : age <= 21 ? 'developing' : 'peaking'

  return {
    id, name, number: 99, position, birthDate,
    club: 'Youth Academy', caps, goals: 0,
    stats: {
      overall: baseOvr,
      potential,
      pace: position === 'GK' ? null : pace,
      shooting, passing, dribbling, defending, physical,
    },
    gkStats,
    skillMoves: 2, weakFoot: 3,
    preferredFoot: rng() < 0.8 ? 'Right' : 'Left',
    estimated: true, source: 'regen',
    avatar,
    // YouthPlayer fields
    potential,
    potentialStars: calcPotentialStars(potential),
    potentialRevealed: scoutingNetworkOwned,
    ageGroup,
    developmentPhase: devPhase,
    teamId,
    yearGenerated: currentYear,
  }
}

/** Position distribution for a starting youth squad. */
const U17_POSITIONS: Position[] = ['GK', 'GK', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW']
const U21_POSITIONS: Position[] = ['GK', 'GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW']

export function generateYouthSquad(
  teamId: string,
  confederation: string,
  currentYear: number,
  hasYouthAcademy: boolean,
  scoutingNetworkOwned: boolean,
  rng: Rng,
): { u17: YouthPlayer[]; u21: YouthPlayer[] } {
  const opts = { teamId, confederation, currentYear, hasYouthAcademy, scoutingNetworkOwned, rng }
  const u17 = U17_POSITIONS.map((pos) => generateYouthPlayer({ ...opts, position: pos, ageGroup: 'U17' }))
  const u21 = U21_POSITIONS.map((pos) => generateYouthPlayer({ ...opts, position: pos, ageGroup: 'U21' }))
  return { u17, u21 }
}

/** Develop a youth player by one year. Returns updated player (or same if at potential). */
export function developYouthPlayer(p: YouthPlayer, currentYear: number, rng: Rng): YouthPlayer {
  const age = ageInYear(p.birthDate, currentYear)
  const potential = p.potential
  const current   = p.stats.overall
  if (current >= potential || age > 27) return p

  const maxGrowth = age <= 20 ? randInt(rng, 3, 5) : age <= 23 ? randInt(rng, 2, 3) : randInt(rng, 1, 2)
  const actualGrowth = Math.min(maxGrowth, potential - current)

  const growStat = (v: number | null, pct: number) =>
    v !== null ? Math.min(99, Math.round(v + actualGrowth * pct)) : null

  const devPhase: YouthPlayer['developmentPhase'] = age <= 16 ? 'raw' : age <= 21 ? 'developing' : 'peaking'
  const newAgeGroup: YouthPlayer['ageGroup'] = age >= 17 ? 'U21' : 'U17'

  return {
    ...p,
    ageGroup: newAgeGroup,
    developmentPhase: devPhase,
    stats: {
      ...p.stats,
      overall: current + actualGrowth,
      pace:      growStat(p.stats.pace,      p.position === 'FW' ? 0.8 : 0.4),
      shooting:  growStat(p.stats.shooting,  p.position === 'FW' ? 0.8 : 0.4),
      passing:   growStat(p.stats.passing,   p.position === 'MF' ? 0.8 : 0.5),
      dribbling: growStat(p.stats.dribbling, p.position === 'MF' ? 0.8 : 0.4),
      defending: growStat(p.stats.defending, p.position === 'DF' ? 0.8 : 0.4),
      physical:  growStat(p.stats.physical,  p.position === 'DF' ? 0.8 : 0.5),
    },
    potentialStars: calcPotentialStars(potential),
  }
}
