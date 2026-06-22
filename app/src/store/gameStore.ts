import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { Preferences } from '@capacitor/preferences'
import { TEAMS, getTeam } from '../data/teams'
import { buildSide, defaultLineup } from '../domain/ai/lineup'
import { MatchSim, simulateMatch } from '../domain/engine/matchEngine'
import { FORMATIONS } from '../domain/engine/formations'
import { getEvent, rollEvent } from '../domain/events/eventPool'
import {
  applyMatchOutcome, applyPrepEffect, dailyRecovery, initialPlayerState,
  prepActionEffect, tickSuspensions, yellowThresholdFor,
} from '../domain/player/condition'
import {
  agingRng, ageInYear, developRegenPlayer,
  generateYouthSquad, generateYouthPlayer, developYouthPlayer,
  runAgingPass,
} from '../domain/player/aging'
import { makeRng } from '../domain/rng'
import { buildGroupFixtures, fixturesOfDay, TIMELINE, teamFixture } from '../domain/tournament/schedule'
import { buildNextRound, buildR32, champion, matchWinner, roundFinished } from '../domain/tournament/bracket'
import type {
  CareerEntry, CoachProfile, Difficulty, FacilityType, Fixture, GameState, Mentality,
  PlayerStates, PrepAction, RegenPlayer, RetiredPlayer, YouthPlayer,
  Round, SaveSlotMeta, TacticSliders, SetPieceOptions, Tactics, TacticPreset, TacticalFamiliarity,
  ScheduledMatch, CompetitionResult,
  InboxMessage, MatchEvent, PostMatchEvent, PressConfState,
} from '../domain/types'
import { PLAYER_INTERACTION_POOL } from '../data/playerInteractionPool'
import type { InteractionTrigger } from '../data/playerInteractionPool'
import { PRESS_QUESTIONS } from '../data/pressConferencePool'
import type { PressCategory } from '../data/pressConferencePool'
import { achievementLevel, expectationLevel, FACILITY_COST, MENTALITY_SLIDER_PRESETS, MENTALITY_TO_NUM } from '../domain/types'
import { teamAvgOverall } from '../data/teams'
import { generateCareerCalendar, simulateWindowMatches, getNextUserMatch, getNextMajorTournamentInfo, resolveWC2026Bracket } from '../domain/calendar/calendar.engine'
import { CAREER_EPOCH, careerDayToDate } from '../domain/calendar/calendar.types'
import { checkFiringAfterCompetition, calcCompetitionGrade } from '../domain/calendar/qualification'
import { groupStandings } from '../domain/tournament/standings'

const SAVE_VERSION = 8

