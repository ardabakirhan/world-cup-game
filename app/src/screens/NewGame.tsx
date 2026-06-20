import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { TEAMS, teamAvgOverall } from '../data/teams'
import { NATIONALITIES } from '../data/nationalities'
import { SKIN, HAIR_COLORS, avatarSvg, type AvatarParams } from '../components/avatarGen'
import { Avatar } from '../components/Avatar'
import { Flag } from '../components/Flag'
import { OvrBadge, Modal } from '../components/ui'
import { useGame } from '../store/gameStore'
import type { CoachProfile, Difficulty } from '../domain/types'
import { expectationLevel } from '../domain/types'
import { generateCareerCalendar } from '../domain/calendar/calendar.engine'

// ── helpers ───────────────────────────────────────────────────────────────────

const HAIR_STYLES = ['short', 'buzz', 'curly', 'wavy', 'fade', 'long', 'bun', 'afro', 'receding', 'bald']
const BEARD_OPTIONS = ['none', 'stubble', 'full', 'mustache', 'goatee']
const GLASSES_OPTIONS = ['none', 'normal', 'sunglasses']
const HAIR_COLOR_KEYS = Object.keys(HAIR_COLORS)

function randomAvatar(): AvatarParams {
  const pick = <T,>(arr: T[]) => arr[Math.floor(Math.random() * arr.length)]
  return {
    skinTone: Math.floor(Math.random() * 8),
    hairStyle: pick(HAIR_STYLES),
    hairColor: pick(HAIR_COLOR_KEYS),
    beard: pick(BEARD_OPTIONS),
    glasses: 'none',
  }
}

const EXP_LABEL_KEYS = ['honorable', 'groups', 'last16', 'quarterfinal', 'semifinal', 'champion']
const EXP_COLORS = ['#6b7280', '#6b7280', '#3a6b32', '#6b632a', '#b45309', '#1f7a46']

function difficultyStars(avgOvr: number): number {
  if (avgOvr >= 85) return 1
  if (avgOvr >= 80) return 2
  if (avgOvr >= 75) return 3
  if (avgOvr >= 70) return 4
  return 5
}

function Stars(props: { n: number }) {
  return (
    <span className="text-[var(--accent)] text-sm tracking-tighter">
      {'★'.repeat(props.n)}{'☆'.repeat(5 - props.n)}
    </span>
  )
}

// ── main component ────────────────────────────────────────────────────────────

