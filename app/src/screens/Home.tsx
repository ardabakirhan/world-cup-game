import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getTeam, groupTeams, teamAvgOverall } from '../data/teams'
import { useGame } from '../store/gameStore'
import { groupStandings } from '../domain/tournament/standings'
import { nextTeamFixture, teamFixture, TIMELINE } from '../domain/tournament/schedule'
import { champion, resultLabel } from '../domain/tournament/bracket'
import { Card, Modal, OvrBadge, Segmented } from '../components/ui'
import { Flag } from '../components/Flag'
import type { PrepAction, ScheduledMatch } from '../domain/types'
import {
  getNextUserMatch, getNextFriendly, matchCompetitionLabel,
  currentWindowLabel, getNextMajorTournamentInfo,
} from '../domain/calendar/calendar.engine'
import { formatGameDate, careerDayToDate } from '../domain/calendar/calendar.types'
import type { InboxMessage } from '../domain/types'
import { CurrentStanding } from '../components/CurrentStanding'

const PREP_ACTIONS: PrepAction[] = ['attack', 'defense', 'setpieces', 'rest', 'talk', 'press', 'tactics']

// ── helpers ─────────────────────────────────────────────────────────

function fxDateStr(day: number): string {
  const d = careerDayToDate(day)
  return `${d.day.toString().padStart(2, '0')}.${d.month.toString().padStart(2, '0')}`
}

function fmtInboxDate(day: number): string {
  const d = careerDayToDate(day)
  return `${d.day.toString().padStart(2, '0')}.${d.month.toString().padStart(2, '0')}.${String(d.year).slice(2)}`
}

function compBadge(m: ScheduledMatch): string {
  if (m.matchType === 'friendly') return 'HAZ'
  const wid = (m.windowId ?? '').toUpperCase()
  const isWC   = wid.includes('WC') || wid.startsWith('WORLD')
  const isEuro = wid.includes('EURO') || wid.startsWith('EC')
  const isNL   = wid.includes('NL') || wid.includes('NATIONS')
  const isGC   = wid.includes('GC') || wid.includes('GOLD')
  const isCopa = wid.includes('COPA') || wid.includes('CONCA')
  if (m.matchType === 'qual' || m.matchType === 'playoff') {
    if (isWC) return 'WC(Q)'
    if (isEuro) return 'EC(Q)'
    return 'ELM'
  }
  if (m.matchType === 'knockout' || m.matchType === 'nl_final' as string) {
    if (isWC) return 'WC'
    if (isEuro) return 'EC'
    if (isNL) return 'NL'
    return 'K.O.'
  }
  if (m.matchType === 'group') {
    if (isWC) return 'WC'
    if (isEuro) return 'EC'
    if (isNL) return 'NL'
    if (isGC) return 'GC'
    if (isCopa) return 'CA'
  }
  return 'WC'
}

function confColor(n: number): string {
  if (n >= 80) return '#22c55e'
  if (n >= 60) return '#f59e0b'
  if (n >= 40) return '#f97316'
  return '#ef4444'
}

function confLabel(n: number, lang: string): string {
  const tr = lang === 'tr'
  if (n >= 85) return tr ? 'Mükemmel'    : 'Excellent'
  if (n >= 70) return tr ? 'İyi'          : 'Good'
  if (n >= 55) return tr ? 'Orta'         : 'Average'
  if (n >= 40) return tr ? 'Endişeli'     : 'Worried'
  return            tr ? 'Risk Altında'  : 'At Risk'
}

// ── sub-components ───────────────────────────────────────────────────

