import type { Player, Position } from '../data/types'
import type { AvatarParams } from '../components/avatarGen'
import type {
  CalendarWindow, ScheduledMatch, QualGroup, NLGroup,
  CompetitionResult, GameDate,
} from './calendar/calendar.types'

// Re-export for convenience
export type { CalendarWindow, ScheduledMatch, QualGroup, NLGroup, CompetitionResult, GameDate }

// ----------------------------------------------------------------- player
export interface PlayerState {
  form: number // 1..10, starts 6
  morale: number // 1..10, starts 7
  fitness: number // 0..100
  goals: number
  assists: number
  yellows: number // in current "card cycle" (legacy, kept for compat)
  red: boolean
  suspendedMatches: number
  injuredUntilDay: number // -1 = fit
  minutesPlayed: number
  // ── Discipline (System 1) ──────────────────────────────────────────
  compYellows: number          // cumulative yellows in the current competition
  compYellowsId: string        // which competition compYellows belongs to
  redCards: number             // career red cards (this save)
  suspensionReason?: RedCategory | 'yellows' // why currently suspended
  // ── Aging (v6) ───────────────────────────────────────────────────
  overallDecay?: number        // accumulated OVR points lost to aging
  retiredInternational?: boolean // player has retired from intl football
}

export type RedCategory = 'straight' | 'second_yellow' | 'dogso' | 'dissent'

export type PlayerStates = Record<string, PlayerState>

// ── Youth / Regen / Retirement (v6) ──────────────────────────────────────────
export type FacilityType =
  | 'youth_academy'      // more + better regens
  | 'tactical_center'   // faster familiarity gain
  | 'fitness_center'    // -15% fatigue, -20% injury risk
  | 'scouting_network'  // reveals exact potential
  | 'medical_center'    // faster injury recovery
  | 'stadium_upgrade'   // +home morale, +budget per home match

export const FACILITY_COST: Record<FacilityType, number> = {
  youth_academy:    3_000_000,
  tactical_center:  2_000_000,
  fitness_center:   2_500_000,
  scouting_network: 1_500_000,
  medical_center:   2_000_000,
  stadium_upgrade:  4_000_000,
}

/** Youth player (U17 or U21) with hidden/revealed potential. */
export interface YouthPlayer extends Player {
  potential: number                          // exact potential OVR (hidden unless revealed)
  potentialStars: 1 | 2 | 3 | 4 | 5        // display stars for user
  potentialRevealed: boolean                 // true after Scouting Network purchased
  ageGroup: 'U17' | 'U21'
  developmentPhase: 'raw' | 'developing' | 'peaking'
  teamId: string
  yearGenerated: number
}

/** Player promoted to senior squad (formerly a YouthPlayer). */
export interface RegenPlayer extends Player {
  squadLevel: 'u17' | 'u21' | 'senior'
  yearGenerated: number
  teamId: string
  potential?: number
  potentialStars?: 1 | 2 | 3 | 4 | 5
  potentialRevealed?: boolean
}

export interface RetiredPlayer {
  id: string
  name: string
  teamId: string
  position: Position
  caps: number
  goals: number
  yearRetired: number
  peakOvr: number
}

// ---------------------------------------------------------------- tactics
export type TacticStyle = 'defensive' | 'balanced' | 'attacking'
export type PressLevel = 'low' | 'mid' | 'high'
export type Tempo = 'slow' | 'normal' | 'fast'

export type Mentality = 'ultra_defensive' | 'defensive' | 'balanced' | 'attacking' | 'gung_ho'

export interface TacticSliders {
  width: number      // 1-10: attacking width
  defLine: number    // 1-10: defensive line height
  press: number      // 1-10: press intensity
  tempo: number      // 1-10: play tempo
  aggression: number // 1-10: tackle intensity / card risk
  crossing: number   // 1-10: crossing focus
  counter: number    // 1-10: counter-attack speed
}

