import { makeRng, pickWeighted, randInt, type Rng } from '../rng'
import type { GkStats, Position } from '../../data/types'
import type {
  MatchEvent, MatchResult, MatchStats, Mentality, RedCategory,
  ScorerEntry, Tactics, WeatherType,
} from '../types'
import {
  effectiveness, tacticEffect, teamRatings,
  type EnginePlayer, type TacticEffect, type TeamRatings,
} from './ratings'
import { FORMATIONS } from './formations'

function emptyStats(): MatchStats {
  return { shots: 0, shotsOnTarget: 0, corners: 0, fouls: 0, offsides: 0 }
}

/** All engine probabilities live here so the calibration script can tune one place. */
export const TUNING = {
  basePerMin: 0.200,      // raised to hit 2.4-3.0 goals/match after offside cancellations
  midExp: 2.5,
  convBase: 0.095,
  convPower: 2,
  convMin: 0.025,
  convMax: 0.4,
  penPerChance: 0.009,    // calibrated to 0.15-0.35/match (was 0.015, too many pens)
  penScoreBase: 0.76,
  injPerMin: 0.0012,      // reduced slightly to stay within 0.05-0.25/match
  yellowPerMin: 0.005,    // reduced (was 0.006); fouls add ~0.7 more
  redPerMin: 0.0002,      // calibrated: direct discipline reds + second yellows → 0.05-0.15/match
  momentumMult: 1.1,
  momentumMins: 8,
  trailingLatePush: 1.28,
  leadingLateShell: 0.85,
  fatiguePerMin: 0.55,
  bigChanceThreshold: 0.155,  // raised: more chances at higher basePerMin, need stricter filter
  // ── offside ──────────────────────────────────────────────────────────────
  offsidePerChance: 0.15,  // calibrated to 2-5/match at higher basePerMin
  offsideCatch: 0.85,
  // ── fouls / free kicks ───────────────────────────────────────────────────
  foulPerMin: 0.062,       // raised slightly: chance-gate reduces minutes fouls can fire
  foulRedRate: 0.0,        // no violent conduct from fouls — discipline() handles straight reds
  foulYellowRate: 0.10,    // calibrated to ~0.7 yellow/match from fouls
  foulDangerousZone: 0.28, // P(foul awarded in dangerous FK zone | foul)
  fkGoalRate: 0.09,        // P(direct FK goal | dangerous FK shot attempted)
  fkSaveRate: 0.44,        // P(FK saved | FK shot not a goal)
  // ── momentum ─────────────────────────────────────────────────────────────
  momentumGoalShift: 35,
  momentumBigMissShift: 8,
  momentumRedShift: 20,
  momentumCornerShift: 3,
}

export interface Side {
  teamId: string
  formation?: string
  starters: EnginePlayer[]
  bench: EnginePlayer[]
  tactics: Tactics
  isUser: boolean
  subsMade: number
  windowsUsed: number
  windowOpen: boolean
  bonus?: { att: number; def: number }
  formationBias?: number
  penaltyTakerId?: string
  markedOpponents?: Record<string, 'tight' | 'space'>
  captainId?: string | null
  viceCaptainId?: string | null
  familiarityScore?: number
  redCards?: number
  sentOffRoles?: Position[]
}

function makeshiftGk(): GkStats {
  return { diving: 45, handling: 42, kicking: 40, reflexes: 46, speed: 52, positioning: 43 }
}

function countDefenders(formation: string): number {
  const slots = FORMATIONS[formation] ?? FORMATIONS['4-3-3']
  return slots.filter((s) => s.role === 'DF').length
}

// Attack modifier for own formation vs opponent formation.
// Kept intentionally small: convPower=2 squares ratios, so 1.07 att vs 1.07 def
// already produces ~15% goal difference per team.
function formationAttMod(ownFm: string, oppFm: string): number {
  const own = countDefenders(ownFm)
  const opp = countDefenders(oppFm)
  const base = own <= 3 ? 1.07 : own >= 5 ? 0.94 : 1.00
  // 5-back opponent crowds out a 3-front attack
  const matchup = opp >= 5 && own <= 3 ? 0.95 : 1.0
  return base * matchup
}

// Defense modifier for own formation vs opponent formation.
function formationDefMod(ownFm: string, oppFm: string): number {
  const own = countDefenders(ownFm)
  const opp = countDefenders(oppFm)
  const base = own <= 3 ? 0.93 : own >= 5 ? 1.14 : 1.00
  // 5-back outnumbers 3-front attackers
  const matchup = own >= 5 && opp <= 3 ? 1.05 : 1.0
  return base * matchup
}

export interface SideStatus {
  goals: number
  ratings: TeamRatings
  effect: TacticEffect
  momentumUntil: number
}

export type EnginePhase = '1H' | 'HT' | '2H' | 'BREAK_ET' | 'ET1' | 'ET2' | 'PENS' | 'DONE'

export interface SubRequest {
  outId: string
  inId: string
}

export class MatchSim {
  home: Side
  away: Side
  knockout: boolean
  rng: Rng
  minute = 0
  phase: EnginePhase = '1H'
  events: MatchEvent[] = []
  scorers: ScorerEntry[] = []
  pens?: { home: number; away: number }
  finishedAfter: 'FT' | 'AET' | 'PENS' = 'FT'
  status: { home: SideStatus; away: SideStatus }
  pendingInjury: { side: 'home' | 'away'; playerId: string } | null = null
  injuredIds: string[] = []
  // ── new fields ────────────────────────────────────────────────────────────
  weather: WeatherType
  momentum = 0                              // -100..+100: positive = home advantage
  matchStats = { home: emptyStats(), away: emptyStats() }
  matchRatings: Record<string, number> = {} // player id → 0-10 rating
  lastVariants: Partial<Record<string, number>> = {} // no-repeat commentary

  constructor(home: Side, away: Side, opts: { knockout: boolean; seed: number }) {
    this.home = home
    this.away = away
    this.knockout = opts.knockout
    this.rng = makeRng(opts.seed)
    for (const s of [home, away]) {
      s.redCards = s.redCards ?? 0
      s.sentOffRoles = s.sentOffRoles ?? []
    }
    this.status = {
      home: this.initStatus(home),
      away: this.initStatus(away),
    }
    this.weather = this.initWeather()
    this.initMatchRatings()
    this.push({ minute: 0, type: 'kickoff', variant: this.vr() })
    // Rare weather-flavor event at minute 0 for bad conditions
    if (this.weather === 'heavy_rain' || this.weather === 'hot_humid') {
      this.push({ minute: 0, type: 'weather_effect', variant: this.pickVariant('weather_effect', 3) })
    }
  }

  private initWeather(): WeatherType {
    const r = this.rng()
    if (r < 0.30) return 'perfect'
    if (r < 0.55) return 'light_rain'
    if (r < 0.70) return 'heavy_rain'
    if (r < 0.90) return 'hot_humid'
    return 'cold'
  }

  private initMatchRatings() {
    for (const p of [...this.home.starters, ...this.home.bench, ...this.away.starters, ...this.away.bench]) {
      this.matchRatings[p.id] = 6.0
    }
  }

  /** Pick a commentary variant index that differs from the last used for this event type. */
  private pickVariant(type: string, count: number): number {
    const last = this.lastVariants[type] ?? -1
    if (count <= 1) return 0
    let v: number
    let tries = 0
    do { v = randInt(this.rng, 0, count - 1) } while (v === last && ++tries < 4)
    this.lastVariants[type] = v
    return v
  }

