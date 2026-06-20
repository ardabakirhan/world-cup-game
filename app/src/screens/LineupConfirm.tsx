import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Player } from '../data/types'
import { getTeam } from '../data/teams'
import { useGame } from '../store/gameStore'
import { FORMATIONS, FORMATION_KEYS } from '../domain/engine/formations'
import { positionPenalty } from '../domain/engine/ratings'
import { isAvailable, roleScore } from '../domain/ai/lineup'
import { getNextUserMatch, matchCompetitionLabel } from '../domain/calendar/calendar.engine'
import { careerDayToDate } from '../domain/calendar/calendar.types'
import { positionFit, POS_FIT_COLOR } from '../domain/positions'
import type { Mentality } from '../domain/types'
import { Card, Modal, OvrBadge } from '../components/ui'
import { PitchView, type ChipData } from '../components/PitchView'
import { PositionBadges } from '../components/PositionBadges'
import { Flag } from '../components/Flag'
import { familiarityColor } from './Tactics'

const MENTALITIES: Mentality[] = ['ultra_defensive', 'defensive', 'balanced', 'attacking', 'gung_ho']

const MENTALITY_COLOR: Record<Mentality, string> = {
  ultra_defensive: '#3b82f6',
  defensive:       '#22c55e',
  balanced:        '#eab308',
  attacking:       '#f97316',
  gung_ho:         '#ef4444',
}

// [TR, EN]
const MENTALITY_LABEL: Record<Mentality, [string, string]> = {
  ultra_defensive: ['Aşırı Def.', 'Ultra Def.'],
  defensive:       ['Savunmacı', 'Defensive'],
  balanced:        ['Dengeli',   'Balanced'],
  attacking:       ['Atak',      'Attacking'],
  gung_ho:         ['Tam Baskı', 'Gung-Ho'],
}

