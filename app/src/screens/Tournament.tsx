import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GROUPS, getPlayer, getTeam, groupTeams } from '../data/teams'
import { useGame } from '../store/gameStore'
import { groupStandings } from '../domain/tournament/standings'
import { resultLabel } from '../domain/tournament/bracket'
import { Card, Segmented } from '../components/ui'
import { Flag } from '../components/Flag'
import type { Round, ScheduledMatch } from '../domain/types'
import { formatGameDate, careerDayToDate } from '../domain/calendar/calendar.types'

const KO_LIST: Round[] = ['R32', 'R16', 'QF', 'SF', 'THIRD', 'FINAL']
type Tab = 'groups' | 'knockout' | 'scorers'
type CareerTab = 'matches' | 'standings' | 'scorers'

// ── Career Mode ──────────────────────────────────────────────────────────────

function CompetitionLabel({ windowId }: { windowId: string }) {
  const { t } = useTranslation()
  const labels: Record<string, string> = {
    WC_2026: t('tournaments.WC_2026'),
    NL_2627_GROUP: t('tournaments.NATIONS_LEAGUE'),
    NL_2627_KO: t('tournaments.NATIONS_LEAGUE'),
    NL_2627_FINALS: t('tournaments.NATIONS_LEAGUE'),
    SUMMER_2027: 'Continental Tournament 2027',
    WC2030_QUAL: 'WC 2030 Qualification',
    EURO_2028: t('tournaments.EURO_2028'),
    WC_2030: 'FIFA World Cup 2030',
  }
  return <>{labels[windowId] ?? windowId}</>
}

