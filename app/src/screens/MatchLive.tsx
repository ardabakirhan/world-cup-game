import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPlayer, getTeam } from '../data/teams'
import { Avatar } from '../components/Avatar'
import { useGame } from '../store/gameStore'
import type { MatchSim } from '../domain/engine/matchEngine'
import type { Position } from '../data/types'
import type { Fixture, MatchEvent, Tactics } from '../domain/types'
import { FORMATIONS } from '../domain/engine/formations'
import { positionPenalty, type EnginePlayer } from '../domain/engine/ratings'
import { positionFit } from '../domain/positions'
import { Modal, Segmented } from '../components/ui'
import { Flag } from '../components/Flag'
import { PitchView, type ChipData } from '../components/PitchView'
import { Pitch2D, contrastColor } from '../components/Pitch2D'
import { teamColor } from '../data/teamColors'
import { familiarityLabel } from './Tactics'

type Speed = 0 | 1 | 2 | 4 | 99

/** Safe getPlayer — never throws for regen/youth IDs. */
function tryGetPlayer(id: string) {
  try { return getPlayer(id) } catch { return null }
}

/** Get the team color for an event's team, different from user accent. */
function eventTeamColor(teamId: string, userTeamId: string, homeColor: string, awayColor: string, homeTeamId: string) {
  if (teamId === userTeamId) return 'var(--accent)'
  return teamId === homeTeamId ? homeColor : awayColor
}

/** Real milliseconds of wall-clock per game-minute at 1x speed.
 *  1 game-minute = 350ms → a full 90' match ≈ 31 real seconds at 1x. */
export const BASE_TICK_MS = 350

/** Real ms between game-minute steps for a given speed. All speeds are an exact
 *  divisor of BASE_TICK_MS so 1x/2x/4x are the *same match* at different
 *  fast-forward levels (1x=1200, 2x=600, 4x=300); ⏭ skips ~instantly. */
function tickInterval(speed: Speed): number {
  switch (speed) {
    case 4: return BASE_TICK_MS / 4 // 300ms
    case 2: return BASE_TICK_MS / 2 // 600ms
    case 99: return 60              // skip — instant fast-forward
    default: return BASE_TICK_MS    // 1x (and paused 0, where the value is unused)
  }
}

const EVENT_ICON: Record<string, string> = {
  goal: '⚽', pen_goal: '⚽', pen_miss: '❌', save: '🧤', miss: '💨', woodwork: '🥅',
  yellow: '🟨', red: '🟥', injury: '🚑', sub: '🔁', kickoff: '🟢', halftime: '⏸',
  fulltime: '🏁', et_start: '⏱', shootout: '🎯', armband: '🎽', gk_field: '🧤',
  big_chance_miss: '🔥', crowd_roar: '📣', wonder_shot: '🌟',
  offside: '🚩', free_kick_goal: '⚽', free_kick_saved: '🧤', weather_effect: '🌧️',
  foul_minor: '🟡', foul_dangerous: '⚠️',
}

// Events that appear in the commentary feed (free_kick raw event excluded — it's noise)
const FEED_EVENT_TYPES = new Set([
  'goal', 'pen_goal', 'pen_miss', 'save', 'miss', 'woodwork',
  'yellow', 'red', 'injury', 'sub', 'kickoff', 'halftime',
  'fulltime', 'et_start', 'shootout', 'armband', 'gk_field',
  'big_chance_miss', 'crowd_roar', 'wonder_shot',
  'offside', 'free_kick_goal', 'free_kick_saved', 'weather_effect',
])

const WEATHER_ICON: Record<string, string> = {
  perfect: '☀️', light_rain: '🌧️', heavy_rain: '⛈️', hot_humid: '🌡️', cold: '❄️',
}

function playGoalSfx() {
  try {
    const ctx = new AudioContext()
    const dur = 1.2
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
    const noise = ctx.createBufferSource()
    noise.buffer = buf
    const bp = ctx.createBiquadFilter()
    bp.type = 'bandpass'
    bp.frequency.value = 900
    bp.Q.value = 0.4
    const gn = ctx.createGain()
    gn.gain.setValueAtTime(0, ctx.currentTime)
    gn.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.07)
    gn.gain.setValueAtTime(0.35, ctx.currentTime + 0.5)
    gn.gain.linearRampToValueAtTime(0, ctx.currentTime + dur)
    noise.connect(bp); bp.connect(gn); gn.connect(ctx.destination)
    noise.start(); noise.stop(ctx.currentTime + dur + 0.1)
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(1400, ctx.currentTime)
    osc.frequency.linearRampToValueAtTime(1100, ctx.currentTime + 0.3)
    const og = ctx.createGain()
    og.gain.setValueAtTime(0.12, ctx.currentTime)
    og.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.35)
    osc.connect(og); og.connect(ctx.destination)
    osc.start(); osc.stop(ctx.currentTime + 0.4)
    setTimeout(() => ctx.close(), (dur + 0.5) * 1000)
  } catch { /* audio unavailable */ }
}