function surname(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

function fxDateStr(day: number): string {
  const d = careerDayToDate(day)
  return `${d.day.toString().padStart(2, '0')}.${d.month.toString().padStart(2, '0')}`
}

function importanceStars(matchType: string): string {
  if (matchType === 'knockout' || matchType === 'nl_final') return '★★★'
  if (matchType === 'group' || matchType === 'qual' || matchType === 'playoff') return '★★'
  return '★'
}

function famLabelStr(score: number, isTR: boolean): string {
  if (score <= 20) return isTR ? 'Karmaşa'   : 'Chaos'
  if (score <= 40) return isTR ? 'Öğreniyor' : 'Learning'
  if (score <= 60) return isTR ? 'Gelişiyor' : 'Developing'
  if (score <= 80) return isTR ? 'Alışkın'   : 'Comfortable'
  return                  isTR ? 'Mükemmel'  : 'Excellent'
}

export function LineupConfirm() {
  const nav = useNavigate()
  const g = useGame()
  const teamId = g.teamId!
  const team = getTeam(teamId)
  const isTR = g.lang === 'tr'

  const nextMatch = getNextUserMatch(g.schedule, teamId, g.day)
  const oppId = nextMatch
    ? (nextMatch.homeId === teamId ? nextMatch.awayId : nextMatch.homeId)
    : null
  const oppTeam = oppId ? getTeam(oppId) : null

  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [showFormPicker, setShowFormPicker] = useState(false)
  const [showMentalPicker, setShowMentalPicker] = useState(false)
  const [backLine, setBackLine] = useState(g.lineup.formation[0])

  const slots = FORMATIONS[g.lineup.formation]
  const byId = useMemo(() => new Map(team.players.map((p) => [p.id, p])), [team])
  const roles = g.lineup.roles ?? Array(slots.length).fill(null)

  const toChip = (p: Player, slotIdx: number | null): ChipData => {
    const st = g.playerStates[p.id]
    let icons = ''
    if (st?.injuredUntilDay > g.day) icons += '🚑'
    if (st?.suspendedMatches > 0) icons += '🟥'
    if (st?.fitness < 60) icons += '🟡'
    return {
      id: p.id,
      number: p.number,
      label: surname(p.name),
      ovr: p.stats.overall,
      effOvr: Math.round(
        p.stats.overall * (slotIdx !== null ? positionPenalty(p.position, slots[slotIdx].role) : 1)
      ),
      icons,
      disabled: !isAvailable(p, g.playerStates, g.day),
      avatar: p.avatar,
      subRole: slotIdx !== null ? (roles[slotIdx] ?? null) : null,
      isCaptain: g.lineup.captainId === p.id,
      isViceCaptain: g.lineup.viceCaptainId === p.id,
      posFit: slotIdx !== null ? positionFit(slots[slotIdx].label, p) : undefined,
    }
  }

  const pitchChips: (ChipData | null)[] = slots.map((_, i) => {
    const id = g.lineup.starters[i]
    const p = id ? byId.get(id) : undefined
    return p ? toChip(p, i) : null
  })

  const inXI = new Set(g.lineup.starters.filter(Boolean) as string[])
  const benchChips: ChipData[] = team.players
    .filter((p) => !inXI.has(p.id))
    .sort((a, b) =>
      Number(isAvailable(b, g.playerStates, g.day)) - Number(isAvailable(a, g.playerStates, g.day)) ||
      b.stats.overall - a.stats.overall
    )
    .map((p) => toChip(p, null))

  const lineupValid = (() => {
    const filledIds = g.lineup.starters.filter(Boolean) as string[]
    if (filledIds.length !== 11) return false
    if (!filledIds.every((id) => {
      const p = byId.get(id)
      return p && isAvailable(p, g.playerStates, g.day)
    })) return false
    return filledIds.some((id) => byId.get(id)?.position === 'GK')
  })()

  const warnings = (g.lineup.starters.filter(Boolean) as string[]).flatMap((id) => {
    const p = byId.get(id)
    const st = g.playerStates[id]
    if (!p || !st) return []
    if (st.injuredUntilDay > g.day)
      return [{ icon: '🏥', text: isTR ? `${surname(p.name)} sakat — oynayamaz` : `${surname(p.name)} injured — unavailable` }]
    if (st.suspendedMatches > 0)
      return [{ icon: '🟥', text: isTR ? `${surname(p.name)} cezalı — oynayamaz` : `${surname(p.name)} suspended — unavailable` }]
    if (st.fitness < 65)
      return [{ icon: '⚠️', text: isTR ? `${surname(p.name)} yorgun (${Math.round(st.fitness)}%)` : `${surname(p.name)} tired (${Math.round(st.fitness)}%)` }]
    return []
  })

  const fam = g.tacticalFamiliarity
  const famColor = familiarityColor(fam.score)
  const mentality: Mentality = g.tactics.mentality ?? 'balanced'
  const mentalityColor = MENTALITY_COLOR[mentality]
  const mentalityLabel = MENTALITY_LABEL[mentality][isTR ? 0 : 1]

  const onSwapPitch = (i: number, j: number) => {
    const a = g.lineup.starters[i]
    const b = g.lineup.starters[j]
    if (a === null && b === null) return
    if (a !== null) g.setStarter(j, a)
    else if (b !== null) g.setStarter(i, b)
  }

  if (!nextMatch || !oppTeam) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-8" style={{ minHeight: '100dvh' }}>
        <p className="text-sm text-[var(--muted)]">{isTR ? 'Maç bulunamadı.' : 'No match found.'}</p>
        <button className="btn" onClick={() => nav(-1)}>{isTR ? 'Geri' : 'Back'}</button>
      </div>
    )
  }

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh', background: 'var(--bg)' }}>
      {/* ─── Header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-center gap-3 px-4 py-3 border-b border-[var(--line)]"
        style={{ background: 'var(--card)', flexShrink: 0 }}
      >
        <button
          className="rounded-lg px-2.5 py-1.5 font-bold border border-[var(--line)]"
          style={{ background: 'var(--card2)', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}
          onClick={() => nav(-1)}
        >
          ‹
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <Flag code={oppId!} size={15} />
            <h1 className="text-base font-black truncate leading-tight">
              {oppTeam.name}
              <span className="font-normal text-[var(--muted)]">
                {' '}— {isTR ? 'Kadro Onayı' : 'Lineup Confirm'}
              </span>
            </h1>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5" style={{ fontSize: 10, color: 'var(--muted)' }}>
            <span>{matchCompetitionLabel(nextMatch)}</span>
            <span>·</span>
            <span>{fxDateStr(nextMatch.day)}</span>
            <span>·</span>
            <span style={{ color: '#f59e0b', fontWeight: 800 }}>{importanceStars(nextMatch.matchType)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <Flag code={teamId} size={15} />
          <span className="text-xs font-extrabold" style={{ color: 'var(--accent)' }}>
            {team.name.slice(0, 3).toUpperCase()}
          </span>
        </div>
      </div>

      {/* ─── Scrollable body ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-3" style={{ paddingBottom: 100 }}>

        {/* Pitch + bench */}
        <Card>
          <PitchView
            slots={slots}
            pitch={pitchChips}
            bench={benchChips}
            benchTitle={isTR ? 'Yedekler' : 'Bench'}
            onSwapPitch={onSwapPitch}
            onBenchToPitch={(benchId, slotIdx) => g.setStarter(slotIdx, benchId)}
            onPitchToBench={(slotIdx) => g.setStarter(slotIdx, null)}
            onSlotTap={(slotIdx) => setPickSlot(slotIdx)}
          />
        </Card>

        {/* Quick-change row: Formation / Mentality / Familiarity */}
        <div className="grid grid-cols-3 gap-2">
          <button
            className="rounded-xl border border-[var(--line)] px-2.5 py-2 text-left"
            style={{ background: 'var(--card)' }}
            onClick={() => setShowFormPicker(true)}
          >
            <div className="text-[8px] uppercase tracking-wide font-bold text-[var(--muted)]">
              {isTR ? 'Formasyon' : 'Formation'}
            </div>
            <div className="text-sm font-extrabold mt-0.5" style={{ color: 'var(--accent)' }}>
              {g.lineup.formation}
            </div>
            <div className="text-[8px] text-[var(--muted)] mt-0.5">
              ↕ {isTR ? 'Değiştir' : 'Change'}
            </div>
          </button>

          <button
            className="rounded-xl border border-[var(--line)] px-2.5 py-2 text-left"
            style={{ background: 'var(--card)' }}
            onClick={() => setShowMentalPicker(true)}
          >
            <div className="text-[8px] uppercase tracking-wide font-bold text-[var(--muted)]">
              {isTR ? 'Mentalite' : 'Mentality'}
            </div>
            <div className="text-sm font-extrabold mt-0.5" style={{ color: mentalityColor }}>
              {mentalityLabel}
            </div>
            <div className="text-[8px] text-[var(--muted)] mt-0.5">
              ↕ {isTR ? 'Değiştir' : 'Change'}
            </div>
          </button>

          <div
            className="rounded-xl border border-[var(--line)] px-2.5 py-2"
            style={{ background: 'var(--card)' }}
          >
            <div className="text-[8px] uppercase tracking-wide font-bold text-[var(--muted)]">
              {isTR ? 'Aşinalık' : 'Familiarity'}
            </div>
            <div className="text-sm font-extrabold mt-0.5" style={{ color: famColor }}>
              {famLabelStr(fam.score, isTR)}
            </div>
            <div
              className="mt-1.5 rounded-full overflow-hidden"
              style={{ height: 3, background: 'var(--line)' }}
            >
              <div
                className="h-full rounded-full"
                style={{ width: `${fam.score}%`, background: famColor, transition: 'width 0.5s ease' }}
              />
            </div>
          </div>
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div
            className="rounded-xl border border-[var(--line)] px-3 py-2.5 flex flex-col gap-1.5"
            style={{ background: 'var(--card)' }}
          >
            <div className="text-[8px] uppercase tracking-wide font-bold text-[var(--muted)] mb-0.5">
              {isTR ? 'Uyarılar' : 'Warnings'}
            </div>
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="text-sm shrink-0">{w.icon}</span>
                <span
                  className="text-xs font-semibold leading-tight"
                  style={{ color: w.icon === '⚠️' ? '#f59e0b' : 'var(--bad)' }}
                >
                  {w.text}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Fixed bottom action bar ─────────────────────────────────── */}
      <div
        className="flex gap-2 px-4 py-3 border-t border-[var(--line)]"
        style={{ flexShrink: 0, background: 'var(--card)' }}
      >
        <button
          className="flex-1 rounded-xl py-3.5 text-sm font-bold border border-[var(--line)]"
          style={{ background: 'var(--card2)', color: 'var(--muted)' }}
          onClick={() => nav('/tactics')}
        >
          📋 {isTR ? 'Taktikleri Düzenle' : 'Edit Tactics'}
        </button>
        <button
          className="flex-[2] rounded-xl py-3.5 text-sm font-bold"
          disabled={!lineupValid}
          style={{
            background: lineupValid ? 'var(--accent)' : 'var(--card2)',
            color: lineupValid ? '#fff' : 'var(--muted)',
            opacity: lineupValid ? 1 : 0.5,
          }}
          onClick={() => { if (lineupValid) nav('/match') }}
        >
          {lineupValid
            ? `⚽ ${isTR ? 'Maça Başla' : 'Start Match'}`
            : (isTR ? 'Kadroda eksik veya cezalı oyuncu var' : 'Lineup incomplete or unavailable')
          }
        </button>
      </div>

      {/* ─── Modals ──────────────────────────────────────────────────── */}
      <Modal open={pickSlot !== null} onClose={() => setPickSlot(null)}>
        {pickSlot !== null && (
          <SimplePlayerPicker slotIndex={pickSlot} onDone={() => setPickSlot(null)} />
        )}
      </Modal>

      <Modal open={showFormPicker} onClose={() => setShowFormPicker(false)}>
        <FormationPicker
          backLine={backLine}
          onBackLine={setBackLine}
          currentFormation={g.lineup.formation}
          isTR={isTR}
          onSelect={(k) => { g.setFormation(k); setShowFormPicker(false) }}
        />
      </Modal>

      <Modal open={showMentalPicker} onClose={() => setShowMentalPicker(false)}>
        <MentalityPicker
          current={mentality}
          isTR={isTR}
          onSelect={(m) => { g.setMentality(m); setShowMentalPicker(false) }}
        />
      </Modal>
    </div>
  )
}

