// Pre-computes a visual timeline for one match using footballsimulationengine.
// The library drives player positions and ball movement; our matchEngine still
// owns all game outcomes (goals, cards, results). The timeline is stored in a
// WeakMap so it is GC'd when the MatchSim is discarded.
import { initiateGame, playIteration, startSecondHalf } from 'footballsimulationengine'
import type { MatchSim } from './matchEngine'
import type { EnginePlayer } from './ratings'
import { FORMATIONS } from './formations'

const LIB_W = 680   // pitchWidth passed to the library
const LIB_H = 1050  // pitchHeight
const ITERS_PER_MIN = 5  // library iterations consumed per game-minute

export interface TimelineFrame {
  ballX: number
  ballY: number
  homePositions: Array<{ x: number; y: number }>  // indexed by starter slot
  awayPositions: Array<{ x: number; y: number }>
}

interface PitchTimelineEntry {
  frames: TimelineFrame[]
  homeIds: string[]   // sim.home.starters[i].id at build time
  awayIds: string[]
}

const timelineCache = new WeakMap<MatchSim, PitchTimelineEntry>()

// ── position helpers ──────────────────────────────────────────────────────────

function toLibPos(label: string, slotRole: string): string {
  const L = label.toUpperCase()
  if (slotRole === 'GK' || L === 'GK') return 'GK'
  if (L === 'RB' || L === 'RWB') return 'RB'
  if (L === 'LB' || L === 'LWB') return 'LB'
  if (L === 'CB') return 'CB'
  if (L === 'RM' || L === 'RW' || L === 'RAM' || L === 'RCM') return 'RM'
  if (L === 'LM' || L === 'LW' || L === 'LAM' || L === 'LCM') return 'LM'
  if (L === 'ST' || L === 'CF') return 'ST'
  return 'CM'  // DM, CDM, CAM, AM → CM
}

function clampSkill(v: number | null | undefined, fallback: number): string {
  return String(Math.round(Math.max(10, Math.min(99, v ?? fallback))))
}

/** Build a library-format player object from our EnginePlayer + formation slot. */
function makeLibPlayer(
  p: EnginePlayer,
  slotLabel: string,
  slotX: number,   // lateral % (0=left, 100=right)
  slotY: number,   // depth % (90=own goal, 10=attack)
  isKickOff: boolean,
): Record<string, unknown> {
  const s = p.stats
  const ov = s.overall
  const isGK = p.slotRole === 'GK'

  // Library Y axis = depth (kickoff team: 0 = their goal, 1050 = opponent goal).
  // slotY: 90 = own goal, 10 = opponent goal.
  // Map to the first half (y: 10..LIB_H/2-10) for kickoff team, mirror for second.
  const halfH = LIB_H / 2 - 20         // 505
  const depth = (1 - slotY / 100) * halfH + 10   // slotY=90→61, slotY=10→464
  const libY = isKickOff ? depth : LIB_H - depth
  const libX = (slotX / 100) * LIB_W

  return {
    name: p.id,
    position: toLibPos(slotLabel, p.slotRole),
    rating: String(ov),
    currentPOS: [Math.round(libX), Math.round(libY)],
    fitness: Math.round(p.fitness),
    height: 180,
    injured: false,
    skill: {
      passing:        clampSkill(s.passing,              ov * 0.85),
      shooting:       clampSkill(s.shooting,             ov * 0.85),
      tackling:       clampSkill(s.defending,            ov * 0.75),
      saving:         isGK ? clampSkill(p.gk?.reflexes ?? null, ov) : '15',
      agility:        clampSkill(s.dribbling ?? s.pace,  ov * 0.85),
      strength:       clampSkill(s.physical,             ov * 0.75),
      penalty_taking: clampSkill(s.shooting,             ov * 0.8),
      jumping:        clampSkill(s.physical,             ov * 0.7),
      control:        clampSkill(s.dribbling,            ov * 0.8),
    },
  }
}

/** Convert library [libX, libY] pixel position to our 0-100 percentage system.
 *  homeAttacksHighY: true when home team attacks toward libY=LIB_H in this half. */
function libToOur(
  libX: number, libY: number,
  homeAttacksHighY: boolean,
): { x: number; y: number } {
  const rawX = homeAttacksHighY
    ? (libY / LIB_H) * 100
    : ((LIB_H - libY) / LIB_H) * 100
  const rawY = (libX / LIB_W) * 100
  return {
    x: Math.max(1, Math.min(99, rawX)),
    y: Math.max(1, Math.min(99, rawY)),
  }
}

