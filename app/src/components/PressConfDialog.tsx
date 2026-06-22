import { getTeam } from '../data/teams'
import { PRESS_QUESTIONS } from '../data/pressConferencePool'
import type { PressCategory } from '../data/pressConferencePool'
import { useGame } from '../store/gameStore'
import { Modal } from './ui'

export function PressConfDialog() {
  const teamId = useGame((s) => s.teamId)
  const lang = useGame((s) => s.lang)
  const pc = useGame((s) => s.pendingPressConf)
  const resolvePressConfQuestion = useGame((s) => s.resolvePressConfQuestion)
  const skipPressConf = useGame((s) => s.skipPressConf)

  if (!pc || !teamId) return null

  const pool = PRESS_QUESTIONS[pc.category as PressCategory]
  if (!pool) return null

  const qIdx = pc.questionIndices[pc.currentQ]
  const q = pool[qIdx]
  if (!q) return null

  const isTR = lang === 'tr'

  // Find the player who actually didn't start (validated at pick time, just resolve name)
  const team = getTeam(teamId)
  const starterSet = new Set(pc.matchStarterIds ?? [])
  const benchedStar = [...team.players]
    .sort((a, b) => b.stats.overall - a.stats.overall)
    .find((p) => p.stats.overall >= 75 && !starterSet.has(p.id))
  const playerName = benchedStar?.name ?? team.players[0]?.name ?? '?'

  const rawQuestion = isTR ? q.question.tr : q.question.en
  const question = rawQuestion
    .replace(/\[BENCHED_STAR\]/g, playerName)
    .replace(/\[DROPPED_PLAYER\]/g, playerName)

  const total = pc.questionIndices.length
  const current = pc.currentQ + 1

  return (
    <Modal open>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🎤</span>
        <div>
          <div style={{ fontWeight: 800, fontSize: 14 }}>{isTR ? 'Basın Toplantısı' : 'Press Conference'}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)' }}>{isTR ? `Soru ${current}/${total}` : `Question ${current}/${total}`}</div>
        </div>
        <button
          onClick={skipPressConf}
          style={{
            marginLeft: 'auto',
            fontSize: 10,
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          {isTR ? 'Geç' : 'Skip'}
        </button>
      </div>

      {/* Progress dots */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {pc.questionIndices.map((_, i) => (
          <div
            key={i}
            style={{
              height: 4,
              flex: 1,
              borderRadius: 2,
              background: i < current ? 'var(--accent)' : 'var(--line)',
              transition: 'background 0.3s',
            }}
          />
        ))}
      </div>

      <div
        style={{
          fontSize: 13,
          lineHeight: 1.55,
          fontWeight: 600,
          color: 'var(--text)',
          marginBottom: 14,
        }}
      >
        🗞️ {question}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {q.options.map((opt, i) => (
          <button
            key={i}
            className="btn-ghost text-left"
            onClick={() => resolvePressConfQuestion(i)}
            style={{ fontSize: 13 }}
          >
            {isTR ? opt.text.tr : opt.text.en}
          </button>
        ))}
      </div>
    </Modal>
  )
}