  private shiftMomentum(delta: number) {
    this.momentum = Math.max(-100, Math.min(100, this.momentum + delta))
  }

  private updateRating(playerId: string, delta: number) {
    if (this.matchRatings[playerId] !== undefined) {
      this.matchRatings[playerId] = Math.max(0, Math.min(10, this.matchRatings[playerId] + delta))
    }
  }

  private applySideMods(side: Side, ratings: TeamRatings) {
    if (side.bonus) {
      ratings.att += side.bonus.att
      ratings.def += side.bonus.def
    }
    const bias = side.formationBias ?? 0
    ratings.att *= 1 + bias * 0.025
    ratings.def *= 1 - bias * 0.02
    for (const role of side.sentOffRoles ?? []) {
      ratings.att *= 0.88
      ratings.mid *= 0.88
      ratings.def *= (role === 'DF' || role === 'GK') ? 0.70 : 0.80
      if (role === 'FW') ratings.att *= 0.75
    }
  }

  private initStatus(side: Side): SideStatus {
    const ratings = teamRatings(side.starters)
    this.applySideMods(side, ratings)
    return { goals: 0, ratings, effect: tacticEffect(side.tactics), momentumUntil: -1 }
  }

  private vr(): number { return randInt(this.rng, 0, 2) }

  private push(e: MatchEvent) { this.events.push(e) }

  side(which: 'home' | 'away'): Side {
    return which === 'home' ? this.home : this.away
  }

  refresh(which: 'home' | 'away') {
    const s = this.side(which)
    const ratings = teamRatings(s.starters)
    this.applySideMods(s, ratings)
    this.status[which].ratings = ratings
    this.status[which].effect = tacticEffect(s.tactics)
  }

  setTactics(which: 'home' | 'away', t: Tactics) {
    this.side(which).tactics = t
    this.refresh(which)
  }

  applySubs(which: 'home' | 'away', subs: SubRequest[]): boolean {
    const s = this.side(which)
    if (subs.length === 0) return true
    const isHT = this.phase === 'HT' || this.phase === 'BREAK_ET'
    if (!isHT && !s.windowOpen && s.windowsUsed >= 3) return false
    if (s.subsMade + subs.length > 5) return false
    for (const { outId, inId } of subs) {
      const outIdx = s.starters.findIndex((p) => p.id === outId)
      const inIdx = s.bench.findIndex((p) => p.id === inId)
      if (outIdx < 0 || inIdx < 0) return false
      const out = s.starters[outIdx]
      const sub = s.bench[inIdx]
      sub.slotRole = out.slotRole
      s.starters[outIdx] = sub
      s.bench.splice(inIdx, 1)
      s.subsMade++
      this.push({ minute: this.minute, type: 'sub', teamId: s.teamId, playerId: sub.id, playerName: out.name, playerName2: sub.name, variant: this.pickVariant('sub', 3) })
      this.checkArmbandTransfer(s, out.id)
    }
    if (!isHT && !s.windowOpen) {
      s.windowsUsed++
      s.windowOpen = true
    }
    if (this.pendingInjury && this.pendingInjury.side === which) this.pendingInjury = null
    this.refresh(which)
    return true
  }

  private familiarityMult(side: Side): { effMult: number; tacticMult: number } {
    const score = side.familiarityScore ?? 70
    if (score <= 20) return { effMult: 0.82, tacticMult: 0.60 }
    if (score <= 40) return { effMult: 0.90, tacticMult: 0.75 }
    if (score <= 60) return { effMult: 0.96, tacticMult: 0.88 }
    if (score <= 80) return { effMult: 1.00, tacticMult: 1.00 }
    return { effMult: 1.04, tacticMult: 1.08 }
  }

  private chanceProb(att: 'home' | 'away'): number {
    const def = att === 'home' ? 'away' : 'home'
    const a = this.status[att]
    const d = this.status[def]
    const hFam = this.familiarityMult(this.home)
    const aFam = this.familiarityMult(this.away)
    const attFam = att === 'home' ? hFam : aFam
    const midA = a.ratings.mid * attFam.effMult * d.effect.oppMidMult
    const midB = d.ratings.mid * (att === 'home' ? aFam.effMult : hFam.effMult) * a.effect.oppMidMult
    const share = Math.pow(midA, TUNING.midExp) / (Math.pow(midA, TUNING.midExp) + Math.pow(midB, TUNING.midExp))
    let p = TUNING.basePerMin * share * 2 * a.effect.chanceMult * attFam.tacticMult
    if (this.minute <= a.momentumUntil) p *= TUNING.momentumMult
    // Unified momentum effect: -100..+100
    const momAdv = att === 'home' ? this.momentum : -this.momentum
    if (momAdv > 50) p *= 1.15
    else if (momAdv < -50) p *= 0.90
    if (this.minute > 70) {
      if (a.goals < d.goals) p *= TUNING.trailingLatePush
      if (a.goals > d.goals) p *= TUNING.leadingLateShell
    }
    return p
  }

  // ── Offside check ─────────────────────────────────────────────────────────
  /** Returns true if the chance is cancelled by offside. Fires an offside event. */
  private checkOffside(attKey: 'home' | 'away'): boolean {
    const defKey = attKey === 'home' ? 'away' : 'home'
    const def = this.side(defKey)
    const defLineN = pSlider(def, 'defLine') // 0..1
    // High defensive line pushes up → more runs caught offside (base rate scales 0.55×..1.45×)
    const offsideBase = TUNING.offsidePerChance * (0.55 + defLineN * 0.90)
    if (this.rng() >= offsideBase) return false
    const catchRate = Math.min(0.95, TUNING.offsideCatch + (defLineN - 0.5) * 0.20)
    if (this.rng() >= catchRate) return false
    // Offside caught
    this.matchStats[attKey].offsides++
    this.push({
      minute: this.minute, type: 'offside',
      teamId: this.side(attKey).teamId,
      variant: this.pickVariant('offside', 5),
    })
    return true
  }

  // ── Foul system ───────────────────────────────────────────────────────────
  /** Contextual foul check per team per minute. Fires free_kick + optional card. */
  private maybeFoul(which: 'home' | 'away') {
    const s = this.side(which)
    if (s.starters.length <= 7) return
    const sl = s.tactics.sliders
    const aggN = sl ? (sl.aggression - 1) / 9 : 0.44
    const rate = TUNING.foulPerMin * (0.8 + aggN * 0.7)
    if (this.rng() >= rate) return

    const opp: 'home' | 'away' = which === 'home' ? 'away' : 'home'
    const oppSide = this.side(opp)
    this.matchStats[which].fouls++

    // Foul zone (from FK-receiving team's perspective)
    const zR = this.rng()
    const foulZone: 'own' | 'mid' | 'att' = zR < 0.35 ? 'own' : zR < 0.70 ? 'mid' : 'att'

    // FK event awarded to opponent
    this.push({
      minute: this.minute, type: 'free_kick',
      teamId: oppSide.teamId,
      variant: this.pickVariant(foulZone === 'att' ? 'foul_dangerous' : 'foul_minor', 4),
      foulZone,
    })

    // Card severity
    const sevR = this.rng()
    if (sevR < TUNING.foulRedRate) {
      // Violent conduct → straight red
      const fouler = pickWeighted(this.rng, s.starters, (p) => p.slotRole === 'DF' ? 3 : 1)
      this.sendOff(which, fouler, 'straight')
    } else if (sevR < TUNING.foulRedRate + TUNING.foulYellowRate) {
      // Yellow card foul
      const fouler = pickWeighted(this.rng, s.starters, (p) =>
        p.slotRole === 'DF' ? 3 : p.slotRole === 'MF' ? 2 : 1)
      this.push({
        minute: this.minute, type: 'yellow',
        teamId: s.teamId, playerId: fouler.id, playerName: fouler.name,
        variant: this.pickVariant('yellow', 3),
      })
      this.updateRating(fouler.id, -0.3)
      const seen = this.events.filter((e) => e.type === 'yellow' && e.teamId === s.teamId && e.playerName === fouler.name)
      if (seen.length >= 2) this.sendOff(which, fouler, 'second_yellow')
    }

    // Resolve dangerous FK (shot attempt if in attacking zone)
    // 'own' = foul in fouling team's defensive third = FK team is near *their* attacking end → dangerous
    if (foulZone === 'own') this.resolveDangerousFk(opp)
  }

