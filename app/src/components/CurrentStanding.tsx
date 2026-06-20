import { useMemo, useState } from 'react'
import { getTeam, TEAMS, teamAvgOverall } from '../data/teams'
import type { QualGroup, NLGroup, ScheduledMatch } from '../domain/types'
import type { CalendarWindow } from '../domain/calendar/calendar.types'
import type { StandingRow } from '../domain/tournament/standings'
import { Flag } from './Flag'

// ── helpers ───────────────────────────────────────────────────────────────

function computeStandings(matches: ScheduledMatch[], teamIds: string[]): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [id, { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, gd: 0, points: 0 }])
  )
  for (const m of matches) {
    if (!m.result || !m.homeId || !m.awayId) continue
    const h = rows.get(m.homeId)
    const a = rows.get(m.awayId)
    if (!h || !a) continue
    const { homeGoals, awayGoals } = m.result
    h.played++; a.played++
    h.gf += homeGoals; h.ga += awayGoals
    a.gf += awayGoals; a.ga += homeGoals
    if (homeGoals > awayGoals) { h.won++; a.lost++; h.points += 3 }
    else if (homeGoals < awayGoals) { a.won++; h.lost++; a.points += 3 }
    else { h.drawn++; a.drawn++; h.points++; a.points++ }
  }
  const list = [...rows.values()]
  for (const r of list) r.gd = r.gf - r.ga
  list.sort((x, y) => y.points - x.points || y.gd - x.gd || y.gf - x.gf || x.teamId.localeCompare(y.teamId))
  return list
}

function worldRank(teamId: string): number {
  const sorted = [...TEAMS].sort((a, b) => teamAvgOverall(b) - teamAvgOverall(a))
  const idx = sorted.findIndex((t) => t.id === teamId)
  return idx >= 0 ? idx + 1 : 999
}

const ROUND_LABEL: Record<string, [string, string]> = {
  R32:   ['Son 32',        'Round of 32'],
  R16:   ['Son 16',        'Round of 16'],
  QF:    ['Çeyrek Final',  'Quarter-Final'],
  SF:    ['Yarı Final',    'Semi-Final'],
  FINAL: ['Final',         'Final'],
  THIRD: ['3. lük',        '3rd Place'],
}

function roundLabel(round: string, isTR: boolean): string {
  const pair = ROUND_LABEL[round.toUpperCase()]
  return pair ? pair[isTR ? 0 : 1] : round
}

// ── Table ─────────────────────────────────────────────────────────────────