/** Starting federation budget by team strength (OVR ≈ FIFA ranking proxy). */
function initialFederationBudget(teamId: string): number {
  const avg = teamAvgOverall(getTeam(teamId))
  if (avg >= 85) return 3_000_000   // ~Top 10
  if (avg >= 80) return 2_000_000   // ~11-30
  if (avg >= 75) return 1_200_000   // ~31-60
  if (avg >= 70) return   800_000   // ~61-100
  if (avg >= 65) return   500_000   // ~101-150
  return                   300_000   // ~150+
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function initialPlayerStates(): PlayerStates {
  const st: PlayerStates = {}
  for (const t of TEAMS) for (const p of t.players) st[p.id] = initialPlayerState()
  return st
}

function dayPhase(day: number): GameState['phase'] {
  const td = TIMELINE.find((d) => d.day === day)
  if (!td) return 'finished'
  return td.kind === 'match' ? 'matchday' : 'prep'
}

const KO_ORDER: Round[] = ['R32', 'R16', 'QF', 'SF']

// Formation back-line family: 4=four-back, 3=three-back, 5=five-back, 0=other
function formationFamily(f: string): number {
  const n = parseInt(f[0], 10)
  return [3, 4, 5].includes(n) ? n : 0
}

function familiarityDropMultiplier(oldFormation: string, newFormation: string, oldMentalityNum: number, newMentalityNum: number): number {
  let mult = 1.0
  if (oldFormation !== newFormation) {
    const of = formationFamily(oldFormation)
    const nf = formationFamily(newFormation)
    if (of === nf && of !== 0) mult *= 0.70      // same family
    else if (Math.abs(of - nf) <= 1) mult *= 0.50 // adjacent
    else mult *= 0.35                              // completely different
  }
  const steps = Math.abs(oldMentalityNum - newMentalityNum)
  if (steps === 1) mult *= 0.85
  else if (steps === 2) mult *= 0.70
  else if (steps >= 3) mult *= 0.50
  return mult
}

const DEFAULT_FAMILIARITY: TacticalFamiliarity = {
  formation: '4-3-3',
  mentality: 3,
  score: 0,
  matchesWithCurrentSetup: 0,
  lastChangedWindow: 'WC_2026',
}

const COACH_RATING_MULT: Record<number, number> = { 1: 0.7, 2: 0.85, 3: 1.0, 4: 1.15, 5: 1.3 }

/** Competition id + yellow-accumulation threshold for a match (drives discipline scoping). */
function disciplineCtx(match: { competition?: string; matchType?: string; round?: string; group?: string }): {
  competitionId: string; yellowThreshold: number
} {
  const competitionId = match.competition ?? 'WC_2026'
  // Legacy WC fixtures expose round (no matchType): KO rounds are stricter.
  const koRound = match.round && KO_ORDER.includes(match.round as Round)
  const matchType = match.matchType ?? (koRound ? 'knockout' : match.group ? 'group' : 'group')
  return { competitionId, yellowThreshold: yellowThresholdFor(matchType) }
}

let inboxSeq = 0
function makeInboxMessage(
  kind: InboxMessage['kind'], day: number, titleKey: string, bodyKey: string,
  params?: Record<string, string | number>,
): InboxMessage {
  inboxSeq++
  return { id: `msg_${day}_${inboxSeq}_${Math.random().toString(36).slice(2, 7)}`, kind, day, titleKey, bodyKey, params, read: false }
}

const REASON_KEY: Record<string, string> = {
  straight: 'inbox.reasonStraight', second_yellow: 'inbox.reasonSecondYellow',
  dogso: 'inbox.reasonDogso', dissent: 'inbox.reasonDissent', yellows: 'inbox.reasonYellows',
}

/** Build inbox notices for the user's own players after a match (injuries / new bans / served bans). */
function buildMatchInbox(
  day: number, userTeamId: string, events: MatchEvent[],
  suspBefore: Record<string, number>, statesAfter: PlayerStates,
  servedIds: string[], playerName: (id: string) => string,
): InboxMessage[] {
  const msgs: InboxMessage[] = []
  // injuries to user players
  for (const e of events) {
    if (e.type === 'injury' && e.teamId === userTeamId && e.playerId) {
      msgs.push(makeInboxMessage('injury', day, 'inbox.injuryTitle', 'inbox.injuryBody', { player: e.playerName ?? playerName(e.playerId) }))
    }
  }
  // new suspensions (suspendedMatches went from 0 to >0 this match)
  for (const id of Object.keys(statesAfter)) {
    const after = statesAfter[id]
    const before = suspBefore[id] ?? 0
    if (after && after.suspendedMatches > 0 && before === 0) {
      const reasonKey = REASON_KEY[after.suspensionReason ?? 'straight'] ?? 'inbox.reasonStraight'
      msgs.push(makeInboxMessage('suspension', day, 'inbox.suspTitle', 'inbox.suspBody', {
        player: playerName(id), n: after.suspendedMatches, reasonKey,
      }))
    }
  }
  // served suspensions (available again)
  for (const id of servedIds) {
    msgs.push(makeInboxMessage('suspension_over', day, 'inbox.suspOverTitle', 'inbox.suspOverBody', { player: playerName(id) }))
  }
  return msgs
}

interface Actions {
  careerSeed: number
  newCareer: (teamId: string, tournamentId: string, coach: CoachProfile, difficulty: Difficulty, slot: 0 | 1 | 2) => void
  initCareer: (teamId: string, coach: CoachProfile, difficulty: Difficulty, slot: 0 | 1 | 2) => void
  advanceToNextMatch: () => void
  advanceWeek: () => void
  skipFriendly: (matchId: string) => void
  resolveQualification: (windowId: string) => void
  restart: () => void
  setLang: (l: 'tr' | 'en') => void
  setDifficulty: (d: Difficulty) => void
  setSound: (music: boolean, sfx: boolean) => void
  setFormation: (key: string) => void
  setStarter: (slot: number, playerId: string | null) => void
  setRole: (slotIdx: number, role: string | null) => void
  setSetpiece: (type: 'corner' | 'freekick' | 'penalty' | 'longThrow', playerId: string | null) => void
  setMentality: (mentality: Mentality) => void
  setSlider: (key: keyof TacticSliders, value: number) => void
  setSetpieceOption: <K extends keyof SetPieceOptions>(key: K, value: SetPieceOptions[K]) => void
  saveTacticPreset: (slot: 0 | 1 | 2, name: string) => void
  loadTacticPreset: (slot: 0 | 1 | 2) => void
  setOppositionInstruction: (playerId: string, instruction: 'tight' | 'normal' | 'space') => void
  setCaptain: (playerId: string | null) => void
  setViceCaptain: (playerId: string | null) => void
  setTactics: (t: Tactics) => void
  doPrepAction: (a: PrepAction) => void
  resolveEvent: (choiceIndex: number) => void
  resolvePostMatchEvent: (choiceIndex: number) => void
  openPressConf: () => void
  resolvePressConfQuestion: (choiceIndex: number) => void
  skipPressConf: () => void
  markInboxRead: (id?: string) => void
  clearInbox: () => void
  advanceDay: () => void
  createUserMatch: () => { sim: MatchSim; fixture: Fixture } | null
  commitUserMatch: (sim: MatchSim, fixtureId: string) => void
  // career tracking
  recordCareerEnd: (grade: 'A' | 'B' | 'C' | 'D' | 'F') => void
  // slot management
  saveToSlot: (n: 0 | 1 | 2) => Promise<void>
  loadFromSlot: (n: 0 | 1 | 2) => Promise<boolean>
  listSlots: () => Promise<(SaveSlotMeta | null)[]>
  deleteSlot: (n: 0 | 1 | 2) => Promise<void>
  // ── aging / youth / federation ──────────────────────────────────────
  runAnnualAging: (year: number) => void
  callUpYouth: (playerId: string) => void
  callUpPoolPlayer: (playerId: string) => void
  releaseYouth: (playerId: string) => void
  confirmMatchdaySquad: (playerIds: string[]) => void
  lockTournamentSquad: (playerIds: string[], windowId: string) => void
  purchaseFacility: (type: FacilityType) => void
  addFederationBudget: (amount: number, source?: string) => void
  // internal
  maybeRollEvent: () => void
  simulateDayMatches: (skipFixtureId?: string) => void
  progressBracket: () => void
  gainFamiliarityAfterMatch: (matchId?: string) => void
  trainTactics: () => void
}

export type Store = GameState & Actions

const emptyState = (): GameState => ({
  version: SAVE_VERSION,
  teamId: null,
  tournamentId: 'WC_2026',
  day: 0,
  phase: 'idle',
  fixtures: [],
  playerStates: {},
  lineup: { formation: '4-3-3', starters: Array(11).fill(null), roles: Array(11).fill(null), setpieces: { corner: null, freekick: null, penalty: null, longThrow: null }, captainId: null, viceCaptainId: null },
  tactics: { style: 'balanced', press: 'mid', tempo: 'normal', mentality: 'balanced', sliders: { width: 5, defLine: 5, press: 5, tempo: 5, aggression: 5, crossing: 5, counter: 5 }, setpieceOptions: { cornerDelivery: 'inswinger', fkRoutine: 'shoot', penaltyStyle: 'placed', longThrowOn: false }, oppositionInstructions: {} },
  trainingBoost: { attack: 0, defense: 0, setpieces: 0 },
  prepActionUsed: false,
  pendingEvent: null,
  eventLog: [],
  inbox: [],
  pressRelation: 0,
  eliminated: false,
  eliminatedRound: null,
  lang: 'en',
  coach: null,
  difficulty: 'normal',
  activeSlot: 0,
  music: true,
  sfx: true,
  fired: false,
  careerHistory: [],
  careerEndRecorded: false,
  // calendar fields
  currentDate: CAREER_EPOCH,
  currentWindowId: 'WC_2026',
  calendarWindows: [],
  schedule: [],
  qualGroups: [],
  nlGroups: [],
  worldNews: [],
  competitionHistory: [],
  nlLeague: null,
  wcQualState: 'not_started',
  euroQualState: 'not_started',
  trophyPass: false,
  warningCount: 0,
  tacticPresets: [null, null, null],
  tacticalFamiliarity: { ...DEFAULT_FAMILIARITY },
  coachTacticsRating: 3,
  totalMatchesPlayed: 0,
  tacticsTrainingUsedThisWindow: false,
  // v7 youth/aging/federation
  lastAgingYear: 0,
  youthSquad: { u17: [], u21: [] },
  regenPool: {},
  retiredPlayers: [],
  federationBudget: 0,
  facilitiesOwned: [],
  selectedSquad: [],
  squadSelectionNeeded: false,
  calledUpPoolPlayers: [],
  tournamentSquadLocked: false,
  lockedSquadIds: [],
  activeTournamentId: null,
  // v9 — relationships & post-match events
  playerRelationships: {},
  mustStartNext: [],
  pendingPostMatchEvents: [],
  pendingPressConf: null,
})

const capStorage = createJSONStorage(() => ({
  getItem: async (k: string) => (await Preferences.get({ key: k })).value,
  setItem: async (k: string, v: string) => { await Preferences.set({ key: k, value: v }) },
  removeItem: async (k: string) => { await Preferences.remove({ key: k }) },
}))

/** Build post-match player interaction events after a user match. */
function buildPostMatchEvents(
  teamId: string,
  result: { homeGoals: number; awayGoals: number },
  isHome: boolean,
  schedule: ScheduledMatch[],
  lineup: { starters: (string | null)[] },
  playerStates: PlayerStates,
  relationships: Record<string, number>,
  rng: () => number,
): PostMatchEvent[] {
  const userGF = isHome ? result.homeGoals : result.awayGoals
  const userGA = isHome ? result.awayGoals : result.homeGoals
  const userWon = userGF > userGA
  const userLost = userGF < userGA

  const starterIds = new Set(lineup.starters.filter(Boolean) as string[])
  const team = getTeam(teamId)
  const players = team.players

  // Recent results for losing streak check
  const recentUserResults = schedule
    .filter((m) => m.result && (m.homeId === teamId || m.awayId === teamId))
    .sort((a, b) => b.day - a.day)
    .slice(0, 3)
  const isLosingStreak = recentUserResults.length >= 3 &&
    recentUserResults.every((m) => {
      const gh = m.homeId === teamId ? m.result!.homeGoals : m.result!.awayGoals
      const ga = m.homeId === teamId ? m.result!.awayGoals : m.result!.homeGoals
      return gh < ga
    })

  const events: PostMatchEvent[] = []

  const addEv = (trigger: InteractionTrigger, playerId: string) => {
    const pool = PLAYER_INTERACTION_POOL[trigger]
    const variantIdx = Math.floor(rng() * pool.length)
    events.push({ trigger, playerId, variantIdx })
  }

  // Captain poor match
  const captain = players.find((p) => starterIds.has(p.id) && (p.caps ?? 0) >= 20)
  if (captain && userLost) addEv('captainPoorMatch', captain.id)

  // Three-match losing streak
  if (isLosingStreak) {
    const capForStreak = players.find((p) => starterIds.has(p.id))
    if (capForStreak) addEv('threeMatchLosingStreak', capForStreak.id)
  }

  // Star player good form — check matchRatings
  if (userWon) {
    const starInForm = players
      .filter((p) => starterIds.has(p.id) && p.stats.overall >= 82)
      .sort((a, b) => b.stats.overall - a.stats.overall)[0]
    if (starInForm && rng() < 0.40) addEv('starPlayerGoodForm', starInForm.id)
  }

  // Young player first cap (caps === 0 before this match; approximated by caps === 0)
  const youngDebut = players.find((p) => starterIds.has(p.id) && (p.caps ?? 0) === 0)
  if (youngDebut) addEv('youngPlayerFirstCap', youngDebut.id)

  // Benched players reactions (check up to 2 high-rated benched players)
  const benchedStars = players
    .filter((p) => !starterIds.has(p.id) && p.stats.overall >= 78 &&
      (playerStates[p.id]?.injuredUntilDay ?? -1) < 0 &&
      (playerStates[p.id]?.suspendedMatches ?? 0) === 0)
    .sort((a, b) => b.stats.overall - a.stats.overall)
    .slice(0, 2)

  for (const b of benchedStars) {
    const consecutiveBenched = (relationships[b.id] ?? 50) <= 45 ? 3 : 1
    const chanceThreshold = userLost ? 0.55 : 0.30
    if (consecutiveBenched >= 3) {
      if (events.length < 2) addEv('benchedThreeMatches', b.id)
    } else if (rng() < chanceThreshold && events.length < 2) {
      addEv(userWon ? 'benchedAndWon' : 'benchedAndLost', b.id)
    }
  }

  // Max 2 events per match
  return events.slice(0, 2)
}

/** Pick a random subset of indices for press conference questions. */
function pickPressQIndices(category: PressCategory, count: number, rng: () => number): number[] {
  const pool = PRESS_QUESTIONS[category]
  const indices = pool.map((_, i) => i)
  // Fisher-Yates shuffle then take first `count`
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }
  return indices.slice(0, Math.min(count, indices.length))
}