// ─── Formation picker modal content ─────────────────────────────────────────

function FormationPicker({
  backLine, onBackLine, currentFormation, isTR, onSelect,
}: {
  backLine: string
  onBackLine: (bl: string) => void
  currentFormation: string
  isTR: boolean
  onSelect: (k: string) => void
}) {
  return (
    <div className="p-1">
      <h2 className="text-lg font-extrabold mb-3">{isTR ? 'Formasyon Seç' : 'Choose Formation'}</h2>
      <div className="flex gap-1 mb-3">
        {(['4', '3', '5'] as const).map((bl) => (
          <button
            key={bl}
            className="flex-1 rounded-lg py-1.5 text-xs font-bold border"
            style={{
              background: backLine === bl ? 'var(--accent)' : 'var(--card2)',
              borderColor: backLine === bl ? 'var(--accent)' : 'var(--line)',
              color: backLine === bl ? '#fff' : 'var(--muted)',
            }}
            onClick={() => onBackLine(bl)}
          >
            {bl === '4' ? (isTR ? '4\'lü Dif' : '4 Back')
              : bl === '3' ? (isTR ? '3\'lü Dif' : '3 Back')
              : (isTR ? '5\'li Dif' : '5 Back')}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {FORMATION_KEYS.filter((k) => k[0] === backLine).map((k) => (
          <button
            key={k}
            className="rounded-lg border px-3 py-2 text-sm font-bold"
            style={{
              background: k === currentFormation ? 'var(--accent)' : 'var(--card2)',
              borderColor: k === currentFormation ? 'var(--accent)' : 'var(--line)',
              color: k === currentFormation ? '#fff' : 'var(--muted)',
            }}
            onClick={() => onSelect(k)}
          >
            {k}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Mentality picker modal content ─────────────────────────────────────────

function MentalityPicker({
  current, isTR, onSelect,
}: {
  current: Mentality
  isTR: boolean
  onSelect: (m: Mentality) => void
}) {
  return (
    <div className="p-1">
      <h2 className="text-lg font-extrabold mb-3">{isTR ? 'Mentalite Seç' : 'Choose Mentality'}</h2>
      <div className="flex flex-col gap-1.5">
        {MENTALITIES.map((m) => {
          const color = MENTALITY_COLOR[m]
          const label = MENTALITY_LABEL[m][isTR ? 0 : 1]
          const isActive = m === current
          return (
            <button
              key={m}
              className="rounded-xl py-3 px-4 text-sm font-bold text-left border"
              style={{
                background: isActive ? color : 'var(--card2)',
                borderColor: isActive ? color : 'var(--line)',
                color: isActive ? '#fff' : 'var(--muted)',
                boxShadow: isActive ? `0 2px 8px ${color}44` : undefined,
              }}
              onClick={() => onSelect(m)}
            >
              {label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Simple player picker modal content ─────────────────────────────────────

function SimplePlayerPicker({ slotIndex, onDone }: { slotIndex: number; onDone: () => void }) {
  const g = useGame()
  const team = getTeam(g.teamId!)
  const slots = FORMATIONS[g.lineup.formation]
  const slot = slots[slotIndex]
  const isTR = g.lang === 'tr'

  const candidates = team.players
    .filter((p) => isAvailable(p, g.playerStates, g.day))
    .sort((a, b) => roleScore(b, slot.role) - roleScore(a, slot.role))

  return (
    <div>
      <h2 className="text-lg font-extrabold mb-2">
        {isTR ? `${slot.label} — Oyuncu Seç` : `Pick ${slot.label}`}
      </h2>
      <div className="flex flex-col max-h-[60dvh] overflow-y-auto">
        <button
          className="row-tap py-2 text-left text-sm text-[var(--muted)]"
          onClick={() => { g.setStarter(slotIndex, null); onDone() }}
        >
          {isTR ? 'Boş bırak' : 'Leave empty'}
        </button>
        {candidates.map((p) => {
          const fit = positionFit(slot.label, p)
          const alreadyIn = g.lineup.starters.includes(p.id)
          const st = g.playerStates[p.id]
          return (
            <button
              key={p.id}
              className="row-tap flex items-center gap-2 border-t border-[var(--line)] py-2 text-left"
              onClick={() => { g.setStarter(slotIndex, p.id); onDone() }}
            >
              <span className="shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: POS_FIT_COLOR[fit] }} />
              <OvrBadge value={p.stats.overall} estimated={p.estimated} />
              <span className="flex-1 min-w-0">
                <span className="truncate text-sm font-semibold block">
                  {p.name}
                  {alreadyIn && <span className="text-[var(--muted)]"> •</span>}
                </span>
                <span className="mt-0.5 flex"><PositionBadges player={p} max={3} /></span>
              </span>
              <span className="text-xs text-[var(--muted)] shrink-0 tabular-nums">
                {Math.round(st?.fitness ?? 0)}%
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