  /** Resolve a direct free kick attempt in shooting range. */
  private resolveDangerousFk(attKey: 'home' | 'away') {
    const defKey = attKey === 'home' ? 'away' : 'home'
    const att = this.side(attKey)
    const def = this.side(defKey)
    const r = this.rng()
    if (r >= 0.40) return  // cross (35%) or short routine (25%) — no shot event

    // Direct shot attempt
    const taker = this.pickShooter(att)
    this.matchStats[attKey].shots++
    const pGoal = Math.min(0.28, Math.max(0.03, TUNING.fkGoalRate *
      (((taker.stats.shooting ?? 50) * 0.7 + (taker.stats.passing ?? 50) * 0.3) / 70) *
      effectiveness(taker)))

    if (this.rng() < pGoal) {
      // FK GOAL
      this.status[attKey].goals++
      this.status[attKey].momentumUntil = this.minute + TUNING.momentumMins
      this.shiftMomentum(attKey === 'home' ? TUNING.momentumGoalShift : -TUNING.momentumGoalShift)
      this.scorers.push({ playerId: taker.id, teamId: att.teamId, minute: this.minute })
      this.matchStats[attKey].shotsOnTarget++
      this.updateRating(taker.id, 1.5)
      this.push({
        minute: this.minute, type: 'free_kick_goal',
        teamId: att.teamId, playerId: taker.id, playerName: taker.name,
        variant: this.pickVariant('free_kick_goal', 4),
        late: this.minute >= 80 || undefined,
      })
    } else if (this.rng() < TUNING.fkSaveRate) {
      // FK SAVED
      this.matchStats[attKey].shotsOnTarget++
      const gk = def.starters.find((p) => p.slotRole === 'GK')
      if (gk) this.updateRating(gk.id, 0.4)
      this.push({
        minute: this.minute, type: 'free_kick_saved',
        teamId: att.teamId, playerId: taker.id, playerName: taker.name,
        variant: this.pickVariant('free_kick_saved', 3),
      })
    }
    // else: FK missed wide — no extra event, goal kick follows
  }

  private pickShooter(side: Side): EnginePlayer {
    const pool = side.starters.filter((p) => p.slotRole !== 'GK')
    return pickWeighted(this.rng, pool, (p) => {
      const roleW = p.slotRole === 'FW' ? 5 : p.slotRole === 'MF' ? 2.2 : 0.6
      return roleW * ((p.stats.shooting ?? 40) + 20)
    })
  }

  private resolveChance(attKey: 'home' | 'away') {
    // ── 1. Offside check — must run BEFORE any goal chain ──
    if (this.checkOffside(attKey)) return

    const defKey = attKey === 'home' ? 'away' : 'home'
    const att = this.side(attKey)
    const def = this.side(defKey)
    const a = this.status[attKey]
    const d = this.status[defKey]

    // ── 1b. Formation matchup modifiers ──────────────────────────────────────
    const attFM = formationAttMod(att.formation ?? '4-3-3', def.formation ?? '4-3-3')
    const defFM = formationDefMod(def.formation ?? '4-3-3', att.formation ?? '4-3-3')

    // ── 2. Shot zone ──
    const zoneRoll = this.rng()
    type Zone = 'close' | 'edge' | 'long' | 'very_long'
    const zone: Zone = zoneRoll < 0.35 ? 'close' : zoneRoll < 0.65 ? 'edge' : zoneRoll < 0.95 ? 'long' : 'very_long'
    const zoneConvMult: Record<Zone, number> = { close: 1.0, edge: 0.65, long: 0.22, very_long: 0.04 }

    // ── 3. Penalty check (only from close zone) ──
    if (zone === 'close' && this.rng() < TUNING.penPerChance / 0.35) {
      const preferred = att.penaltyTakerId ? att.starters.find((p) => p.id === att.penaltyTakerId) : null
      const taker = preferred ?? this.pickShooter(att)
      const gkQ = d.ratings.gk
      const penStyle = att.tactics.setpieceOptions?.penaltyStyle ?? 'placed'
      let pScore: number
      if (penStyle === 'panenka') {
        pScore = 0.82
      } else {
        const styleBonus = penStyle === 'power' ? 0.04 : 0.02
        // Late-game pressure modifier
        const latePenalty = this.minute >= 75 ? -0.05 : 0
        // Taker shooting skill modifier
        const skillMod = ((taker.stats.shooting ?? 60) - 75) * 0.003
        // GK reflexes modifier
        const gkReflexes = this.side(defKey).starters.find(p => p.slotRole === 'GK')?.gk?.reflexes ?? 70
        const gkMod = gkReflexes >= 85 ? -0.10 : 0
        pScore = Math.min(0.94, Math.max(0.55, TUNING.penScoreBase + styleBonus + skillMod + gkMod + latePenalty + ((taker.stats.shooting ?? 60) - gkQ) * 0.003))
      }
      this.matchStats[attKey].shots++
      this.matchStats[attKey].shotsOnTarget++
      if (this.rng() < pScore) this.goal(attKey, taker, true, false)
      else {
        this.push({ minute: this.minute, type: 'pen_miss', teamId: att.teamId, playerId: taker.id, playerName: taker.name, variant: this.vr() })
        this.updateRating(taker.id, -0.5)
      }
      return
    }

    // ── 4. Normal shot resolution ──
    const shooter = this.pickShooter(att)
    const marking = def.markedOpponents?.[shooter.id]
    const markMult = marking === 'tight' ? 0.85 : marking === 'space' ? 1.05 : 1
    // Weather modifiers
    const weatherShoot = this.weather === 'heavy_rain' ? 0.92 : 1.0
    const shooterQ = ((shooter.stats.shooting ?? 45) * 0.7 + (shooter.stats.dribbling ?? 45) * 0.3) * effectiveness(shooter) * markMult * weatherShoot
    const attackQ = (shooterQ * 0.6 + a.ratings.att * 0.4) * a.effect.attMult * attFM
    const defenseQ = (d.ratings.def * 0.58 + d.ratings.gk * 0.42) * d.effect.defMult * defFM
    const pGoalBase = Math.min(TUNING.convMax,
      Math.max(TUNING.convMin, TUNING.convBase * Math.pow(attackQ / defenseQ, TUNING.convPower)))
    const pGoal = Math.min(TUNING.convMax, pGoalBase * zoneConvMult[zone])

    this.matchStats[attKey].shots++
    if (pGoalBase >= TUNING.bigChanceThreshold || zone === 'close') {
      this.matchStats[attKey].shotsOnTarget++
    }

    if (this.rng() < pGoal) {
      this.goal(attKey, shooter, false, zone === 'very_long')
    } else {
      const isBigChance = pGoalBase >= TUNING.bigChanceThreshold && zone !== 'very_long'
      if (zone === 'very_long') {
        this.push({ minute: this.minute, type: 'wonder_shot', teamId: att.teamId, playerId: shooter.id, playerName: shooter.name, variant: this.rng() < 0.5 ? 0 : 1 })
      } else {
        const r = this.rng()
        const type = r < 0.5 ? 'save' : r < 0.92 ? 'miss' : 'woodwork'
        this.push({ minute: this.minute, type, teamId: att.teamId, playerId: shooter.id, playerName: shooter.name, variant: this.pickVariant(type, 8) })
        if (type === 'save') {
          // GK gets a rating boost for saves
          const gk = this.side(defKey).starters.find((p) => p.slotRole === 'GK')
          if (gk) this.updateRating(gk.id, 0.4)
        }
        if (isBigChance) {
          this.push({ minute: this.minute, type: 'big_chance_miss', teamId: att.teamId, playerId: shooter.id, playerName: shooter.name, variant: this.pickVariant('big_chance_miss', 2) })
          this.updateRating(shooter.id, -0.5)
          this.shiftMomentum(attKey === 'home' ? -TUNING.momentumBigMissShift : TUNING.momentumBigMissShift)
        }
      }
    }
  }