export const useGame = create<Store>()(
  persist(
    (set, get) => ({
      ...emptyState(),
      careerSeed: 0,

      newCareer: (teamId, tournamentId, coach, difficulty, slot) => {
        const playerStates = initialPlayerStates()
        const lineup = defaultLineup(teamId, playerStates, 0)
        set({
          ...emptyState(),
          lang: get().lang,
          music: get().music,
          sfx: get().sfx,
          careerHistory: get().careerHistory,
          careerSeed: Date.now() >>> 0,
          teamId,
          tournamentId,
          coach,
          difficulty,
          activeSlot: slot,
          playerStates,
          lineup,
          phase: 'prep',
          coachTacticsRating: 2 + Math.floor(Math.random() * 3), // 2,3,4
          totalMatchesPlayed: 0,
          tacticalFamiliarity: {
            formation: lineup.formation,
            mentality: 3, // balanced default
            score: 0,
            matchesWithCurrentSetup: 0,
            lastChangedWindow: 'WC_2026',
          },
          tacticsTrainingUsedThisWindow: false,
        })
        set({ fixtures: buildGroupFixtures() })
        get().maybeRollEvent()
        // persist snapshot to the chosen slot
        void get().saveToSlot(slot)
      },

      // Full career calendar career (replaces single-tournament newCareer)
      initCareer: (teamId, coach, difficulty, slot) => {
        const playerStates = initialPlayerStates()
        const lineup = defaultLineup(teamId, playerStates, 0)
        const calResult = generateCareerCalendar(teamId, TEAMS)
        const nlGroup = calResult.nlGroups.find((g) => g.teams.includes(teamId))
        const isWC = calResult.windows.some((w) => w.id === 'WC_2026' && w.userParticipates)

        // Generate starting youth squads (uses career seed derived from Date.now())
        const initSeed = Date.now() >>> 0
        const youthRng = agingRng(initSeed, 2026)
        const team = getTeam(teamId)
        const youthSquad = generateYouthSquad(
          teamId, team.confederation, 2026, false, false, youthRng,
        )

        set({
          ...emptyState(),
          lang: get().lang,
          music: get().music,
          sfx: get().sfx,
          careerHistory: get().careerHistory,
          careerSeed: Date.now() >>> 0,
          teamId,
          tournamentId: isWC ? 'WC_2026' : 'CAREER',
          coach,
          difficulty,
          activeSlot: slot,
          playerStates,
          lineup,
          phase: 'prep',
          coachTacticsRating: 2 + Math.floor(Math.random() * 3), // 2,3,4
          totalMatchesPlayed: 0,
          tacticalFamiliarity: {
            formation: lineup.formation,
            mentality: 3, // balanced default
            score: 0,
            matchesWithCurrentSetup: 0,
            lastChangedWindow: isWC ? 'WC_2026' : (calResult.windows[0]?.id ?? 'FRIENDLY_AUG_2026'),
          },
          tacticsTrainingUsedThisWindow: false,
          currentDate: CAREER_EPOCH,
          currentWindowId: isWC ? 'WC_2026' : (calResult.windows[0]?.id ?? 'FRIENDLY_AUG_2026'),
          calendarWindows: calResult.windows,
          schedule: calResult.schedule,
          qualGroups: calResult.qualGroups,
          nlGroups: calResult.nlGroups,
          nlLeague: nlGroup?.league ?? null,
          wcQualState: isWC ? 'n/a' : 'not_started',
          euroQualState: 'not_started',
          inbox: [makeInboxMessage('board', 0, 'inbox.welcomeTitle', 'inbox.welcomeBody', { team: getTeam(teamId).name })],
          youthSquad,
          selectedSquad: isWC ? team.players.slice(0, 26).map((p) => p.id) : [],
          squadSelectionNeeded: false,
          federationBudget: initialFederationBudget(teamId),
          // Pre-lock WC 2026 teams with their real squad — no mandatory selection screen for first tournament
          tournamentSquadLocked: isWC,
          lockedSquadIds: isWC ? team.players.slice(0, 26).map((p) => p.id) : [],
          activeTournamentId: isWC ? 'WC_2026' : null,
        })
        // Also build legacy fixtures for WC teams (used by existing bracket logic)
        if (isWC) set({ fixtures: buildGroupFixtures() })
        get().maybeRollEvent()
        void get().saveToSlot(slot)
      },

      advanceToNextMatch: () => {
        const g = get()
        if (!g.teamId) return

        const nextMatch = getNextUserMatch(g.schedule, g.teamId, g.day)
        if (!nextMatch) return

        // Block advance if a major tournament first match is next and squad not locked
        if (!g.tournamentSquadLocked) {
          const tournInfo = getNextMajorTournamentInfo(g.schedule, g.calendarWindows, g.teamId, g.day)
          if (tournInfo && nextMatch.windowId === tournInfo.windowId) {
            set({ squadSelectionNeeded: true })
            return
          }
        }

        // Simulate non-user matches up to and including the user's match day.
        // date gate in simulateWindowMatches ensures no future matchdays are touched.
        const { updatedSchedule, worldNews } = simulateWindowMatches(
          nextMatch.windowId,
          g.teamId,
          g.schedule,
          g.playerStates,
          (g as typeof g & { careerSeed: number }).careerSeed,
          nextMatch.day,   // was g.day (the day BEFORE advancing) — now uses target day
        )

        // Apply daily recovery for days elapsed
        const states = structuredClone(g.playerStates)
        const daysElapsed = Math.max(0, nextMatch.day - g.day)
        for (let i = 0; i < Math.floor(daysElapsed / 2); i++) dailyRecovery(states)

        const newDate = careerDayToDate(nextMatch.day)
        set({
          schedule: updatedSchedule,
          playerStates: states,
          day: nextMatch.day,
          currentDate: newDate,
          currentWindowId: nextMatch.windowId,
          phase: 'matchday',
          prepActionUsed: false,
          worldNews: worldNews.length > 0 ? worldNews : g.worldNews,
        })
        get().maybeRollEvent()

        // Annual aging pass: trigger when calendar year advances past Jan 1
        const prevYear = g.currentDate.year
        if (newDate.year > prevYear) {
          for (let yr = prevYear + 1; yr <= newDate.year; yr++) {
            get().runAnnualAging(yr)
          }
        }

        void get().saveToSlot(g.activeSlot)
      },

      advanceWeek: () => {
        const g = get()
        if (!g.teamId) return
        const newDay  = g.day + 7
        const newDate = careerDayToDate(newDay)

        // Block if a major tournament starts within this week and squad not locked
        if (!g.tournamentSquadLocked) {
          const tournInfo = getNextMajorTournamentInfo(g.schedule, g.calendarWindows, g.teamId, g.day)
          if (tournInfo && tournInfo.firstMatchDay <= newDay) {
            set({ squadSelectionNeeded: true })
            return
          }
        }

        // Simulate world matches in the current window up to the end of this week
        const { updatedSchedule, worldNews } = simulateWindowMatches(
          g.currentWindowId,
          g.teamId,
          g.schedule,
          g.playerStates,
          (g as typeof g & { careerSeed: number }).careerSeed,
          newDay,
        )

        // ~3 rest-day recovery passes for a week (7 days / 2 days per pass)
        const states = structuredClone(g.playerStates)
        for (let i = 0; i < 3; i++) dailyRecovery(states)

        set({
          schedule: updatedSchedule,
          playerStates: states,
          day: newDay,
          currentDate: newDate,
          prepActionUsed: false,
          worldNews: worldNews.length > 0 ? worldNews : g.worldNews,
        })

        // Annual aging trigger if year rolled over
        const prevYear = g.currentDate.year
        if (newDate.year > prevYear) {
          for (let yr = prevYear + 1; yr <= newDate.year; yr++) get().runAnnualAging(yr)
        }

        void get().saveToSlot(g.activeSlot)
      },

      skipFriendly: (matchId) => {
        const g = get()
        const schedule = structuredClone(g.schedule) as ScheduledMatch[]
        const m = schedule.find((x) => x.id === matchId)
        if (!m) return
        m.simulated = true
        // rest squad on skip
        const states = structuredClone(g.playerStates)
        if (g.teamId) {
          const ids = getTeam(g.teamId).players.map((p) => p.id)
          applyPrepEffect(states, ids, { teamFitness: 10 })
        }
        set({ schedule, playerStates: states })
        void get().saveToSlot(g.activeSlot)
      },

      resolveQualification: (windowId) => {
        const g = get()
        if (!g.teamId) return

        const windowMatches = g.schedule.filter((m) => m.windowId === windowId)
        const userMatches = windowMatches.filter(
          (m) => m.homeId === g.teamId || m.awayId === g.teamId,
        )
        if (userMatches.some((m) => !m.result)) return  // not all played

        // Determine outcome from qual group standings
        const qg = g.qualGroups.find((q) => q.teams.includes(g.teamId!))
        if (!qg) return

        const groupMatches = g.schedule.filter((m) => m.group === qg.id)
        const rows = groupStandings(groupMatches as unknown as Fixture[], qg.id, qg.teams)
        const userRow = rows.find((r) => r.teamId === g.teamId)
        const rank = rows.indexOf(userRow!)
        const qualified = rank < qg.directSlots
        const playoff = rank < qg.directSlots + qg.playoffSlots

        const outcome = qualified ? 'qual_success' : playoff ? 'group_stage' : 'qual_fail'
        const allTeams = TEAMS
        const teamIdx = allTeams
          .filter((t) => t.confederation === getTeam(g.teamId!).confederation)
          .sort((a, b) => {
            const ap = (a as unknown as { ranking_pts?: number }).ranking_pts ?? 0
            const bp = (b as unknown as { ranking_pts?: number }).ranking_pts ?? 0
            return bp - ap
          })
          .findIndex((t) => t.id === g.teamId) + 1
        const grade = calcCompetitionGrade(outcome as CompetitionResult['outcome'], teamIdx)
        const result: CompetitionResult = { competition: qg.id, windowId, outcome: outcome as CompetitionResult['outcome'], grade, day: g.day }

        const firingResult = checkFiringAfterCompetition(result, teamIdx, g.competitionHistory, g.difficulty, g.trophyPass)
        const newHistory = [...g.competitionHistory, result]
        let { fired, trophyPass, warningCount, wcQualState } = g

        if (firingResult === 'fired') fired = true
        if (firingResult === 'warned') warningCount++
        if (firingResult === 'free_pass_used') trophyPass = false
        wcQualState = qualified ? 'qualified' : 'eliminated'

        set({ competitionHistory: newHistory, fired, trophyPass, warningCount, wcQualState })
        void get().saveToSlot(g.activeSlot)
      },

      restart: () => set({ ...emptyState(), lang: get().lang, music: get().music, sfx: get().sfx, careerHistory: get().careerHistory }),

      setLang: (lang) => set({ lang }),

      setDifficulty: (difficulty) => set({ difficulty }),

      setSound: (music, sfx) => set({ music, sfx }),

      setFormation: (key) => {
        const { lineup, teamId, playerStates, day } = get()
        if (!teamId || !FORMATIONS[key]) return
        const slots = FORMATIONS[key]
        const old = lineup.starters.filter(Boolean) as string[]
        const team = getTeam(teamId)
        const byId = new Map(team.players.map((p) => [p.id, p]))
        const remaining = [...old]
        const starters: (string | null)[] = slots.map((slot) => {
          const i = remaining.findIndex((id) => byId.get(id)?.position === slot.role)
          if (i >= 0) return remaining.splice(i, 1)[0]
          return null
        })
        for (let i = 0; i < starters.length && remaining.length; i++) {
          if (!starters[i]) starters[i] = remaining.shift()!
        }
        void playerStates; void day
        set({ lineup: { formation: key, starters, roles: Array(slots.length).fill(null), setpieces: lineup.setpieces, captainId: lineup.captainId, viceCaptainId: lineup.viceCaptainId } })
      },

      setStarter: (slot, playerId) => {
        const lineup = get().lineup
        const starters = [...lineup.starters]
        const roles = [...(lineup.roles ?? Array(starters.length).fill(null))]
        if (playerId) {
          const dup = starters.indexOf(playerId)
          if (dup >= 0) { starters[dup] = starters[slot]; roles[dup] = roles[slot] }
        }
        starters[slot] = playerId
        roles[slot] = null  // clear role when player changes
        set({ lineup: { ...lineup, starters, roles } })
      },

      setRole: (slotIdx, role) => {
        const lineup = get().lineup
        const roles = [...(lineup.roles ?? Array(lineup.starters.length).fill(null))]
        roles[slotIdx] = role
        set({ lineup: { ...lineup, roles } })
      },

      setSetpiece: (type, playerId) => {
        const lineup = get().lineup
        const sp = { ...(lineup.setpieces ?? { corner: null, freekick: null, penalty: null, longThrow: null }) }
        sp[type] = playerId
        set({ lineup: { ...lineup, setpieces: sp } })
      },

      setMentality: (mentality) => {
        const presetSliders = MENTALITY_SLIDER_PRESETS[mentality]
        const style = mentality === 'ultra_defensive' || mentality === 'defensive' ? 'defensive'
          : mentality === 'attacking' || mentality === 'gung_ho' ? 'attacking' : 'balanced'
        const press = presetSliders.press >= 7 ? 'high' : presetSliders.press <= 3 ? 'low' : 'mid'
        const tempo = presetSliders.tempo >= 7 ? 'fast' : presetSliders.tempo <= 3 ? 'slow' : 'normal'
        set({ tactics: { ...get().tactics, mentality, sliders: presetSliders, style, press, tempo } })
      },

      setSlider: (key, value) => {
        const sliders = { ...get().tactics.sliders, [key]: Math.min(10, Math.max(1, value)) }
        const press = sliders.press >= 7 ? 'high' : sliders.press <= 3 ? 'low' : 'mid'
        const tempo = sliders.tempo >= 7 ? 'fast' : sliders.tempo <= 3 ? 'slow' : 'normal'
        set({ tactics: { ...get().tactics, sliders, press, tempo } })
      },

      setSetpieceOption: (key, value) => {
        set({ tactics: { ...get().tactics, setpieceOptions: { ...get().tactics.setpieceOptions, [key]: value } } })
      },

      saveTacticPreset: (slot, name) => {
        const g = get()
        const presets = [...(g.tacticPresets ?? [null, null, null])] as (TacticPreset | null)[]
        presets[slot] = { name, mentality: g.tactics.mentality, sliders: { ...g.tactics.sliders }, setpieceOptions: { ...g.tactics.setpieceOptions } }
        set({ tacticPresets: presets })
      },

      loadTacticPreset: (slot) => {
        const g = get()
        const preset = (g.tacticPresets ?? [])[slot]
        if (!preset) return
        const style = preset.mentality === 'ultra_defensive' || preset.mentality === 'defensive' ? 'defensive'
          : preset.mentality === 'attacking' || preset.mentality === 'gung_ho' ? 'attacking' : 'balanced'
        const press = preset.sliders.press >= 7 ? 'high' : preset.sliders.press <= 3 ? 'low' : 'mid'
        const tempo = preset.sliders.tempo >= 7 ? 'fast' : preset.sliders.tempo <= 3 ? 'slow' : 'normal'
        set({ tactics: { ...g.tactics, mentality: preset.mentality, sliders: { ...preset.sliders }, setpieceOptions: { ...preset.setpieceOptions }, style, press, tempo } })
      },

      setOppositionInstruction: (playerId, instruction) => {
        const oi = { ...(get().tactics.oppositionInstructions ?? {}) }
        if (instruction === 'normal') delete oi[playerId]
        else oi[playerId] = instruction
        set({ tactics: { ...get().tactics, oppositionInstructions: oi } })
      },

      setCaptain: (playerId) => {
        const lineup = get().lineup
        // Can't be captain and vice-captain simultaneously
        const vc = lineup.viceCaptainId === playerId ? null : lineup.viceCaptainId
        set({ lineup: { ...lineup, captainId: playerId, viceCaptainId: vc } })
      },

      setViceCaptain: (playerId) => {
        const lineup = get().lineup
        // Can't be vice-captain and captain simultaneously
        const cap = lineup.captainId === playerId ? null : lineup.captainId
        set({ lineup: { ...lineup, viceCaptainId: playerId, captainId: cap } })
      },

      setTactics: (tactics) => set({ tactics }),

      gainFamiliarityAfterMatch: (matchId) => {
        const g = get()
        const fam = g.tacticalFamiliarity
        if (matchId && fam.lastMatchId === matchId) return

        const currentMentalityNum = MENTALITY_TO_NUM[g.tactics.mentality] ?? 3

        // Sync baseline values if empty (first match ever)
        let currentFormation = fam.formation
        let currentMentality = fam.mentality
        if (!currentFormation) {
          currentFormation = g.lineup.formation
          currentMentality = currentMentalityNum
        }

        const sameFormation = currentFormation === g.lineup.formation
        const sameMentality = currentMentality === currentMentalityNum

        let currentScore = fam.score
        let formationPoints = 8
        let mentalityPoints = 5

        if (!sameFormation || !sameMentality) {
          const dropMult = familiarityDropMultiplier(
            currentFormation, g.lineup.formation, currentMentality, currentMentalityNum
          )
          currentScore = Math.max(0, Math.round(fam.score * dropMult))
          
          if (!sameFormation) formationPoints = 0
          if (!sameMentality) mentalityPoints = 0
        }

        const trainingPoints = g.tacticsTrainingUsedThisWindow ? 3 : 0
        const baseGain = formationPoints + mentalityPoints + trainingPoints
        const cappedGain = Math.min(baseGain, 15)
        const ratingMult = COACH_RATING_MULT[g.coachTacticsRating] ?? 1.0
        const actualGain = Math.round(cappedGain * ratingMult)
        const newScore = Math.min(100, currentScore + actualGain)

        set({
          tacticalFamiliarity: {
            formation: g.lineup.formation,
            mentality: currentMentalityNum,
            score: newScore,
            matchesWithCurrentSetup: (!sameFormation || !sameMentality) ? 0 : fam.matchesWithCurrentSetup + 1,
            lastChangedWindow: (!sameFormation || !sameMentality) ? g.currentWindowId : fam.lastChangedWindow,
            lastMatchId: matchId,
            lastMatchGain: actualGain,
            lastMatchOldScore: fam.score,
            lastMatchNewScore: newScore,
          },
          totalMatchesPlayed: g.totalMatchesPlayed + 1,
          tacticsTrainingUsedThisWindow: false,
        })
      },

      trainTactics: () => {
        const g = get()
        if (g.prepActionUsed) return
        const fam = g.tacticalFamiliarity
        const gain = Math.round(5 * (COACH_RATING_MULT[g.coachTacticsRating] ?? 1.0))
        const newScore = Math.min(100, fam.score + gain)
        // Also apply small fitness drain for all players
        const states = structuredClone(g.playerStates)
        const allIds = Object.keys(states)
        for (const id of allIds) {
          if (states[id]) states[id].fitness = Math.max(0, states[id].fitness - 3)
        }
        set({
          tacticalFamiliarity: { ...fam, score: newScore },
          playerStates: states,
          prepActionUsed: true,
          tacticsTrainingUsedThisWindow: true,
        })
      },

      doPrepAction: (a) => {
        const g = get()
        // Training lives in the pre-match (Hazırlan) flow; allow it on a prep
        // day OR whenever a session hasn't been used before the next match.
        const inCareer = g.schedule.length > 0
        if (g.prepActionUsed || !g.teamId || (!inCareer && g.phase !== 'prep')) return
        if (a === 'tactics') { get().trainTactics(); return }
        const eff = prepActionEffect(a)
        const states = structuredClone(g.playerStates)
        applyPrepEffect(states, getTeam(g.teamId).players.map((p) => p.id), eff)
        const tb = { ...g.trainingBoost }
        if (eff.trainingBoost?.attack) tb.attack += eff.trainingBoost.attack
        if (eff.trainingBoost?.defense) tb.defense += eff.trainingBoost.defense
        if (eff.trainingBoost?.setpieces) tb.setpieces += eff.trainingBoost.setpieces
        set({
          playerStates: states,
          trainingBoost: tb,
          prepActionUsed: true,
          pressRelation: Math.max(-5, Math.min(5, g.pressRelation + (eff.press ?? 0))),
        })
      },

      resolveEvent: (choiceIndex) => {
        const g = get()
        if (!g.pendingEvent || !g.teamId) return
        const ev = getEvent(g.pendingEvent.eventId)
        const eff = ev.choices[choiceIndex] ?? ev.choices[0]
        const states = structuredClone(g.playerStates)
        const ids = getTeam(g.teamId).players.map((p) => p.id)
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
        if (eff.teamMorale || eff.teamFitness)
          applyPrepEffect(states, ids, { teamMorale: eff.teamMorale, teamFitness: eff.teamFitness })
        const subj = g.pendingEvent.playerId
        if (subj && states[subj]) {
          const st = states[subj]
          if (eff.subjectMorale) st.morale = clamp(st.morale + eff.subjectMorale, 1, 10)
          if (eff.subjectForm) st.form = clamp(st.form + eff.subjectForm, 1, 10)
          if (eff.subjectFitness) st.fitness = clamp(st.fitness + eff.subjectFitness, 0, 100)
        }
        set({
          playerStates: states,
          pendingEvent: null,
          pressRelation: clamp(g.pressRelation + (eff.press ?? 0), -5, 5),
          eventLog: [...g.eventLog, {
            day: g.day, eventId: g.pendingEvent.eventId, choiceIndex, playerId: subj,
          }],
        })
      },

      resolvePostMatchEvent: (choiceIndex) => {
        const g = get()
        const ev = g.pendingPostMatchEvents[0]
        if (!ev || !g.teamId) return
        const pool = PLAYER_INTERACTION_POOL[ev.trigger as InteractionTrigger]
        if (!pool) return
        const interaction = pool[ev.variantIdx]
        const eff = interaction.options[choiceIndex]?.effect ?? {}
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
        const states = structuredClone(g.playerStates)
        const ids = getTeam(g.teamId).players.map((p) => p.id)
        // Apply morale / teamMorale effects
        if (eff.morale && states[ev.playerId]) {
          states[ev.playerId].morale = clamp(states[ev.playerId].morale + eff.morale, 1, 10)
        }
        if (eff.teamMorale) {
          applyPrepEffect(states, ids, { teamMorale: eff.teamMorale })
        }
        // Update relationship
        const relationships = { ...g.playerRelationships }
        const prev = relationships[ev.playerId] ?? 50
        relationships[ev.playerId] = clamp(prev + (eff.relationship ?? 0) * 5, 0, 100)
        // mustStartNext
        const mustStartNext = eff.mustStartNext
          ? [...new Set([...g.mustStartNext, ev.playerId])]
          : g.mustStartNext
        set({
          playerStates: states,
          playerRelationships: relationships,
          mustStartNext,
          pendingPostMatchEvents: g.pendingPostMatchEvents.slice(1),
        })
      },

      openPressConf: () => {
        // pendingPressConf is already set by commitUserMatch — just expose it
        // (no-op if already set; called when user taps the press conf button)
      },

      resolvePressConfQuestion: (choiceIndex) => {
        const g = get()
        const pc = g.pendingPressConf
        if (!pc) return
        const pool = PRESS_QUESTIONS[pc.category as PressCategory]
        const qIdx = pc.questionIndices[pc.currentQ]
        const q = pool[qIdx]
        if (!q) return
        const eff = q.options[choiceIndex]?.effect ?? {}
        const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))
        const accumulated = {
          pressRelation: pc.effects.pressRelation + (eff.pressRelation ?? 0),
          teamMorale: pc.effects.teamMorale + (eff.teamMorale ?? 0),
          boardConfidence: pc.effects.boardConfidence + (eff.boardConfidence ?? 0),
        }
        const isLast = pc.currentQ >= pc.questionIndices.length - 1
        if (isLast) {
          // Apply all accumulated effects
          const newPressRelation = clamp(g.pressRelation + accumulated.pressRelation, -5, 5)
          const states = g.teamId ? structuredClone(g.playerStates) : g.playerStates
          if (g.teamId && accumulated.teamMorale !== 0) {
            applyPrepEffect(states, getTeam(g.teamId).players.map((p) => p.id), {
              teamMorale: accumulated.teamMorale,
            })
          }
          set({
            pressRelation: newPressRelation,
            playerStates: states,
            pendingPressConf: null,
          })
        } else {
          set({
            pendingPressConf: { ...pc, currentQ: pc.currentQ + 1, effects: accumulated },
          })
        }
      },

      skipPressConf: () => set({ pendingPressConf: null }),

      markInboxRead: (id) => {
        const inbox = (get().inbox ?? []).map((m) => (!id || m.id === id ? { ...m, read: true } : m))
        set({ inbox })
      },

      clearInbox: () => set({ inbox: [] }),

      maybeRollEvent: () => {
        const g = get()
        if (g.phase !== 'prep' || g.pendingEvent || !g.teamId) return
        // difficulty gate: easy → fewer events, hard → more events
        const gateRng = makeRng((g.careerSeed ^ (g.day * 7919) ^ 0xCAFE) >>> 0)
        const rollChance = g.difficulty === 'easy' ? 0.45 : g.difficulty === 'hard' ? 0.85 : 0.65
        if (gateRng() > rollChance) return

        const team = getTeam(g.teamId)
        const lastUserFixture = [...g.fixtures]
          .filter((f) => f.result && (f.homeId === g.teamId || f.awayId === g.teamId))
          .sort((a, b) => b.day - a.day)[0]
        let lastWon: boolean | null = null
        if (lastUserFixture?.result) {
          const w = matchWinner(lastUserFixture)
          lastWon = w === null ? false : w === g.teamId
        }
        const rolled = rollEvent({
          day: g.day,
          players: team.players,
          states: g.playerStates,
          lineup: g.lineup,
          lastWon,
          pressRelation: g.pressRelation,
          rng: makeRng((g.careerSeed ^ (g.day * 7919)) >>> 0),
        })
        if (rolled) set({ pendingEvent: rolled })
      },

      advanceDay: () => {
        const g = get()
        if (g.phase === 'finished' || !g.teamId) return

        if (g.phase === 'matchday') {
          const userFx = teamFixture(g.fixtures, g.teamId, g.day)
          if (userFx && !userFx.result && !g.eliminated) return
          g.simulateDayMatches()
        } else {
          const states = structuredClone(g.playerStates)
          dailyRecovery(states)
          set({ playerStates: states })
        }

        const day = g.day + 1
        const phase = day > 18 ? 'finished' : dayPhase(day)
        set({ day, phase, prepActionUsed: false, pendingEvent: null, pendingPostMatchEvents: [], pendingPressConf: null })
        if (phase === 'prep') get().maybeRollEvent()
        // auto-save after each day advance
        void get().saveToSlot(get().activeSlot)
      },

      simulateDayMatches: (skipFixtureId?: string) => {
        const g = get()
        if (!g.teamId) return
        const states = structuredClone(g.playerStates)
        const fixtures = structuredClone(g.fixtures)
        const rng = makeRng((g.careerSeed ^ (g.day * 104729)) >>> 0)

        for (const f of fixturesOfDay(fixtures, g.day)) {
          if (f.result || f.id === skipFixtureId || !f.homeId || !f.awayId) continue
          const home = buildSide(f.homeId, states, g.day, { isUser: false, oppId: f.awayId })
          const away = buildSide(f.awayId, states, g.day, { isUser: false, oppId: f.homeId })
          const knockout = !f.group
          const result = simulateMatch(home, away, knockout, (hashStr(f.id) ^ g.careerSeed) >>> 0)
          f.result = result
          const ctx = disciplineCtx(f)
          for (const [side, won, drawn] of [
            [home, result.homeGoals > result.awayGoals || (result.pens?.home ?? 0) > (result.pens?.away ?? 0), result.homeGoals === result.awayGoals && !result.pens],
            [away, result.awayGoals > result.homeGoals || (result.pens?.away ?? 0) > (result.pens?.home ?? 0), result.homeGoals === result.awayGoals && !result.pens],
          ] as const) {
            applyMatchOutcome(states, {
              teamId: side.teamId, won, drawn,
              appeared: side.starters, benchUnused: side.bench,
              scorers: result.scorers, events: result.events ?? [], day: g.day, rng,
              competitionId: ctx.competitionId, yellowThreshold: ctx.yellowThreshold,
            })
            tickSuspensions(states, getTeam(side.teamId).players.map((p) => p.id),
              new Set(side.starters.map((p) => p.id)))
          }
        }

        set({ playerStates: states, fixtures })
        get().progressBracket()
      },

      progressBracket: () => {
        const g = get()
        if (!g.teamId) return
        let fixtures = g.fixtures
        const has = (r: Round) => fixtures.some((f) => f.round === r)

        if (roundFinished(fixtures, 'G3') && !has('R32')) {
          fixtures = [...fixtures, ...buildR32(fixtures)]
          if (!fixtures.some((f) => f.round === 'R32' && (f.homeId === g.teamId || f.awayId === g.teamId)))
            set({ eliminated: true, eliminatedRound: 'G3' })
        }
        for (const r of KO_ORDER) {
          const nextRound: Round = r === 'SF' ? 'FINAL' : (KO_ORDER[KO_ORDER.indexOf(r) + 1] as Round)
          if (roundFinished(fixtures, r) && !fixtures.some((f) => f.round === nextRound)) {
            fixtures = [...fixtures, ...buildNextRound(fixtures, r)]
            const lost = fixtures.some(
              (f) => f.round === r && f.result &&
                (f.homeId === g.teamId || f.awayId === g.teamId) && matchWinner(f) !== g.teamId)
            const stillIn = fixtures.some(
              (f) => !f.result && (f.homeId === g.teamId || f.awayId === g.teamId))
            if (lost && !g.eliminated && !stillIn) set({ eliminated: true, eliminatedRound: r })
          }
        }
        set({ fixtures })

        // check firing condition once the tournament is fully complete
        const updated = get()
        if (updated.teamId && updated.eliminatedRound !== undefined) {
          const allDone = fixtures.every((f) => f.result || !f.homeId || !f.awayId)
          if (allDone && !updated.fired) {
            const team = getTeam(updated.teamId)
            const expLvl = expectationLevel(teamAvgOverall(team), updated.difficulty)
            const achLvl = achievementLevel(updated.eliminatedRound)
            if (achLvl <= expLvl - 2) set({ fired: true })
          }
        }
      },

      createUserMatch: () => {
        const g = get()
        if (!g.teamId || g.phase !== 'matchday' || g.eliminated) return null
        // Prefer new schedule over legacy fixtures
        const schedMatch = g.schedule.find(
          (m) => m.day === g.day && !m.result && !m.simulated &&
            (m.homeId === g.teamId || m.awayId === g.teamId))
        const fixture: Fixture | undefined = schedMatch
          ? (schedMatch as unknown as Fixture)
          : teamFixture(g.fixtures, g.teamId, g.day)
        if (!fixture || fixture.result || !fixture.homeId || !fixture.awayId) return null
        const states = structuredClone(g.playerStates)
        const isHome = fixture.homeId === g.teamId
        const oppId = isHome ? fixture.awayId : fixture.homeId
        const baseBonus = {
          att: g.trainingBoost.attack + g.trainingBoost.setpieces * 0.5,
          def: g.trainingBoost.defense + g.trainingBoost.setpieces * 0.5,
        }
        // difficulty modifier: easy +3, hard -5, normal 0
        const diffMod = g.difficulty === 'easy' ? 3 : g.difficulty === 'hard' ? -5 : 0
        // captain morale bonus
        const capId = g.lineup.captainId
        if (capId && states[capId]) {
          const capOvr = getTeam(g.teamId).players.find(p => p.id === capId)?.stats.overall ?? 70
          const capBonus = capOvr >= 85 ? 3 : capOvr >= 75 ? 2 : 1
          const ids = getTeam(g.teamId).players.map(p => p.id)
          applyPrepEffect(states, ids, { teamMorale: capBonus })
        }
        const userSide = buildSide(g.teamId, states, g.day, {
          isUser: true, lineup: g.lineup, tactics: g.tactics, oppId,
          familiarityScore: g.tacticalFamiliarity.score,
          regenPool: g.regenPool,
          playerRelationships: g.playerRelationships,
        })
        userSide.bonus = { att: baseBonus.att + diffMod, def: baseBonus.def + diffMod }
        const oppSide = buildSide(oppId, states, g.day, { isUser: false, oppId: g.teamId })
        const sim = new MatchSim(
          isHome ? userSide : oppSide,
          isHome ? oppSide : userSide,
          { knockout: !fixture.group, seed: (hashStr(fixture.id) ^ g.careerSeed) >>> 0 },
        )
        return { sim, fixture }
      },

      commitUserMatch: (sim, fixtureId) => {
        const g = get()
        if (!g.teamId) return
        const states = structuredClone(g.playerStates)
        const fixtures = structuredClone(g.fixtures)
        const schedule = structuredClone(g.schedule) as ScheduledMatch[]
        
        const f = fixtures.find((x) => x.id === fixtureId)
        const sm = schedule.find((x) => x.id === fixtureId)
        const targetMatch = f || sm
        if (!targetMatch) return

        const result = sim.result(true)
        targetMatch.result = result
        if (sm) {
          sm.result = result
          sm.simulated = true
        }

        // snapshot the user squad's suspension counters before applying the result
        const userPlayerIds = getTeam(g.teamId).players.map((p) => p.id)
        const suspBefore: Record<string, number> = {}
        for (const id of userPlayerIds) suspBefore[id] = states[id]?.suspendedMatches ?? 0
        // players already banned coming into this match (eligible to serve it)
        const bannedBefore = new Set(
          Object.keys(states).filter((id) => (states[id]?.suspendedMatches ?? 0) > 0),
        )

        const ctx = disciplineCtx(targetMatch as { competition?: string; matchType?: string; round?: string; group?: string })
        const rng = makeRng((g.careerSeed ^ hashStr(fixtureId)) >>> 0)
        let userServed: string[] = []
        for (const which of ['home', 'away'] as const) {
          const side = sim.side(which)
          const goalsFor = which === 'home' ? result.homeGoals : result.awayGoals
          const goalsAg = which === 'home' ? result.awayGoals : result.homeGoals
          const pensFor = which === 'home' ? result.pens?.home ?? 0 : result.pens?.away ?? 0
          const pensAg = which === 'home' ? result.pens?.away ?? 0 : result.pens?.home ?? 0
          const won = goalsFor > goalsAg || pensFor > pensAg
          const drawn = goalsFor === goalsAg && !result.pens
          applyMatchOutcome(states, {
            teamId: side.teamId, won, drawn,
            appeared: side.starters, benchUnused: side.bench,
            scorers: result.scorers, events: result.events ?? [], day: g.day, rng,
            competitionId: ctx.competitionId, yellowThreshold: ctx.yellowThreshold,
          })
          const served = tickSuspensions(states, getTeam(side.teamId).players.map((p) => p.id),
            new Set(side.starters.map((p) => p.id)), bannedBefore)
          if (side.teamId === g.teamId) userServed = served
        }

        // build inbox notices for the user's own players
        const nameOf = (id: string) => getTeam(g.teamId!).players.find((p) => p.id === id)?.name ?? id
        const newMsgs = buildMatchInbox(
          g.day, g.teamId, result.events ?? [], suspBefore, states, userServed, nameOf,
        )

        // Federation budget income based on user's match result
        const userHome = sim.home.teamId === g.teamId
        const userGoalsFor = userHome ? result.homeGoals : result.awayGoals
        const userGoalsAg  = userHome ? result.awayGoals : result.homeGoals
        const userPensFor  = userHome ? (result.pens?.home ?? 0) : (result.pens?.away ?? 0)
        const userPensAg   = userHome ? (result.pens?.away ?? 0) : (result.pens?.home ?? 0)
        const userWon  = userGoalsFor > userGoalsAg || userPensFor > userPensAg
        const isFriendly = (targetMatch as { matchType?: string }).matchType === 'friendly'
        const budgetGain  = userWon ? (isFriendly ? 100_000 : 150_000) : 0

        // After a WC 2026 group-stage match, try to fill the R32 bracket.
        // resolveWC2026Bracket is a no-op until all 72 group matches have results.
        const isWCGroup = sm?.windowId === 'WC_2026' && sm?.matchType === 'group'
        const resolvedSchedule = isWCGroup ? resolveWC2026Bracket(schedule) : schedule

        set({
          playerStates: states,
          fixtures,
          schedule: resolvedSchedule,
          inbox: [...newMsgs, ...(g.inbox ?? [])].slice(0, 40),
          trainingBoost: { attack: 0, defense: 0, setpieces: 0 },
          federationBudget: g.federationBudget + budgetGain,
        })

        // Career-mode WC elimination: bracket just filled → check if user advances
        if (isWCGroup && !g.eliminated && g.teamId) {
          const bracketFilled = resolvedSchedule.some(
            (m) => m.windowId === 'WC_2026' && m.round === 'R32' && m.homeId !== null,
          )
          if (bracketFilled) {
            const userInR32 = resolvedSchedule.some(
              (m) => m.round === 'R32' &&
                (m.homeId === g.teamId || m.awayId === g.teamId),
            )
            if (!userInR32) set({ eliminated: true, eliminatedRound: 'G3' })
          }
        }

        // Build post-match player interaction events
        const matchRng = makeRng((g.careerSeed ^ hashStr(fixtureId) ^ 0xBEEF) >>> 0)
        const isHomeTeam = targetMatch.homeId === g.teamId
        const postMatchEvs = buildPostMatchEvents(
          g.teamId, result, isHomeTeam, resolvedSchedule,
          g.lineup, states, g.playerRelationships, matchRng,
        )

        // Determine press conference category
        const userGF2 = isHomeTeam ? result.homeGoals : result.awayGoals
        const userGA2 = isHomeTeam ? result.awayGoals : result.homeGoals
        const goalDiff = userGF2 - userGA2
        const pressCategory: PressCategory =
          goalDiff >= 3 ? 'afterBigWin' :
          goalDiff > 0  ? 'afterWin'    :
          goalDiff < 0  ? 'afterLoss'   : 'afterDraw'
        const pressQRng = makeRng((g.careerSeed ^ hashStr(fixtureId) ^ 0xCAFE) >>> 0)
        const pressQIndices = pickPressQIndices(pressCategory, 3, pressQRng)
        const pendingPressConf: PressConfState = {
          category: pressCategory,
          questionIndices: pressQIndices,
          currentQ: 0,
          effects: { pressRelation: 0, teamMorale: 0, boardConfidence: 0 },
        }

        set({
          pendingPostMatchEvents: postMatchEvs,
          pendingPressConf,
        })

        // Update familiarity after match
        get().gainFamiliarityAfterMatch(fixtureId)
        g.simulateDayMatches(fixtureId)

        // Auto-unlock tournament squad when all user matches in the window are done
        const g2 = get()
        if (g2.tournamentSquadLocked && g2.activeTournamentId && g2.teamId) {
          const userMatches = g2.schedule.filter(
            (m) => m.windowId === g2.activeTournamentId &&
              (m.homeId === g2.teamId || m.awayId === g2.teamId),
          )
          if (userMatches.length > 0 && userMatches.every((m) => m.result)) {
            set({ tournamentSquadLocked: false, activeTournamentId: null })
          }
        }
      },

      // ---- aging / youth / federation ----

      runAnnualAging: (year) => {
        const g = get()
        if (!g.teamId) return
        if (g.lastAgingYear >= year) return  // already ran this year

        const rng = agingRng((g as typeof g & { careerSeed: number }).careerSeed, year)

        // Collect all players: static teams + regens
        const allPlayers: Array<{ id: string; birthDate: string; position: import('../data/types').Position; stats: { overall: number } }> = []
        for (const t of TEAMS) allPlayers.push(...t.players)
        for (const rp of Object.values(g.regenPool)) allPlayers.push(rp)

        const { decayUpdates, retiredIds } = runAgingPass(allPlayers, g.playerStates, year, rng)

        const states = structuredClone(g.playerStates)
        for (const [id, decay] of Object.entries(decayUpdates)) {
          if (!states[id]) states[id] = initialPlayerState()
          states[id].overallDecay = decay
        }

        // Apply retirement
        const newRetired: RetiredPlayer[] = [...g.retiredPlayers]
        for (const id of retiredIds) {
          if (!states[id]) continue
          states[id].retiredInternational = true
          // Find player info
          let p = g.regenPool[id] as import('../data/types').Player | undefined
          if (!p) {
            for (const t of TEAMS) { const found = t.players.find((x) => x.id === id); if (found) { p = found; break } }
          }
          if (p) {
            newRetired.push({
              id: p.id, name: p.name, teamId: g.teamId,
              position: p.position,
              caps: states[id].minutesPlayed > 0 ? Math.floor(states[id].minutesPlayed / 90) : p.caps,
              goals: states[id].goals + (p.goals ?? 0),
              yearRetired: year,
              peakOvr: p.stats.overall,
            })
            // Inbox notification only for user's team
            const userTeamPlayers = TEAMS.find((t) => t.id === g.teamId)?.players ?? []
            const isUserPlayer = userTeamPlayers.some((x) => x.id === id) || g.regenPool[id]?.teamId === g.teamId
            if (isUserPlayer) {
              const caps = Math.floor(states[id].minutesPlayed / 90) || p.caps
              const goals = states[id].goals + (p.goals ?? 0)
              const newInbox = makeInboxMessage(
                'news', g.day,
                'inbox.retiredTitle',
                'inbox.retiredBody',
                { player: p.name, caps, goals },
              )
              set({ inbox: [...g.inbox, newInbox] })
            }
          }
        }

        const teamId = g.teamId  // non-null (checked above)
        const hasAcademy = g.facilitiesOwned.includes('youth_academy')
        const hasScout = g.facilitiesOwned.includes('scouting_network')
        const userTeamData = TEAMS.find((t) => t.id === teamId)
        const conf = userTeamData?.confederation ?? 'UEFA'

        // Develop youthSquad players
        const newU17: YouthPlayer[] = []
        const newU21: YouthPlayer[] = []
        const readyForCallUp: YouthPlayer[] = []
        for (const p of g.youthSquad.u17) {
          const dev = developYouthPlayer(p, year, rng)
          const upd: YouthPlayer = { ...dev, potentialRevealed: hasScout || p.potentialRevealed }
          // Notify when a player turns exactly 16 (now eligible for senior call-up)
          if (ageInYear(p.birthDate, year) === 16) {
            set({ inbox: [...get().inbox, makeInboxMessage('news', g.day, 'youth.eligibleTitle', 'youth.eligibleBody', { player: upd.name })] })
          }
          if (upd.ageGroup === 'U21') newU21.push(upd)
          else newU17.push(upd)
        }
        for (const p of g.youthSquad.u21) {
          const dev = developYouthPlayer(p, year, rng)
          const upd: YouthPlayer = { ...dev, potentialRevealed: hasScout || p.potentialRevealed }
          if (upd.stats.overall >= 68 && ageInYear(upd.birthDate, year) >= 21) readyForCallUp.push(upd)
          newU21.push(upd)
        }

        // Generate regens for retired user players → add to U17
        if (userTeamData) {
          for (const retId of retiredIds) {
            const isUserPlayer = userTeamData.players.some((x) => x.id === retId) || g.regenPool[retId]?.teamId === teamId
            if (!isUserPlayer) continue
            const retiredP = userTeamData.players.find((x) => x.id === retId) ?? (g.regenPool[retId] as import('../data/types').Player | undefined)
            if (!retiredP) continue
            const regenCount = hasAcademy ? 2 : 1
            for (let ri = 0; ri < regenCount; ri++) {
              const newYouth = generateYouthPlayer({
                teamId, confederation: conf,
                position: retiredP.position,
                ageGroup: 'U17', currentYear: year,
                hasYouthAcademy: hasAcademy, scoutingNetworkOwned: hasScout, rng,
              })
              newU17.push(newYouth)
              states[newYouth.id] = initialPlayerState()
              set({ inbox: [...get().inbox, makeInboxMessage('news', g.day, 'youth.regenTitle', 'youth.regenBody',
                { player: newYouth.name, position: newYouth.position, age: ageInYear(newYouth.birthDate, year) })] })
            }
          }
        }

        // Develop senior regens
        const newRegenPool: Record<string, RegenPlayer> = {}
        for (const [rid, rp] of Object.entries(g.regenPool)) {
          const evolved = developRegenPlayer(rp, year, rng)
          newRegenPool[rid] = { ...evolved, squadLevel: rp.squadLevel, yearGenerated: rp.yearGenerated, teamId: rp.teamId } as RegenPlayer
          if (!states[rid]) states[rid] = initialPlayerState()
        }

        // Notify about call-up ready players
        for (const p of readyForCallUp.slice(0, 2)) {
          set({ inbox: [...get().inbox, makeInboxMessage('news', g.day, 'youth.readyTitle', 'youth.readyBody', { player: p.name, ovr: p.stats.overall })] })
        }

        set({
          playerStates: states,
          retiredPlayers: newRetired,
          youthSquad: { u17: newU17, u21: newU21 },
          regenPool: { ...g.regenPool, ...newRegenPool },
          lastAgingYear: year,
        })
      },

      callUpYouth: (playerId) => {
        const g = get()
        // Check youthSquad first (U17/U21), then regenPool
        const u17 = g.youthSquad.u17.find((p) => p.id === playerId)
        const u21 = g.youthSquad.u21.find((p) => p.id === playerId)
        const youthP = u17 ?? u21
        if (youthP) {
          // Promote from youthSquad to regenPool (senior)
          const asRegen: RegenPlayer = {
            ...youthP,
            squadLevel: 'senior',
            yearGenerated: youthP.yearGenerated,
            teamId: youthP.teamId,
            potential: youthP.potential,
            potentialStars: youthP.potentialStars,
            potentialRevealed: youthP.potentialRevealed,
          }
          const newU17 = g.youthSquad.u17.filter((p) => p.id !== playerId)
          const newU21 = g.youthSquad.u21.filter((p) => p.id !== playerId)
          const isFirstCallUp = (youthP.caps ?? 0) === 0
          set({
            youthSquad: { u17: newU17, u21: newU21 },
            regenPool: { ...g.regenPool, [playerId]: asRegen },
            inbox: [...g.inbox, makeInboxMessage(
              'news', g.day,
              isFirstCallUp ? 'youth.callUpFirstTitle' : 'youth.callUpTitle',
              isFirstCallUp ? 'youth.callUpFirstBody' : 'youth.callUpBody',
              { player: youthP.name },
            )],
          })
          return
        }
        // Fall back to existing regenPool logic
        const rp = g.regenPool[playerId]
        if (!rp) return
        const updated: RegenPlayer = { ...rp, squadLevel: 'senior' }
        set({
          regenPool: { ...g.regenPool, [playerId]: updated },
          inbox: [...g.inbox, makeInboxMessage('news', g.day, 'youth.callUpTitle', 'youth.callUpBody', { player: rp.name })],
        })
      },

      callUpPoolPlayer: (playerId) => {
        const g = get()
        if (!g.teamId) return
        if (g.calledUpPoolPlayers.includes(playerId)) return
        const team = getTeam(g.teamId)
        const player = team.extendedPool?.find((p) => p.id === playerId)
        if (!player) return
        const states = structuredClone(g.playerStates)
        if (!states[playerId]) states[playerId] = initialPlayerState()
        set({
          calledUpPoolPlayers: [...g.calledUpPoolPlayers, playerId],
          playerStates: states,
          inbox: [...g.inbox, makeInboxMessage('news', g.day, 'pool.callUpTitle', 'pool.callUpBody', { player: player.name })],
        })
      },

      releaseYouth: (playerId) => {
        const g = get()
        set({
          youthSquad: {
            u17: g.youthSquad.u17.filter((p) => p.id !== playerId),
            u21: g.youthSquad.u21.filter((p) => p.id !== playerId),
          },
        })
      },

      confirmMatchdaySquad: (playerIds) => {
        set({ selectedSquad: playerIds, squadSelectionNeeded: false })
      },

      lockTournamentSquad: (playerIds, windowId) => {
        const g = get()
        set({
          tournamentSquadLocked: true,
          lockedSquadIds: playerIds,
          activeTournamentId: windowId,
          selectedSquad: playerIds,
          squadSelectionNeeded: false,
          inbox: [...g.inbox, makeInboxMessage('board', g.day, 'inbox.squadLockTitle', 'inbox.squadLockBody', { tournamentKey: windowId, n: playerIds.length })],
        })
        void get().saveToSlot(g.activeSlot)
      },

      purchaseFacility: (type) => {
        const g = get()
        if (g.facilitiesOwned.includes(type)) return
        const cost = FACILITY_COST[type]
        if (g.federationBudget < cost) return
        set({
          federationBudget: g.federationBudget - cost,
          facilitiesOwned: [...g.facilitiesOwned, type],
          inbox: [...g.inbox, makeInboxMessage('board', g.day, 'inbox.facilityTitle', 'inbox.facilityBody', { facilityKey: `facility.${type}` })],
        })
      },

      addFederationBudget: (amount, _source) => {
        const g = get()
        set({ federationBudget: g.federationBudget + amount })
      },

      // ---- career tracking ----

      recordCareerEnd: (grade) => {
        const g = get()
        if (!g.teamId || !g.coach || g.careerEndRecorded) return
        const champ = champion(g.fixtures)
        const round: Round | 'CHAMP' = champ === g.teamId ? 'CHAMP' : (g.eliminatedRound ?? 'G3')
        const entry: CareerEntry = {
          tournamentId: g.tournamentId,
          teamId: g.teamId,
          coachName: g.coach.name,
          round,
          grade,
          fired: g.fired,
          completedAt: Date.now(),
        }
        set({ careerHistory: [...g.careerHistory, entry], careerEndRecorded: true })
        void get().saveToSlot(g.activeSlot)
      },

      // ---- slot management ----

      saveToSlot: async (n) => {
        const g = get()
        const payload: GameState = {
          version: g.version, teamId: g.teamId, tournamentId: g.tournamentId,
          day: g.day, phase: g.phase,
          fixtures: g.fixtures, playerStates: g.playerStates, lineup: g.lineup,
          tactics: g.tactics, trainingBoost: g.trainingBoost, prepActionUsed: g.prepActionUsed,
          pendingEvent: g.pendingEvent, eventLog: g.eventLog, inbox: g.inbox ?? [], pressRelation: g.pressRelation,
          eliminated: g.eliminated, eliminatedRound: g.eliminatedRound, lang: g.lang,
          coach: g.coach, difficulty: g.difficulty, activeSlot: n, music: g.music, sfx: g.sfx,
          fired: g.fired, careerHistory: g.careerHistory, careerEndRecorded: g.careerEndRecorded,
          // calendar fields
          currentDate: g.currentDate, currentWindowId: g.currentWindowId,
          calendarWindows: g.calendarWindows, schedule: g.schedule,
          qualGroups: g.qualGroups, nlGroups: g.nlGroups, worldNews: g.worldNews,
          competitionHistory: g.competitionHistory, nlLeague: g.nlLeague,
          wcQualState: g.wcQualState, euroQualState: g.euroQualState,
          trophyPass: g.trophyPass, warningCount: g.warningCount,
          tacticPresets: g.tacticPresets ?? [null, null, null],
          tacticalFamiliarity: g.tacticalFamiliarity,
          coachTacticsRating: g.coachTacticsRating,
          totalMatchesPlayed: g.totalMatchesPlayed,
          // v7
          lastAgingYear: g.lastAgingYear ?? 0,
          youthSquad: g.youthSquad ?? { u17: [], u21: [] },
          regenPool: g.regenPool ?? {},
          retiredPlayers: g.retiredPlayers ?? [],
          federationBudget: g.federationBudget ?? 0,
          facilitiesOwned: g.facilitiesOwned ?? [],
          selectedSquad: g.selectedSquad ?? [],
          squadSelectionNeeded: g.squadSelectionNeeded ?? false,
          calledUpPoolPlayers: g.calledUpPoolPlayers ?? [],
          tournamentSquadLocked: g.tournamentSquadLocked ?? false,
          lockedSquadIds: g.lockedSquadIds ?? [],
          activeTournamentId: g.activeTournamentId ?? null,
          playerRelationships: g.playerRelationships ?? {},
          mustStartNext: g.mustStartNext ?? [],
          pendingPostMatchEvents: g.pendingPostMatchEvents ?? [],
          pendingPressConf: g.pendingPressConf ?? null,
        }
        await Preferences.set({ key: `wc26-slot-${n}`, value: JSON.stringify({ state: payload, seed: (get() as Store & { careerSeed: number }).careerSeed }) })
        const meta: SaveSlotMeta = {
          slot: n, coachName: g.coach?.name ?? '?',
          teamId: g.teamId ?? '', day: g.day, savedAt: Date.now(),
        }
        await Preferences.set({ key: `wc26-slotmeta-${n}`, value: JSON.stringify(meta) })
        set({ activeSlot: n })
      },

      loadFromSlot: async (n) => {
        const { value } = await Preferences.get({ key: `wc26-slot-${n}` })
        if (!value) return false
        try {
          const parsed = JSON.parse(value) as { state: GameState; seed: number }
          set({ ...parsed.state, inbox: parsed.state.inbox ?? [], calledUpPoolPlayers: parsed.state.calledUpPoolPlayers ?? [], tournamentSquadLocked: parsed.state.tournamentSquadLocked ?? false, lockedSquadIds: parsed.state.lockedSquadIds ?? [], activeTournamentId: parsed.state.activeTournamentId ?? null, careerSeed: parsed.seed, activeSlot: n } as Partial<Store>)
          return true
        } catch {
          return false
        }
      },

      listSlots: async () => {
        return Promise.all(([0, 1, 2] as const).map(async (n) => {
          const { value } = await Preferences.get({ key: `wc26-slotmeta-${n}` })
          if (!value) return null
          try { return JSON.parse(value) as SaveSlotMeta }
          catch { return null }
        }))
      },

      deleteSlot: async (n) => {
        await Preferences.remove({ key: `wc26-slot-${n}` })
        await Preferences.remove({ key: `wc26-slotmeta-${n}` })
      },
    }),
    {
      name: 'wc26-career',
      version: SAVE_VERSION,
      storage: capStorage,
      migrate: (state) => {
        const base = emptyState()
        const s = state as Partial<GameState>
        return {
          ...base,
          ...s,
          inbox: (s as Partial<GameState>).inbox ?? [],
          lineup: {
            ...base.lineup,
            ...(s.lineup ?? {}),
            setpieces: { ...base.lineup.setpieces, ...(s.lineup?.setpieces ?? {}) },
            captainId: (s.lineup as Partial<typeof base.lineup>)?.captainId ?? null,
            viceCaptainId: (s.lineup as Partial<typeof base.lineup>)?.viceCaptainId ?? null,
          },
          tactics: {
            ...base.tactics,
            ...(s.tactics ?? {}),
            sliders: { ...base.tactics.sliders, ...(s.tactics?.sliders ?? {}) },
            setpieceOptions: { ...base.tactics.setpieceOptions, ...(s.tactics?.setpieceOptions ?? {}) },
          },
          tacticPresets: (s as Partial<GameState & { tacticPresets: (TacticPreset | null)[] }>).tacticPresets ?? [null, null, null],
          tacticalFamiliarity: (s as Partial<GameState>).tacticalFamiliarity ?? { ...DEFAULT_FAMILIARITY },
          coachTacticsRating: (s as Partial<GameState>).coachTacticsRating ?? 3,
          totalMatchesPlayed: (s as Partial<GameState>).totalMatchesPlayed ?? 0,
          tacticsTrainingUsedThisWindow: (s as Partial<GameState>).tacticsTrainingUsedThisWindow ?? false,
          calledUpPoolPlayers: (s as Partial<GameState>).calledUpPoolPlayers ?? [],
          tournamentSquadLocked: (s as Partial<GameState>).tournamentSquadLocked ?? false,
          lockedSquadIds: (s as Partial<GameState>).lockedSquadIds ?? [],
          activeTournamentId: (s as Partial<GameState>).activeTournamentId ?? null,
          playerRelationships: (s as Partial<GameState>).playerRelationships ?? {},
          mustStartNext: (s as Partial<GameState>).mustStartNext ?? [],
          pendingPostMatchEvents: (s as Partial<GameState>).pendingPostMatchEvents ?? [],
          pendingPressConf: (s as Partial<GameState>).pendingPressConf ?? null,
        }
      },
    },
  ),
)
