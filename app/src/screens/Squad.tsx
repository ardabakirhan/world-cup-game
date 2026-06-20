import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeam } from '../data/teams'
import type { Player, Position } from '../data/types'
import type { YouthPlayer } from '../domain/types'
import { useGame } from '../store/gameStore'
import { CondDot, OvrBadge } from '../components/ui'
import { Avatar } from '../components/Avatar'
import { ageInYear } from '../domain/player/aging'
import { CAREER_EPOCH } from '../domain/calendar/calendar.types'

const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }
type SortKey = 'number' | 'pos' | 'ovr' | 'form' | 'fitness'
type TabKey = 'senior' | 'u21' | 'u17' | 'pool'

const POS_COLOR: Record<Position, { bg: string; text: string }> = {
  GK: { bg: '#78350f', text: '#fcd34d' },
  DF: { bg: '#1e3a5f', text: '#60a5fa' },
  MF: { bg: '#14432a', text: '#4ade80' },
  FW: { bg: '#450a0a', text: '#f87171' },
}

function PosBadge({ pos }: { pos: Position }) {
  const c = POS_COLOR[pos] ?? { bg: 'var(--card2)', text: 'var(--muted)' }
  return (
    <span
      className="inline-block rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase leading-tight shrink-0"
      style={{ background: c.bg, color: c.text }}
    >
      {pos}
    </span>
  )
}

function PotStars({ p, revealed }: { p: YouthPlayer; revealed: boolean }) {
  if (revealed) {
    return <span className="font-bold" style={{ color: 'var(--accent)' }}>{p.potential}</span>
  }
  const s = p.potentialStars
  return <span className="text-[12px]" style={{ color: '#f59e0b' }}>{'★'.repeat(s)}{'☆'.repeat(5 - s)}</span>
}