  private goal(attKey: 'home' | 'away', scorer: EnginePlayer, penalty: boolean, wonderGoal = false) {
    const att = this.side(attKey)
    const defKey = attKey === 'home' ? 'away' : 'home'
    const prevAttGoals = this.status[attKey].goals
    const prevDefGoals = this.status[defKey].goals
    this.status[attKey].goals++
    this.status[attKey].momentumUntil = this.minute + TUNING.momentumMins
    this.shiftMomentum(attKey === 'home' ? TUNING.momentumGoalShift : -TUNING.momentumGoalShift)
    this.scorers.push({ playerId: scorer.id, teamId: att.teamId, minute: this.minute, penalty })
    this.updateRating(scorer.id, 1.5)
    const late = this.minute >= 80
    const equalizer = prevAttGoals < prevDefGoals && prevAttGoals + 1 === prevDefGoals
    // Pick variant from the appropriate situational pool
    const goalKey = penalty ? 'pen_goal' : late ? 'goal_late' : equalizer ? 'goal_equalizer' : 'goal'
    const goalVarCount = penalty ? 4 : late ? 8 : equalizer ? 8 : 10
    this.push({
      minute: this.minute, type: penalty ? 'pen_goal' : 'goal',
      teamId: att.teamId, playerId: scorer.id, playerName: scorer.name,
      variant: this.pickVariant(goalKey, goalVarCount),
      late: late || undefined,
      equalizer: equalizer || undefined,
      wonderGoal: wonderGoal || undefined,
    })
  }

  private discipline(which: 'home' | 'away') {
    const s = this.side(which)
    if (s.starters.length <= 7) return
    const aggMult = this.status[which].effect.aggMult ?? 1
    if (this.rng() < TUNING.yellowPerMin * aggMult) {
      const victim = pickWeighted(this.rng, s.starters, (p) =>
        p.slotRole === 'DF' ? 3 : p.slotRole === 'MF' ? 2 : p.slotRole === 'FW' ? 1 : 0.2)
      this.push({ minute: this.minute, type: 'yellow', teamId: s.teamId, playerId: victim.id, playerName: victim.name, variant: this.pickVariant('yellow', 3) })
      this.updateRating(victim.id, -0.3)
      const seen = this.events.filter((e) => e.type === 'yellow' && e.teamId === s.teamId && e.playerName === victim.name)
      if (seen.length >= 2) this.sendOff(which, victim, 'second_yellow')
    } else if (this.rng() < TUNING.redPerMin * aggMult) {
      const victim = pickWeighted(this.rng, s.starters, (p) => (p.slotRole === 'DF' ? 3 : 1))
      const r = this.rng()
      const cat: RedCategory = r < 0.7 ? 'straight' : r < 0.92 ? 'dogso' : 'dissent'
      this.sendOff(which, victim, cat)
    }
  }

  private suspensionFor(cat: RedCategory): number {
    switch (cat) {
      case 'straight': return randInt(this.rng, 2, 3)
      case 'dogso': return randInt(this.rng, 1, 2)
      case 'second_yellow':
      case 'dissent': return 1
    }
  }

  private sendOff(which: 'home' | 'away', victim: EnginePlayer, category: RedCategory) {
    const s = this.side(which)
    const wasGk = victim.slotRole === 'GK'
    s.starters = s.starters.filter((p) => p.id !== victim.id)
    s.redCards = (s.redCards ?? 0) + 1
    s.sentOffRoles = [...(s.sentOffRoles ?? []), victim.slotRole]
    this.updateRating(victim.id, -1.5)
    this.shiftMomentum(which === 'home' ? -TUNING.momentumRedShift : TUNING.momentumRedShift)
    this.push({
      minute: this.minute, type: 'red', teamId: s.teamId,
      playerId: victim.id, playerName: victim.name, variant: this.pickVariant('red_' + category, 3),
      redCategory: category, suspension: this.suspensionFor(category),
    })
    if (wasGk) this.replaceKeeper(s)
    this.checkArmbandTransfer(s, victim.id)
    this.refresh(which)
  }

  private replaceKeeper(s: Side) {
    const benchGk = s.bench.find((b) => b.position === 'GK')
    if (benchGk && s.subsMade < 5) {
      const weakest = [...s.starters].sort((a, b) => a.stats.overall - b.stats.overall)[0]
      if (weakest) {
        s.starters = s.starters.filter((p) => p.id !== weakest.id)
        s.bench = s.bench.filter((b) => b.id !== benchGk.id)
        benchGk.slotRole = 'GK'
        s.starters.push(benchGk)
        s.subsMade++
        this.push({
          minute: this.minute, type: 'sub', teamId: s.teamId,
          playerId: benchGk.id, playerName: weakest.name, playerName2: benchGk.name, variant: this.vr(),
        })
        return
      }
    }
    const fieldPlayer = [...s.starters]
      .filter((p) => p.slotRole === 'DF')
      .sort((a, b) => a.stats.overall - b.stats.overall)[0]
      ?? [...s.starters].sort((a, b) => a.stats.overall - b.stats.overall)[0]
    if (fieldPlayer) {
      fieldPlayer.slotRole = 'GK'
      fieldPlayer.gk = makeshiftGk()
      this.push({
        minute: this.minute, type: 'gk_field', teamId: s.teamId,
        playerId: fieldPlayer.id, playerName: fieldPlayer.name, variant: this.vr(),
      })
    }
  }

  private checkArmbandTransfer(s: Side, leavingId: string) {
    if (!s.captainId || s.captainId !== leavingId) return
    const newCaptain = s.viceCaptainId ? s.starters.find((p) => p.id === s.viceCaptainId) : null
    if (newCaptain) {
      s.captainId = newCaptain.id
      s.viceCaptainId = null
      this.push({ minute: this.minute, type: 'armband', teamId: s.teamId, playerId: newCaptain.id, playerName: newCaptain.name, variant: this.vr() })
    } else {
      s.captainId = null
    }
  }

