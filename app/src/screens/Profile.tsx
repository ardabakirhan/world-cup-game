import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGame } from '../store/gameStore'
import { Avatar } from '../components/Avatar'
import { Flag } from '../components/Flag'
import { Card } from '../components/ui'
import type { CareerEntry } from '../domain/types'

const ROUND_PTS: Record<string, number> = {
  CHAMP: 100, FINAL: 60, SF: 40, QF: 25, R16: 15, R32: 10, G3: 5,
}
const GRADE_PTS: Record<string, number> = { A: 20, B: 10, C: 0, D: -5, F: -10 }

const GRADE_COLOR: Record<string, string> = {
  A: '#22c55e', B: '#4ade80', C: '#6b7280', D: '#f59e0b', F: '#ef4444',
}

const ROUND_ICON: Record<string, string> = {
  CHAMP: '🏆', FINAL: '🥈', SF: '🥉', THIRD: '🥉', QF: '⚡', R16: '16', R32: '32', G3: '●',
}

function StatBadge({ icon, value, label }: { icon: string; value: number; label: string }) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className="text-xl leading-none">{icon}</span>
      <span className="text-lg font-black">{value}</span>
      <span className="text-[10px] text-[var(--muted)] text-center leading-tight">{label}</span>
    </div>
  )
}

function EntryCard({ entry }: { entry: CareerEntry }) {
  const { t } = useTranslation()
  const roundLabel = entry.round === 'CHAMP'
    ? t('summary.wonCup')
    : t('summary.reachedRound', { round: t(`rounds.${entry.round}`) })

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0">
      <Flag code={entry.teamId} size={24} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-sm truncate">{entry.teamId.toUpperCase()}</span>
          {entry.fired && (
            <span className="text-[9px] font-bold px-1 rounded" style={{ background: '#ef444422', color: '#ef4444' }}>
              {t('exp.fired').replace('.', '')}
            </span>
          )}
        </div>
        <div className="text-xs text-[var(--muted)] truncate">
          {t(`tournaments.${entry.tournamentId}`)}
        </div>
        <div className="text-xs text-[var(--muted)]">{roundLabel}</div>
      </div>
      <div className="flex flex-col items-end gap-1">
        <span
          className="text-sm font-black w-6 h-6 rounded-full flex items-center justify-center"
          style={{ background: GRADE_COLOR[entry.grade] + '22', color: GRADE_COLOR[entry.grade] }}
        >
          {entry.grade}
        </span>
        <span className="text-base leading-none">{ROUND_ICON[entry.round] ?? '●'}</span>
      </div>
    </div>
  )
}

export function Profile() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()

  const history = useMemo(() => [...g.careerHistory].reverse(), [g.careerHistory])

  const stats = useMemo(() => {
    return {
      total: history.length,
      champs: history.filter((e) => e.round === 'CHAMP').length,
      finals: history.filter((e) => e.round === 'FINAL').length,
      semis: history.filter((e) => e.round === 'SF' || e.round === 'THIRD').length,
      quarters: history.filter((e) => e.round === 'QF').length,
      pts: history.reduce((sum, e) => {
        return sum + (ROUND_PTS[e.round] ?? 5) + (GRADE_PTS[e.grade] ?? 0)
      }, 0),
    }
  }, [history])

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <button className="text-[var(--muted)] text-sm" onClick={() => nav(-1)}>←</button>
        <h1 className="text-xl font-black">{t('profile.title')}</h1>
      </div>

      {g.coach && (
        <Card>
          <div className="flex items-center gap-4">
            <Avatar params={g.coach.avatar} size={60} round />
            <div className="flex-1 min-w-0">
              <div className="font-extrabold text-lg truncate">{g.coach.name}</div>
              <div className="text-sm text-[var(--muted)]">
                {stats.total} {t('profile.seasons')}
              </div>
              <div className="font-bold text-sm mt-0.5" style={{ color: 'var(--accent)' }}>
                {stats.pts} {t('profile.totalPts')}
              </div>
              {g.totalMatchesPlayed >= 5 && (
                <div className="text-xs text-[var(--muted)] mt-0.5">
                  {t('profile.tacticsRating')}:{' '}
                  <span style={{ color: 'var(--accent)' }}>
                    {'★'.repeat(g.coachTacticsRating)}{'☆'.repeat(5 - g.coachTacticsRating)}
                  </span>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      <Card>
        <div className="grid grid-cols-4 gap-1 py-1">
          <StatBadge icon="🏆" value={stats.champs} label={t('profile.championships')} />
          <StatBadge icon="🥈" value={stats.finals} label={t('profile.finals')} />
          <StatBadge icon="🥉" value={stats.semis} label={t('profile.semis')} />
          <StatBadge icon="⚡" value={stats.quarters} label={t('profile.quarters')} />
        </div>
      </Card>

      {history.length === 0 ? (
        <div className="text-center text-sm text-[var(--muted)] py-10">
          {t('profile.noHistory')}
        </div>
      ) : (
        <Card>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1">
            {t('profile.history')}
          </div>
          {history.map((entry, i) => (
            <EntryCard key={i} entry={entry} />
          ))}
        </Card>
      )}
    </div>
  )
}
