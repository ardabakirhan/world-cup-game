import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeam } from '../data/teams'
import type { Player, Position } from '../data/types'
import type { PlayerStates, YouthPlayer } from '../domain/types'
import { useGame } from '../store/gameStore'
import { Avatar } from '../components/Avatar'
import { OvrBadge, Modal } from '../components/ui'
import { ageInYear } from '../domain/player/aging'
import { CAREER_EPOCH } from '../domain/calendar/calendar.types'
import { getNextMajorTournamentInfo } from '../domain/calendar/calendar.engine'

const POS_ORDER: Record<Position, number> = { GK: 0, DF: 1, MF: 2, FW: 3 }
// Soft guidance ranges — not enforced as hard blocks (only GK=3 and total=26 are hard)
const SOFT_RANGES: Partial<Record<Position, [number, number]>> = { DF: [7, 9], MF: [6, 9], FW: [5, 7] }

interface PoolEntry extends Player {
  isYouth?: boolean
  isPool?: boolean
  notCallable?: boolean
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="px-3 py-2 border-b border-[var(--line)]"
      style={{ background: 'var(--card2)' }}>
      <span className="text-[10px] font-black uppercase tracking-widest text-[var(--muted)]">{label}</span>
      <span className="ml-2 text-[10px] text-[var(--muted)]">({count})</span>
    </div>
  )
}