function playKeySfx() {
  try {
    const ctx = new AudioContext()
    ;[440, 554, 659].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.frequency.value = freq
      osc.type = 'triangle'
      const g = ctx.createGain()
      const t = ctx.currentTime + i * 0.06
      g.gain.setValueAtTime(0, t)
      g.gain.linearRampToValueAtTime(0.08, t + 0.02)
      g.gain.linearRampToValueAtTime(0, t + 0.35)
      osc.connect(g); g.connect(ctx.destination)
      osc.start(t); osc.stop(t + 0.4)
    })
    setTimeout(() => ctx.close(), 1000)
  } catch { /* audio unavailable */ }
}

export function MatchLive() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const created = useMemo(() => g.createUserMatch(), []) // eslint-disable-line react-hooks/exhaustive-deps
  const simRef = useRef<MatchSim | null>(created?.sim ?? null)
  const fixtureRef = useRef<Fixture | null>(created?.fixture ?? null)
  const [, forceRender] = useState(0)
  const [speed, setSpeed] = useState<Speed>(1)
  const [pitchOn, setPitchOn] = useState(true)
  const [showSubs, setShowSubs] = useState(false)
  const [showTactics, setShowTactics] = useState(false)
  const [committed, setCommitted] = useState(false)
  const [resultSaved, setResultSaved] = useState(false)
  const [toast, setToast] = useState<{ show: boolean; message: string }>({ show: false, message: '' })
  const feedRef = useRef<HTMLDivElement>(null)
  const goalPauseRef = useRef(0) // wall-clock ms until which playback holds on a goal
  const bigChancePauseRef = useRef(0) // wall-clock ms until which playback slows after big chance
  const prevSpeedRef = useRef<Speed>(1) // speed before big-chance auto-slow
  const [scoreFlash, setScoreFlash] = useState<'goal' | 'key' | null>(null)
  // Prevents minute advancement until the visual timeline is pre-computed.

  const sim = simRef.current
  const fixture = fixtureRef.current
  const userIsHome = !!sim && !!g.teamId && sim.home.teamId === g.teamId
  const userKey = userIsHome ? 'home' : 'away'

  useEffect(() => {
    if (!sim) {
      nav('/home')
      return
    }
    const tick = () => {
      if (speed === 0 || sim.awaitingUser) return
      if (document.hidden) return // pause progression when the tab/app is hidden
      // hold on a goal so the ball-in-net + "GOAL!" text are seen together
      if (Date.now() < goalPauseRef.current) return
      const breakPhase = sim.phase === 'HT' || sim.phase === 'BREAK_ET'
      if (breakPhase) {
        if (speed === 99) sim.resumeFromBreak() // skipping plays through breaks
        else return // wait for user to resume
      }
      if (sim.phase === 'DONE') return
      const steps = speed === 99 ? 15 : 1
      for (let i = 0; i < steps; i++) {
        if ((sim.phase as string) === 'DONE') break
        if (sim.phase === 'HT' || sim.phase === 'BREAK_ET') {
          if (speed === 99) sim.resumeFromBreak()
          else break
        }
        const stepEvents = sim.step()
        // goal: pause 1.5s so celebration + ball-in-net are both seen; play crowd sound
        if (speed !== 99 && stepEvents.some((e) => e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal')) {
          goalPauseRef.current = Date.now() + 1500
          if (useGame.getState().sfx) playGoalSfx()
          setScoreFlash('goal')
          setTimeout(() => setScoreFlash(null), 1500)
          forceRender((x) => x + 1)
          break
        }
        // key moment (big chance, red card, pen miss, wonder shot): drop to 1x + cue
        if (speed !== 99 && stepEvents.some((e) =>
          e.type === 'big_chance_miss' || e.type === 'red' ||
          e.type === 'pen_miss' || e.type === 'wonder_shot'
        )) {
          if (speed !== 1) {
            prevSpeedRef.current = speed
            setSpeed(1)
            setTimeout(() => setSpeed(prevSpeedRef.current), BASE_TICK_MS)
          }
          bigChancePauseRef.current = Date.now() + BASE_TICK_MS
          if (useGame.getState().sfx) playKeySfx()
          setScoreFlash('key')
          setTimeout(() => setScoreFlash(null), 800)
        }
        if (sim.awaitingUser && speed !== 99) break
        if (sim.awaitingUser && speed === 99) {
          // skipping: auto-sub like AI would
          const inj = sim.pendingInjury
          if (inj) {
            const side = sim.side(inj.side)
            const victim = side.starters.find((p) => p.id === inj.playerId)
            const sub = side.bench.find((b) => b.position === victim?.slotRole) ?? side.bench[0]
            if (victim && sub) sim.applySubs(inj.side, [{ outId: victim.id, inId: sub.id }])
            else sim.pendingInjury = null
          }
        }
      }
      forceRender((x) => x + 1)
    }
    const iv = setInterval(tick, tickInterval(speed))
    return () => clearInterval(iv)
  }, [sim, speed, nav])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight })
  })

  const done = sim?.phase === 'DONE'

  useEffect(() => {
    if (sim && done && !resultSaved && fixture) {
      setResultSaved(true)
      g.commitUserMatch(sim, fixture.id)
      
      // Get the absolute latest familiarity state from store to ensure we have the update
      const updatedFam = useGame.getState().tacticalFamiliarity
      const oldScore = updatedFam.lastMatchOldScore ?? 0
      const newScore = updatedFam.lastMatchNewScore ?? 0
      const diff = newScore - oldScore
      const diffSign = diff >= 0 ? `+${diff}` : `${diff}`
      const label = familiarityLabel(newScore, t)
      const message = `${t('tactics.famTitle')} ${diffSign}  →  ${label} (${newScore}/100)`
      
      setToast({ show: true, message })
      setTimeout(() => {
        setToast({ show: false, message: '' })
      }, 3000)
    }
  }, [sim, done, resultSaved, fixture, g, t])

  if (!sim || !fixture) return null

  const home = getTeam(sim.home.teamId)
  const away = getTeam(sim.away.teamId)
  const breakPhase = sim.phase === 'HT' || sim.phase === 'BREAK_ET'
  const userSide = sim.side(userKey)
  const injury = sim.pendingInjury
  const homeColor = teamColor(sim.home.teamId)
  const awayColor = contrastColor(homeColor, teamColor(sim.away.teamId))
  const homeMen = sim.home.starters.length
  const awayMen = sim.away.starters.length

  const finish = () => {
    if (committed) return
    setCommitted(true)
    if (!resultSaved) {
      g.commitUserMatch(sim, fixture.id)
    }
    g.advanceDay()
    nav('/home')
  }

  const eventText = (e: MatchEvent) => {
    if (e.type === 'red' && e.redCategory) {
      return t(`commentary.red_${e.redCategory}.v${e.variant}`, {
        player: e.playerName ?? '',
        defaultValue: t(`commentary.red.v${e.variant}`, { player: e.playerName ?? '' }),
      })
    }
    // Wonder goal
    if ((e.type === 'goal' || e.type === 'pen_goal') && e.wonderGoal) {
      return t(`commentary.goal_wonder.v${e.variant}`, { player: e.playerName ?? '' })
    }
    // Situational goal variants: late goal or equalizer use dedicated commentary pools
    if (e.type === 'goal') {
      if (e.late && e.equalizer) {
        return t(`commentary.goal_late.v${e.variant}`, {
          player: e.playerName ?? '',
          defaultValue: t(`commentary.goal.v${e.variant}`, { player: e.playerName ?? '' }),
        })
      }
      if (e.late) {
        return t(`commentary.goal_late.v${e.variant}`, {
          player: e.playerName ?? '',
          defaultValue: t(`commentary.goal.v${e.variant}`, { player: e.playerName ?? '' }),
        })
      }
      if (e.equalizer) {
        return t(`commentary.goal_equalizer.v${e.variant}`, {
          player: e.playerName ?? '',
          defaultValue: t(`commentary.goal.v${e.variant}`, { player: e.playerName ?? '' }),
        })
      }
    }
    return t(`commentary.${e.type}.v${e.variant}`, {
      player: e.playerName ?? '',
      player2: e.playerName2 ?? '',
    })
  }

  return (
    <div className="flex h-dvh flex-col">
      <style>{`
        @keyframes toast-fade-in {
          from { transform: translate(-50%, -20px); opacity: 0; }
          to { transform: translate(-50%, 0); opacity: 1; }
        }
        @keyframes score-goal-flash {
          0%   { box-shadow: 0 0 0 0 rgba(34,197,94,0); transform: scale(1); }
          18%  { box-shadow: 0 0 28px 10px rgba(34,197,94,0.75); transform: scale(1.1); }
          45%  { box-shadow: 0 0 18px 5px rgba(34,197,94,0.4); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); transform: scale(1); }
        }
        @keyframes score-key-flash {
          0%   { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
          30%  { box-shadow: 0 0 18px 6px rgba(245,158,11,0.65); }
          100% { box-shadow: 0 0 0 0 rgba(245,158,11,0); }
        }
      `}</style>
      {toast.show && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 9999,
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: '9999px',
            fontSize: '13px',
            fontWeight: 'bold',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.3), 0 8px 10px -6px rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            animation: 'toast-fade-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            transition: 'all 0.3s ease',
          }}
        >
          <span style={{ color: 'var(--accent)', fontSize: '16px' }}>⚡</span>
          <span>{toast.message}</span>
        </div>
      )}
      {/* score header */}
      <div className="card m-3 mb-0 p-3 text-center">
        {/* Competition label + live indicator */}
        <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-[var(--muted)]">
          <span style={{ letterSpacing: '0.12em' }}>{t(`rounds.${fixture.round}`)}</span>
          {!done && (
            <span className="flex items-center gap-1" style={{ color: '#22c55e' }}>
              <span className="pulse-dot inline-block h-1.5 w-1.5 rounded-full" style={{ background: '#22c55e' }} />
              {t('match.live')}
            </span>
          )}
          {sim.weather && sim.weather !== 'perfect' && (
            <span title={sim.weather}>{WEATHER_ICON[sim.weather]}</span>
          )}
          {!done && sim.minute >= 80 && (
            <span
              className="animate-pulse rounded-full px-2 py-0.5 text-[9px] font-black"
              style={{ background: 'rgba(220,38,38,0.2)', color: '#ef4444', border: '1px solid rgba(220,38,38,0.4)' }}
            >
              ⏱️ SON DAKİKALAR
            </span>
          )}
        </div>

        {/* Teams + score */}
        <div className="mt-2 flex items-center justify-center gap-2">
          {/* Home side */}
          <div className="flex flex-1 flex-col items-end gap-0.5 min-w-0">
            <Flag code={home.id} size={36} />
            <span className="text-sm font-extrabold truncate max-w-full leading-tight">{home.name}</span>
            {/* Home goal scorers */}
            <div className="flex flex-col items-end gap-0.5">
              {sim.events
                .filter(e => (e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal') && e.teamId === sim.home.teamId)
                .map((e, i) => (
                  <span key={i} className="text-[10px] text-[var(--muted)] leading-tight">
                    ⚽ {e.playerName?.split(' ').pop() ?? ''} <span className="font-mono">{e.minute}'</span>
                  </span>
                ))}
            </div>
          </div>

          {/* Score box */}
          <span
            className="rounded-xl bg-[var(--card2)] px-4 py-2.5 tabular-nums text-3xl font-black leading-none shrink-0 border border-[var(--line)]"
            style={scoreFlash ? {
              animation: scoreFlash === 'goal'
                ? 'score-goal-flash 1.5s ease-out forwards'
                : 'score-key-flash 0.8s ease-out forwards',
            } : undefined}
          >
            {sim.status.home.goals}
            <span className="text-[var(--muted)] mx-1.5 text-xl font-normal">–</span>
            {sim.status.away.goals}
          </span>

          {/* Away side */}
          <div className="flex flex-1 flex-col items-start gap-0.5 min-w-0">
            <Flag code={away.id} size={36} />
            <span className="text-sm font-extrabold truncate max-w-full leading-tight">{away.name}</span>
            {/* Away goal scorers */}
            <div className="flex flex-col items-start gap-0.5">
              {sim.events
                .filter(e => (e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal') && e.teamId === sim.away.teamId)
                .map((e, i) => (
                  <span key={i} className="text-[10px] text-[var(--muted)] leading-tight">
                    ⚽ {e.playerName?.split(' ').pop() ?? ''} <span className="font-mono">{e.minute}'</span>
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Momentum bar */}
        <MomentumBar sim={sim} homeColor={homeColor} awayColor={awayColor} homeId={home.id} awayId={away.id} />

        {/* Mini match stats strip */}
        <MatchStatsStrip sim={sim} homeColor={homeColor} awayColor={awayColor} />

        {/* Minute / phase */}
        <div className="mt-1 text-xs font-bold tabular-nums text-[var(--muted)]">
          {done
            ? sim.finishedAfter === 'PENS' && sim.pens
              ? `${t('match.ft')} · ${t('match.pens')} ${sim.pens.home}-${sim.pens.away}`
              : t('match.ft')
            : sim.phase === 'HT'
              ? t('match.ht')
              : sim.phase === 'BREAK_ET'
                ? t('match.et')
                : t('match.min', { n: sim.minute })}
        </div>
      </div>

      {/* red-card persistent banners */}
      {(homeMen < 11 || awayMen < 11) && (
        <div className="mx-3 mt-2 flex flex-col gap-1">
          {homeMen < 11 && (
            <div className="rounded-lg px-2 py-1 text-xs font-bold text-white" style={{ background: 'rgba(220,38,38,0.85)' }}>
              🟥 {t('match.tenMen', { n: homeMen, team: home.name })}
            </div>
          )}
          {awayMen < 11 && (
            <div className="rounded-lg px-2 py-1 text-xs font-bold text-white" style={{ background: 'rgba(220,38,38,0.85)' }}>
              🟥 {t('match.tenMen', { n: awayMen, team: away.name })}
            </div>
          )}
        </div>
      )}

      {/* 2D live pitch — goal celebration overlay variant (wonder/late goals) */}
      {pitchOn && (
        <div className="mx-3 mt-2 relative">
          {/* Simple mode toggle — subtle top-right icon */}
          <button
            onClick={() => setPitchOn(false)}
            className="absolute top-1.5 right-1.5 z-10 rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={{ background: 'rgba(0,0,0,0.45)', color: 'rgba(255,255,255,0.55)', backdropFilter: 'blur(4px)' }}
          >
            ⚙
          </button>
          <Pitch2D
            sim={sim}
            minute={sim.minute}
            homeColor={homeColor}
            awayColor={awayColor}
            tickMs={tickInterval(speed)}
          />
          {/* Goal celebration variant overlay */}
          {(() => {
            const lastGoalEv = [...sim.events].reverse().find((e) => (e.type === 'goal' || e.type === 'pen_goal') && e.minute === sim.minute)
            if (!lastGoalEv) return null
            if (lastGoalEv.wonderGoal) {
              return (
                <div className="pointer-events-none absolute inset-x-3 mt-2 flex items-center justify-center">
                  <span
                    className="animate-bounce rounded-full px-4 py-1 text-base font-black tracking-wider"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#db2777)', color: '#fff', boxShadow: '0 0 24px rgba(219,39,119,0.6)' }}
                  >🌟 İNANILMAZ GOL!</span>
                </div>
              )
            }
            if (lastGoalEv.late && lastGoalEv.equalizer) {
              return (
                <div className="pointer-events-none absolute inset-x-3 mt-2 flex items-center justify-center">
                  <span
                    className="animate-pulse rounded-full px-4 py-1 text-base font-black tracking-wider"
                    style={{ background: 'linear-gradient(135deg,#dc2626,#f97316)', color: '#fff', boxShadow: '0 0 20px rgba(220,38,38,0.6)' }}
                  >⚡ SON DAKİKA EŞİTLEYİCİ!</span>
                </div>
              )
            }
            if (lastGoalEv.late) {
              return (
                <div className="pointer-events-none absolute inset-x-3 mt-2 flex items-center justify-center">
                  <span
                    className="animate-pulse rounded-full px-4 py-1 text-sm font-black tracking-wider"
                    style={{ background: 'rgba(234,179,8,0.2)', color: '#eab308', border: '2px solid rgba(234,179,8,0.5)' }}
                  >🔥 GEÇ GOL!</span>
                </div>
              )
            }
            return null
          })()}
          <div className="mt-1.5 flex items-center justify-between text-[10px]">
            <span className="flex items-center gap-1.5" style={{ color: homeColor }}>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: homeColor }} />
              <span className="font-bold">{home.id.slice(0, 3).toUpperCase()}</span>
              <span className="text-[var(--muted)]">→</span>
            </span>
            <span className="text-[var(--muted)] tabular-nums font-bold text-[11px]">
              {sim.phase === 'HT' ? 'HT' : sim.phase === 'BREAK_ET' ? 'ET' : `${sim.minute}'`}
            </span>
            <span className="flex items-center gap-1.5" style={{ color: awayColor }}>
              <span className="text-[var(--muted)]">←</span>
              <span className="font-bold">{away.id.slice(0, 3).toUpperCase()}</span>
              <span className="inline-block h-2 w-2 rounded-full" style={{ background: awayColor }} />
            </span>
          </div>
        </div>
      )}

      {/* event feed */}
      <div ref={feedRef} className="mx-3 mt-2 flex-1 overflow-y-auto rounded-xl border border-[var(--line)] bg-[var(--card)]">
        {sim.events.filter((e) => FEED_EVENT_TYPES.has(e.type)).map((e, i) => {
          const isGoal     = e.type === 'goal' || e.type === 'pen_goal' || e.type === 'free_kick_goal'
          const isYellow   = e.type === 'yellow'
          const isRed      = e.type === 'red'
          const isAtmos    = e.type === 'crowd_roar' || e.type === 'weather_effect'
          const isBigChance = e.type === 'big_chance_miss'
          const isSub      = e.type === 'sub'
          const isInjury   = e.type === 'injury'
          // Only show avatar for events where player identity matters
          const showAvatar = isGoal || isSub || isInjury || e.type === 'yellow' || e.type === 'red'
          const player = showAvatar && e.playerId ? tryGetPlayer(e.playerId) : null
          // Team label color: green for goals, team's own color for others, muted for atmos
          const tColor = isGoal ? 'var(--good)'
            : e.teamId ? eventTeamColor(e.teamId, g.teamId ?? '', homeColor, awayColor, sim.home.teamId)
            : 'var(--muted)'
          const rowBg = isGoal      ? 'rgba(34,197,94,0.08)'
                      : isRed       ? 'rgba(239,68,68,0.09)'
                      : isYellow    ? 'rgba(245,158,11,0.07)'
                      : isBigChance ? 'rgba(249,115,22,0.07)'
                      : undefined
          return (
            <div
              key={i}
              className="flex items-start gap-2 border-b border-[var(--line)] px-3 last:border-0"
              style={{
                background: rowBg,
                paddingTop: isGoal ? 8 : 6,
                paddingBottom: isGoal ? 8 : 6,
              }}
            >
              {/* Minute */}
              <span className="w-8 shrink-0 text-right font-mono text-[11px] font-bold tabular-nums text-[var(--muted)] pt-0.5">
                {e.minute > 0 ? `${e.minute}'` : ''}
              </span>

              {/* Event icon */}
              <span className={`leading-none pt-0.5 shrink-0 ${isGoal ? 'text-xl' : 'text-base'}`}>
                {EVENT_ICON[e.type] ?? '•'}
              </span>

              {/* Avatar — only for meaningful events */}
              {player && (
                <span className="shrink-0 rounded-full overflow-hidden" style={{ width: 20, height: 20, background: 'var(--card2)', border: '1px solid var(--line)', marginTop: 2 }}>
                  <Avatar params={player.avatar} size={20} />
                </span>
              )}

              {/* Text */}
              <span className={`flex-1 text-sm leading-snug min-w-0 ${
                isGoal ? 'font-bold' : isAtmos ? 'italic text-[var(--muted)] text-xs' : ''
              }`}>
                {e.teamId && !isAtmos && (
                  <b style={{ color: tColor }}>
                    {e.teamId === g.teamId
                      ? (isGoal ? '⚽ ' : '')
                      : `${getTeam(e.teamId).name}: `}
                  </b>
                )}
                {eventText(e)}
              </span>
            </div>
          )
        })}
      </div>

      {/* injury prompt */}
      {injury && userSide.subsMade < 5 && (
        <div className="mx-3 mt-2 rounded-lg border border-[var(--bad)] bg-[var(--card)] p-2 text-sm text-[var(--bad)]">
          🚑 {t('match.injuryPrompt', { player: userSide.starters.find((p) => p.id === injury.playerId)?.name ?? '' })}
        </div>
      )}

      {/* controls */}
      <div className="m-3 flex flex-col gap-2">
        {!done && !breakPhase && (
          <div className="flex gap-1.5">
            <button
              className="flex-1 py-2.5 text-sm font-bold"
              style={speed === 0
                ? { background: 'var(--accent)', color: '#fff', borderRadius: 10 }
                : { background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10 }}
              onClick={() => setSpeed(speed === 0 ? 1 : 0)}
            >
              {speed === 0 ? '▶' : '⏸'}
            </button>
            {([1, 2, 4] as const).map((s) => (
              <button
                key={s}
                className="flex-1 py-2.5 text-sm font-bold"
                style={speed === s
                  ? { background: 'var(--accent)', color: '#fff', borderRadius: 10 }
                  : { background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10 }}
                onClick={() => setSpeed(s)}
              >
                {s}×
              </button>
            ))}
            <button
              className="flex-1 py-2.5 text-sm font-bold"
              style={speed === 99
                ? { background: 'var(--accent)', color: '#fff', borderRadius: 10 }
                : { background: 'transparent', border: '1px solid var(--line)', color: 'var(--muted)', borderRadius: 10 }}
              onClick={() => setSpeed(99)}
            >
              ⏭
            </button>
          </div>
        )}
        {!done && (
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => { setSpeed(0); setShowSubs(true) }}>
              🔁 {t('match.subs')} ({t('match.subsLeft', { n: 5 - userSide.subsMade })})
            </button>
            <button className="btn-ghost flex-1" onClick={() => { setSpeed(0); setShowTactics(true) }}>
              📋 {t('match.tacticsBtn')}
            </button>
          </div>
        )}
        {!pitchOn && (
          <button className="btn-ghost text-xs py-1.5" onClick={() => setPitchOn(true)}>
            🗺️ {t('match.pitchMode')}
          </button>
        )}
        {breakPhase && (
          <button className="btn" onClick={() => { sim.resumeFromBreak(); setSpeed(1); forceRender((x) => x + 1) }}>
            ▶ {t('match.continueMatch')}
          </button>
        )}
        {done && (
          <button className="btn" onClick={finish}>🏁 {t('match.finish')}</button>
        )}
      </div>

      <Modal open={showSubs} onClose={() => setShowSubs(false)}>
        <SubPanel
          sim={sim}
          userKey={userKey}
          formation={g.lineup.formation}
          onClose={() => { setShowSubs(false); forceRender((x) => x + 1) }}
        />
      </Modal>
      <Modal open={showTactics} onClose={() => setShowTactics(false)}>
        <TacticPanel
          tactics={userSide.tactics}
          onChange={(tc) => { sim.setTactics(userKey, tc); forceRender((x) => x + 1) }}
        />
      </Modal>
    </div>
  )
}

/** Horizontal stats strip: shots | corners | fouls for each team. */
function MatchStatsStrip({ sim, homeColor, awayColor }: { sim: MatchSim; homeColor: string; awayColor: string }) {
  const ms = (sim as any).matchStats as Record<'home'|'away', {shots:number; shotsOnTarget:number; corners:number; fouls:number; offsides:number}> | undefined
  if (!ms) return null
  const rows: { label: string; home: number; away: number }[] = [
    { label: '🎯', home: ms.home.shotsOnTarget, away: ms.away.shotsOnTarget },
    { label: '⚽', home: ms.home.shots, away: ms.away.shots },
    { label: '🚩', home: ms.home.offsides, away: ms.away.offsides },
    { label: '⚠️', home: ms.home.fouls, away: ms.away.fouls },
  ]
  return (
    <div className="mt-2 flex flex-col gap-0.5">
      {rows.map((r) => (
        <div key={r.label} className="grid grid-cols-[2rem_1fr_1.5rem_1fr_2rem] items-center gap-1">
          <span className="text-right tabular-nums text-xs font-bold" style={{ color: homeColor }}>{r.home}</span>
          <div className="h-1 rounded-full overflow-hidden flex justify-end" style={{ background: 'var(--line)' }}>
            <div style={{ width: `${r.home + r.away === 0 ? 50 : Math.round(r.home / (r.home + r.away) * 100)}%`, background: homeColor, height: '100%' }} />
          </div>
          <span className="text-center text-[9px] text-[var(--muted)]">{r.label}</span>
          <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
            <div style={{ width: `${r.home + r.away === 0 ? 50 : Math.round(r.away / (r.home + r.away) * 100)}%`, background: awayColor, height: '100%' }} />
          </div>
          <span className="text-left tabular-nums text-xs font-bold" style={{ color: awayColor }}>{r.away}</span>
        </div>
      ))}
    </div>
  )
}

/** Momentum bar showing home vs away pressure with gradient + team codes. */
function MomentumBar({
  sim, homeColor, awayColor, homeId, awayId,
}: {
  sim: MatchSim; homeColor: string; awayColor: string; homeId: string; awayId: string
}) {
  const homeShare = Math.max(0.10, Math.min(0.90, 0.5 + sim.momentum / 200))
  const homePct = Math.round(homeShare * 100)
  const awayPct = 100 - homePct
  return (
    <div className="mt-2.5 flex items-center gap-2 text-[10px]">
      <span className="shrink-0 font-black uppercase tracking-wide tabular-nums w-8 text-right" style={{ color: homeColor }}>
        {homeId.slice(0, 3).toUpperCase()}
      </span>
      <div className="relative flex-1 overflow-hidden rounded-full" style={{ height: 6, background: 'var(--card2)' }}>
        {/* gradient fill */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `linear-gradient(to right, ${homeColor}cc, ${awayColor}cc)`,
            transition: 'clip-path 0.6s ease',
            clipPath: `inset(0 ${awayPct}% 0 0 round 9999px)`,
          }}
        />
        {/* center marker */}
        <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2" style={{ background: 'var(--line)' }} />
      </div>
      <span className="shrink-0 font-black uppercase tracking-wide tabular-nums w-8 text-left" style={{ color: awayColor }}>
        {awayId.slice(0, 3).toUpperCase()}
      </span>
    </div>
  )
}