export function NewGame() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1)
  const [coachName, setCoachName] = useState('')
  const [avatar, setAvatar] = useState<AvatarParams>(randomAvatar)
  const [nationality, setNationality] = useState('us')
  const [pickedTeam, setPickedTeam] = useState<string | null>(null)
  const [showSlotModal, setShowSlotModal] = useState(false)
  // Step 4 = career preview before starting
  const [previewTeam, setPreviewTeam] = useState<string | null>(null)

  const g = useGame()
  const nav = useNavigate()

  const coach: CoachProfile = { name: coachName.trim() || 'Coach', avatar, nationality }

  const startCareer = (teamId: string, selectedSlot: 0 | 1 | 2) => {
    g.initCareer(teamId, coach, g.difficulty, selectedSlot)
    nav('/home')
  }

  const handleSlotConfirm = (n: 0 | 1 | 2) => {
    setShowSlotModal(false)
    if (pickedTeam) startCareer(pickedTeam, n)
  }

  const handleTeamSelect = (teamId: string) => {
    setPickedTeam(teamId)
    setPreviewTeam(teamId)
    setStep(4)
  }

  const handleTeamConfirm = async (teamId: string) => {
    setPickedTeam(teamId)
    const metas = await g.listSlots()
    const anyOccupied = metas.some((m) => m !== null)
    if (!anyOccupied) {
      startCareer(teamId, 0)
    } else {
      setShowSlotModal(true)
    }
  }

  return (
    <div className="flex flex-col h-dvh bg-[var(--bg)]">
      {/* Progress bar — 4 steps */}
      <div className="flex gap-1 p-3 pb-0">
        {([1, 2, 3, 4] as const).map((s) => (
          <div
            key={s}
            className="h-1 flex-1 rounded-full"
            style={{ background: s <= step ? 'var(--accent)' : 'var(--card2)' }}
          />
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        {step === 1 && (
          <CoachStep
            name={coachName}
            onNameChange={setCoachName}
            avatar={avatar}
            onAvatarChange={setAvatar}
            onNext={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <NationalityStep
            value={nationality}
            onChange={setNationality}
            onBack={() => setStep(1)}
            onNext={() => setStep(3)}
          />
        )}
        {step === 3 && (
          <TeamStep
            coach={coach}
            onBack={() => setStep(2)}
            onSelect={handleTeamSelect}
          />
        )}
        {step === 4 && previewTeam && (
          <CareerPreviewStep
            teamId={previewTeam}
            coach={coach}
            difficulty={g.difficulty}
            onBack={() => setStep(3)}
            onConfirm={() => handleTeamConfirm(previewTeam)}
          />
        )}
      </div>

      <Modal open={showSlotModal} onClose={() => setShowSlotModal(false)}>
        <SlotPicker onSelect={handleSlotConfirm} onCancel={() => setShowSlotModal(false)} />
      </Modal>
    </div>
  )
}

// ── Step 1: Coach Creator ────────────────────────────────────────────────────

function CoachStep(props: {
  name: string
  onNameChange: (n: string) => void
  avatar: AvatarParams
  onAvatarChange: (a: AvatarParams) => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const { avatar, onAvatarChange } = props

  const set = (patch: Partial<AvatarParams>) => onAvatarChange({ ...avatar, ...patch })

  const preview = (patch: Partial<AvatarParams>) =>
    avatarSvg({ ...avatar, ...patch }, 32)

  return (
    <div className="p-4 pb-6 flex flex-col gap-4">
      <h1 className="text-xl font-black">{t('newgame.stepCoach')}</h1>

      <div className="flex items-center gap-4">
        <Avatar params={avatar} size={80} round />
        <div className="flex-1 flex flex-col gap-2">
          <input
            type="text"
            maxLength={20}
            value={props.name}
            onChange={(e) => props.onNameChange(e.target.value)}
            placeholder={t('newgame.coachNamePlaceholder')}
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--card2)] px-3 py-2 text-sm font-semibold focus:border-[var(--accent)] outline-none"
          />
          <button
            className="btn-ghost text-xs py-1.5"
            onClick={() => onAvatarChange({
              skinTone: Math.floor(Math.random() * 8),
              hairStyle: HAIR_STYLES[Math.floor(Math.random() * HAIR_STYLES.length)],
              hairColor: HAIR_COLOR_KEYS[Math.floor(Math.random() * HAIR_COLOR_KEYS.length)],
              beard: BEARD_OPTIONS[Math.floor(Math.random() * BEARD_OPTIONS.length)],
              glasses: GLASSES_OPTIONS[Math.floor(Math.random() * GLASSES_OPTIONS.length)],
            })}
          >
            🎲 {t('newgame.random')}
          </button>
        </div>
      </div>

      <Section label={t('newgame.skinTone')}>
        <div className="flex gap-2 flex-wrap">
          {SKIN.map((hex, i) => (
            <button
              key={i}
              onClick={() => set({ skinTone: i })}
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{
                background: hex,
                borderColor: avatar.skinTone === i ? 'var(--accent)' : 'transparent',
                transform: avatar.skinTone === i ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </Section>

      <Section label={t('newgame.hairStyle')}>
        <div className="flex gap-1.5 flex-wrap">
          {HAIR_STYLES.map((hs) => (
            <button
              key={hs}
              onClick={() => set({ hairStyle: hs })}
              className="flex flex-col items-center gap-0.5 p-1.5 rounded-lg border"
              style={{
                borderColor: avatar.hairStyle === hs ? 'var(--accent)' : 'var(--line)',
                background: avatar.hairStyle === hs ? 'var(--card2)' : 'transparent',
              }}
            >
              <span
                dangerouslySetInnerHTML={{ __html: preview({ hairStyle: hs }) }}
                className="pointer-events-none"
              />
              <span className="text-[9px] text-[var(--muted)]">{t(`newgame.hair_${hs}`)}</span>
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('newgame.hairColor')}>
        <div className="flex gap-2 flex-wrap">
          {HAIR_COLOR_KEYS.map((key) => (
            <button
              key={key}
              onClick={() => set({ hairColor: key })}
              className="w-8 h-8 rounded-full border-2 transition-transform"
              style={{
                background: HAIR_COLORS[key],
                borderColor: avatar.hairColor === key ? 'var(--accent)' : 'transparent',
                transform: avatar.hairColor === key ? 'scale(1.2)' : 'scale(1)',
              }}
            />
          ))}
        </div>
      </Section>

      <Section label={t('newgame.beard')}>
        <div className="flex gap-1.5 flex-wrap">
          {BEARD_OPTIONS.map((b) => (
            <button
              key={b}
              onClick={() => set({ beard: b })}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                borderColor: avatar.beard === b ? 'var(--accent)' : 'var(--line)',
                background: avatar.beard === b ? 'var(--accent)' : 'var(--card2)',
                color: avatar.beard === b ? '#fff' : 'var(--muted)',
              }}
            >
              {t(`newgame.beard_${b}`)}
            </button>
          ))}
        </div>
      </Section>

      <Section label={t('newgame.glasses')}>
        <div className="flex gap-1.5 flex-wrap">
          {GLASSES_OPTIONS.map((g) => (
            <button
              key={g}
              onClick={() => set({ glasses: g })}
              className="rounded-lg border px-2.5 py-1.5 text-xs font-semibold"
              style={{
                borderColor: avatar.glasses === g ? 'var(--accent)' : 'var(--line)',
                background: avatar.glasses === g ? 'var(--accent)' : 'var(--card2)',
                color: avatar.glasses === g ? '#fff' : 'var(--muted)',
              }}
            >
              {t(`newgame.glasses_${g}`)}
            </button>
          ))}
        </div>
      </Section>

      <button className="btn w-full mt-2" onClick={props.onNext}>{t('newgame.next')}</button>
    </div>
  )
}

function Section(props: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">{props.label}</div>
      {props.children}
    </div>
  )
}

// ── Step 2: Nationality ───────────────────────────────────────────────────────

function NationalityStep(props: {
  value: string
  onChange: (code: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const { t } = useTranslation()
  const [q, setQ] = useState('')

  const filtered = useMemo(() =>
    q.trim()
      ? NATIONALITIES.filter((n) => n.name.toLowerCase().includes(q.toLowerCase()))
      : NATIONALITIES,
    [q])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-black mb-3">{t('newgame.stepNat')}</h1>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('newgame.searchCountry')}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--card2)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none"
        />
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {filtered.map((nat) => (
          <button
            key={nat.code}
            onClick={() => props.onChange(nat.code)}
            className="w-full flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0 text-left"
            style={props.value === nat.code ? { color: 'var(--accent)' } : undefined}
          >
            <Flag code={nat.code} size={20} />
            <span className="flex-1 text-sm font-medium">{nat.name}</span>
            {props.value === nat.code && <span className="text-[var(--accent)]">✓</span>}
          </button>
        ))}
      </div>

      <div className="p-4 pt-2 flex gap-2">
        <button className="btn-ghost flex-1" onClick={props.onBack}>{t('newgame.back')}</button>
        <button className="btn flex-1" onClick={props.onNext}>{t('newgame.next')}</button>
      </div>
    </div>
  )
}

// ── Step 3: Team Select ───────────────────────────────────────────────────────

const CONF_FILTERS = ['ALL', 'UEFA', 'CAF', 'AFC', 'CONMEBOL', 'CONCACAF', 'OFC'] as const
type ConfFilter = (typeof CONF_FILTERS)[number]

function TeamStep(props: {
  coach: CoachProfile
  onBack: () => void
  onSelect: (teamId: string) => void
}) {
  const { t } = useTranslation()
  const g = useGame()
  const [q, setQ] = useState('')
  const [confFilter, setConfFilter] = useState<ConfFilter>('ALL')

  // All 211 teams
  const allTeams = useMemo(() => TEAMS, [])

  const filtered = useMemo(() => {
    let list = allTeams
    if (confFilter !== 'ALL') list = list.filter((tm) => tm.confederation === confFilter)
    if (q.trim()) list = list.filter((tm) => tm.name.toLowerCase().includes(q.toLowerCase()))
    return list
  }, [q, confFilter, allTeams])

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 pb-2">
        <h1 className="text-xl font-black mb-3">{t('newgame.stepTeam')}</h1>
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t('newgame.searchTeam')}
          className="w-full rounded-lg border border-[var(--line)] bg-[var(--card2)] px-3 py-2 text-sm focus:border-[var(--accent)] outline-none"
        />
      </div>

      {/* Confederation filter chips */}
      <div className="px-4 pb-2 flex gap-1.5 overflow-x-auto no-scrollbar">
        {CONF_FILTERS.map((cf) => (
          <button
            key={cf}
            onClick={() => setConfFilter(cf)}
            className="shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold border transition-colors"
            style={confFilter === cf
              ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' }
              : { background: 'var(--card2)', borderColor: 'var(--line)', color: 'var(--muted)' }
            }
          >
            {cf === 'ALL' ? t('newgame.filterAll') : cf}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4">
        {filtered.map((tm) => {
          const avg = teamAvgOverall(tm)
          const expLvl = expectationLevel(avg, g.difficulty)
          const stars = difficultyStars(avg)
          const isGenerated = (tm as { generated?: boolean }).generated === true
          const isWC = tm.tournaments?.some((tr) => tr.id === 'WC_2026' && tr.qualified) ?? false
          return (
            <button
              key={tm.id}
              onClick={() => props.onSelect(tm.id)}
              className="w-full flex items-center gap-3 py-2.5 border-b border-[var(--line)] last:border-0 text-left"
              style={isGenerated ? { opacity: 0.55 } : undefined}
              title={isGenerated ? t('profile.generatedNote') : undefined}
            >
              <Flag code={tm.id} size={24} />
              <div className="flex-1 min-w-0">
                <div
                  className="font-semibold text-sm truncate"
                  style={isGenerated ? { fontStyle: 'italic' } : undefined}
                >
                  {tm.name}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <Stars n={stars} />
                  {isWC && (
                    <span className="text-[10px] font-bold rounded px-1.5 py-0.5"
                      style={{ background: '#1f7a4622', color: '#1f7a46' }}>
                      WC 2026
                    </span>
                  )}
                  <span
                    className="text-[10px] font-bold rounded px-1.5 py-0.5"
                    style={{ background: EXP_COLORS[expLvl] + '33', color: EXP_COLORS[expLvl] }}
                  >
                    {t(`exp.${EXP_LABEL_KEYS[expLvl]}`)}
                  </span>
                </div>
              </div>
              <OvrBadge value={avg} />
            </button>
          )
        })}
      </div>

      <div className="p-4 pt-2">
        <button className="btn-ghost w-full" onClick={props.onBack}>{t('newgame.back')}</button>
      </div>
    </div>
  )
}

// ── Step 4: Career Preview ────────────────────────────────────────────────────

function CareerPreviewStep(props: {
  teamId: string
  coach: CoachProfile
  difficulty: Difficulty
  onBack: () => void
  onConfirm: () => void
}) {
  const { t } = useTranslation()
  const tm = TEAMS.find((x) => x.id === props.teamId)!
  const avg = teamAvgOverall(tm)
  const expLvl = expectationLevel(avg, props.difficulty)
  const expKey = EXP_LABEL_KEYS[expLvl]
  const top = [...tm.players].sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 5)

  // Build career window preview
  const calResult = useMemo(() => {
    try { return generateCareerCalendar(props.teamId, TEAMS) }
    catch { return null }
  }, [props.teamId])

  const windows = calResult?.windows.filter((w) => w.userParticipates) ?? []

  return (
    <div className="p-4 pb-6 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <Avatar params={props.coach.avatar} size={48} round />
        <div>
          <div className="font-bold">{props.coach.name}</div>
          <div className="text-xs text-[var(--muted)]">{t('newgame.stepCoach')}</div>
        </div>
      </div>

      <div>
        <h2 className="text-xl font-extrabold flex items-center gap-2">
          <Flag code={tm.id} size={26} />
          {tm.name}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {tm.confederation} · {t('common.ovr')} {avg}
        </p>
      </div>

      <div className="card p-3 flex items-center justify-between">
        <div>
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{t('newgame.expectation')}</div>
          <div className="font-bold text-sm mt-0.5" style={{ color: EXP_COLORS[expLvl] }}>
            {t(`exp.${expKey}`)}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs text-[var(--muted)] uppercase tracking-wide">{t('newgame.difficulty')}</div>
          <Stars n={difficultyStars(avg)} />
        </div>
      </div>

      {windows.length > 0 && (
        <div>
          <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
            {t('newgame.careerPath')}
          </div>
          <div className="flex flex-col gap-1.5">
            {windows.map((w, i) => (
              <div key={w.id} className="flex items-center gap-2 text-sm">
                <span className="text-[var(--muted)] w-4 text-center">{i + 1}.</span>
                <span
                  className="rounded px-1.5 py-0.5 text-[10px] font-bold"
                  style={{
                    background: w.type === 'wc' ? '#1f7a4622' : w.type === 'nations_league' ? '#1a3a6a22' :
                      w.type === 'qual' ? '#6b3a2222' : '#2a2a4a22',
                    color: w.type === 'wc' ? '#1f7a46' : w.type === 'nations_league' ? '#4a90d9' :
                      w.type === 'qual' ? '#c0602a' : '#9a9ac0',
                  }}
                >
                  {w.type === 'wc' ? 'WC' : w.type === 'nations_league' ? 'NL' :
                    w.type === 'qual' ? 'QUAL' : w.type === 'tournament' ? 'CUP' : 'FR'}
                </span>
                <span className="flex-1 truncate">{w.competition}</span>
                <span className="text-[10px] text-[var(--muted)]">
                  {w.dateStart.year}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {top.map((p) => (
          <div key={p.id} className="flex items-center gap-2 text-sm">
            <OvrBadge value={p.stats.overall} estimated={p.estimated} />
            <span className="font-semibold">{p.name}</span>
            <span className="text-xs text-[var(--muted)]">{p.position} · {p.club}</span>
          </div>
        ))}
      </div>

      <button className="btn w-full" onClick={props.onConfirm}>
        {t('newgame.startCareer')}
      </button>
      <button className="btn-ghost w-full" onClick={props.onBack}>
        {t('newgame.back')}
      </button>
    </div>
  )
}

// ── Slot Picker ───────────────────────────────────────────────────────────────

function SlotPicker(props: { onSelect: (n: 0 | 1 | 2) => void; onCancel: () => void }) {
  const { t } = useTranslation()
  const g = useGame()
  const [slots, setSlots] = useState<(import('../domain/types').SaveSlotMeta | null)[]>([null, null, null])
  const [confirmOverwrite, setConfirmOverwrite] = useState<0 | 1 | 2 | null>(null)

  useState(() => {
    g.listSlots().then(setSlots)
  })

  const pick = (n: 0 | 1 | 2) => {
    if (slots[n]) { setConfirmOverwrite(n) }
    else props.onSelect(n)
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-extrabold">{t('newgame.slot_select')}</h2>
      {([0, 1, 2] as const).map((n) => {
        const meta = slots[n]
        return (
          <button
            key={n}
            onClick={() => pick(n)}
            className="card p-3 flex items-center gap-3 row-tap text-left"
          >
            <div className="text-2xl font-black text-[var(--muted)] w-7">{n + 1}</div>
            {meta ? (
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{meta.coachName}</div>
                <div className="text-xs text-[var(--muted)] truncate">Day {meta.day}</div>
              </div>
            ) : (
              <div className="flex-1 text-sm text-[var(--muted)]">{t('menu.emptySlot')}</div>
            )}
          </button>
        )
      })}
      <button className="btn-ghost w-full" onClick={props.onCancel}>{t('common.cancel')}</button>

      <Modal open={confirmOverwrite !== null} onClose={() => setConfirmOverwrite(null)}>
        <div className="flex flex-col gap-3">
          <p className="font-semibold">{t('newgame.overwriteConfirm')}</p>
          <button className="btn w-full" onClick={() => { props.onSelect(confirmOverwrite!); setConfirmOverwrite(null) }}>
            {t('common.confirm')}
          </button>
          <button className="btn-ghost w-full" onClick={() => setConfirmOverwrite(null)}>{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
