import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { GROUPS, groupTeams, teamAvgOverall } from '../data/teams'
import { useGame } from '../store/gameStore'
import type { CoachProfile } from '../domain/types'
import { Modal, OvrBadge, Segmented } from '../components/ui'
import { Flag } from '../components/Flag'

const DEFAULT_COACH: CoachProfile = {
  name: 'Coach',
  avatar: { skinTone: 3, hairStyle: 'short', hairColor: 'black', beard: 'none' },
  nationality: 'us',
}

export function TeamSelect() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const newCareer = useGame((s) => s.newCareer)
  const lang = useGame((s) => s.lang)
  const setLang = useGame((s) => s.setLang)
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <div className="p-4 pb-8">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black">🏆 2026</h1>
          <h2 className="text-lg font-bold">{t('teamselect.title')}</h2>
          <p className="text-sm text-[var(--muted)]">{t('teamselect.subtitle')}</p>
        </div>
        <div className="w-28">
          <Segmented
            options={[{ value: 'tr', label: 'TR' }, { value: 'en', label: 'EN' }]}
            value={lang}
            onChange={(v) => setLang(v)}
          />
        </div>
      </div>

      {GROUPS.map((g) => (
        <div key={g} className="mt-4">
          <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--muted)]">
            {t('teamselect.group', { g })}
          </h3>
          <div className="mt-1 grid grid-cols-2 gap-2">
            {groupTeams(g).map((team) => (
              <button
                key={team.id}
                className="card row-tap flex items-center gap-2 p-2.5 text-left"
                onClick={() => setPicked(team.id)}
              >
                <Flag code={team.id} size={20} />
                <span className="flex-1 truncate text-sm font-semibold">{team.name}</span>
                <OvrBadge value={teamAvgOverall(team)} />
              </button>
            ))}
          </div>
        </div>
      ))}

      <Modal open={picked !== null} onClose={() => setPicked(null)}>
        {picked && <PickConfirm teamId={picked} onConfirm={() => { newCareer(picked, 'WC_2026', DEFAULT_COACH, 'normal', 0); nav('/home') }} onCancel={() => setPicked(null)} />}
      </Modal>
    </div>
  )
}

function PickConfirm(props: { teamId: string; onConfirm: () => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const all = GROUPS.flatMap((g) => groupTeams(g))
  const tm = all.find((x) => x.id === props.teamId)!
  const top = [...tm.players].sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 5)
  return (
    <div>
      <h2 className="text-xl font-extrabold flex items-center gap-2">
        <Flag code={tm.id} size={26} />
        {tm.name}
      </h2>
      <p className="text-sm text-[var(--muted)]">
        {t('teamselect.group', { g: tm.group })} · {tm.confederation} · {t('common.ovr')} {teamAvgOverall(tm)}
      </p>
      <div className="mt-3 flex flex-col gap-1">
        {top.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <OvrBadge value={p.stats.overall} estimated={p.estimated} />
            <span className="font-semibold">{p.name}</span>
            <span className="text-xs text-[var(--muted)]">{p.position} · {p.club}</span>
          </div>
        ))}
      </div>
      <button className="btn w-full mt-4" onClick={props.onConfirm}>
        {t('teamselect.manage', { team: tm.name })}
      </button>
      <button className="btn-ghost w-full mt-2" onClick={props.onCancel}>
        {t('common.cancel')}
      </button>
    </div>
  )
}