function GridButton({
  icon, label, subtitle, onClick, primary, badge, muted, borderLeft, borderTop,
}: {
  icon: string; label: string; subtitle?: string; onClick: () => void
  primary?: boolean; badge?: boolean; muted?: boolean
  borderLeft?: boolean; borderTop?: boolean
}) {
  return (
    <button
      onClick={muted ? undefined : onClick}
      className="row-tap flex flex-col items-center justify-center gap-1 relative"
      style={{
        background: primary
          ? `color-mix(in srgb, var(--accent) 18%, var(--card))`
          : 'var(--card)',
        borderLeft: borderLeft ? '1px solid var(--line)' : undefined,
        borderTop:  borderTop  ? '1px solid var(--line)' : undefined,
        opacity: muted ? 0.38 : 1,
        padding: '6px 4px',
      }}
    >
      {badge && (
        <span
          className="absolute top-2 right-2 h-2 w-2 rounded-full"
          style={{ background: 'var(--bad)' }}
        />
      )}
      <span style={{ fontSize: 30, lineHeight: 1 }}>{icon}</span>
      <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', textAlign: 'center', marginTop: 4 }}>
        {label}
      </span>
      {subtitle && (
        <span style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', maxWidth: '92%', lineHeight: 1.2 }}>
          {subtitle}
        </span>
      )}
    </button>
  )
}