  private maybeInjury(which: 'home' | 'away') {
    const s = this.side(which)
    const opp = this.side(which === 'home' ? 'away' : 'home')
    // Base rate × contextual multipliers
    let rate = TUNING.injPerMin
    // High opponent aggression
    const oppAggN = opp.tactics.sliders ? (opp.tactics.sliders.aggression - 1) / 9 : 0.44
    if (oppAggN > 0.6) rate *= 1.5
    // Weather
    if (this.weather === 'hot_humid') rate *= 1.2
    if (this.rng() >= rate) return
    const victim = s.starters[randInt(this.rng, 0, s.starters.length - 1)]
    // Fatigue multiplier — exhausted players injure 3x more
    if ((100 - victim.fitness) >= 86 && this.rng() >= 1 / 3) return // 2/3 of the time cancel if not actually risky
    this.push({ minute: this.minute, type: 'injury', teamId: s.teamId, playerId: victim.id, playerName: victim.name, variant: this.pickVariant('injury', 5) })
    this.updateRating(victim.id, -0.5)
    victim.fitness = Math.min(victim.fitness, 20)
    if (s.isUser) {
      this.pendingInjury = { side: which, playerId: victim.id }
    } else {
      this.aiInjurySub(which, victim)
    }
    this.injuredIds.push(victim.id)
  }

  private aiInjurySub(which: 'home' | 'away', victim: EnginePlayer) {
    const s = this.side(which)
    if (s.subsMade >= 5 || s.bench.length === 0) return
    const candidates = s.bench.filter((b) => b.position === victim.slotRole)
    const sub = (candidates.length ? candidates : s.bench)
      .sort((x, y) => y.stats.overall - x.stats.overall)[0]
    this.applySubs(which, [{ outId: victim.id, inId: sub.id }])
  }

  private aiRoutine(which: 'home' | 'away') {
    const s = this.side(which)
    if (s.isUser) return
    const opp = this.status[which === 'home' ? 'away' : 'home']
    const own = this.status[which]
    // Sub tired players at 60' / 75' (threshold updated for new higher fatigue drain)
    if ((this.minute === 60 || this.minute === 75) && s.subsMade < 5 && s.bench.length) {
      const tired = s.starters
        .filter((p) => p.slotRole !== 'GK' && p.fitness < 30)  // fatigue 70%+
        .sort((x, y) => x.fitness - y.fitness)
        .slice(0, this.minute === 60 ? 2 : 5 - s.subsMade)
      const subs: SubRequest[] = []
      const benchLeft = [...s.bench]
      for (const t of tired) {
        const i = benchLeft.findIndex((b) => b.position === t.slotRole)
        const pick = i >= 0 ? benchLeft.splice(i, 1)[0] : benchLeft.shift()
        if (pick) subs.push({ outId: t.id, inId: pick.id })
      }
      if (subs.length) {
        s.windowOpen = false
        this.applySubs(which, subs)
      }
    }
    if (this.minute === 75) {
      if (own.goals < opp.goals && s.tactics.style !== 'attacking')
        this.setTactics(which, { ...s.tactics, style: 'attacking' })
      else if (own.goals > opp.goals && s.tactics.style !== 'defensive')
        this.setTactics(which, { ...s.tactics, style: 'defensive' })
    }
  }

  private applyFatigue() {
    for (const which of ['home', 'away'] as const) {
      const s = this.side(which)
      const sl = s.tactics.sliders
      // Slider-based additions to base drain rate
      const pressBonus = sl && sl.press >= 7 ? 0.3 : sl && sl.press >= 4 ? 0.15 : 0
      const tempoBonus = sl && sl.tempo >= 7 ? 0.2 : sl && sl.tempo >= 4 ? 0.10 : 0
      // Weather multiplier
      const weatherMult = this.weather === 'hot_humid' ? 1.15 : 1.0
      const base = (TUNING.fatiguePerMin + pressBonus + tempoBonus) * weatherMult
      // 10-man sides cover more ground
      const redMult = 1 + 0.15 * (s.redCards ?? 0)
      for (const p of s.starters) {
        // Out-of-position players fatigue faster
        const outPosMult = p.position !== p.slotRole ? 1 + (0.3 / TUNING.fatiguePerMin) : 1
        p.fitness = Math.max(0, p.fitness - base * redMult * outPosMult)
      }
      if (this.minute % 15 === 0) this.refresh(which)
    }
  }

  get awaitingUser(): boolean {
    if (this.pendingInjury === null) return false
    const s = this.side(this.pendingInjury.side)
    return s.subsMade < 5 && s.bench.length > 0
  }

  step(): MatchEvent[] {
    if (this.phase === 'DONE' || this.phase === 'HT' || this.phase === 'BREAK_ET' || this.phase === 'PENS') return []
    const before = this.events.length
    this.minute++
    this.home.windowOpen = false
    this.away.windowOpen = false

    const pHome = this.chanceProb('home')
    const pAway = this.chanceProb('away')
    const pAny = pHome + pAway
    const eventsBeforeChance = this.events.length
    if (pAny > 0 && this.rng() < pAny) {
      const attacker: 'home' | 'away' = this.rng() < pHome / pAny ? 'home' : 'away'
      this.resolveChance(attacker)
    }
    // Only fire fouls in minutes where no chance event already resolved — prevents
    // visual conflicts where a shot and a foul appear in the same minute feed entry.
    const chanceFired = this.events.length > eventsBeforeChance
    for (const which of ['home', 'away'] as const) {
      if (!chanceFired) this.maybeFoul(which)
      this.discipline(which)
      this.maybeInjury(which)
      this.aiRoutine(which)
    }
    this.applyFatigue()

    // Rare weather commentary (bad conditions, every ~20 min)
    if (this.minute % 20 === 10 && (this.weather === 'heavy_rain' || this.weather === 'hot_humid' || this.weather === 'cold')) {
      if (this.rng() < 0.25) {
        this.push({ minute: this.minute, type: 'weather_effect', variant: this.pickVariant('weather_effect', 3) })
      }
    }

    // Crowd atmosphere
    if (this.minute % 15 === 0 && this.minute > 0) {
      const hMom = this.minute <= this.status.home.momentumUntil ? 1 : 0
      const aMom = this.minute <= this.status.away.momentumUntil ? 1 : 0
      const midRatio = (this.status.home.ratings.mid || 1) / ((this.status.away.ratings.mid || 1))
      if (hMom !== aMom || midRatio > 1.25 || midRatio < 0.8) {
        const teamId = (hMom > aMom || midRatio > 1.25) ? this.home.teamId : this.away.teamId
        this.push({ minute: this.minute, type: 'crowd_roar', teamId, variant: this.rng() < 0.5 ? 0 : 1 })
      }
    }

    if (this.minute === 45 && this.phase === '1H') {
      this.phase = 'HT'
      this.push({ minute: 45, type: 'halftime', variant: this.vr() })
    } else if (this.minute === 90 && this.phase === '2H') {
      if (this.knockout && this.status.home.goals === this.status.away.goals) {
        this.phase = 'BREAK_ET'
        this.push({ minute: 90, type: 'et_start', variant: this.vr() })
      } else {
        this.finish('FT')
      }
    } else if (this.minute === 105 && this.phase === 'ET1') {
      this.phase = 'ET2'
      this.push({ minute: 106, type: 'kickoff', variant: this.vr() })
    } else if (this.minute === 120 && this.phase === 'ET2') {
      if (this.status.home.goals === this.status.away.goals) {
        this.phase = 'PENS'
        this.push({ minute: 120, type: 'shootout', variant: this.vr() })
        this.runShootout()
      } else {
        this.finish('AET')
      }
    }
    return this.events.slice(before)
  }