export function PlayerPool() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const lockTournamentSquad = useGame((s) => s.lockTournamentSquad)
  const callUpYouth = useGame((s) => s.callUpYouth)
  const callUpPoolPlayer = useGame((s) => s.callUpPoolPlayer)
  const confirmMatchdaySquad = useGame((s) => s.confirmMatchdaySquad)

  const team = getTeam(g.teamId!)
  const currentYear = g.currentDate?.year ?? CAREER_EPOCH.year

  // Detect upcoming major tournament
  const tournInfo = useMemo(
    () => g.teamId ? getNextMajorTournamentInfo(g.schedule, g.calendarWindows, g.teamId, g.day) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [g.schedule.length, g.calendarWindows.length, g.teamId, g.day],
  )

  const isLocked = g.tournamentSquadLocked && !!g.activeTournamentId

  // Initial selection: locked squad → selected squad → empty
  const [selected, setSelected] = useState<Set<string>>(() => {
    const seed = g.lockedSquadIds.length > 0 ? g.lockedSquadIds
      : g.selectedSquad.length > 0 ? g.selectedSquad : []
    return new Set(seed)
  })

  const [confirmOpen, setConfirmOpen] = useState(false)
  const calledUpSet = new Set(g.calledUpPoolPlayers ?? [])

  // ── Build player lists ────────────────────────────────────────────────
  const seniors: PoolEntry[] = team.players.filter(
    (p) => !g.playerStates[p.id]?.retiredInternational,
  )
  const seniorRegens: PoolEntry[] = Object.values(g.regenPool)
    .filter((r) => r.teamId === g.teamId && r.squadLevel === 'senior') as PoolEntry[]

  const allSeniors = [...seniors, ...seniorRegens].sort(
    (a, b) => POS_ORDER[a.position] - POS_ORDER[b.position] || b.stats.overall - a.stats.overall,
  )

  const youthCallable: PoolEntry[] = [
    ...g.youthSquad.u21,
    ...g.youthSquad.u17.filter((p) => ageInYear(p.birthDate, currentYear) >= 16),
  ].map((p: YouthPlayer) => ({ ...p, isYouth: true }))
    .sort((a, b) => b.stats.overall - a.stats.overall)

  const youthNotCallable: PoolEntry[] = g.youthSquad.u17
    .filter((p) => ageInYear(p.birthDate, currentYear) < 16)
    .map((p: YouthPlayer) => ({ ...p, isYouth: true, notCallable: true }))

  const poolPlayers: PoolEntry[] = (team.extendedPool ?? [])
    .map((p) => ({ ...p, isPool: true }))
    .sort((a, b) => b.stats.overall - a.stats.overall)

  // Position counts
  const allSelectable = [...allSeniors, ...youthCallable, ...poolPlayers.filter((p) => calledUpSet.has(p.id))]
  const posCounts = { GK: 0, DF: 0, MF: 0, FW: 0 }
  for (const id of selected) {
    const p = allSelectable.find((x) => x.id === id)
    if (p) posCounts[p.position]++
  }

  // Hard requirements: exactly 3 GK and total 26
  const canConfirm = selected.size === 26 && posCounts.GK === 3

  // Soft advisory warnings for DF/MF/FW (non-blocking)
  const isTR = g.lang === 'tr'
  const POS_NAME_TR: Partial<Record<Position, string>> = { DF: 'defans', MF: 'orta saha', FW: 'forvet' }
  const POS_NAME_EN: Partial<Record<Position, string>> = { DF: 'defender', MF: 'midfielder', FW: 'forward' }
  const softWarnings: string[] = (Object.entries(SOFT_RANGES) as [Position, [number, number]][])
    .filter(([pos, [min, max]]) => posCounts[pos] < min || posCounts[pos] > max)
    .map(([pos, [min, max]]) => {
      const count = posCounts[pos]
      const name = isTR ? (POS_NAME_TR[pos] ?? pos) : (POS_NAME_EN[pos] ?? pos)
      return isTR
        ? `⚠️ ${count} ${name} seçildi — tipik kadrolarda ${min}-${max} olur`
        : `⚠️ ${count} ${name}s selected — typical range: ${min}-${max}`
    })

  const toggle = (p: PoolEntry) => {
    if (p.notCallable || isLocked) return
    const id = p.id
    if (p.isYouth && !g.regenPool[id]) {
      callUpYouth(id)
    }
    if (p.isPool && !calledUpSet.has(id)) {
      callUpPoolPlayer(id)
    }
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else if (next.size < 26) next.add(id)
      return next
    })
  }

  const handleLock = () => {
    if (!canConfirm) return
    if (tournInfo) {
      lockTournamentSquad([...selected], tournInfo.windowId)
    } else {
      confirmMatchdaySquad([...selected])
    }
    setConfirmOpen(false)
    nav('/home')
  }

  const lockBtnLabel = tournInfo
    ? t('squadLock.lockBtn')
    : t('squadSel.confirm')

  return (
    <div className="flex h-dvh flex-col">
      {/* Header */}
      <div className="card m-3 mb-0 p-3">
        <h1 className="text-base font-black">{t('squadLock.title')}</h1>
        {isLocked ? (
          <p className="text-xs mt-1" style={{ color: 'var(--good)' }}>
            🔒 {t('squadLock.locked')}
          </p>
        ) : tournInfo ? (
          <p className="text-xs text-[var(--muted)] mt-0.5">
            {t('squadLock.forTournament', { tournament: tournInfo.competition })}
          </p>
        ) : (
          <p className="text-xs text-[var(--muted)] mt-0.5">{t('squadSel.subtitle')}</p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-sm font-bold tabular-nums"
            style={{ color: selected.size === 26 ? 'var(--accent)' : 'var(--text)' }}>
            {selected.size}/26 {t('squadSel.selected')}
          </span>
          {posCounts.GK !== 3 && (
            <span className="text-[11px]" style={{ color: 'var(--bad)' }}>
              ⛔ GK: {posCounts.GK}/3
            </span>
          )}
        </div>
        {softWarnings.length > 0 && (
          <div className="mt-1 flex flex-col gap-0.5">
            {softWarnings.map((w, i) => (
              <span key={i} className="text-[10px]" style={{ color: '#f59e0b' }}>{w}</span>
            ))}
          </div>
        )}
      </div>

      {/* Player list */}
      <div className="flex-1 overflow-y-auto mx-3 mt-2">
        <div className="card">

          {/* Section A — Senior Squad */}
          <SectionHeader label={t('squadLock.sectionSenior')} count={allSeniors.length} />
          {allSeniors.map((p) => <PlayerRow key={p.id} p={p} selected={selected.has(p.id)} isLocked={isLocked} onToggle={toggle} playerStates={g.playerStates} currentYear={currentYear} t={t} calledUpSet={calledUpSet} />)}

          {/* Section B — Youth */}
          {(youthCallable.length > 0 || youthNotCallable.length > 0) && (
            <>
              <SectionHeader label={t('squadLock.sectionYouth')} count={youthCallable.length} />
              {youthCallable.map((p) => <PlayerRow key={p.id} p={p} selected={selected.has(p.id)} isLocked={isLocked} onToggle={toggle} playerStates={g.playerStates} currentYear={currentYear} t={t} calledUpSet={calledUpSet} />)}
              {youthNotCallable.map((p) => <PlayerRow key={p.id} p={p} selected={false} isLocked={isLocked} onToggle={toggle} playerStates={g.playerStates} currentYear={currentYear} t={t} calledUpSet={calledUpSet} />)}
            </>
          )}

          {/* Section C — Extended Pool */}
          {poolPlayers.length > 0 && (
            <>
              <SectionHeader label={t('squadLock.sectionPool')} count={poolPlayers.length} />
              {poolPlayers.map((p) => <PlayerRow key={p.id} p={p} selected={selected.has(p.id)} isLocked={isLocked} onToggle={toggle} playerStates={g.playerStates} currentYear={currentYear} t={t} calledUpSet={calledUpSet} />)}
            </>
          )}
        </div>
      </div>

      {/* Bottom buttons */}
      <div className="m-3 mt-2">
        {isLocked ? (
          <button className="btn w-full py-3 text-base font-black opacity-40" disabled>
            🔒 {t('squadLock.locked')}
          </button>
        ) : (
          <button
            className="btn w-full py-3 text-base font-black"
            style={!canConfirm ? { opacity: 0.4 } : {}}
            disabled={!canConfirm}
            onClick={() => tournInfo ? setConfirmOpen(true) : handleLock()}
          >
            {lockBtnLabel} ({selected.size}/26)
          </button>
        )}
        <button className="btn-ghost w-full mt-2 text-sm py-2" onClick={() => nav('/home')}>
          {t('common.cancel')}
        </button>
      </div>

      {/* Confirmation modal for lock */}
      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="flex flex-col gap-4">
          <h2 className="text-lg font-extrabold">{t('squadLock.confirmTitle')}</h2>
          <p className="text-sm text-[var(--muted)]">
            {t('squadLock.confirmBody', { tournament: tournInfo?.competition ?? '' })}
          </p>
          <div className="flex gap-2">
            <button className="btn-ghost flex-1" onClick={() => setConfirmOpen(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn flex-1" onClick={handleLock}>
              {t('common.confirm')}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

// ── Player row sub-component ─────────────────────────────────────────────────

interface RowProps {
  p: PoolEntry
  selected: boolean
  isLocked: boolean
  onToggle: (p: PoolEntry) => void
  playerStates: PlayerStates
  currentYear: number
  t: ReturnType<typeof useTranslation>['t']
  calledUpSet: Set<string>
}

function PlayerRow({ p, selected, isLocked, onToggle, playerStates, currentYear, t, calledUpSet }: RowProps) {
  const st = playerStates[p.id]
  const age = ageInYear(p.birthDate, currentYear)
  const isCalled = p.isPool && calledUpSet.has(p.id)
  const notCallable = p.notCallable || (p.isPool && !isCalled && isLocked)

  return (
    <button
      className="w-full flex items-center gap-2.5 px-3 py-2.5 border-b border-[var(--line)] last:border-0 text-left"
      style={{
        ...(selected ? { background: 'rgba(var(--accent-rgb,0,200,100),0.08)' } : {}),
        ...(notCallable || isLocked ? { opacity: p.notCallable ? 0.45 : 1 } : {}),
      }}
      onClick={() => onToggle(p)}
      disabled={p.notCallable || isLocked}
    >
      {/* Checkbox */}
      {p.notCallable ? (
        <div className="shrink-0 rounded-full flex items-center justify-center"
          style={{ width: 22, height: 22, background: 'var(--card2)', border: '2px solid var(--line)' }}>
          <span className="text-[9px]">🔒</span>
        </div>
      ) : p.isPool && !isCalled && !isLocked ? (
        <div className="shrink-0 rounded-full flex items-center justify-center px-2"
          style={{ height: 22, minWidth: 40, background: 'var(--accent)', color: '#fff', fontSize: 9, fontWeight: 700 }}>
          {t('pool.callUp')}
        </div>
      ) : (
        <div className="shrink-0 rounded-full flex items-center justify-center"
          style={{ width: 22, height: 22, background: selected ? 'var(--accent)' : 'var(--card2)', border: '2px solid ' + (selected ? 'var(--accent)' : 'var(--line)') }}>
          {selected && <span className="text-white text-[10px] font-black">✓</span>}
        </div>
      )}

      <Avatar params={p.avatar} size={28} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold truncate">{p.name}</span>
          {p.isYouth && !p.notCallable && (
            <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold shrink-0"
              style={{ background: 'var(--accent)', color: '#fff' }}>U21</span>
          )}
          {isCalled && (
            <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold shrink-0"
              style={{ background: 'var(--good)', color: '#fff' }}>{t('pool.called')}</span>
          )}
          {p.isPool && !isCalled && !isLocked && (
            <span className="text-[9px] rounded-full px-1.5 py-0.5 font-bold shrink-0"
              style={{ background: '#8b5cf6', color: '#fff' }}>{t('pool.poolBadge')}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5 text-[11px] text-[var(--muted)]">
          <span>{p.position} · {age}{t('youth.yearsOld')}</span>
          {p.caps > 0 && <span>{p.caps} {t('squad.caps')}</span>}
          {(p.isPool || p.isYouth) && p.club && <span className="truncate">{p.club}</span>}
          {p.notCallable && <span>{t('youth.eligibleAge')}</span>}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <OvrBadge value={Math.max(40, p.stats.overall - (st?.overallDecay ?? 0))} estimated={p.estimated} />
        {!p.isPool && !p.isYouth && (
          <div className="text-[10px] text-[var(--muted)] mt-0.5">
            F{Math.round(st?.form ?? 6)} M{Math.round(st?.morale ?? 7)}
          </div>
        )}
      </div>
    </button>
  )
}