function SubPanel(props: {
  sim: MatchSim
  userKey: 'home' | 'away'
  formation: string
  onClose: () => void
}) {
  const { t } = useTranslation()
  const [, bump] = useState(0)
  const rerender = () => bump((x) => x + 1)
  
  const [pendingSubs, setPendingSubs] = useState<Record<string, string>>({})
  
  const side = props.sim.side(props.userKey)
  const slots = FORMATIONS[props.formation]
  const isBreak = props.sim.phase === 'HT' || props.sim.phase === 'BREAK_ET'
  const windowsLeft = 3 - side.windowsUsed

  const chipOf = (p: EnginePlayer, slotRole: Position | null, slotLabel?: string): ChipData => ({
    id: p.id,
    number: 0,
    label: p.name.split(' ').pop() ?? p.name,
    ovr: p.stats.overall,
    effOvr: Math.round(p.stats.overall * positionPenalty(p.position, slotRole ?? p.position)),
    icons:
      (props.sim.pendingInjury?.playerId === p.id ? '🚑' : '') +
      (p.fitness < 55 ? '🟡' : ''),
    avatar: getPlayer(p.id).avatar,
    posFit: slotLabel ? positionFit(slotLabel, getPlayer(p.id)) : undefined,
  })

  const used = new Set<string>()
  const basePitchPlayers: (EnginePlayer | null)[] = slots.map((slot) => {
    const p = side.starters.find((s) => !used.has(s.id) && s.slotRole === slot.role)
    if (p) used.add(p.id)
    return p ?? null
  })
  for (const s of side.starters) {
    if (used.has(s.id)) continue
    const free = basePitchPlayers.findIndex((x) => x === null)
    if (free >= 0) {
      basePitchPlayers[free] = s
      used.add(s.id)
    }
  }

  const pitchPlayers = basePitchPlayers.map((p) => {
    if (p && pendingSubs[p.id]) {
      const subbedOn = side.bench.find(b => b.id === pendingSubs[p.id])
      return subbedOn ?? p
    }
    return p
  })

  const pitch = pitchPlayers.map((p, i) => (p ? chipOf(p, slots[i].role, slots[i].label) : null))
  
  const pendingInIds = new Set(Object.values(pendingSubs))
  const bench = side.bench
    .filter((p) => !pendingInIds.has(p.id))
    .map((p) => chipOf(p, null))

  const netSubsCount = Object.keys(pendingSubs).length

  return (
    <div>
      <h2 className="text-lg font-extrabold">🔁 {t('match.subs')}</h2>
      <p className="text-xs text-[var(--muted)]">
        {t('match.subsLeft', { n: 5 - side.subsMade - netSubsCount })} · {t('match.windowsLeft', { n: windowsLeft })}
        {!isBreak && windowsLeft <= 0 && !side.windowOpen ? ' ⚠️' : ''}
      </p>
      <div className="mt-2">
        <PitchView
          slots={slots}
          pitch={pitch}
          bench={bench}
          benchTitle={t('tactics.bench')}
          onSwapPitch={(i, j) => {
            const a = pitchPlayers[i]
            const b = pitchPlayers[j]
            if (a && b) {
              const tmp = a.slotRole
              a.slotRole = b.slotRole
              b.slotRole = tmp
            } else if (a) {
              a.slotRole = slots[j].role
            } else if (b) {
              b.slotRole = slots[i].role
            }
            props.sim.refresh(props.userKey)
            rerender()
          }}
          onBenchToPitch={(benchId, slotIdx) => {
            const baseOut = basePitchPlayers[slotIdx]
            if (!baseOut) return 
            if (side.subsMade + netSubsCount >= 5 && !pendingSubs[baseOut.id]) return
            setPendingSubs(prev => ({ ...prev, [baseOut.id]: benchId }))
          }}
          onPitchToBench={(slotIdx) => {
            const baseOut = basePitchPlayers[slotIdx]
            if (!baseOut) return
            setPendingSubs(prev => {
              const next = { ...prev }
              delete next[baseOut.id]
              return next
            })
          }}
        />
      </div>
      <div className="mt-4 flex gap-3">
        <button className="btn-ghost flex-1 py-2" onClick={props.onClose}>
          {t('common.cancel', 'İptal')}
        </button>
        <button 
          className="btn-primary flex-1 py-2" 
          onClick={() => {
            const reqs = Object.entries(pendingSubs).map(([outId, inId]) => ({ outId, inId }))
            if (reqs.length > 0) {
              props.sim.applySubs(props.userKey, reqs)
            }
            props.onClose()
          }}
        >
          {t('common.ok', 'Onayla')}
        </button>
      </div>
    </div>
  )
}

function TacticPanel(props: { tactics: Tactics; onChange: (t: Tactics) => void }) {
  const { t } = useTranslation()
  const tc = props.tactics
  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">📋 {t('match.tacticsBtn')}</h2>
      <Segmented
        options={[
          { value: 'defensive', label: t('tactics.defensive') },
          { value: 'balanced', label: t('tactics.balanced') },
          { value: 'attacking', label: t('tactics.attacking') },
        ]}
        value={tc.style}
        onChange={(style) => props.onChange({ ...tc, style })}
      />
      <Segmented
        options={[
          { value: 'low', label: `${t('tactics.press')}: ${t('tactics.low')}` },
          { value: 'mid', label: t('tactics.mid') },
          { value: 'high', label: t('tactics.high') },
        ]}
        value={tc.press}
        onChange={(press) => props.onChange({ ...tc, press })}
      />
      <Segmented
        options={[
          { value: 'slow', label: `${t('tactics.tempo')}: ${t('tactics.slow')}` },
          { value: 'normal', label: t('tactics.normal') },
          { value: 'fast', label: t('tactics.fast') },
        ]}
        value={tc.tempo}
        onChange={(tempo) => props.onChange({ ...tc, tempo })}
      />
    </div>
  )
}
