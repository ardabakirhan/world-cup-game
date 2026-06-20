import { useTranslation } from 'react-i18next'
import { getPlayer } from '../data/teams'
import { getEvent } from '../domain/events/eventPool'
import { useGame } from '../store/gameStore'
import { Modal } from './ui'

export function EventDialog() {
  const { t } = useTranslation()
  const pendingEvent = useGame((s) => s.pendingEvent)
  const resolveEvent = useGame((s) => s.resolveEvent)
  if (!pendingEvent) return null
  const ev = getEvent(pendingEvent.eventId)
  const player = pendingEvent.playerId ? getPlayer(pendingEvent.playerId).name : ''
  return (
    <Modal open>
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--accent)]">📰 {t('home.prepTitle')}</div>
      <h2 className="text-lg font-extrabold mt-1">{t(`events.${ev.id}.title`)}</h2>
      <p className="mt-2 text-sm text-[var(--muted)]">{t(`events.${ev.id}.body`, { player })}</p>
      <div className="mt-4 flex flex-col gap-2">
        {ev.choices.map((_, i) => (
          <button key={i} className="btn-ghost text-left" onClick={() => resolveEvent(i)}>
            {t(`events.${ev.id}.c${i}`, { player })}
          </button>
        ))}
      </div>
    </Modal>
  )
}