export const MENTALITY_SLIDER_PRESETS: Record<Mentality, TacticSliders> = {
  ultra_defensive: { width: 2, defLine: 2, press: 2, tempo: 2, aggression: 3, crossing: 2, counter: 9 },
  defensive:       { width: 3, defLine: 3, press: 4, tempo: 4, aggression: 4, crossing: 3, counter: 7 },
  balanced:        { width: 5, defLine: 5, press: 5, tempo: 5, aggression: 5, crossing: 5, counter: 5 },
  attacking:       { width: 7, defLine: 7, press: 7, tempo: 7, aggression: 6, crossing: 7, counter: 4 },
  gung_ho:         { width: 9, defLine: 9, press: 9, tempo: 9, aggression: 8, crossing: 8, counter: 2 },
}

// Mentality ordinal for familiarity calculations
export const MENTALITY_TO_NUM: Record<Mentality, number> = {
  ultra_defensive: 1, defensive: 2, balanced: 3, attacking: 4, gung_ho: 5,
}

export interface TacticalFamiliarity {
  formation: string          // current tracked formation
  mentality: number          // MENTALITY_TO_NUM value 1-5
  score: number              // 0-100
  matchesWithCurrentSetup: number
  lastChangedWindow: string
  lastMatchId?: string
  lastMatchGain?: number
  lastMatchOldScore?: number
  lastMatchNewScore?: number
}

export type CornerDelivery = 'inswinger' | 'outswinger' | 'short' | 'driven'
export type FKRoutine = 'shoot' | 'cross' | 'layoff' | 'wall'
export type PenaltyStyle = 'power' | 'placed' | 'panenka'

export interface SetPieceOptions {
  cornerDelivery: CornerDelivery
  fkRoutine: FKRoutine
  penaltyStyle: PenaltyStyle
  longThrowOn: boolean
}

export interface TacticPreset {
  name: string
  mentality: Mentality
  sliders: TacticSliders
  setpieceOptions: SetPieceOptions
}

export interface Tactics {
  style: TacticStyle
  press: PressLevel
  tempo: Tempo
  mentality: Mentality
  sliders: TacticSliders
  setpieceOptions: SetPieceOptions
  oppositionInstructions: Record<string, 'tight' | 'normal' | 'space'>
}

export interface FormationSlot {
  role: Position
  label: string // 'GK' | 'LB' | 'ST'...
  x: number // % from left on a vertical pitch (own goal at bottom)
  y: number // % from top
}

export interface SetPieceTakers {
  corner: string | null
  freekick: string | null
  penalty: string | null
  longThrow: string | null
}

export interface Lineup {
  formation: string // key into FORMATIONS
  starters: (string | null)[] // player ids, aligned with formation slots
  roles: (string | null)[]    // sub-role per slot (null = formation label default)
  setpieces: SetPieceTakers
  captainId: string | null
  viceCaptainId: string | null
}

// ---------------------------------------------------------------- fixture
export type Round =
  | 'G1' | 'G2' | 'G3'
  | 'R32' | 'R16' | 'QF' | 'SF' | 'THIRD' | 'FINAL'
  | 'FRIENDLY'

export const KO_ROUNDS: Round[] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']

export interface ScorerEntry {
  playerId: string
  teamId: string
  minute: number
  penalty?: boolean
}

// ── Weather conditions generated at match start ──────────────────────────────
export type WeatherType = 'perfect' | 'light_rain' | 'heavy_rain' | 'hot_humid' | 'cold'

// ── Per-team match statistics ─────────────────────────────────────────────────
export interface MatchStats {
  shots: number
  shotsOnTarget: number
  corners: number
  fouls: number
  offsides: number
}

export type MatchEventType =
  | 'goal' | 'pen_goal' | 'pen_miss' | 'save' | 'miss' | 'woodwork'
  | 'yellow' | 'red' | 'injury' | 'sub' | 'kickoff' | 'halftime'
  | 'fulltime' | 'et_start' | 'shootout' | 'armband' | 'gk_field'
  | 'big_chance_miss' | 'crowd_roar' | 'wonder_shot'
  | 'corner' | 'throw_in' | 'goal_kick' | 'free_kick' | 'offside'
  | 'free_kick_goal' | 'free_kick_saved' | 'weather_effect'

