import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeam } from '../data/teams'
import type { Player, Position } from '../data/types'
import type { YouthPlayer } from '../domain/types'
import { useGame } from '../store/gameStore'
import { Avatar } from '../components/Avatar'
import { OvrBadge } from '../components/ui'
import { ageInYear } from '../domain/player/aging'
import { CAREER_EPOCH } from '../domain/calendar/calendar.types'

const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }
const MIN_BY_POS: Record<Position, number> = { GK: 3, DF: 8, MF: 8, FW: 6 }

type FilterKey = 'all' | 'GK' | 'DF' | 'MF' | 'FW' | 'youth' | 'pool'

interface CandidatePlayer extends Player {
  isYouth?: boolean
  isPool?: boolean
  potentialStars?: 1 | 2 | 3 | 4 | 5
  potentialRevealed?: boolean
}

function StarDisplay({ stars, revealed, potential }: { stars: number; revealed: boolean; potential: number }) {
  if (revealed) return <span className="text-xs font-bold" style={{ color: 'var(--accent)' }}>{potential}</span>
  return (
    <span className="text-[11px]" style={{ color: '#f59e0b' }}>
      {'★'.repeat(stars)}{'☆'.repeat(5 - stars)}
    </span>
  )
}

export function SquadSelection() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const confirmMatchdaySquad = useGame((s) => s.confirmMatchdaySquad)
  const callUpYouth = useGame((s) => s.callUpYouth)
  const callUpPoolPlayer = useGame((s) => s.callUpPoolPlayer)

  const [selected, setSelected] = useState<Set<string>>(
    new Set(g.selectedSquad.length === 26 ? g.selectedSquad : []),
  )
  const [filter, setFilter] = useState<FilterKey>('all')

  const currentYear = g.currentDate?.year ?? CAREER_EPOCH.year
  const team = getTeam(g.teamId!)

  // ── Candidate pools ────────────────────────────────────────────────────────
  const seniors: CandidatePlayer[] = team.players.filter(
    (p) => !g.playerStates[p.id]?.retiredInternational,
  )
  const seniorRegens: CandidatePlayer[] = Object.values(g.regenPool)
    .filter((r) => r.teamId === g.teamId && r.squadLevel === 'senior')
    .map((r) => ({ ...r, isYouth: false, potentialStars: r.potentialStars, potentialRevealed: r.potentialRevealed }))

  // U21 (17-21) all callable; U17 players aged 16 also callable
  const u21Eligible: CandidatePlayer[] = [
    ...g.youthSquad.u21,
    ...g.youthSquad.u17.filter((p) => ageInYear(p.birthDate, currentYear) >= 16),
  ].map((p: YouthPlayer) => ({
    ...p,
    isYouth: true,
    potentialStars: p.potentialStars,
    potentialRevealed: p.potentialRevealed,
  }))

  // U17 players under 16 — shown in youth tab but not selectable
  const u17NotCallable: CandidatePlayer[] = g.youthSquad.u17
    .filter((p) => ageInYear(p.birthDate, currentYear) < 16)
    .map((p: YouthPlayer) => ({
      ...p,
      isYouth: true,
      potentialStars: p.potentialStars,
      potentialRevealed: p.potentialRevealed,
    }))

  // All pool players from extendedPool
  const allPoolCandidates: CandidatePlayer[] = (team.extendedPool ?? []).map((p) => ({
    ...p,
    isPool: true,
  }))
  const calledUpSet = new Set(g.calledUpPoolPlayers ?? [])

  // Main selectable candidates: seniors + regens + eligible youth + called-up pool players
  const allCandidates: CandidatePlayer[] = [
    ...seniors,
    ...seniorRegens,
    ...u21Eligible,
    ...allPoolCandidates.filter((p) => calledUpSet.has(p.id)),
  ]

  const filtered = useMemo(() => {
    if (filter === 'pool') {
      return [...allPoolCandidates].sort((a, b) => b.stats.overall - a.stats.overall)
    }
    if (filter === 'youth') {
      const callable = allCandidates.filter((p) => p.isYouth)
      // Append non-callable U17 at the bottom
      return [...callable.sort((a, b) => b.stats.overall - a.stats.overall), ...u17NotCallable]
    }
    let pool = allCandidates
    if (filter !== 'all') pool = pool.filter((p) => p.position === filter)
    return pool.sort((a, b) => {
      if (a.isYouth !== b.isYouth) return a.isYouth ? 1 : -1
      if (a.isPool !== b.isPool) return a.isPool ? 1 : -1
      return POS_ORDER[a.position] - POS_ORDER[b.position] || b.stats.overall - a.stats.overall
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, allCandidates.length, allPoolCandidates.length, u17NotCallable.length, calledUpSet.size])

  const toggle = (id: string) => {
    // Find player in main list OR pool list
    const player = allCandidates.find((p) => p.id === id)
      ?? allPoolCandidates.find((p) => p.id === id)
    if (!player) return

    if (player.isYouth && !g.regenPool[id]) {
      callUpYouth(id)
    }
    if (player.isPool && !calledUpSet.has(id)) {
      callUpPoolPlayer(id)
    }

    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 26) next.add(id)
      return next
    })
  }

  // Pos count validation
  const posCounts = { GK: 0, DF: 0, MF: 0, FW: 0 }
  for (const id of selected) {
    const p = allCandidates.find((x) => x.id === id)
    if (p) posCounts[p.position]++
  }
  const posWarning = (Object.entries(MIN_BY_POS) as [Position, number][]).find(
    ([pos, min]) => posCounts[pos] < min,
  )

  const canConfirm = selected.size === 26 && !posWarning

  const confirm = () => {
    if (!canConfirm) return
    confirmMatchdaySquad([...selected])
    nav('/home')
  }

  const FILTERS: { key: FilterKey; label: string }[] = [
    { key: 'all', label: t('common.all') },
    { key: 'GK', label: 'GK' },
    { key: 'DF', label: 'DF' },
    { key: 'MF', label: 'MF' },
    { key: 'FW', label: 'FW' },
    { key: 'youth', label: t('squad.tabU21') },
    { key: 'pool', label: t('pool.tab') },
  ]

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <div className="card m-3 mb-0 p-3">
        <h1 className="text-base font-black">{t('squadSel.title')}</h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">{t('squadSel.subtitle')}</p>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold tabular-nums" style={{ color: selected.size === 26 ? 'var(--accent)' : 'var(--text)' }}>
            {selected.size}/26 {t('squadSel.selected')}
          </span>
          {posWarning && (
            <span className="text-[11px] text-[var(--bad)]">
              ⚠ min {MIN_BY_POS[posWarning[0]]} {posWarning[0]}
            </span>
          )}
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1.5 px-3 py-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className="rounded-full px-3 py-1 text-xs font-bold whitespace-nowrap"
            style={filter === f.key
              ? { background: 'var(--accent)', color: '#fff' }
              : { background: 'var(--card2)', color: 'var(--muted)' }}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Pool tab hint */}
      {filter === 'pool' && (
        <div className="mx-3 mb-1 px-3 py-2 rounded-lg text-[11px] text-[var(--muted)]"
          style={{ background: 'var(--card2)' }}>
          {t('pool.hint')}
        </div>
      )}

      {/* Player list */}
      <div className="flex-1 overflow-y-auto mx-3">
        <div className="card">
          {filtered.map((p) => {
            const isSelected = selected.has(p.id)
            const st = g.playerStates[p.id]
            const age = ageInYear(p.birthDate, currentYear)
            const isCalled = calledUpSet.has(p.id)
            const notCallable = p.isYouth && age < 16

            return (
              <button
                key={p.id}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--line)] last:border-0 text-left"
                style={{
                  ...(isSelected ? { background: 'rgba(var(--accent-rgb,0,200,100),0.08)' } : {}),
                  ...(notCallable ? { opacity: 0.45, pointerEvents: 'none' } : {}),
                }}
                onClick={() => !notCallable && toggle(p.id)}
              >
                {/* Checkbox / call-up indicator */}
                {notCallable ? (
                  <div className="shrink-0 rounded-full flex items-center justify-center"
                    style={{ width: 22, height: 22, background: 'var(--card2)', border: '2px solid var(--line)' }}>
                    <span className="text-[10px]" style={{ color: 'var(--muted)' }}>🔒</span>
                  </div>
                ) : p.isPool && !isCalled ? (
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center px-2"
                    style={{ height: 22, minWidth: 40, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700 }}
                  >
                    {t('pool.callUp')}
                  </div>
                ) : (
                  <div
                    className="shrink-0 rounded-full flex items-center justify-center"
                    style={{
                      width: 22, height: 22,
                      background: isSelected ? 'var(--accent)' : 'var(--card2)',
                      border: '2px solid ' + (isSelected ? 'var(--accent)' : 'var(--line)'),
                    }}
                  >
                    {isSelected && <span className="text-white text-[10px] font-black">✓</span>}
                  </div>
                )}

                <Avatar params={p.avatar} size={28} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-semibold truncate">{p.name}</span>
                    {p.isYouth && (
                      <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold shrink-0"
                        style={{ background: 'var(--accent)', color: '#fff' }}>U21</span>
                    )}
                    {p.isPool && (
                      <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold shrink-0"
                        style={{ background: isCalled ? 'var(--good)' : '#8b5cf6', color: '#fff' }}>
                        {isCalled ? t('pool.called') : t('pool.poolBadge')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--muted)]">
                    <span>{p.position} · {age}{t('youth.yearsOld')}</span>
                    {p.caps > 0 && <span>{p.caps} {t('squad.caps')}</span>}
                    {p.club && <span className="truncate">{p.club}</span>}
                    {notCallable && <span className="text-[10px]" style={{ color: 'var(--muted)' }}>{t('youth.eligibleAge')}</span>}
                    {p.isYouth && !notCallable && p.potentialStars && (
                      <StarDisplay
                        stars={p.potentialStars}
                        revealed={p.potentialRevealed ?? false}
                        potential={(p as YouthPlayer).potential ?? 0}
                      />
                    )}
                  </div>
                </div>

                <div className="shrink-0 text-right">
                  <OvrBadge value={Math.max(40, p.stats.overall - (st?.overallDecay ?? 0))} estimated={p.estimated} />
                  {!p.isPool && (
                    <div className="text-[10px] text-[var(--muted)] mt-0.5">
                      F{Math.round(st?.form ?? 6)} M{Math.round(st?.morale ?? 7)}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
          {filter === 'pool' && filtered.length === 0 && (
            <div className="px-4 py-6 text-center text-sm text-[var(--muted)]">
              {t('pool.empty')}
            </div>
          )}
        </div>
      </div>

      {/* Confirm button */}
      <div className="m-3 mt-2">
        <button
          className="btn w-full py-3 text-base font-black"
          style={!canConfirm ? { opacity: 0.4 } : {}}
          disabled={!canConfirm}
          onClick={confirm}
        >
          {t('squadSel.confirm')} ({selected.size}/26)
        </button>
        <button className="btn-ghost w-full mt-2 text-sm py-2" onClick={() => nav('/home')}>
          {t('common.cancel')}
        </button>
      </div>
    </div>
  )
}