function SmallButton({
  icon, label, onClick, borderLeft,
}: {
  icon: string; label: string; onClick: () => void; borderLeft?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="row-tap flex items-center justify-center gap-2"
      style={{
        background: 'var(--card2)',
        borderTop:  '1px solid var(--line)',
        borderLeft: borderLeft ? '1px solid var(--line)' : undefined,
        padding: '10px 8px',
      }}
    >
      <span style={{ fontSize: 16 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--muted)' }}>{label}</span>
    </button>
  )
}

// ── Main Home ────────────────────────────────────────────────────────

export function Home() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const teamId = g.teamId!
  const team = getTeam(teamId)

  const isCareerMode = g.schedule.length > 0
  const [prepOpen, setPrepOpen] = useState(false)
  const [inboxOpen, setInboxOpen] = useState(false)

  if (!isCareerMode) return <LegacyHome />

  const nextMatch    = getNextUserMatch(g.schedule, teamId, g.day)
  const nextFriendly = getNextFriendly(g.schedule, teamId, g.day)

  const isMatchToday   = g.phase === 'matchday' && nextMatch?.day === g.day
  const isMatchThisWeek = !!nextMatch && nextMatch.day <= g.day + 6

  const inbox  = g.inbox ?? []
  const unread = inbox.filter((m) => !m.read).length

  const oppOf = (m: ScheduledMatch) => m.homeId === teamId ? m.awayId : m.homeId

  const windowLabel = currentWindowLabel(g.currentWindowId, g.qualGroups, teamId)

  // Next 8 upcoming user fixtures
  const fixtureStrip = g.schedule
    .filter((m) => !m.result && !m.simulated && m.day >= g.day &&
      (m.homeId === teamId || m.awayId === teamId))
    .sort((a, b) => a.day - b.day)
    .slice(0, 8)

  // Board confidence derived from recent results
  const confidence = (() => {
    let conf = 65
    const recent = g.schedule
      .filter((m) => !!m.result && (m.homeId === teamId || m.awayId === teamId))
      .sort((a, b) => b.day - a.day)
      .slice(0, 5)
    for (const m of recent) {
      const isHome = m.homeId === teamId
      const gf = isHome ? m.result!.homeGoals : m.result!.awayGoals
      const ga = isHome ? m.result!.awayGoals : m.result!.homeGoals
      if (gf > ga) conf = Math.min(95, conf + 8)
      else if (gf < ga) conf = Math.max(15, conf - 10)
      else conf = Math.min(95, Math.max(15, conf + 1))
    }
    if (g.wcQualState === 'qualified')  conf = Math.min(99, conf + 10)
    if (g.wcQualState === 'eliminated') conf = Math.max(10, conf - 15)
    return conf
  })()

  // "Devam Et" action
  const handleDevamEt = () => {
    if (needsSquadLock) return nav('/player-pool')
    if (isMatchToday)    return nav('/lineup')
    if (isMatchThisWeek) return setPrepOpen(true)
    return g.advanceWeek()
  }

  const devamEtLabel = isMatchToday
    ? (g.lang === 'tr' ? 'Maça Git' : 'Go to Match')
    : isMatchThisWeek
      ? (g.lang === 'tr' ? 'Devam Et' : 'Continue')
      : (g.lang === 'tr' ? 'Devam Et' : 'Continue')

  const devamEtSub = isMatchToday
    ? '⚽'
    : isMatchThisWeek && nextMatch && oppOf(nextMatch)
      ? `vs ${getTeam(oppOf(nextMatch)!).name}`
      : g.lang === 'tr' ? '(haftayı atla)' : '(skip week)'

  // For prep modal: use nextMatch or nextFriendly opponent
  const prepTarget = nextMatch ?? nextFriendly
  const prepOppId  = prepTarget ? oppOf(prepTarget) : null

  // Youth notification
  const youthReady = g.youthSquad.u21.some((p) => p.stats.overall >= 68)

  // Tournament squad lock
  const tournInfo = getNextMajorTournamentInfo(g.schedule, g.calendarWindows, teamId, g.day)
  const needsSquadLock = !!tournInfo && !g.tournamentSquadLocked
  const isSquadLocked = g.tournamentSquadLocked && !!g.activeTournamentId

  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{ height: '100%', background: 'var(--bg)' }}
    >
      {/* ─── SECTION 1: Date bar ─────────────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          background: 'var(--card2)',
          borderBottom: '1px solid var(--line)',
          textAlign: 'center',
          padding: '8px 16px',
        }}
      >
        <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: '-0.02em', fontFamily: 'monospace' }}>
          {formatGameDate(g.currentDate, g.lang)}
        </div>
        <div
          style={{
            fontSize: 9,
            color: 'var(--muted)',
            marginTop: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          <Flag code={teamId} size={11} />
          {team.name} · {windowLabel}
        </div>
      </div>

      {/* ─── SECTION 2: Three-column info bar ────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          borderBottom: '1px solid var(--line)',
          height: 178,
        }}
      >
        {/* LEFT — Fixtures */}
        <div style={{ borderRight: '1px solid var(--line)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={colHdr}>{t('home.fixtures')}</div>
          <div style={{ overflowY: 'hidden', flex: 1 }}>
            {fixtureStrip.slice(0, 6).map((fx) => {
              const badge = compBadge(fx)
              return (
                <div
                  key={fx.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    padding: '2px 5px',
                    borderBottom: '1px solid var(--line)',
                  }}
                >
                  <span style={{ color: 'var(--muted)', fontFamily: 'monospace', fontSize: 9, width: 28, flexShrink: 0 }}>
                    {fxDateStr(fx.day)}
                  </span>
                  {fx.homeId ? <Flag code={fx.homeId} size={11} /> : <span style={{ width: 11 }} />}
                  <span style={{ color: 'var(--muted)', fontSize: 8 }}>-:-</span>
                  {fx.awayId ? <Flag code={fx.awayId} size={11} /> : <span style={{ width: 11 }} />}
                  <span style={badgePill}>{badge}</span>
                </div>
              )
            })}
            {fixtureStrip.length === 0 && (
              <div style={{ padding: '8px 6px', fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>
                —
              </div>
            )}
          </div>
        </div>

        {/* CENTER — Inbox / Next match preview */}
        <div style={{ borderRight: '1px solid var(--line)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <button
            style={{ ...colHdr, cursor: 'pointer', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 4 }}
            onClick={() => setInboxOpen(true)}
          >
            <span>{g.lang === 'tr' ? 'Mesaj Kutusu' : 'Inbox'}</span>
            {unread > 0 && (
              <span
                className="pulse-dot"
                style={{
                  background: 'var(--accent)',
                  color: '#fff',
                  borderRadius: 9999,
                  padding: '0 4px',
                  fontSize: 8,
                  fontWeight: 900,
                  flexShrink: 0,
                }}
              >
                {unread}
              </span>
            )}
          </button>

          <div style={{ flex: 1, padding: '4px 6px', overflow: 'hidden' }}>
            {nextMatch ? (
              <>
                <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 1 }}>
                  {g.lang === 'tr' ? 'Gelecek maç:' : 'Next match:'}
                </div>
                <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 6 }}>
                  {fxDateStr(nextMatch.day)} · {matchCompetitionLabel(nextMatch)}
                </div>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {nextMatch.homeId && <Flag code={nextMatch.homeId} size={28} />}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: nextMatch.homeId === teamId ? 'var(--accent)' : 'var(--text)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {(nextMatch.homeId ?? '').slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                  <span style={{ color: 'var(--muted)', fontWeight: 700, fontSize: 13 }}>–</span>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                    {nextMatch.awayId && <Flag code={nextMatch.awayId} size={28} />}
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: nextMatch.awayId === teamId ? 'var(--accent)' : 'var(--text)',
                        fontFamily: 'monospace',
                      }}
                    >
                      {(nextMatch.awayId ?? '').slice(0, 3).toUpperCase()}
                    </span>
                  </div>
                </div>
              </>
            ) : nextFriendly ? (
              <div style={{ textAlign: 'center', paddingTop: 8 }}>
                <div style={{ fontSize: 8, color: 'var(--muted)', marginBottom: 6 }}>
                  {g.lang === 'tr' ? 'Hazırlık maçı' : 'Friendly'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  {nextFriendly.homeId && <Flag code={nextFriendly.homeId} size={26} />}
                  <span style={{ color: 'var(--muted)', fontWeight: 700 }}>–</span>
                  {nextFriendly.awayId && <Flag code={nextFriendly.awayId} size={26} />}
                </div>
              </div>
            ) : (
              <div style={{ paddingTop: 24, fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>
                {t('home.careerComplete')}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — Board confidence */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={colHdr}>{g.lang === 'tr' ? 'Güven' : 'Confidence'}</div>
          <div style={{ flex: 1, padding: '6px 8px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 900, color: confColor(confidence) }}>
              {confidence}%
            </div>
            <div
              style={{
                height: 5,
                background: 'var(--line)',
                borderRadius: 2,
                overflow: 'hidden',
                margin: '4px 0',
              }}
            >
              <div
                style={{
                  width: `${confidence}%`,
                  height: '100%',
                  background: confColor(confidence),
                  transition: 'width 0.5s ease',
                }}
              />
            </div>
            <div style={{ fontSize: 9, fontWeight: 700, color: confColor(confidence) }}>
              {confLabel(confidence, g.lang)}
            </div>
            {g.wcQualState !== 'n/a' && g.wcQualState !== 'not_started' && (
              <div
                style={{
                  marginTop: 6,
                  padding: '2px 4px',
                  borderRadius: 2,
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  fontSize: 8,
                  color:
                    g.wcQualState === 'qualified'  ? 'var(--good)' :
                    g.wcQualState === 'eliminated' ? 'var(--bad)'  : 'var(--muted)',
                }}
              >
                {t(`home.wcQual_${g.wcQualState}`)}
              </div>
            )}
            {/* Youth ready notification */}
            {youthReady && (
              <div
                style={{
                  marginTop: 4,
                  padding: '2px 4px',
                  borderRadius: 2,
                  background: 'var(--card2)',
                  border: '1px solid var(--line)',
                  fontSize: 8,
                  color: 'var(--accent)',
                  cursor: 'pointer',
                }}
                onClick={() => nav('/squad')}
              >
                🌟 {g.lang === 'tr' ? 'U-21 hazır' : 'U-21 ready'}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ─── Squad lock banner ──────────────────────────────────── */}
      {(needsSquadLock || isSquadLocked) && (
        <button
          onClick={() => nav('/player-pool')}
          style={{
            flexShrink: 0,
            background: needsSquadLock ? 'var(--bad)' : 'var(--good)',
            color: '#fff',
            padding: '8px 16px',
            textAlign: 'center',
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          {needsSquadLock
            ? `⚠️ ${g.lang === 'tr' ? tournInfo!.competition + ' için kadro seçimi zorunlu!' : 'Squad selection required for ' + tournInfo!.competition}`
            : `🔒 ${g.lang === 'tr' ? 'Turnuva kadrosu kilitli' : 'Tournament squad locked'}`
          }
        </button>
      )}

      {/* ─── SECTION 3: Action grid (2×3) ───────────────────────── */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr 1fr',
          borderBottom: '1px solid var(--line)',
        }}
      >
        <GridButton
          icon={isMatchToday ? '▶' : isMatchThisWeek ? '▶' : '⏩'}
          label={devamEtLabel}
          subtitle={devamEtSub}
          onClick={handleDevamEt}
          primary={isMatchThisWeek || isMatchToday}
          badge={isMatchToday}
        />
        <GridButton
          icon="👥"
          label={g.lang === 'tr' ? 'Kadro' : 'Squad'}
          onClick={() => nav('/squad')}
          borderLeft
        />
        <GridButton
          icon="📋"
          label={g.lang === 'tr' ? 'Oyuncu Havuzu' : 'Player Pool'}
          subtitle={needsSquadLock ? (g.lang === 'tr' ? '⚠️ Kadro seç!' : '⚠️ Select squad!') : undefined}
          onClick={() => nav('/player-pool')}
          borderTop
          badge={needsSquadLock}
        />
        <GridButton
          icon="📋"
          label={g.lang === 'tr' ? 'Taktik' : 'Tactics'}
          onClick={() => nav('/tactics')}
          borderLeft
          borderTop
        />
        <GridButton
          icon="⚽"
          label={g.lang === 'tr' ? 'Antrenman' : 'Training'}
          onClick={() => {
            if (!g.prepActionUsed) {
              if (prepOppId) setPrepOpen(true)
              else g.doPrepAction('rest')
            }
          }}
          borderTop
          muted={g.prepActionUsed}
          subtitle={g.prepActionUsed ? (g.lang === 'tr' ? 'Yapıldı ✓' : 'Done ✓') : undefined}
        />
        <GridButton
          icon="🏆"
          label={g.lang === 'tr' ? 'Turnuvalar' : 'Competitions'}
          onClick={() => nav('/tournament')}
          borderLeft
          borderTop
        />
      </div>

      {/* ─── SECTION 4: Current standing widget ─────────────────── */}
      <CurrentStanding
        teamId={teamId}
        schedule={g.schedule}
        currentWindowId={g.currentWindowId}
        calendarWindows={g.calendarWindows}
        qualGroups={g.qualGroups}
        nlGroups={g.nlGroups}
        isTR={g.lang === 'tr'}
      />

      {/* ─── SECTION 5: Small bottom row ────────────────────────── */}
      <div
        style={{
          flexShrink: 0,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
        }}
      >
        <SmallButton
          icon="🏛️"
          label={g.lang === 'tr' ? 'Federasyon' : 'Federation'}
          onClick={() => nav('/federation')}
        />
        <SmallButton
          icon="👤"
          label={g.lang === 'tr' ? 'Profil' : 'Profile'}
          onClick={() => nav('/profile')}
          borderLeft
        />
      </div>

      {/* ─── Modals ─────────────────────────────────────────────── */}
      {prepOppId && (
        <Modal open={prepOpen} onClose={() => setPrepOpen(false)}>
          <MatchPrep
            oppId={prepOppId}
            userTeamId={teamId}
            schedule={g.schedule}
            onGoTactics={() => { setPrepOpen(false); nav('/tactics') }}
            onSimToMatch={() => {
              setPrepOpen(false)
              if (needsSquadLock) { nav('/player-pool'); return }
              g.advanceToNextMatch()
            }}
          />
        </Modal>
      )}
      <Modal open={inboxOpen} onClose={() => setInboxOpen(false)}>
        <InboxList
          messages={inbox}
          onOpen={(id) => g.markInboxRead(id)}
          onReadAll={() => g.markInboxRead()}
          onClear={() => { g.clearInbox(); setInboxOpen(false) }}
        />
      </Modal>
    </div>
  )
}

// Shared inline styles
const colHdr: React.CSSProperties = {
  padding: '4px 6px',
  borderBottom: '1px solid var(--line)',
  fontSize: 9,
  fontWeight: 700,
  color: 'var(--muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  flexShrink: 0,
}

const badgePill: React.CSSProperties = {
  background: 'var(--card2)',
  border: '1px solid var(--line)',
  borderRadius: 2,
  padding: '0 2px',
  fontSize: 7,
  color: 'var(--muted)',
  flexShrink: 0,
  marginLeft: 'auto',
  fontFamily: 'monospace',
}

// ── Inbox message list ───────────────────────────────────────────────

const INBOX_ICON: Record<string, string> = {
  board: '🏛️', suspension: '🟥', suspension_over: '✅', injury: '🚑', press: '📰', news: '🌍',
}

function InboxList(props: {
  messages: InboxMessage[]
  onOpen: (id: string) => void
  onReadAll: () => void
  onClear: () => void
}) {
  const { t } = useTranslation()
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const sorted = [...props.messages].sort((a, b) => b.day - a.day)

  const resolve = (m: InboxMessage) => {
    const params: Record<string, string | number> = { ...(m.params ?? {}) }
    if (m.params?.reasonKey) params.reason = t(String(m.params.reasonKey))
    if (m.params?.facilityKey) params.facility = t(String(m.params.facilityKey))
    if (m.params?.tournamentKey) params.tournament = t(`tournaments.${String(m.params.tournamentKey)}`)
    return { title: t(m.titleKey, params), body: t(m.bodyKey, params) }
  }

  const handleTap = (id: string) => {
    props.onOpen(id)
    setExpandedId((prev) => (prev === id ? null : id))
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-extrabold">📬 {t('home.inboxTitle')}</h2>
        {props.messages.length > 0 && (
          <div className="flex gap-2">
            <button className="text-xs text-[var(--accent)] font-bold" onClick={props.onReadAll}>{t('home.inboxReadAll')}</button>
            <button className="text-xs text-[var(--muted)] font-bold" onClick={props.onClear}>{t('home.inboxClear')}</button>
          </div>
        )}
      </div>
      {sorted.length === 0 ? (
        <p className="text-sm text-[var(--muted)] text-center py-6">{t('home.inboxEmpty')}</p>
      ) : (
        <div className="flex flex-col max-h-[60dvh] overflow-y-auto">
          {sorted.map((m) => {
            const { title, body } = resolve(m)
            const isExpanded = expandedId === m.id
            return (
              <button
                key={m.id}
                className="flex items-start gap-2 border-b border-[var(--line)] last:border-0 py-2.5 text-left row-tap"
                onClick={() => handleTap(m.id)}
              >
                <span className="text-base mt-0.5 shrink-0">{INBOX_ICON[m.kind] ?? '✉️'}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    {!m.read && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: 'var(--accent)' }} />}
                    <span className={`text-sm truncate ${m.read ? 'font-semibold text-[var(--muted)]' : 'font-extrabold'}`}>{title}</span>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">{fmtInboxDate(m.day)}</div>
                  {isExpanded && (
                    <div className="text-xs mt-1 leading-relaxed" style={{ color: 'var(--text)' }}>{body}</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Match prep modal ─────────────────────────────────────────────────

interface MatchPrepProps {
  oppId: string
  userTeamId: string
  schedule: ScheduledMatch[]
  onGoTactics: () => void
  onSimToMatch: () => void
}

function MatchPrep({ oppId, userTeamId, schedule, onGoTactics, onSimToMatch }: MatchPrepProps) {
  const { t } = useTranslation()
  const g = useGame()
  const opp = getTeam(oppId)
  const user = getTeam(userTeamId)
  const oppOvr = teamAvgOverall(opp)
  const userOvr = teamAvgOverall(user)
  const diff = userOvr - oppOvr

  const top3 = [...opp.players].sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 3)

  const getForm = (teamId: string) =>
    schedule
      .filter((m) => (m.homeId === teamId || m.awayId === teamId) && m.result)
      .sort((a, b) => b.day - a.day)
      .slice(0, 3)
      .map((m) => {
        const isHome = m.homeId === teamId
        const gf = isHome ? m.result!.homeGoals : m.result!.awayGoals
        const ga = isHome ? m.result!.awayGoals : m.result!.homeGoals
        const penHome = m.result?.pens?.home ?? 0
        const penAway = m.result?.pens?.away ?? 0
        const penWin = isHome ? penHome > penAway : penAway > penHome
        if (gf > ga || (gf === ga && penWin)) return 'W'
        if (gf < ga || (gf === ga && !penWin && m.result?.pens)) return 'L'
        return 'D'
      })

  const oppForm  = getForm(oppId)
  const userForm = getForm(userTeamId)
  const hint = diff >= 8 ? t('home.scoutHintFav') : diff <= -8 ? t('home.scoutHintUnder') : t('home.scoutHintEven')
  const dotColor = (r: string) => r === 'W' ? 'var(--good)' : r === 'L' ? 'var(--bad)' : 'var(--muted)'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Flag code={oppId} size={28} />
        <div>
          <div className="text-base font-extrabold">{opp.name}</div>
          <div className="text-xs text-[var(--muted)]">{t('home.scoutReport')}</div>
        </div>
        <OvrBadge value={Math.round(oppOvr)} estimated={false} />
      </div>
      <div className="flex gap-4">
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)] font-bold mb-1">{user.name}</div>
          <div className="flex gap-1">
            {userForm.length === 0
              ? <span className="text-xs text-[var(--muted)]">—</span>
              : userForm.map((r, i) => (
                  <span key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                    style={{ background: dotColor(r) }}>{r}</span>
                ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] uppercase text-[var(--muted)] font-bold mb-1">{opp.name}</div>
          <div className="flex gap-1">
            {oppForm.length === 0
              ? <span className="text-xs text-[var(--muted)]">—</span>
              : oppForm.map((r, i) => (
                  <span key={i} className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-extrabold text-white"
                    style={{ background: dotColor(r) }}>{r}</span>
                ))}
          </div>
        </div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-[var(--muted)] font-bold mb-1">{t('home.scoutTopPlayers')}</div>
        {top3.map((p) => (
          <div key={p.id} className="flex items-center gap-2 py-1 border-b border-[var(--line)] last:border-0">
            <OvrBadge value={p.stats.overall} estimated={p.estimated} />
            <span className="flex-1 text-sm font-semibold truncate">{p.name}</span>
            <span className="text-xs text-[var(--muted)]">{p.position}</span>
          </div>
        ))}
      </div>
      <div className="rounded-lg p-2 text-xs text-[var(--fg)]" style={{ background: 'var(--card2)' }}>
        💡 {hint}
      </div>
      <div>
        <div className="text-[10px] uppercase text-[var(--muted)] font-bold mb-1">{t('home.training')}</div>
        {g.prepActionUsed ? (
          <p className="text-sm text-[var(--good)]">✓ {t('home.prepUsed')}</p>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {PREP_ACTIONS.map((a) => (
              <button key={a} className="btn-ghost text-left" onClick={() => g.doPrepAction(a)}>
                <div className="text-sm font-bold">{t(`prep.${a}`)}</div>
                <div className="text-[11px] text-[var(--muted)]">{t(`prep.${a}Desc`)}</div>
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="flex gap-2 mt-1">
        <button className="btn-ghost flex-1" onClick={onGoTactics}>📋 {t('home.goToTactics')}</button>
        <button className="btn flex-1" onClick={onSimToMatch}>▶▶ {t('home.simToMatch')}</button>
      </div>
    </div>
  )
}

// ── Legacy Home (old saves without calendar schedule) ────────────────

function LegacyHome() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const teamId = g.teamId!
  const team = getTeam(teamId)

  const todayFx = teamFixture(g.fixtures, teamId, g.day)
  const nextFx = nextTeamFixture(g.fixtures, teamId, g.day)
  const isMatchToday = g.phase === 'matchday' && todayFx && !todayFx.result && !g.eliminated
  const champ = champion(g.fixtures)
  const dayMatchesPending = g.phase === 'matchday' &&
    g.fixtures.some((f) => f.day === g.day && !f.result)

  const standings = groupStandings(g.fixtures, team.group!, groupTeams(team.group!).map((x) => x.id))
  const ownFixtures = g.fixtures
    .filter((f) => f.homeId === teamId || f.awayId === teamId)
    .sort((a, b) => a.day - b.day)

  const oppOf = (fx: typeof ownFixtures[number]) =>
    fx.homeId === teamId ? fx.awayId : fx.homeId

  return (
    <div className="p-4 flex flex-col gap-3 pb-6">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-black">{team.name}</h1>
          <p className="text-xs text-[var(--muted)]">
            {t('common.day', { n: g.day + 1 })} / {TIMELINE.length}
          </p>
        </div>
        <div className="w-24">
          <Segmented
            options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
            value={g.lang}
            onChange={(v) => g.setLang(v)}
          />
        </div>
      </header>

      {champ && (
        <Card className="text-center">
          <div className="text-lg">🏆 {t('home.champion', { team: getTeam(champ).name })}</div>
          <button className="btn w-full mt-2" onClick={() => nav('/summary')}>{t('home.viewSummary')}</button>
        </Card>
      )}

      {g.eliminated && g.phase !== 'finished' && (
        <Card>
          <p className="text-sm text-[var(--warn)]">
            ⚠️ {t('home.eliminated', { round: t(`rounds.${g.eliminatedRound ?? 'G3'}`) })}
          </p>
        </Card>
      )}

      {nextFx && oppOf(nextFx) && (
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            {t('home.nextMatch')} — {t(`rounds.${nextFx.round}`)}
            {nextFx.day === g.day && <span className="ml-2 text-[var(--accent)]">{t('home.today')}</span>}
          </div>
          <div className="mt-1 flex items-center gap-2 text-lg font-extrabold">
            <Flag code={teamId} size={22} />
            <span className="truncate">{team.name}</span>
            <span className="text-[var(--muted)] font-normal">vs</span>
            <Flag code={oppOf(nextFx)!} size={22} />
            <span className="truncate">{getTeam(oppOf(nextFx)!).name}</span>
          </div>
          {isMatchToday && (
            <button className="btn w-full mt-3" onClick={() => nav('/match')}>⚽ {t('home.toMatch')}</button>
          )}
        </Card>
      )}

      {team.group && (
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
            {t('home.groupTable', { g: team.group })}
          </div>
          <table className="w-full mt-1 text-sm">
            <thead>
              <tr className="text-[11px] text-[var(--muted)]">
                <th className="text-left font-normal"> </th>
                <th className="font-normal">P</th>
                <th className="font-normal">GD</th>
                <th className="font-normal">Pts</th>
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => (
                <tr key={r.teamId} className={r.teamId === teamId ? 'font-bold text-[var(--accent)]' : ''}>
                  <td className="py-0.5">
                    <span className="inline-flex items-center gap-1.5">
                      {i + 1}. <Flag code={r.teamId} size={14} /> {getTeam(r.teamId).name}
                    </span>
                  </td>
                  <td className="text-center">{r.played}</td>
                  <td className="text-center">{r.gd > 0 ? '+' : ''}{r.gd}</td>
                  <td className="text-center font-bold">{r.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('home.calendar')}</div>
        <div className="mt-1 flex flex-col">
          {ownFixtures.map((fx) => (
            <div key={fx.id} className="flex items-center justify-between border-b border-[var(--line)] last:border-0 py-1.5 text-sm">
              <span className="text-xs text-[var(--muted)] w-20">{t(`rounds.${fx.round}`)}</span>
              <span className="flex-1 px-2 truncate">
                {fx.homeId ? getTeam(fx.homeId).name : '—'} – {fx.awayId ? getTeam(fx.awayId).name : '—'}
              </span>
              <span className="font-bold tabular-nums">{fx.result ? resultLabel(fx.result) : ''}</span>
            </div>
          ))}
        </div>
      </Card>

      {g.phase !== 'finished' && !champ && (
        <button
          className={isMatchToday ? 'btn-ghost w-full' : 'btn w-full'}
          disabled={!!isMatchToday}
          style={isMatchToday ? { opacity: 0.5 } : undefined}
          onClick={() => g.advanceDay()}
        >
          {g.phase === 'matchday' && dayMatchesPending && !isMatchToday
            ? `▶ ${t('home.simDay')}`
            : `${t('home.advance')} →`}
        </button>
      )}
    </div>
  )
}