export interface MatchEvent {
  minute: number
  type: MatchEventType
  teamId?: string
  playerId?: string
  playerName?: string
  playerName2?: string // sub: incoming player
  variant: number // commentary template variant
  redCategory?: RedCategory // severity tier for red cards
  suspension?: number        // matches banned for this red card
  // goal metadata flags (used for celebration variants)
  late?: boolean         // goal scored after minute 80
  equalizer?: boolean    // goal makes score level
  wonderGoal?: boolean   // scored from very-long zone (own half)
  foulZone?: 'own' | 'mid' | 'att'  // zone from FK-receiving team's perspective
}

export interface MatchResult {
  homeGoals: number // incl. extra time
  awayGoals: number
  pens?: { home: number; away: number }
  scorers: ScorerEntry[]
  finishedAfter: 'FT' | 'AET' | 'PENS'
  events?: MatchEvent[] // kept only for the user's matches
  weather?: WeatherType
  matchStats?: { home: MatchStats; away: MatchStats }
  matchRatings?: Record<string, number>
  momentum?: number
}

export interface Fixture {
  id: string
  round: Round
  day: number
  group?: string
  homeId: string | null // null until bracket resolved
  awayId: string | null
  slotHome?: string // bracket slot label, e.g. '1A', 'W73'
  slotAway?: string
  result?: MatchResult
}

// --------------------------------------------------------------- difficulty / coach
export type Difficulty = 'easy' | 'normal' | 'hard'

export interface CoachProfile {
  name: string
  avatar: AvatarParams
  nationality: string  // ISO code, e.g. 'tr', 'gb-eng'
}

export interface SaveSlotMeta {
  slot: 0 | 1 | 2
  coachName: string
  teamId: string
  day: number
  savedAt: number  // Date.now() timestamp
}

// Expectation level 0..5 for a team (0=honorable, 5=champion)
export function expectationLevel(avgOvr: number, difficulty: Difficulty): number {
  const base = avgOvr >= 85 ? 5 : avgOvr >= 80 ? 4 : avgOvr >= 75 ? 3 : avgOvr >= 70 ? 2 : avgOvr >= 65 ? 1 : 0
  return difficulty === 'hard' ? Math.min(5, base + 1) : base
}

// Achievement level from eliminatedRound (0=groups, 6=champion)
export function achievementLevel(eliminatedRound: Round | null): number {
  if (!eliminatedRound) return 6
  const m: Partial<Record<Round, number>> = { G3: 0, R32: 1, R16: 2, QF: 3, THIRD: 4, SF: 4, FINAL: 5 }
  return m[eliminatedRound] ?? 0
}

// --------------------------------------------------------------- timeline
export type DayKind = 'prep' | 'match'

export interface TimelineDay {
  day: number
  kind: DayKind
  round?: Round
}

export type PrepAction = 'attack' | 'defense' | 'setpieces' | 'rest' | 'talk' | 'press' | 'tactics'

// ------------------------------------------------------------------ events
export interface ActiveEvent {
  eventId: string
  playerId?: string // subject, if any
}

// ── Post-match player interaction events ──────────────────────────────────────
export interface PostMatchEvent {
  trigger: string           // InteractionTrigger key
  playerId: string          // subject player
  variantIdx: number        // which dialogue from the pool
}

// ── Post-match press conference ───────────────────────────────────────────────
export interface PressConfState {
  category: string          // PressCategory key
  questionIndices: number[] // 3 randomly-picked indices from pool
  currentQ: number          // 0..2
  effects: { pressRelation: number; teamMorale: number; boardConfidence: number }
}

export interface EventLogEntry {
  day: number
  eventId: string
  choiceIndex: number
  playerId?: string
}

// ---------------------------------------------------------------- career history
export interface CareerEntry {
  tournamentId: string
  teamId: string
  coachName: string
  round: Round | 'CHAMP'
  grade: 'A' | 'B' | 'C' | 'D' | 'F'
  fired: boolean
  completedAt: number
}

