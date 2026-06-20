import type { Player } from '../data/types'
import { playerPositions } from '../domain/positions'

/** Small detailed-position pills (e.g. "CAM CM RW"), primary highlighted. */
export function PositionBadges({ player, max = 4 }: { player: Pick<Player, 'positions' | 'primaryPosition' | 'position'>; max?: number }) {
  const pos = playerPositions(player)
  const primary = (player.primaryPosition ?? pos[0])?.toUpperCase()
  return (
    <span className="flex flex-wrap gap-0.5">
      {pos.slice(0, max).map((c, i) => {
        const isPrimary = c === primary && i === pos.indexOf(primary ?? c)
        return (
          <span
            key={`${c}-${i}`}
            className="rounded px-1 text-[9px] font-extrabold leading-[1.3]"
            style={{
              background: isPrimary ? 'var(--accent)' : 'var(--card2)',
              color: isPrimary ? '#fff' : 'var(--muted)',
              border: isPrimary ? 'none' : '1px solid var(--line)',
            }}
          >
            {c}
          </span>
        )
      })}
    </span>
  )
}
