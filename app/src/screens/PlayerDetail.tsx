import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getPlayer } from '../data/teams'
import { useGame } from '../store/gameStore'
import { Card, CondDot, OvrBadge, StatBar } from '../components/ui'
import { Avatar } from '../components/Avatar'

function age(birthDate: string): number {
  if (!birthDate) return 0
  const b = new Date(birthDate)
  const ref = new Date('2026-06-11')
  let a = ref.getFullYear() - b.getFullYear()
  if (ref < new Date(ref.getFullYear(), b.getMonth(), b.getDate())) a--
  return a
}

export function PlayerDetail() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const { playerId } = useParams()
  const g = useGame()
  const p = getPlayer(playerId!)
  const st = g.playerStates[p.id]

  return (
    <div className="p-4 pb-6 flex flex-col gap-3">
      <button className="text-sm text-[var(--accent)] text-left" onClick={() => nav(-1)}>← {t('squad.title')}</button>
      <Card>
        <div className="flex items-center gap-3">
          <Avatar params={p.avatar} size={56} />
          <div className="flex-1">
            <h1 className="text-lg font-extrabold">#{p.number} {p.name}</h1>
            <p className="text-xs text-[var(--muted)]">
              {p.position} · {p.club} · {t('squad.age')} {age(p.birthDate)}
            </p>
          </div>
          <OvrBadge value={p.stats.overall} estimated={p.estimated} />
        </div>
        <div className="mt-2 flex gap-4 text-xs text-[var(--muted)]">
          <span>{t('squad.caps')}: <b className="text-[var(--text)]">{p.caps}</b></span>
          <span>{t('squad.goals')}: <b className="text-[var(--text)]">{p.goals}</b></span>
          <span>{t('squad.tournamentGoals', { n: st.goals })}</span>
        </div>
        <div className="mt-2 flex gap-4 text-xs">
          <span className="text-[var(--muted)]">{t('common.form')}: <CondDot value={st.form} max={10} /></span>
          <span className="text-[var(--muted)]">{t('common.morale')}: <CondDot value={st.morale} max={10} /></span>
          <span className="text-[var(--muted)]">{t('common.fitness')}: <CondDot value={st.fitness} max={100} /></span>
        </div>
        {st.injuredUntilDay > g.day && (
          <p className="mt-2 text-xs text-[var(--bad)]">🚑 {t('common.injured')} → {t('common.day', { n: st.injuredUntilDay + 1 })}</p>
        )}
        {st.suspendedMatches > 0 && (
          <p className="mt-2 text-xs text-[var(--bad)]">🟥 {t('common.suspended')} ({st.suspendedMatches})</p>
        )}
        {p.estimated && <p className="mt-2 text-[11px] text-[var(--warn)]">* {t('squad.estimatedNote')}</p>}
      </Card>

      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('squad.stats')}</div>
        <div className="mt-2">
          <StatBar label={t('common.ovr')} value={p.stats.overall} />
          {p.position !== 'GK' && (
            <>
              <StatBar label={t('squad.pace')} value={p.stats.pace} />
              <StatBar label={t('squad.shooting')} value={p.stats.shooting} />
              <StatBar label={t('squad.passing')} value={p.stats.passing} />
              <StatBar label={t('squad.dribbling')} value={p.stats.dribbling} />
              <StatBar label={t('squad.defending')} value={p.stats.defending} />
              <StatBar label={t('squad.physical')} value={p.stats.physical} />
            </>
          )}
        </div>
        {p.gkStats && (
          <div className="mt-3">
            <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('squad.gkStats')}</div>
            <div className="mt-1">
              <StatBar label={t('squad.diving')} value={p.gkStats.diving} />
              <StatBar label={t('squad.handling')} value={p.gkStats.handling} />
              <StatBar label={t('squad.kicking')} value={p.gkStats.kicking} />
              <StatBar label={t('squad.reflexes')} value={p.gkStats.reflexes} />
              <StatBar label={t('squad.positioning')} value={p.gkStats.positioning} />
              <StatBar label={t('squad.speed')} value={p.gkStats.speed} />
            </div>
          </div>
        )}
        <div className="mt-3 flex gap-4 text-xs text-[var(--muted)]">
          <span>{t('squad.skillMoves')}: {'★'.repeat(p.skillMoves)}</span>
          <span>{t('squad.weakFoot')}: {'★'.repeat(p.weakFoot)}</span>
          <span>{t('squad.preferredFoot')}: {t(`squad.${p.preferredFoot}`, p.preferredFoot)}</span>
        </div>
      </Card>

      {/* Disciplinary history */}
      <Card>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('squad.discipline')}</div>
        <div className="mt-2 flex flex-col gap-1.5 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">🟥 {t('squad.totalReds')}</span>
            <b className="tabular-nums">{st.redCards ?? 0}</b>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">🟨 {t('squad.compYellows')}</span>
            <b className="tabular-nums">{st.compYellows ?? 0}</b>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-[var(--muted)]">{t('squad.banStatus')}</span>
            {st.suspendedMatches > 0 ? (
              <b className="text-[var(--bad)]">
                {t('squad.banMatches', { n: st.suspendedMatches })}
                {st.suspensionReason && ` · ${t(`squad.reason_${st.suspensionReason}`)}`}
              </b>
            ) : (
              <b className="text-[var(--good)]">{t('squad.banNone')}</b>
            )}
          </div>
        </div>
      </Card>
    </div>
  )
}