  resumeFromBreak() {
    if (this.phase === 'HT') {
      this.phase = '2H'
      this.push({ minute: 46, type: 'kickoff', variant: this.vr() })
    } else if (this.phase === 'BREAK_ET') {
      this.phase = 'ET1'
      this.push({ minute: 91, type: 'kickoff', variant: this.vr() })
    }
  }

  private finish(after: 'FT' | 'AET') {
    this.finishedAfter = after
    this.phase = 'DONE'
    this.push({ minute: this.minute, type: 'fulltime', variant: this.vr() })
  }

  private runShootout() {
    const takers = (s: Side) =>
      [...s.starters]
        .filter((p) => p.slotRole !== 'GK')
        .sort((x, y) =>
          ((y.stats.shooting ?? 0) * 0.6 + y.stats.overall * 0.4) -
          ((x.stats.shooting ?? 0) * 0.6 + x.stats.overall * 0.4))
    const hT = takers(this.home)
    const aT = takers(this.away)
    const gkOf = (which: 'home' | 'away') => this.status[which].ratings.gk
    const scoreP = (taker: EnginePlayer, gk: number) =>
      Math.min(0.92, Math.max(0.50, TUNING.penScoreBase + ((taker.stats.shooting ?? 60) - gk) * 0.003))
    let h = 0
    let a = 0
    let round = 0
    while (true) {
      const ht = hT[round % hT.length]
      const at = aT[round % aT.length]
      const hScore = this.rng() < scoreP(ht, gkOf('away'))
      const aScore = this.rng() < scoreP(at, gkOf('home'))
      if (hScore) h++
      if (aScore) a++
      round++
      if (round >= 5 && h !== a) break
      if (round >= 11) { if (h === a) continue; break }
    }
    this.pens = { home: h, away: a }
    this.finishedAfter = 'PENS'
    this.phase = 'DONE'
    this.push({ minute: 120, type: 'fulltime', variant: this.vr() })
  }

  result(keepEvents: boolean): MatchResult {
    return {
      homeGoals: this.status.home.goals,
      awayGoals: this.status.away.goals,
      pens: this.pens,
      scorers: this.scorers,
      finishedAfter: this.finishedAfter,
      events: keepEvents ? this.events : undefined,
      weather: this.weather,
      matchStats: keepEvents ? this.matchStats : undefined,
      matchRatings: keepEvents ? this.matchRatings : undefined,
      momentum: this.momentum,
    }
  }

  finishFast(): MatchResult {
    let guard = 0
    while (this.phase !== 'DONE' && guard++ < 400) {
      if (this.phase === 'HT' || this.phase === 'BREAK_ET') this.resumeFromBreak()
      this.step()
    }
    return this.result(false)
  }
}

export function simulateMatch(home: Side, away: Side, knockout: boolean, seed: number): MatchResult {
  return new MatchSim(home, away, { knockout, seed }).finishFast()
}

// ════════════════════════════════════════════════════════════════════════════════
//  UNIFIED SPATIAL MODEL — single source of truth for the 2D pitch.
//  Coordinates are FIXED: x=0 home goal, x=100 away goal; y=0 top, y=100 bottom.
// ════════════════════════════════════════════════════════════════════════════════

export type RoleCat = 'GK' | 'CB' | 'FB' | 'CDM' | 'CM' | 'CAM' | 'W' | 'ST'
export type PitchAction =
  | 'pass' | 'shot' | 'cross' | 'dribble' | 'clearance'
  | 'corner' | 'freekick' | 'goalkick' | 'throwin' | 'kickoff'
export type PitchEvent =
  | 'goal' | 'save' | 'miss' | 'yellow' | 'red' | 'penalty' | 'wondergoal' | 'owngoal'
  | 'offside' | 'foul' | 'free_kick_goal' | 'free_kick_saved' | 'injury'

export interface PlayerDot { x: number; y: number; team: 'home' | 'away'; isGK: boolean }

export interface MatchMinute {
  minute: number
  possession: 'home' | 'away'
  ballX: number
  ballY: number
  ballTargetX: number | null
  ballTargetY: number | null
  action: PitchAction
  event: PitchEvent | null
  actingPlayer: string
  players: Record<string, PlayerDot>
  momentum?: number    // live sim momentum (-100..+100)
  weather?: WeatherType
}

const pClamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
const pLerp = (a: number, b: number, t: number) => a + (b - a) * t
const pSlider = (side: Side, key: 'width' | 'defLine' | 'press' | 'tempo' | 'counter'): number => {
  const s = side.tactics.sliders
  return s ? pClamp((s[key] - 1) / 9, 0, 1) : 0.5
}
const PMENT: Record<Mentality, number> = { ultra_defensive: -2, defensive: -1, balanced: 0, attacking: 1, gung_ho: 2 }
const pMent = (side: Side) => PMENT[side.tactics.mentality] ?? 0

const PITCH_BANDS: Record<RoleCat, { def: number; atk: number; min: number; max: number; wide: boolean }> = {
  GK:  { def: 6,  atk: 7,  min: 4,  max: 8,  wide: false },
  CB:  { def: 18, atk: 38, min: 10, max: 55, wide: false },
  FB:  { def: 20, atk: 50, min: 11, max: 60, wide: true },
  CDM: { def: 33, atk: 50, min: 25, max: 55, wide: false },
  CM:  { def: 48, atk: 60, min: 40, max: 65, wide: false },
  CAM: { def: 52, atk: 72, min: 45, max: 80, wide: false },
  W:   { def: 50, atk: 78, min: 40, max: 88, wide: true },
  ST:  { def: 64, atk: 82, min: 55, max: 88, wide: false },
}

function pitchRole(label: string, broad: string): RoleCat {
  const L = label.toUpperCase()
  if (broad === 'GK' || L === 'GK') return 'GK'
  if (L === 'CB') return 'CB'
  if (['LB', 'RB', 'LWB', 'RWB'].includes(L)) return 'FB'
  if (['DM', 'CDM'].includes(L)) return 'CDM'
  if (['CM', 'RCM', 'LCM'].includes(L)) return 'CM'
  if (['CAM', 'AM', 'RAM', 'LAM'].includes(L)) return 'CAM'
  if (['LM', 'RM', 'LW', 'RW'].includes(L)) return 'W'
  if (['ST', 'CF'].includes(L)) return 'ST'
  return broad === 'DF' ? 'CB' : broad === 'FW' ? 'ST' : 'CM'
}

interface PZone { p: EnginePlayer; baseY: number; role: RoleCat; flank: -1 | 0 | 1 }
function pitchZones(side: Side): PZone[] {
  const slots = FORMATIONS[side.formation ?? '4-3-3'] ?? FORMATIONS['4-3-3']
  const used = new Set<number>()
  const out: PZone[] = []
  for (const p of side.starters) {
    let idx = slots.findIndex((s, i) => !used.has(i) && s.role === p.slotRole)
    if (idx < 0) idx = slots.findIndex((_, i) => !used.has(i))
    if (idx < 0) idx = 0
    used.add(idx)
    const slot = slots[idx]
    const flank: -1 | 0 | 1 = slot.x < 38 ? -1 : slot.x > 62 ? 1 : 0
    out.push({ p, baseY: slot.x, role: pitchRole(slot.label, p.slotRole), flank })
  }
  return out
}

