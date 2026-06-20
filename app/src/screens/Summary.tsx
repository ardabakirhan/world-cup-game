import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TEAMS, getPlayer, getTeam, teamAvgOverall } from '../data/teams'
import { useGame } from '../store/gameStore'
import { champion } from '../domain/tournament/bracket'
import { Card, Modal } from '../components/ui'
import type { Round } from '../domain/types'

const ROUND_SCORE: Record<string, number> = { G3: 0, R32: 1, R16: 2, QF: 3, SF: 4, THIRD: 4, FINAL: 5, CHAMP: 6 }

const GRADE_COLOR: Record<string, string> = {
  A: '#22c55e',
  B: '#4ade80',
  C: '#6b7280',
  D: '#f59e0b',
  F: '#ef4444',
}

export function Summary() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const [confirmRestart, setConfirmRestart] = useState(false)
  const champ = champion(g.fixtures)

  const userRound: Round | 'CHAMP' = useMemo(() => {
    if (champ === g.teamId) return 'CHAMP'
    const playedIn = (r: Round) =>
      g.fixtures.some((f) => f.round === r && (f.homeId === g.teamId || f.awayId === g.teamId))
    if (playedIn('FINAL')) return 'FINAL'
    if (playedIn('SF') || playedIn('THIRD')) return 'SF'
    for (const r of ['QF', 'R16', 'R32'] as Round[]) if (playedIn(r)) return r
    return 'G3'
  }, [champ, g.fixtures, g.teamId])

  const grade = useMemo<'A' | 'B' | 'C' | 'D' | 'F'>(() => {
    const rank = [...TEAMS].sort((a, b) => teamAvgOverall(b) - teamAvgOverall(a))
      .findIndex((tm) => tm.id === g.teamId)
    const expected = rank < 4 ? 4 : rank < 8 ? 3 : rank < 16 ? 2 : rank < 32 ? 1 : 0
    const achieved = ROUND_SCORE[userRound] ?? 0
    const d = achieved - expected
    return d >= 2 ? 'A' : d === 1 ? 'B' : d === 0 ? 'C' : d === -1 ? 'D' : 'F'
  }, [g.teamId, userRound])

  // Record the career end once when Summary is first shown
  useEffect(() => {
    if (!g.careerEndRecorded) g.recordCareerEnd(grade)
  }, []) // intentionally run once on mount

  const scorers = useMemo(() => {
    const tally = new Map<string, { teamId: string; goals: number }>()
    for (const f of g.fixtures)
      for (const s of f.result?.scorers ?? []) {
        const e = tally.get(s.playerId) ?? { teamId: s.teamId, goals: 0 }
        e.goals++
        tally.set(s.playerId, e)
      }
    return [...tally.entries()].sort((a, b) => b[1].goals - a[1].goals).slice(0, 5)
  }, [g.fixtures])

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <h1 className="text-xl font-black">{t('summary.title')}</h1>

      {champ && (
        <Card className="text-center py-6">
          <div className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">{t('summary.champion')}</div>
          <div className="mt-1 text-3xl font-black">🏆 {getTeam(champ).name}</div>
        </Card>
      )}

      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('summary.yourRun')}</div>
        <p className="mt-1 text-lg font-bold">
          {userRound === 'CHAMP'
            ? `🥇 ${t('summary.wonCup')}`
            : t('summary.reachedRound', { round: t(`rounds.${userRound}`) })}
        </p>
        <div className="mt-2 flex items-center gap-3">
          <span
            className="text-4xl font-black"
            style={{ color: GRADE_COLOR[grade] }}
          >
            {grade}
          </span>
          <div>
            <div className="text-xs font-bold uppercase text-[var(--muted)]">{t('summary.grade')}</div>
            <p className="text-sm">{t(`summary.gradeDesc.${grade}`)}</p>
          </div>
        </div>
      </Card>

      {/* Firing verdict */}
      <Card
        style={{
          borderLeft: `3px solid ${g.fired ? '#ef4444' : '#22c55e'}`,
        }}
      >
        <div
          className="font-bold text-sm"
          style={{ color: g.fired ? '#ef4444' : '#22c55e' }}
        >
          {t(g.fired ? 'exp.fired' : 'exp.notFired')}
        </div>
        <p className="text-xs text-[var(--muted)] mt-0.5">
          {t(g.fired ? 'exp.firedDesc' : 'exp.notFiredDesc')}
        </p>
      </Card>

      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('summary.topScorers')}</div>
        <div className="mt-1 flex flex-col">
          {scorers.map(([pid, e], i) => (
            <div key={pid} className="flex items-center gap-2 border-b border-[var(--line)] py-1.5 text-sm last:border-0">
              <span className="w-6 text-xs text-[var(--muted)]">{i + 1}.</span>
              <span className="flex-1 font-semibold truncate">{getPlayer(pid).name}</span>
              <span className="text-xs text-[var(--muted)]">{getTeam(e.teamId).name}</span>
              <span className="w-8 text-right font-extrabold">{e.goals}</span>
            </div>
          ))}
        </div>
      </Card>

      <div className="flex gap-2">
        <button className="btn-ghost flex-1" onClick={() => nav('/profile')}>
          {t('summary.viewCareer')}
        </button>
        {g.schedule.length > 0 && g.phase !== 'finished' ? (
          <button className="btn flex-1" onClick={() => nav('/home')}>
            {t('summary.continueCareer')}
          </button>
        ) : (
          <button className="btn flex-1" onClick={() => setConfirmRestart(true)}>
            🔄 {t('summary.playAgain')}
          </button>
        )}
      </div>

      <Modal open={confirmRestart} onClose={() => setConfirmRestart(false)}>
        <p className="text-sm">{t('common.restartConfirm')}</p>
        <button className="btn w-full mt-3" onClick={() => { g.restart(); nav('/newgame') }}>
          {t('common.confirm')}
        </button>
        <button className="btn-ghost w-full mt-2" onClick={() => setConfirmRestart(false)}>
          {t('common.cancel')}
        </button>
      </Modal>
    </div>
  )
}