function CareerTournament() {
  const { t, i18n } = useTranslation()
  const g = useGame()
  const [tab, setTab] = useState<CareerTab>('matches')
  const lang = i18n.language as 'tr' | 'en'

  // User matches in current window, sorted by day
  const userMatches = useMemo(() =>
    g.schedule
      .filter((m) => m.windowId === g.currentWindowId && (m.homeId === g.teamId || m.awayId === g.teamId))
      .sort((a, b) => a.day - b.day),
    [g.schedule, g.currentWindowId, g.teamId],
  )

  // Group standings for the user's current competition group
  const groupInfo = useMemo(() => {
    // NL group
    const nlGroup = g.nlGroups.find((gr) => gr.teams.includes(g.teamId ?? ''))
    if (nlGroup && (g.currentWindowId === 'NL_2627_GROUP' || g.currentWindowId === 'NL_2627_KO')) {
      const matches = g.schedule.filter((m) => m.group === nlGroup.id)
      const rows = groupStandings(matches as never[], nlGroup.id, nlGroup.teams)
      return { label: `NL League ${nlGroup.league} · Group ${nlGroup.groupNum}`, rows, teamIds: nlGroup.teams }
    }
    // Qual group
    const qualGroup = g.qualGroups.find((gr) => gr.teams.includes(g.teamId ?? ''))
    if (qualGroup && g.currentWindowId === 'WC2030_QUAL') {
      const matches = g.schedule.filter((m) => m.group === qualGroup.id)
      const rows = groupStandings(matches as never[], qualGroup.id, qualGroup.teams)
      return { label: `Group ${qualGroup.id.split('_').pop()}`, rows, teamIds: qualGroup.teams }
    }
    // Summer 2027 / EURO 2028 — find group from schedule
    const groupId = userMatches[0]?.group
    if (groupId) {
      const groupTeamIds = [...new Set(
        g.schedule
          .filter((m) => m.windowId === g.currentWindowId && m.group === groupId && m.homeId && m.awayId)
          .flatMap((m) => [m.homeId!, m.awayId!]),
      )]
      const matches = g.schedule.filter((m) => m.group === groupId)
      const rows = groupStandings(matches as never[], groupId, groupTeamIds)
      return { label: `Group ${groupId}`, rows, teamIds: groupTeamIds }
    }
    return null
  }, [g.nlGroups, g.qualGroups, g.schedule, g.currentWindowId, g.teamId, userMatches])

  // Top scorers across all schedule results
  const scorers = useMemo(() => {
    const tally = new Map<string, { teamId: string; goals: number }>()
    for (const m of g.schedule) {
      for (const s of m.result?.scorers ?? []) {
        const e = tally.get(s.playerId) ?? { teamId: s.teamId, goals: 0 }
        e.goals++
        tally.set(s.playerId, e)
      }
    }
    return [...tally.entries()].sort((a, b) => b[1].goals - a[1].goals).slice(0, 15)
  }, [g.schedule])

  const tabOptions = [
    { value: 'matches', label: t('tournament.groups') },
    { value: 'standings', label: 'Standings' },
    { value: 'scorers', label: t('tournament.scorers') },
  ] as { value: CareerTab; label: string }[]

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <div>
        <h1 className="text-xl font-black"><CompetitionLabel windowId={g.currentWindowId} /></h1>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {g.calendarWindows.find((w) => w.id === g.currentWindowId)?.competition ?? ''}
        </p>
      </div>

      <Segmented options={tabOptions} value={tab} onChange={setTab} />

      {tab === 'matches' && (
        <>
          {userMatches.length === 0 ? (
            <Card><p className="text-sm text-[var(--muted)]">{t('tournament.notYet')}</p></Card>
          ) : userMatches.map((m) => (
            <Card key={m.id}>
              <div className="text-xs text-[var(--muted)] mb-1">
                {formatGameDate(careerDayToDate(m.day), lang)} · {m.round}
              </div>
              <MatchRow m={m} userTeam={g.teamId ?? ''} />
            </Card>
          ))}
        </>
      )}

      {tab === 'standings' && (
        groupInfo ? (
          <Card>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1">
              {groupInfo.label}
            </div>
            <StandingsTable rows={groupInfo.rows} userTeam={g.teamId ?? ''} />
          </Card>
        ) : (
          <Card><p className="text-sm text-[var(--muted)]">{t('tournament.notYet')}</p></Card>
        )
      )}

      {tab === 'scorers' && (
        <Card>
          <div className="flex flex-col">
            {scorers.length === 0 && <p className="text-sm text-[var(--muted)]">—</p>}
            {scorers.map(([pid, e], i) => (
              <div key={pid} className="flex items-center gap-2 border-b border-[var(--line)] py-1.5 text-sm last:border-0">
                <span className="w-6 text-xs text-[var(--muted)]">{i + 1}.</span>
                <span className={`flex-1 truncate ${e.teamId === g.teamId ? 'font-bold text-[var(--accent)]' : 'font-semibold'}`}>
                  {getPlayer(pid).name}
                </span>
                <Flag code={e.teamId} size={14} />
                <span className="text-xs text-[var(--muted)]">{getTeam(e.teamId).name}</span>
                <span className="w-8 text-right font-extrabold">{e.goals}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

function MatchRow({ m, userTeam }: { m: ScheduledMatch; userTeam: string }) {
  const isUser = m.homeId === userTeam || m.awayId === userTeam
  return (
    <div className={`flex items-center justify-between text-sm ${isUser ? 'font-bold text-[var(--accent)]' : ''}`}>
      <span className="flex items-center gap-1 flex-1 truncate">
        {m.homeId && <Flag code={m.homeId} size={14} />}
        {m.homeId ? getTeam(m.homeId).name : (m.slotHome ?? '?')}
      </span>
      <span className="mx-2 text-[var(--muted)] tabular-nums font-bold">
        {m.result ? resultLabel(m.result) : '–'}
      </span>
      <span className="flex items-center gap-1 flex-1 truncate justify-end">
        {m.awayId ? getTeam(m.awayId).name : (m.slotAway ?? '?')}
        {m.awayId && <Flag code={m.awayId} size={14} />}
      </span>
    </div>
  )
}

function StandingsTable({ rows, userTeam }: {
  rows: { teamId: string; played: number; won: number; drawn: number; lost: number; gd: number; points: number }[]
  userTeam: string
}) {
  const { t } = useTranslation()
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[11px] text-[var(--muted)]">
          <th className="text-left font-normal"> </th>
          <th className="font-normal">{t('tournament.table_p')}</th>
          <th className="font-normal">{t('tournament.table_w')}</th>
          <th className="font-normal">{t('tournament.table_d')}</th>
          <th className="font-normal">{t('tournament.table_l')}</th>
          <th className="font-normal">{t('tournament.table_gd')}</th>
          <th className="font-normal">{t('tournament.table_pts')}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={r.teamId} className={r.teamId === userTeam ? 'font-bold text-[var(--accent)]' : ''}>
            <td className="py-0.5 max-w-32">
              <span className="flex items-center gap-1 truncate">
                {i + 1}. <Flag code={r.teamId} size={13} /> {getTeam(r.teamId).name}
              </span>
            </td>
            <td className="text-center">{r.played}</td>
            <td className="text-center">{r.won}</td>
            <td className="text-center">{r.drawn}</td>
            <td className="text-center">{r.lost}</td>
            <td className="text-center">{r.gd > 0 ? '+' : ''}{r.gd}</td>
            <td className="text-center font-bold">{r.points}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ── Legacy Mode (WC bracket) ─────────────────────────────────────────────────

function LegacyTournament() {
  const { t } = useTranslation()
  const g = useGame()
  const [tab, setTab] = useState<Tab>('groups')

  const scorers = useMemo(() => {
    const tally = new Map<string, { teamId: string; goals: number }>()
    for (const f of g.fixtures) {
      for (const s of f.result?.scorers ?? []) {
        const e = tally.get(s.playerId) ?? { teamId: s.teamId, goals: 0 }
        e.goals++
        tally.set(s.playerId, e)
      }
    }
    return [...tally.entries()]
      .sort((a, b) => b[1].goals - a[1].goals)
      .slice(0, 15)
  }, [g.fixtures])

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <h1 className="text-xl font-black">🏆 2026</h1>
      <Segmented
        options={[
          { value: 'groups', label: t('tournament.groups') },
          { value: 'knockout', label: t('tournament.knockout') },
          { value: 'scorers', label: t('tournament.scorers') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'groups' && GROUPS.map((grp) => {
        const rows = groupStandings(g.fixtures, grp, groupTeams(grp).map((x) => x.id))
        return (
          <Card key={grp}>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
              {t('teamselect.group', { g: grp })}
            </div>
            <StandingsTable rows={rows} userTeam={g.teamId ?? ''} />
          </Card>
        )
      })}

      {tab === 'knockout' && KO_LIST.map((round) => {
        const fs = g.fixtures.filter((f) => f.round === round)
        return (
          <Card key={round}>
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t(`rounds.${round}`)}</div>
            {fs.length === 0 ? (
              <p className="mt-1 text-sm text-[var(--muted)]">{t('tournament.notYet')}</p>
            ) : (
              <div className="mt-1 flex flex-col">
                {fs.map((f) => (
                  <div key={f.id} className="flex items-center justify-between border-b border-[var(--line)] py-1.5 text-sm last:border-0">
                    <span className={`flex flex-1 items-center gap-1 truncate ${f.homeId === g.teamId || f.awayId === g.teamId ? 'font-bold text-[var(--accent)]' : ''}`}>
                      {f.homeId && <Flag code={f.homeId} size={14} />}
                      {f.homeId ? getTeam(f.homeId).name : f.slotHome}
                      <span className="text-[var(--muted)]">–</span>
                      {f.awayId && <Flag code={f.awayId} size={14} />}
                      {f.awayId ? getTeam(f.awayId).name : f.slotAway}
                    </span>
                    <span className="font-bold tabular-nums">{f.result ? resultLabel(f.result) : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}

      {tab === 'scorers' && (
        <Card>
          <div className="flex flex-col">
            {scorers.length === 0 && <p className="text-sm text-[var(--muted)]">—</p>}
            {scorers.map(([pid, e], i) => (
              <div key={pid} className="flex items-center gap-2 border-b border-[var(--line)] py-1.5 text-sm last:border-0">
                <span className="w-6 text-xs text-[var(--muted)]">{i + 1}.</span>
                <span className={`flex-1 truncate ${e.teamId === g.teamId ? 'font-bold text-[var(--accent)]' : 'font-semibold'}`}>
                  {getPlayer(pid).name}
                </span>
                <Flag code={e.teamId} size={14} />
                <span className="text-xs text-[var(--muted)]">{getTeam(e.teamId).name}</span>
                <span className="w-8 text-right font-extrabold">{e.goals}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  )
}

// ── Entry Point ───────────────────────────────────────────────────────────────

export function Tournament() {
  const schedule = useGame((s) => s.schedule)
  return schedule.length > 0 ? <CareerTournament /> : <LegacyTournament />
}
