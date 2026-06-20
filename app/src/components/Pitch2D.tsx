import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { getTeam } from '../data/teams'
import type { MatchSim } from '../domain/engine/matchEngine'
import { matchMinute } from '../domain/engine/pitch2d'

interface Props {
  sim: MatchSim
  minute: number
  homeColor: string
  awayColor: string
  tickMs: number
}

type XY = { x: number; y: number }

// Animation segment: from → to over dur ms. next is chained when this ends.
interface Seg { from: XY; to: XY; start: number; dur: number; next?: Seg }

const lerpN  = (a: number, b: number, t: number) => a + (b - a) * t
const easeOut = (t: number) => 1 - Math.pow(1 - t, 2.2)
const clampPct = (v: number) => Math.max(0, Math.min(100, v))

/** parse #rrggbb → relative luminance (0..1) */
function luminance(hex: string): number {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Ensure the away dots are visually distinct from the home dots and pitch. */
export function contrastColor(home: string, away: string): string {
  try {
    const lh = luminance(home)
    const la = luminance(away)
    if (Math.abs(lh - la) > 0.25) return away
    return lh > 0.5 ? '#15233b' : '#f1f5f9'
  } catch { return '#f1f5f9' }
}

/** Safe jersey-number lookup — never throws for regen/youth player IDs. */
function jerseyNumber(id: string, sim: MatchSim): number {
  // Try static teams data first
  for (const side of [sim.home, sim.away]) {
    const p = side.starters.find((x) => x.id === id) ?? side.bench.find((x) => x.id === id)
    if (p) {
      // EnginePlayer doesn't carry jersey number — look up from team roster
      try {
        const t = getTeam(side.teamId)
        return t.players.find((x) => x.id === id)?.number ?? 0
      } catch { return 0 }
    }
  }
  return 0
}

/**
 * Pure renderer — receives one fully-resolved MatchMinute from the match engine
 * and draws 22 dots + ball. Ball uses chained rAF segments so it never teleports:
 *   - Shot/cross: glide current→shooter (phase 1), then shooter→target (phase 2)
 *   - Open play / restart: glide current→new position
 * Players use a single CSS transition over tickMs.
 */
export function Pitch2D({ sim, minute, homeColor, awayColor, tickMs }: Props) {
  const rosterSig = sim.home.starters.length + sim.away.starters.length + sim.home.subsMade + sim.away.subsMade
  const mm = useMemo(() => matchMinute(sim, minute), [sim, minute, rosterSig])

  // Player CSS transition: full tick so they settle smoothly between minutes
  const playerTrans = `left ${tickMs}ms linear, top ${tickMs}ms linear`

  const dotColor = (team: 'home' | 'away') => (team === 'home' ? homeColor : awayColor)

  const goalFlash =
    mm.event === 'goal' || mm.event === 'wondergoal' || mm.event === 'free_kick_goal' ||
    (mm.event === 'penalty' && sim.events.some((e) => e.minute === minute && e.type === 'pen_goal'))
  const card = mm.event === 'yellow' ? '🟨' : mm.event === 'red' ? '🟥' : null
  const isShot = mm.action === 'shot' || mm.action === 'cross' || goalFlash || mm.event === 'penalty'

  // ── ball: imperatively driven by a rAF loop with chained segments ──────────
  const ballRef = useRef<HTMLDivElement>(null)
  const curPos  = useRef<XY>({ x: mm.ballX, y: mm.ballY })
  const seg     = useRef<Seg | null>(null)

  // Build new segment(s) whenever the minute changes.
  // useLayoutEffect fires synchronously after DOM commit, before browser paint —
  // guarantees the rAF loop picks up the new segment on the very next frame
  // with no stale-segment gap that would look like a snap/teleport.
  useLayoutEffect(() => {
    const origin: XY = { x: clampPct(mm.ballX), y: clampPct(mm.ballY) }
    const target = mm.ballTargetX != null
      ? { x: clampPct(mm.ballTargetX), y: clampPct(mm.ballTargetY ?? 50) }
      : null

    // halfTick: each shot phase occupies ≤35% of tick, min 40ms so it's always visible
    const halfTick = Math.max(40, tickMs * 0.35)

    if (isShot && target) {
      // Phase 1: glide from wherever ball was → shooter's feet (no snap)
      const dur1 = Math.min(halfTick, 200)
      // Phase 2: fly ball → target (goal mouth / save point)
      const dur2 = Math.min(halfTick, 200)
      const phase2: Seg = { from: origin, to: target, start: 0 /* set on chain */, dur: dur2 }
      const phase1: Seg = { from: { ...curPos.current }, to: origin, start: performance.now(), dur: dur1, next: phase2 }
      seg.current = phase1
    } else {
      // Open play / restart: smooth glide current → new position.
      // Cap at tickMs*0.80 so the ball always reaches its destination before the next minute.
      const dur = Math.max(60, Math.min(tickMs * 0.80, 400))
      seg.current = { from: { ...curPos.current }, to: origin, start: performance.now(), dur }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mm, tickMs, isShot])

  // Persistent rAF loop — runs for the lifetime of the component
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const s = seg.current
      const el = ballRef.current
      if (s && el) {
        const elapsed = performance.now() - s.start
        const t = s.dur <= 0 ? 1 : Math.min(1, elapsed / s.dur)
        const e = easeOut(t)
        const p: XY = { x: lerpN(s.from.x, s.to.x, e), y: lerpN(s.from.y, s.to.y, e) }
        curPos.current = p
        el.style.left = `${p.x}%`
        el.style.top  = `${p.y}%`
        // Chain to next segment when this one finishes
        if (t >= 1 && s.next) {
          seg.current = { ...s.next, start: performance.now() }
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border border-[var(--line)]"
      style={{ aspectRatio: '8 / 5', background: '#14361f' }}
    >
      <style>{`
        @keyframes ball-pulse {
          0%   { box-shadow: 0 0 0 0 rgba(250,250,210,0.7); }
          100% { box-shadow: 0 0 0 14px rgba(250,250,210,0); }
        }
        @keyframes goal-pop {
          0%   { transform: translate(-50%,-50%) scale(0.25); opacity: 0; }
          12%  { transform: translate(-50%,-50%) scale(1.3); opacity: 1; }
          22%  { transform: translate(-50%,-50%) scale(1.0); opacity: 1; }
          70%  { transform: translate(-50%,-50%) scale(1.0); opacity: 1; }
          100% { transform: translate(-50%,-50%) scale(0.9); opacity: 0; }
        }
      `}</style>
      <PitchLinesH />

      {/* players — drawn from engine coordinates, CSS-transitioned */}
      {Object.entries(mm.players).map(([id, d]) => {
        const num  = jerseyNumber(id, sim)
        const size = d.isGK ? 20 : 17
        const onBall = id === mm.actingPlayer
        return (
          <div
            key={id}
            className="absolute flex items-center justify-center rounded-full text-[9px] font-extrabold tabular-nums"
            style={{
              left:       `${d.x}%`,
              top:        `${d.y}%`,
              width:      size,
              height:     size,
              transform:  'translate(-50%, -50%)',
              transition: playerTrans,
              background: dotColor(d.team),
              color:      luminance(dotColor(d.team)) > 0.55 ? '#0d111a' : '#fff',
              border:     d.isGK ? '2px solid #fde047' : '1.5px solid rgba(0,0,0,0.35)',
              boxShadow:  onBall ? '0 0 0 2px #fafad2, 0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.5)',
              zIndex:     onBall ? 4 : d.isGK ? 3 : 2,
            }}
          >
            {num > 0 ? num : ''}
          </div>
        )
      })}

      {/* ball — position driven imperatively by rAF, never teleports */}
      <div
        ref={ballRef}
        className="absolute rounded-full"
        style={{
          left:      `${curPos.current.x}%`,
          top:       `${curPos.current.y}%`,
          width:     9,
          height:    9,
          transform: 'translate(-50%, -50%)',
          background: '#fafad2',
          border:    '1px solid rgba(0,0,0,0.4)',
          boxShadow: '0 0 6px 2px rgba(250,250,210,0.6)',
          zIndex:    5,
          animation: isShot ? 'ball-pulse 0.6s ease-out' : undefined,
        }}
      />

      {/* goal flash */}
      {goalFlash && (
        <div
          className="pointer-events-none absolute font-black"
          style={{
            left: '50%', top: '40%',
            opacity: 0,
            fontSize: 52, color: '#fff',
            letterSpacing: '0.06em',
            textShadow: '0 0 28px rgba(34,197,94,0.95), 0 0 70px rgba(34,197,94,0.35), 0 4px 16px rgba(0,0,0,0.95)',
            animation: 'goal-pop 1.6s cubic-bezier(0.16,1,0.3,1) both',
            zIndex: 6,
          }}
        >
          GOL!
        </div>
      )}

      {/* card icon */}
      {card && (
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${mm.ballX}%`, top: `${mm.ballY}%`,
            transform: 'translate(-50%,-140%)',
            fontSize: 18, zIndex: 7,
          }}
        >
          {card}
        </div>
      )}
    </div>
  )
}

/** Static pitch markings. viewBox 160×100. */
function PitchLinesH() {
  const line = 'rgba(255,255,255,0.22)'
  return (
    <svg viewBox="0 0 160 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x={i * 20} y="0" width="10" height="100" fill="rgba(255,255,255,0.025)" />
      ))}
      <rect x="3" y="4" width="154" height="92" fill="none" stroke={line} strokeWidth="0.7" />
      <line x1="80" y1="4" x2="80" y2="96" stroke={line} strokeWidth="0.7" />
      <circle cx="80" cy="50" r="13" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="80" cy="50" r="1" fill={line} />
      {/* left goal box */}
      <rect x="3" y="26" width="22" height="48" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="3" y="38" width="9" height="24" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="18" cy="50" r="1" fill={line} />
      {/* right goal box */}
      <rect x="135" y="26" width="22" height="48" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="148" y="38" width="9" height="24" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="142" cy="50" r="1" fill={line} />
    </svg>
  )
}