function pitchTeam(
  side: Side, which: 'home' | 'away', inPoss: boolean,
  ballAxisTeam: number, minute: number, scoreDiff: number,
): Record<string, PlayerDot> {
  const zones = pitchZones(side)
  const widthN = pSlider(side, 'width')
  const M = pMent(side)
  const shift = ((ballAxisTeam - 50) / 50) * 10
  const advanced = ballAxisTeam > 60
  const toX = (axis: number) => (which === 'home' ? axis : 100 - axis)
  const out: Record<string, PlayerDot> = {}
  for (let i = 0; i < zones.length; i++) {
    const z = zones[i]
    const b = PITCH_BANDS[z.role]
    const dr = makeRng((minute * 6151 + (which === 'home' ? 0 : 3001) + i * 97) >>> 0)
    let axis: number
    if (z.role === 'GK') {
      axis = pClamp(b.def + (inPoss ? 1 : 0) + (dr() * 2 - 1) * 0.6, b.min, b.max)
      if (minute >= 89 && scoreDiff < 0) axis = pClamp(axis + 8, b.min, 20)
    } else if (z.role === 'ST') {
      const lo = advanced ? 70 : 55
      const hi = advanced ? 88 : 70
      axis = pClamp(pLerp(lo, hi, inPoss ? 0.72 : 0.32) + (dr() * 2 - 1) * 2, lo, hi)
    } else {
      const t = pClamp(0.4 + (ballAxisTeam / 100) * 0.6 + M * 0.05, 0, 1)
      let target = inPoss ? pLerp(b.def, b.atk, t) : pLerp(b.def, b.min, 0.25)
      target += shift
      axis = pClamp(target + (dr() * 2 - 1) * 2, b.min, b.max)
      if (z.role === 'CB') axis = Math.min(axis, 55)
    }
    let y = z.baseY
    if (b.wide) { const fl = z.flank || (z.baseY < 50 ? -1 : 1); y += fl * (0.3 + widthN * 0.9) * 12 }
    else { y += (50 - y) * (0.16 + (1 - widthN) * 0.12) }
    y = pClamp(y + (dr() * 2 - 1) * 2, 5, 95)
    out[z.p.id] = { x: pClamp(toX(axis), 3, 97), y, team: which, isGK: z.role === 'GK' }
  }
  return out
}

const PITCH_ATTACK = new Set([
  'goal', 'pen_goal', 'pen_miss', 'save', 'miss', 'woodwork', 'wonder_shot',
  'free_kick_goal', 'free_kick_saved',
])
const PITCH_GOALS = new Set(['goal', 'pen_goal', 'free_kick_goal'])

function pitchKickoffTeam(minute: number): 'home' | 'away' {
  return minute === 46 || minute === 91 ? 'away' : 'home'
}

interface PCarry {
  possession: 'home' | 'away'
  segStart: number
  restartNext: 'home' | 'away' | null
  restartKind: 'none' | 'goalkick' | 'corner' | 'freekick' | 'kickoff'
}