export function Squad() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const callUpYouth = useGame((s) => s.callUpYouth)
  const releaseYouth = useGame((s) => s.releaseYouth)
  const callUpPoolPlayer = useGame((s) => s.callUpPoolPlayer)
  const team = getTeam(g.teamId!)
  const [sort, setSort] = useState<SortKey>('pos')
  const [tab, setTab] = useState<TabKey>('senior')

  const currentYear = g.currentDate?.year ?? CAREER_EPOCH.year
  const hasScout = g.facilitiesOwned.includes('scouting_network')

  // ── Senior: base squad (minus retired) + promoted regens ──────────────────
  const seniorBase = team.players.filter((p) => !g.playerStates[p.id]?.retiredInternational)
  const seniorRegens = Object.values(g.regenPool)
    .filter((r) => r.teamId === g.teamId && r.squadLevel === 'senior') as Player[]
  const allSenior: Player[] = [...seniorBase, ...seniorRegens]

  const sortPlayers = (list: Player[]) => [...list].sort((a, b) => {
    const sa = g.playerStates[a.id]
    const sb = g.playerStates[b.id]
    const effA = Math.max(40, a.stats.overall - (sa?.overallDecay ?? 0))
    const effB = Math.max(40, b.stats.overall - (sb?.overallDecay ?? 0))
    switch (sort) {
      case 'number':  return (a.number ?? 99) - (b.number ?? 99)
      case 'ovr':     return effB - effA
      case 'form':    return (sb?.form ?? 6) - (sa?.form ?? 6)
      case 'fitness': return (sb?.fitness ?? 100) - (sa?.fitness ?? 100)
      default: return POS_ORDER[a.position] - POS_ORDER[b.position] || effB - effA
    }
  })

  const flag = (p: Player) => {
    const st = g.playerStates[p.id]
    if (!st) return null
    if (st.injuredUntilDay > g.day) return <span className="text-[10px] text-[var(--bad)]">🚑</span>
    if (st.suspendedMatches > 0) return <span className="text-[10px] text-[var(--bad)]">🟥 {st.suspendedMatches}</span>
    if ((st.compYellows ?? 0) >= 2) return <span className="text-[10px] text-[var(--warn)]">🟨{st.compYellows}</span>
    return null
  }

  const hdr = (key: SortKey, label: string) => (
    <button onClick={() => setSort(key)} className="text-[11px] font-bold uppercase"
      style={{ color: sort === key ? 'var(--accent)' : 'var(--muted)' }}>
      {label}
    </button>
  )

  const poolPlayers = team.extendedPool ?? []
  const calledUpSet = new Set(g.calledUpPoolPlayers ?? [])

  const tabs: { key: TabKey; label: string; badge?: number }[] = [
    { key: 'senior', label: t('squad.tabSenior') },
    { key: 'u21', label: 'U21', badge: g.youthSquad.u21.length },
    { key: 'u17', label: 'U17', badge: g.youthSquad.u17.length },
    { key: 'pool', label: t('pool.tab'), badge: poolPlayers.length > 0 ? poolPlayers.length : undefined },
  ]

  return (
    <div className="p-4 pb-6">
      <h1 className="text-xl font-black mb-3">{t('squad.title')}</h1>

      {/* Tabs — pill style */}
      <div className="flex gap-1.5 mb-3">
        {tabs.map((tb) => (
          <button
            key={tb.key}
            className="relative rounded-full px-4 py-1.5 text-xs font-bold min-h-[36px]"
            style={tab === tb.key
              ? { background: 'var(--accent)', color: '#fff', boxShadow: '0 2px 8px color-mix(in srgb, var(--accent) 40%, transparent)' }
              : { background: 'var(--card2)', color: 'var(--muted)', border: '1px solid var(--line)' }}
            onClick={() => setTab(tb.key)}
          >
            {tb.label}
            {tb.badge != null && tb.badge > 0 && (
              <span
                className="absolute -top-1 -right-1 rounded-full px-1 text-[9px] font-black min-w-[16px] text-center"
                style={{ background: tab === tb.key ? '#fff' : 'var(--warn)', color: tab === tb.key ? 'var(--accent)' : '#000' }}
              >
                {tb.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── SENIOR ───────────────────────────────────────────────────────── */}
      {tab === 'senior' && (
        <div className="card">
          <div className="grid grid-cols-[2rem_2rem_1fr_2.6rem_2.4rem_2.4rem_2.6rem] items-center gap-1 px-2 py-2 border-b border-[var(--line)]">
            {hdr('number', t('squad.no'))}
            {hdr('pos', t('squad.pos'))}
            {hdr('ovr', t('squad.name'))}
            <span className="text-[11px] font-bold uppercase text-[var(--muted)] text-right">{t('common.ovr')}</span>
            {hdr('form', t('common.form').slice(0, 4))}
            <span className="text-[11px] font-bold uppercase text-[var(--muted)]">{t('common.morale').slice(0, 4)}</span>
            {hdr('fitness', t('common.fitness').slice(0, 4))}
          </div>
          {sortPlayers(allSenior).map((p) => {
            const st = g.playerStates[p.id]
            const effOvr = Math.max(40, p.stats.overall - (st?.overallDecay ?? 0))
            const fitness = st?.fitness ?? 100
            const fitColor = fitness > 70 ? 'var(--good)' : fitness > 40 ? 'var(--warn)' : 'var(--bad)'
            return (
              <button key={p.id}
                className="row-tap grid w-full grid-cols-[1.6rem_auto_1fr_2.6rem_2.4rem_2.4rem_2.4rem] items-center gap-1.5 px-2 py-2.5 border-b border-[var(--line)] last:border-0 text-left"
                onClick={() => nav(`/squad/${p.id}`)}>
                <span className="text-xs text-[var(--muted)] tabular-nums text-center">{p.number}</span>
                <PosBadge pos={p.primaryPosition as Position ?? p.position} />
                <span className="flex min-w-0 items-center gap-1.5">
                  <Avatar params={p.avatar} size={24} />
                  <span className="min-w-0 flex-1">
                    <span className="truncate text-sm font-bold flex items-center gap-1">
                      {p.name} {flag(p)}
                      {p.id === g.lineup.captainId && <span className="rounded px-1 text-[8px] font-extrabold" style={{ background: '#f59e0b', color: '#000' }}>C</span>}
                      {p.id === g.lineup.viceCaptainId && <span className="rounded px-1 text-[8px] font-extrabold" style={{ background: '#9ca3af', color: '#000' }}>VC</span>}
                    </span>
                    {/* fatigue bar */}
                    <div className="mt-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'var(--line)' }}>
                      <div style={{ width: `${fitness}%`, height: '100%', background: fitColor, transition: 'width 0.3s ease' }} />
                    </div>
                  </span>
                </span>
                <span className="text-right"><OvrBadge value={effOvr} estimated={p.estimated} /></span>
                <CondDot value={st?.form ?? 6} max={10} />
                <CondDot value={st?.morale ?? 7} max={10} />
                <CondDot value={fitness} max={100} />
              </button>
            )
          })}
        </div>
      )}

      {/* ── U21 / U17 ─────────────────────────────────────────────────────── */}
      {(tab === 'u21' || tab === 'u17') && (() => {
        const pool = tab === 'u21' ? g.youthSquad.u21 : g.youthSquad.u17
        if (pool.length === 0) {
          return (
            <div className="card p-6 text-center text-sm text-[var(--muted)]">
              {t('youth.noYouth')}
            </div>
          )
        }
        return (
          <div className="card">
            {[...pool]
              .sort((a, b) => b.stats.overall - a.stats.overall)
              .map((p: YouthPlayer) => {
                const age = ageInYear(p.birthDate, currentYear)
                const isReadyForCallUp = tab === 'u21' && p.stats.overall >= 68
                return (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-3 border-b border-[var(--line)] last:border-0">
                    <Avatar params={p.avatar} size={40} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm truncate">{p.name}</span>
                        <span
                          className="rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0"
                          style={{ background: '#1e3a5f', color: '#60a5fa' }}
                        >
                          {age}y
                        </span>
                        {isReadyForCallUp && (
                          <span className="pulse-dot text-[9px] rounded-full px-1.5 py-0.5 font-black shrink-0"
                            style={{ background: 'var(--accent)', color: '#fff' }}>
                            ★ {t('youth.callUpReady')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <PosBadge pos={p.position as Position} />
                        <span className="text-xs font-bold" style={{ color: isReadyForCallUp ? 'var(--accent)' : 'var(--text)' }}>
                          {t('common.ovr')} {p.stats.overall}
                        </span>
                        <span className="text-[13px] leading-none" style={{ color: '#f59e0b' }}>
                          <PotStars p={p} revealed={hasScout || p.potentialRevealed} />
                        </span>
                      </div>
                      <div className="text-[10px] text-[var(--muted)] mt-0.5">
                        {p.club} · {t(`youth.phase_${p.developmentPhase}`)}
                        {p.caps > 0 && ` · ${p.caps} ${t('squad.caps')}`}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      {tab === 'u21' && (
                        <button
                          className="text-xs px-3 py-1.5 rounded-lg font-bold min-h-[36px]"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                          onClick={() => callUpYouth(p.id)}
                        >
                          {t('youth.callUp')}
                        </button>
                      )}
                      <button
                        className="text-xs px-3 py-1.5 rounded-lg font-bold min-h-[36px]"
                        style={{ background: 'var(--card2)', color: 'var(--muted)', border: '1px solid var(--line)' }}
                        onClick={() => releaseYouth(p.id)}
                      >
                        {t('youth.release')}
                      </button>
                    </div>
                  </div>
                )
              })}
          </div>
        )
      })()}

      {/* ── POOL ─────────────────────────────────────────────────────────── */}
      {tab === 'pool' && (() => {
        if (poolPlayers.length === 0) {
          return (
            <div className="card p-6 text-center text-sm text-[var(--muted)]">
              {t('pool.empty')}
            </div>
          )
        }
        return (
          <div>
            <p className="text-[11px] text-[var(--muted)] mb-2 px-1">{t('pool.hint')}</p>
            <div className="card">
              {[...poolPlayers]
                .sort((a, b) => b.stats.overall - a.stats.overall)
                .map((p) => {
                  const age = ageInYear(p.birthDate, currentYear)
                  const isCalled = calledUpSet.has(p.id)
                  return (
                    <div key={p.id} className="flex items-center gap-3 px-3 py-3 border-b border-[var(--line)] last:border-0">
                      <Avatar params={p.avatar} size={40} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-sm truncate">{p.name}</span>
                          {isCalled && (
                            <span className="rounded px-1.5 py-0.5 text-[9px] font-extrabold shrink-0"
                              style={{ background: 'var(--good)', color: '#fff' }}>
                              {t('pool.called')}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <PosBadge pos={p.position as Position} />
                          <span className="text-xs font-bold">{t('common.ovr')} {p.stats.overall}</span>
                          <span className="text-[11px] text-[var(--muted)]">{age}y</span>
                        </div>
                        {p.club && <div className="text-[10px] text-[var(--muted)] mt-0.5">{p.club}</div>}
                      </div>
                      {!isCalled && (
                        <button
                          className="text-xs px-3 py-1.5 rounded-lg font-bold min-h-[36px] shrink-0"
                          style={{ background: 'var(--accent)', color: '#fff' }}
                          onClick={() => callUpPoolPlayer(p.id)}
                        >
                          {t('pool.callUp')}
                        </button>
                      )}
                    </div>
                  )
                })}
            </div>
          </div>
        )
      })()}

    </div>
  )
}