function StandingTable({ rows, teamId, greenSlots = 0, amberSlots = 0, redFrom = 99 }: {
  rows: StandingRow[]
  teamId: string
  greenSlots?: number
  amberSlots?: number
  redFrom?: number
}) {
  const total = rows.length
  return (
    <div>
      {/* Column headers */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '1px 8px 2px',
        fontSize: 7, color: 'var(--muted)', fontWeight: 600,
      }}>
        <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>#</span>
        <span style={{ width: 14, flexShrink: 0 }} />
        <span style={{ flex: 1 }}>Team</span>
        <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>P</span>
        <span style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>GD</span>
        <span style={{ width: 20, textAlign: 'center', flexShrink: 0 }}>Pts</span>
      </div>

      {rows.map((r, i) => {
        const rank = i + 1
        const isUser = r.teamId === teamId
        const isGreen  = rank <= greenSlots
        const isAmber  = !isGreen && rank <= greenSlots + amberSlots
        const isRed    = rank > total - (total - redFrom + 1) && redFrom <= total && rank >= redFrom
        const border   = isGreen ? '#22c55e' : isAmber ? '#f59e0b' : isRed ? '#ef4444' : 'transparent'

        let teamName = r.teamId
        try { teamName = getTeam(r.teamId).name } catch { /* unknown */ }

        return (
          <div
            key={r.teamId}
            style={{
              display: 'flex', alignItems: 'center', gap: 2,
              padding: '1.5px 6px 1.5px 0',
              fontSize: 10,
              fontWeight: isUser ? 800 : 500,
              color: isUser ? 'var(--fg)' : 'var(--muted)',
              background: isUser ? 'rgba(var(--accent-rgb,180,30,40),0.08)' : undefined,
              borderLeft: `2.5px solid ${border}`,
              paddingLeft: 5,
            }}
          >
            <span style={{ width: 14, textAlign: 'center', flexShrink: 0 }}>{rank}</span>
            <Flag code={r.teamId} size={12} />
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {teamName}
            </span>
            <span style={{ width: 16, textAlign: 'center', flexShrink: 0 }}>{r.played}</span>
            <span style={{ width: 26, textAlign: 'center', flexShrink: 0 }}>
              {r.gd > 0 ? `+${r.gd}` : r.gd}
            </span>
            <span style={{
              width: 20, textAlign: 'center', flexShrink: 0,
              fontWeight: isUser ? 900 : 600,
              color: isUser ? 'var(--accent)' : undefined,
            }}>
              {r.points}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────

interface Props {
  teamId: string
  schedule: ScheduledMatch[]
  currentWindowId: string
  calendarWindows: CalendarWindow[]
  qualGroups: QualGroup[]
  nlGroups: NLGroup[]
  isTR: boolean
}

export function CurrentStanding({
  teamId, schedule, currentWindowId, calendarWindows, qualGroups, nlGroups, isTR,
}: Props) {
  const [collapsed, setCollapsed] = useState(false)

  const windowDef = calendarWindows.find((w) => w.id === currentWindowId)
  const isNL = currentWindowId.includes('NL_2627') || currentWindowId.includes('CNL_2627')

  const windowMatches = useMemo(
    () => schedule.filter((m) => m.windowId === currentWindowId && (m.homeId === teamId || m.awayId === teamId)),
    [schedule, currentWindowId, teamId]
  )

  const pendingMatch = useMemo(
    () => windowMatches.filter((m) => !m.result && m.homeId && m.awayId).sort((a, b) => a.day - b.day)[0],
    [windowMatches]
  )

  const widgetType = useMemo<'ranking' | 'group' | 'qual' | 'nl' | 'knockout'>(() => {
    if (isNL) return 'nl'
    if (!windowDef || windowDef.type === 'friendly') return 'ranking'
    if (!pendingMatch) return 'ranking'
    if (pendingMatch.matchType === 'knockout' || pendingMatch.matchType === 'nl_final') return 'knockout'
    if (pendingMatch.matchType === 'qual') return 'qual'
    if (pendingMatch.matchType === 'group') return 'group'
    return 'ranking'
  }, [isNL, windowDef, pendingMatch])

  const title = isTR ? 'Mevcut Durum' : 'Current Standing'

  // ── build content ─────────────────────────────────────────────────

  const content = useMemo(() => {
    // ── World Ranking ───────────────────────────────────────────────
    if (widgetType === 'ranking') {
      const rank = worldRank(teamId)
      let teamName = teamId
      try { teamName = getTeam(teamId).name } catch { /* ok */ }
      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '6px 10px' }}>
          <span style={{ fontSize: 22 }}>🌍</span>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 700 }}>
              {isTR ? 'FIFA Sıralaması' : 'FIFA Ranking'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
              <span style={{ fontSize: 18, fontWeight: 900, color: 'var(--accent)' }}>#{rank}</span>
              <span style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 600 }}>{teamName}</span>
            </div>
          </div>
        </div>
      )
    }

    // ── Group Stage ─────────────────────────────────────────────────
    if (widgetType === 'group' && pendingMatch?.group) {
      const group = pendingMatch.group
      const grpMatches = schedule.filter((m) => m.windowId === currentWindowId && m.group === group && m.result)
      const teamIds = Array.from(new Set(
        schedule
          .filter((m) => m.windowId === currentWindowId && m.group === group)
          .flatMap((m) => [m.homeId, m.awayId])
          .filter(Boolean) as string[]
      ))
      const standings = computeStandings(grpMatches, teamIds)
      const groupShort = group.split('_').pop() ?? group

      return (
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted)', padding: '2px 8px', fontWeight: 600 }}>
            {isTR ? 'Grup' : 'Group'} {groupShort}
          </div>
          <StandingTable rows={standings} teamId={teamId} greenSlots={2} />
        </div>
      )
    }

    // ── Qualification ────────────────────────────────────────────────
    if (widgetType === 'qual') {
      const qg = qualGroups.find((g) => g.teams.includes(teamId))
      if (!qg) return null
      const qMatches = schedule.filter((m) => qg.matchIds.includes(m.id) && m.result)
      const standings = computeStandings(qMatches, qg.teams)
      const groupShort = qg.id.split('_').pop() ?? qg.id
      return (
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted)', padding: '2px 8px', fontWeight: 600 }}>
            {isTR ? 'Grup' : 'Group'} {groupShort}
          </div>
          <StandingTable
            rows={standings}
            teamId={teamId}
            greenSlots={qg.directSlots}
            amberSlots={qg.playoffSlots}
          />
        </div>
      )
    }

    // ── Nations League ───────────────────────────────────────────────
    if (widgetType === 'nl') {
      const nlg = nlGroups.find((g) => g.teams.includes(teamId))
      if (!nlg) return null
      const nlMatches = schedule.filter((m) => m.group === nlg.id && m.result)
      const standings = computeStandings(nlMatches, nlg.teams)
      const total = nlg.teams.length
      const redFrom = total - nlg.relegationSlots + 1
      return (
        <div>
          <div style={{ fontSize: 8, color: 'var(--muted)', padding: '2px 8px', fontWeight: 600 }}>
            {isTR ? 'Uluslar Ligi' : 'Nations League'} {nlg.league} · {nlg.groupNum}
          </div>
          <StandingTable
            rows={standings}
            teamId={teamId}
            greenSlots={nlg.promotionSlots}
            redFrom={redFrom}
          />
        </div>
      )
    }

    // ── Knockout ─────────────────────────────────────────────────────
    if (widgetType === 'knockout' && pendingMatch) {
      const oppId = pendingMatch.homeId === teamId ? pendingMatch.awayId : pendingMatch.homeId
      const label = roundLabel(pendingMatch.round, isTR)
      let oppName = oppId ?? ''
      if (oppId) { try { oppName = getTeam(oppId).name } catch { /* ok */ } }

      return (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px' }}>
          <div>
            <div style={{ fontSize: 8, color: 'var(--muted)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2 }}>
              {label}
            </div>
            {oppId ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <Flag code={teamId} size={18} />
                <span style={{ fontSize: 11, color: 'var(--muted)', fontWeight: 700 }}>vs</span>
                <Flag code={oppId} size={18} />
                <span style={{ fontSize: 11, fontWeight: 800 }}>{oppName}</span>
              </div>
            ) : (
              <span style={{ fontSize: 10, color: 'var(--muted)' }}>
                {isTR ? 'Eşleşme bekliyor' : 'Draw pending'}
              </span>
            )}
          </div>
        </div>
      )
    }

    return null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widgetType, pendingMatch, schedule, currentWindowId, teamId, qualGroups, nlGroups, isTR])

  if (!content) return null

  return (
    <div style={{ flexShrink: 0, borderTop: '1px solid var(--line)', background: 'var(--card2)' }}>
      {/* Header / toggle */}
      <button
        onClick={() => setCollapsed((c) => !c)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '3px 8px',
          fontSize: 8,
          fontWeight: 700,
          color: 'var(--muted)',
          textTransform: 'uppercase' as const,
          letterSpacing: '0.06em',
          background: 'none',
          border: 'none',
          borderBottom: collapsed ? 'none' : '1px solid var(--line)',
          cursor: 'pointer',
        }}
      >
        <span>{title}</span>
        <span style={{ fontSize: 7 }}>{collapsed ? '▶' : '▼'}</span>
      </button>

      {/* Content */}
      {!collapsed && (
        <div style={{ maxHeight: 160, overflowY: 'auto' }}>
          {content}
        </div>
      )}
    </div>
  )
}