function buildMinute(sim: MatchSim, m: number, cy: PCarry): MatchMinute {
  const homeId = sim.home.teamId
  const evs = sim.events.filter((e) => e.minute === m)
  const kickoffEv = evs.find((e) => e.type === 'kickoff')
  const goalEv = [...evs].reverse().find((e) => PITCH_GOALS.has(e.type) && e.teamId)
  const atkEv = goalEv ?? [...evs].reverse().find((e) => PITCH_ATTACK.has(e.type) && e.teamId)
  const cardEv = [...evs].reverse().find((e) => e.type === 'yellow' || e.type === 'red')
  const offsideEv = evs.find((e) => e.type === 'offside')
  const foulFkEv = evs.find((e) => e.type === 'free_kick')  // FK awarded (no shot resolved)
  const injuryEv = evs.find((e) => e.type === 'injury')
  const dr = makeRng((m * 40503 + 7) >>> 0)

  // ── possession transitions ──
  let restartKind: PCarry['restartKind'] = 'none'
  if (kickoffEv) {
    cy.possession = pitchKickoffTeam(m); cy.segStart = m; cy.restartNext = null; cy.restartKind = 'none'
    restartKind = 'kickoff'
  } else if (cy.restartNext) {
    cy.possession = cy.restartNext; cy.segStart = m; restartKind = cy.restartKind
    cy.restartNext = null; cy.restartKind = 'none'
  }

  let event: PitchEvent | null = null
  let eventTeam: 'home' | 'away' | null = null
  let shooterId: string | null = null
  let wonder = false
  let kind: 'open' | 'goal' | 'save' | 'miss' | 'wonder' = 'open'

  if (atkEv) {
    const tt: 'home' | 'away' = atkEv.teamId === homeId ? 'home' : 'away'
    cy.possession = tt; cy.segStart = m
    eventTeam = tt; shooterId = atkEv.playerId ?? null; wonder = !!atkEv.wonderGoal
    const def: 'home' | 'away' = tt === 'home' ? 'away' : 'home'
    switch (atkEv.type) {
      case 'goal': kind = 'goal'; event = wonder ? 'wondergoal' : 'goal'; cy.restartNext = def; cy.restartKind = 'kickoff'; break
      case 'pen_goal': kind = 'goal'; event = 'penalty'; cy.restartNext = def; cy.restartKind = 'kickoff'; break
      case 'pen_miss': kind = 'miss'; event = 'penalty'; cy.restartNext = def; cy.restartKind = 'goalkick'; break
      case 'wonder_shot': kind = 'wonder'; event = 'miss'; cy.restartNext = def; cy.restartKind = 'goalkick'; break
      case 'miss': kind = 'miss'; event = 'miss'; cy.restartNext = def; cy.restartKind = 'goalkick'; break
      case 'free_kick_goal': kind = 'goal'; event = 'free_kick_goal'; cy.restartNext = def; cy.restartKind = 'kickoff'; break
      case 'free_kick_saved':
        kind = 'save'; event = 'free_kick_saved'
        if (dr() < 0.45) { cy.restartNext = tt; cy.restartKind = 'corner' }
        else { cy.restartNext = def; cy.restartKind = 'goalkick' }
        break
      default: // 'save' / 'woodwork'
        kind = 'save'; event = 'save'
        if (dr() < 0.45) { cy.restartNext = tt; cy.restartKind = 'corner' }
        else { cy.restartNext = def; cy.restartKind = 'goalkick' }
    }
  } else if (offsideEv) {
    // Attacker caught offside — ball goes BACKWARD (pass origin), FK to defenders
    const offsideAtt: 'home' | 'away' = offsideEv.teamId === homeId ? 'home' : 'away'
    const defending: 'home' | 'away' = offsideAtt === 'home' ? 'away' : 'home'
    // Possession stays as attacker for THIS minute's ball position (shows where the pass came from)
    // Next minute: defending team gets FK
    cy.restartNext = defending; cy.restartKind = 'freekick'
    event = 'offside'
    eventTeam = null  // treated as no-shot event; ball position set below
  } else if (foulFkEv && !atkEv) {
    // FK awarded — foul with no shot resolution this minute
    const fkTeam: 'home' | 'away' = foulFkEv.teamId === homeId ? 'home' : 'away'
    cy.possession = fkTeam; cy.segStart = m
    cy.restartNext = null; cy.restartKind = 'none'  // FK "taken" this minute
    event = cardEv ? (cardEv.type === 'red' ? 'red' : 'yellow') : 'foul'
    eventTeam = null
  } else if (cardEv) {
    event = cardEv.type === 'red' ? 'red' : 'yellow'
    const fouling: 'home' | 'away' = cardEv.teamId === homeId ? 'home' : 'away'
    cy.restartNext = fouling === 'home' ? 'away' : 'home'; cy.restartKind = 'freekick'
  } else if (injuryEv) {
    event = 'injury'
  }

  const poss = cy.possession
  const side = sim.side(poss)

  // ── ball origin axis + action ──
  let actAxis: number
  let targetAxis: number | null = null
  let action: PitchAction
  let ballYRaw: number | null = null
  let targetYRaw: number | null = null
  const shooterRole = shooterId ? pitchZones(side).find((z) => z.p.id === shooterId)?.role ?? 'ST' : 'ST'

  if (eventTeam && atkEv) {
    if (event === 'penalty') { actAxis = 92; targetAxis = 100 }
    else if (kind === 'wonder') { actAxis = 60 + dr() * 9; targetAxis = 99 }
    else if (event === 'free_kick_goal' || event === 'free_kick_saved') {
      actAxis = 78 + dr() * 6; targetAxis = 99  // dangerous FK: outside box ~78-84
    }
    else { actAxis = 80 + dr() * 12; targetAxis = 99 }
    action = kind !== 'goal' && (shooterRole === 'W' || shooterRole === 'FB') && dr() < 0.4 ? 'cross' : 'shot'
    targetYRaw = 50 + (dr() * 2 - 1) * 6
  } else if (offsideEv) {
    // Ball snaps to where through-ball was played FROM (behind offside line)
    // poss = the attacker's team (unchanged for this minute)
    actAxis = 63 + dr() * 10   // pass origin: 63-73% attack axis
    action = 'freekick'
    ballYRaw = 50 + (dr() * 2 - 1) * 15
  } else if (foulFkEv && !atkEv) {
    // Ball at foul location (in FK-receiving team's attack frame)
    const fz = foulFkEv.foulZone
    // actAxis is in the FK-receiving team's attack direction:
    // 'own' (foul near fouling team's goal) → FK team attacks from ~78 (near opponent's goal)
    // 'att' (foul near opponent's goal)     → FK team is back near their own end (~22)
    const foulBase = fz === 'own' ? 78 : fz === 'mid' ? 50 : 22
    actAxis = pClamp(foulBase + (dr() * 2 - 1) * 8, 5, 92)
    action = 'freekick'
    ballYRaw = 50 + (dr() * 2 - 1) * 18
  } else if (restartKind === 'kickoff') {
    actAxis = 50; action = 'kickoff'; ballYRaw = 50
  } else if (restartKind === 'goalkick') {
    actAxis = 6; action = 'goalkick'; ballYRaw = 50 + (dr() * 2 - 1) * 10
  } else if (restartKind === 'corner') {
    actAxis = 98; action = 'corner'; ballYRaw = dr() < 0.5 ? 1 : 99; targetAxis = 92; targetYRaw = 50 + (dr() * 2 - 1) * 8
  } else if (restartKind === 'freekick') {
    actAxis = pClamp(40 + dr() * 20, 30, 62); action = 'freekick'
  } else {
    const since = m - cy.segStart
    const pace = 9 + (pSlider(side, 'tempo') * 0.5 + pSlider(side, 'counter') * 0.5) * 14
    actAxis = pClamp(32 + since * pace, 28, 72)
    const r = dr()
    if (actAxis < 50) action = r < 0.78 ? 'pass' : 'dribble'
    else if (actAxis < 64) action = r < 0.6 ? 'pass' : r < 0.82 ? 'dribble' : 'cross'
    else action = r < 0.55 ? 'pass' : 'cross'
    if (action === 'pass' && dr() < 0.08) { action = 'throwin'; ballYRaw = dr() < 0.5 ? 2 : 98 }
  }

  // ── player positions ──
  const scoreDiff = (w: 'home' | 'away') =>
    w === 'home' ? sim.status.home.goals - sim.status.away.goals : sim.status.away.goals - sim.status.home.goals
  const homeInPoss = poss === 'home'
  const homeBallAxis = homeInPoss ? actAxis : 100 - actAxis
  const players: Record<string, PlayerDot> = {
    ...pitchTeam(sim.home, 'home', homeInPoss, homeBallAxis, m, scoreDiff('home')),
    ...pitchTeam(sim.away, 'away', !homeInPoss, 100 - homeBallAxis, m, scoreDiff('away')),
  }
  const axisToX = (axis: number) => (poss === 'home' ? axis : 100 - axis)
  let ballX = pClamp(axisToX(actAxis), 2, 98)
  const ballTargetX = targetAxis == null ? null : pClamp(axisToX(targetAxis), 0, 100)

  let actingPlayer = ''
  let ballY: number
  if (eventTeam && shooterId && players[shooterId]) {
    const oy = pClamp(50 + (dr() * 2 - 1) * 14, 8, 92)
    players[shooterId] = { ...players[shooterId], x: ballX, y: oy }
    actingPlayer = shooterId
    ballY = oy
  } else {
    const wantGk = restartKind === 'goalkick'
    const openPlay = restartKind === 'none' && !offsideEv && !foulFkEv
    let best = ''
    let bestD = Infinity
    for (const [id, d] of Object.entries(players)) {
      if (d.team !== poss) continue
      if (wantGk && !d.isGK) continue
      if (!wantGk && d.isGK && restartKind !== 'kickoff') continue
      if (openPlay && (poss === 'home' ? d.x : 100 - d.x) > 74) continue
      const dist = Math.abs(d.x - ballX) + Math.abs(d.y - (ballYRaw ?? 50)) * 0.5
      if (dist < bestD) { bestD = dist; best = id }
    }
    if (!best) best = Object.keys(players).find((id) => players[id].team === poss) ?? Object.keys(players)[0] ?? ''
    actingPlayer = best
    const bd = players[best]
    if (openPlay && bd) {
      ballX = poss === 'home' ? Math.min(bd.x, 74) : Math.max(bd.x, 26)
      ballY = bd.y
    } else ballY = ballYRaw ?? (bd ? bd.y : 50)
  }

  return {
    minute: m, possession: poss, ballX, ballY,
    ballTargetX, ballTargetY: ballTargetX == null ? null : targetYRaw ?? 50,
    action, event, actingPlayer, players,
    momentum: sim.momentum,
    weather: sim.weather,
  }
}

// ── incremental cache ──
interface PCache { minutes: MatchMinute[]; carryAt: PCarry[]; rosterSig: number[]; builtTo: number; carry: PCarry }
const minuteCache = new WeakMap<MatchSim, PCache>()
const pRosterSig = (sim: MatchSim) =>
  sim.home.starters.length + sim.away.starters.length + sim.home.subsMade + sim.away.subsMade

export function matchMinute(sim: MatchSim, minute: number): MatchMinute {
  let c = minuteCache.get(sim)
  if (!c) {
    c = { minutes: [], carryAt: [], rosterSig: [], builtTo: -1, carry: { possession: 'home', segStart: 0, restartNext: null, restartKind: 'none' } }
    minuteCache.set(sim, c)
  }
  for (let m = c.builtTo + 1; m <= minute; m++) {
    c.carryAt[m] = { ...c.carry }
    c.minutes[m] = buildMinute(sim, m, c.carry)
    c.rosterSig[m] = pRosterSig(sim)
    c.builtTo = m
  }
  if (minute >= 0 && minute <= c.builtTo) {
    const sig = pRosterSig(sim)
    if (c.rosterSig[minute] !== sig) {
      c.minutes[minute] = buildMinute(sim, minute, { ...c.carryAt[minute] })
      c.rosterSig[minute] = sig
    }
    return c.minutes[minute]
  }
  return buildMinute(sim, Math.max(0, minute), { ...c.carry })
}