/** Extract one TimelineFrame from a live matchDetails snapshot. */
function extractFrame(
  md: Record<string, unknown>,
  homeIsKickOff: boolean,
  half: 1 | 2,
): TimelineFrame {
  // In the first half, kickoff team attacks toward libY=LIB_H.
  // After startSecondHalf() they switch ends.
  const homeAttacksHighY = homeIsKickOff ? half === 1 : half === 2

  const homeTeam = (homeIsKickOff ? md.kickOffTeam : md.secondTeam) as
    { players: Array<{ currentPOS: unknown }> }
  const awayTeam = (homeIsKickOff ? md.secondTeam : md.kickOffTeam) as
    { players: Array<{ currentPOS: unknown }> }

  const readPos = (p: { currentPOS: unknown }): { x: number; y: number } => {
    const pos = p.currentPOS
    const [lx = LIB_W / 2, ly = LIB_H / 2] =
      Array.isArray(pos) ? (pos as number[]) : []
    return libToOur(lx, ly, homeAttacksHighY)
  }

  const ball = (md.ball as { position?: unknown } | undefined)?.position
  const [bx = LIB_W / 2, by = LIB_H / 2] =
    Array.isArray(ball) ? (ball as number[]) : []
  const ballOur = libToOur(bx, by, homeAttacksHighY)

  return {
    ballX: ballOur.x,
    ballY: ballOur.y,
    homePositions: homeTeam.players.map(readPos),
    awayPositions: awayTeam.players.map(readPos),
  }
}

/** Build a formation-ordered list of library players for one side.
 *  isKickOff drives which end of the pitch they start in. */
function buildLibTeam(
  side: MatchSim['home'],
  isKickOff: boolean,
): { name: string; rating: number; players: Record<string, unknown>[] } {
  const slots = FORMATIONS[side.formation ?? '4-3-3'] ?? FORMATIONS['4-3-3']
  const used = new Set<number>()
  const players: Record<string, unknown>[] = []

  for (const p of side.starters) {
    let idx = slots.findIndex((s, i) => !used.has(i) && s.role === p.slotRole)
    if (idx < 0) idx = slots.findIndex((_s, i) => !used.has(i))
    if (idx < 0) idx = 0
    used.add(idx)
    players.push(makeLibPlayer(p, slots[idx].label, slots[idx].x, slots[idx].y, isKickOff))
  }

  const avgRating = Math.round(
    side.starters.reduce((a, p) => a + p.stats.overall, 0) / side.starters.length,
  )
  return { name: isKickOff ? 'home' : 'away', rating: avgRating, players }
}

// ── public API ────────────────────────────────────────────────────────────────

/** Pre-compute visual positions for all 90 minutes and store in the WeakMap.
 *  Must be awaited before the pitch is shown. Falls back silently on any error
 *  (matchMinute() will then return engine-derived positions instead). */
export async function buildPitchTimeline(sim: MatchSim): Promise<void> {
  try {
    const homeIds = sim.home.starters.map((p) => p.id)
    const awayIds = sim.away.starters.map((p) => p.id)
    const frames: TimelineFrame[] = []

    // Home team is provisionally placed in the "kickoff half" (y: 0-505).
    // After initiateGame we learn which team is actually the kickoff team.
    const team1 = buildLibTeam(sim.home, true)
    team1.name = 'home'
    const team2 = buildLibTeam(sim.away, false)
    team2.name = 'away'
    const pitch = { pitchWidth: LIB_W, pitchHeight: LIB_H, goalWidth: 90 }

    let md = (await initiateGame(team1, team2, pitch)) as Record<string, unknown>
    const homeIsKickOff =
      (md.kickOffTeam as { name: string }).name === 'home'

    // ── first half: minutes 1-45 ──
    for (let m = 1; m <= 45; m++) {
      for (let i = 0; i < ITERS_PER_MIN; i++) {
        md = (await playIteration(md)) as Record<string, unknown>
      }
      frames[m] = extractFrame(md, homeIsKickOff, 1)
      // Yield to the browser's paint cycle every 5 game-minutes so the loading
      // animation can update and the UI stays responsive.
      if (m % 5 === 0) await new Promise<void>((r) => setTimeout(r, 0))
    }

    // ── switch halves ──
    md = (await startSecondHalf(md)) as Record<string, unknown>

    // ── second half: minutes 46-90 ──
    for (let m = 46; m <= 90; m++) {
      for (let i = 0; i < ITERS_PER_MIN; i++) {
        md = (await playIteration(md)) as Record<string, unknown>
      }
      frames[m] = extractFrame(md, homeIsKickOff, 2)
      if (m % 5 === 0) await new Promise<void>((r) => setTimeout(r, 0))
    }

    timelineCache.set(sim, { frames, homeIds, awayIds })
  } catch {
    // Library error: leave cache empty → matchMinute() falls back to engine positions
  }
}

/** O(1) lookup of the cached timeline entry (undefined if not yet built). */
export function getTimeline(sim: MatchSim): PitchTimelineEntry | undefined {
  return timelineCache.get(sim)
}