// ------------------------------------------------------------------ inbox
export type InboxKind = 'board' | 'suspension' | 'suspension_over' | 'injury' | 'press' | 'news'

export interface InboxMessage {
  id: string
  kind: InboxKind
  day: number
  titleKey: string                              // i18n key, resolved in UI
  bodyKey: string                               // i18n key, resolved in UI
  params?: Record<string, string | number>     // interpolation params
  read: boolean
}

// ------------------------------------------------------------------- game
export interface TrainingBoost {
  attack: number
  defense: number
  setpieces: number
}

export interface GameState {
  version: number
  teamId: string | null
  // Legacy single-tournament field (kept for migrate() compat only)
  tournamentId: string
  day: number                    // career-global day (0 = June 11, 2026)
  phase: 'idle' | 'prep' | 'matchday' | 'finished'
  fixtures: Fixture[]            // WC 2026 group+KO fixtures (legacy path)
  playerStates: PlayerStates
  lineup: Lineup
  tactics: Tactics
  trainingBoost: TrainingBoost
  prepActionUsed: boolean
  pendingEvent: ActiveEvent | null
  eventLog: EventLogEntry[]
  inbox: InboxMessage[]
  pressRelation: number
  eliminated: boolean
  eliminatedRound: Round | null
  lang: 'tr' | 'en'
  coach: CoachProfile | null
  difficulty: Difficulty
  activeSlot: 0 | 1 | 2
  music: boolean
  sfx: boolean
  fired: boolean
  careerHistory: CareerEntry[]
  careerEndRecorded: boolean

  // ── Career Calendar (new in v3) ──────────────────────────────────
  currentDate: GameDate
  currentWindowId: string
  calendarWindows: CalendarWindow[]
  schedule: ScheduledMatch[]     // ALL matches across all windows
  qualGroups: QualGroup[]
  nlGroups: NLGroup[]
  worldNews: string[]
  competitionHistory: CompetitionResult[]
  nlLeague: 'A' | 'B' | 'C' | 'D' | null
  wcQualState: 'not_started' | 'in_progress' | 'qualified' | 'eliminated' | 'n/a'
  euroQualState: 'not_started' | 'qualified' | 'eliminated' | 'n/a'
  trophyPass: boolean
  warningCount: number
  tacticPresets: (TacticPreset | null)[]

  // ── Tactical Familiarity (v4) ─────────────────────────────────────
  tacticalFamiliarity: TacticalFamiliarity
  coachTacticsRating: number  // 1-5, random 2-4 at career start
  totalMatchesPlayed: number  // incremented after each user match
  tacticsTrainingUsedThisWindow?: boolean

  // ── Youth / Aging / Federation (v7) ────────────────────────────────
  lastAgingYear: number                         // calendar year of last aging pass (0 = never)
  youthSquad: { u17: YouthPlayer[]; u21: YouthPlayer[] } // generated at career start
  regenPool: Record<string, RegenPlayer>         // senior-promoted players, keyed by player id
  retiredPlayers: RetiredPlayer[]               // international retirees (for history display)
  federationBudget: number                      // current budget in currency units
  facilitiesOwned: FacilityType[]              // purchased facilities
  selectedSquad: string[]                       // 26 player IDs for current competition window
  squadSelectionNeeded: boolean                 // shows prompt on Home when true
  calledUpPoolPlayers: string[]                 // pool player IDs promoted to selectable squad
  // ── Tournament Squad Lock (v8) ─────────────────────────────────────
  tournamentSquadLocked: boolean               // true while a major tournament is in progress
  lockedSquadIds: string[]                     // the 26 IDs locked for the active tournament
  activeTournamentId: string | null            // windowId of the currently locked tournament

  // ── Player relationships & post-match events (v9) ────────────────
  playerRelationships: Record<string, number>  // playerId → 0-100 (starts 50)
  mustStartNext: string[]                      // playerIds who must start next match
  pendingPostMatchEvents: PostMatchEvent[]     // queue of interactions shown after match
  pendingPressConf: PressConfState | null      // active press conference, if any
}
