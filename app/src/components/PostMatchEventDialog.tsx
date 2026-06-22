import { getTeam } from '../data/teams'
import { PLAYER_INTERACTION_POOL } from '../data/playerInteractionPool'
import type { InteractionTrigger } from '../data/playerInteractionPool'
import { useGame } from '../store/gameStore'
import { Modal } from './ui'
import { Avatar } from './Avatar'

export function PostMatchEventDialog() {
  const teamId = useGame((s) => s.teamId)
  const lang = useGame((s) => s.lang)
  const pendingPostMatchEvents = useGame((s) => s.pendingPostMatchEvents)
  const resolvePostMatchEvent = useGame((s) => s.resolvePostMatchEvent)

  const ev = pendingPostMatchEvents[0]
  if (!ev || !teamId) return null

  const pool = PLAYER_INTERACTION_POOL[ev.trigger as InteractionTrigger]
  if (!pool) return null
  const interaction = pool[ev.variantIdx]
  if (!interaction) return null

  const team = getTeam(teamId)
  const player = team.players.find((p) => p.id === ev.playerId)
  if (!player) return null

  const isTR = lang === 'tr'
  const dialogue = (isTR ? interaction.dialogue.tr : interaction.dialogue.en).replace(/\[PLAYER\]/g, player.name)

  return (
    <Modal open>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <Avatar params={player.avatar} size={48} />
        <div>
          <div style={{ fontWeight: 800, fontSize: 15 }}>{player.name}</div>
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
            {player.position} · OVR {player.stats.overall}
          </div>
        </div>
        {pendingPostMatchEvents.length > 1 && (
          <div
            style={{
              marginLeft: 'auto',
              fontSize: 9,
              color: 'var(--muted)',
              background: 'var(--card2)',
              border: '1px solid var(--line)',
              borderRadius: 4,
              padding: '2px 6px',
            }}
          >
            {pendingPostMatchEvents.length} {isTR ? 'olay' : 'event'}{pendingPostMatchEvents.length !== 1 && !isTR ? 's' : ''}
          </div>
        )}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          color: 'var(--text)',
          background: 'var(--card2)',
          borderRadius: 8,
          padding: '10px 12px',
          marginBottom: 14,
          fontStyle: 'italic',
        }}
      >
        {dialogue}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {interaction.options.map((opt, i) => (
          <button
            key={i}
            className="btn-ghost text-left"
            onClick={() => resolvePostMatchEvent(i)}
            style={{ fontSize: 13 }}
          >
            {isTR ? opt.text.tr : opt.text.en}
          </button>
        ))}
      </div>
    </Modal>
  )
}
