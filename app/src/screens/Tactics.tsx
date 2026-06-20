import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { getTeam } from '../data/teams'
import type { Player, Position } from '../data/types'
import { useGame } from '../store/gameStore'
import { FORMATIONS, FORMATION_KEYS } from '../domain/engine/formations'
import { makeEnginePlayer, teamRatings } from '../domain/engine/ratings'
import { positionFitGrade, OVR_PENALTY } from '../domain/positions'
import { autoPickXI, isAvailable, roleScore } from '../domain/ai/lineup'
import { getNextUserMatch } from '../domain/calendar/calendar.engine'
import type { Mentality, TacticSliders, CornerDelivery, FKRoutine, PenaltyStyle } from '../domain/types'
import { MENTALITY_TO_NUM } from '../domain/types'
import { Card, Modal, OvrBadge, StatBar } from '../components/ui'
import { PitchView, type ChipData } from '../components/PitchView'
import { PositionBadges } from '../components/PositionBadges'
import { positionFit, POS_FIT_COLOR } from '../domain/positions'
import { Flag } from '../components/Flag'
import { Avatar } from '../components/Avatar'

// Sub-role options per broad position
const SUB_ROLES: Record<Position, string[]> = {
  GK: ['GK'],
  DF: ['CB', 'LB', 'RB', 'LWB', 'RWB'],
  MF: ['CDM', 'CM', 'CAM', 'WM'],
  FW: ['CF', 'SS', 'WF'],
}

const MENTALITIES: Mentality[] = ['ultra_defensive', 'defensive', 'balanced', 'attacking', 'gung_ho']

const MENTALITY_COLOR: Record<Mentality, string> = {
  ultra_defensive: '#3b82f6',
  defensive:       '#22c55e',
  balanced:        '#eab308',
  attacking:       '#f97316',
  gung_ho:         '#ef4444',
}

type Tab = 'formation' | 'tactics' | 'setpieces' | 'opposition'

function surname(name: string): string {
  const parts = name.split(' ')
  return parts.length > 1 ? parts[parts.length - 1] : name
}

export function Tactics() {
  const { t } = useTranslation()
  const g = useGame()
  const team = getTeam(g.teamId!)
  const slots = FORMATIONS[g.lineup.formation]
  const [tab, setTab] = useState<Tab>('formation')
  const [view, setView] = useState<'pitch' | 'list'>('pitch')
  const [pickSlot, setPickSlot] = useState<number | null>(null)
  const [pickCaptain, setPickCaptain] = useState<'captain' | 'vice' | null>(null)
  const [backLine, setBackLine] = useState(g.lineup.formation[0])
  const [presetSaveSlot, setPresetSaveSlot] = useState<0 | 1 | 2 | null>(null)
  const [presetNameInput, setPresetNameInput] = useState('')
  const [pendingFormation, setPendingFormation] = useState<string | null>(null)

  const byId = useMemo(() => new Map(team.players.map((p) => [p.id, p])), [team])

  const statusIcons = (p: Player) => {
    const st = g.playerStates[p.id]
    let icons = ''
    if (st.injuredUntilDay > g.day) icons += '🚑'
    if (st.suspendedMatches > 0) icons += '🟥'
    if (st.fitness < 60) icons += '🟡'
    return icons
  }

  const roles = g.lineup.roles ?? Array(slots.length).fill(null)
  const setpieces = g.lineup.setpieces ?? { corner: null, freekick: null, penalty: null, longThrow: null }
  const spo = g.tactics.setpieceOptions ?? { cornerDelivery: 'inswinger', fkRoutine: 'shoot', penaltyStyle: 'placed', longThrowOn: false }
  const sliders = g.tactics.sliders ?? { width: 5, defLine: 5, press: 5, tempo: 5, aggression: 5, crossing: 5, counter: 5 }
  const mentality = g.tactics.mentality ?? 'balanced'
  const tacticPresets = g.tacticPresets ?? [null, null, null]

  const toChip = (p: Player, slotIdx: number | null): ChipData => {
    const grade = slotIdx !== null ? positionFitGrade(slots[slotIdx].label, p) : 'natural'
    return {
      id: p.id,
      number: p.number,
      label: surname(p.name),
      ovr: p.stats.overall,
      effOvr: Math.max(40, p.stats.overall - OVR_PENALTY[grade]),
      icons: statusIcons(p),
      disabled: !isAvailable(p, g.playerStates, g.day),
      avatar: p.avatar,
      subRole: slotIdx !== null ? (roles[slotIdx] ?? null) : null,
      isCaptain: g.lineup.captainId === p.id,
      isViceCaptain: g.lineup.viceCaptainId === p.id,
      posFit: slotIdx !== null ? positionFit(slots[slotIdx].label, p) : undefined,
    }
  }

  const pitchChips: (ChipData | null)[] = slots.map((_, i) => {
    const id = g.lineup.starters[i]
    const p = id ? byId.get(id) : undefined
    return p ? toChip(p, i) : null
  })

  const inXI = new Set(g.lineup.starters.filter(Boolean) as string[])
  const benchChips: ChipData[] = team.players
    .filter((p) => !inXI.has(p.id))
    .sort((a, b) => Number(isAvailable(b, g.playerStates, g.day)) - Number(isAvailable(a, g.playerStates, g.day)) || b.stats.overall - a.stats.overall)
    .map((p) => toChip(p, null))

  const ratings = useMemo(() => {
    const xi = g.lineup.starters
      .map((id, i) => {
        if (!id) return null
        const p = byId.get(id)
        return p ? makeEnginePlayer(p, g.playerStates[p.id], slots[i].role, slots[i].label) : null
      })
      .filter((x) => x !== null)
    return teamRatings(xi)
  }, [g.lineup, g.playerStates, byId, slots])

  const autopick = () => {
    const ids = autoPickXI(g.teamId!, g.playerStates, g.day, g.lineup.formation)
    ids.forEach((id, i) => g.setStarter(i, id))
  }

  const onSwapPitch = (i: number, j: number) => {
    const a = g.lineup.starters[i]
    const b = g.lineup.starters[j]
    if (a === null && b === null) return
    if (a !== null) g.setStarter(j, a)
    else if (b !== null) g.setStarter(i, b)
  }

  // Next opponent for opposition instructions
  const nextMatch = getNextUserMatch(g.schedule, g.teamId!, g.day)
  const oppId = nextMatch
    ? (nextMatch.homeId === g.teamId ? nextMatch.awayId : nextMatch.homeId)
    : null
  const oppTeam = oppId ? getTeam(oppId) : null
  const oppTop6 = oppTeam
    ? [...oppTeam.players].sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 6)
    : []
  const instrMap = g.tactics.oppositionInstructions ?? {}

  const spName = (id: string | null) => {
    if (!id) return t('tactics.notSet')
    return byId.get(id)?.name ?? id
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'formation', label: t('tactics.tabFormation') },
    { key: 'tactics', label: t('tactics.tabTactics') },
    { key: 'setpieces', label: t('tactics.tabSetpieces') },
    { key: 'opposition', label: t('tactics.tabOpposition') },
  ]

  return (
    <div className="flex flex-col" style={{ minHeight: '100dvh' }}>
      {/* Header + tab bar */}
      <div className="px-4 pt-4 pb-0">
        <h1 className="text-xl font-black mb-3">{t('tactics.title')}</h1>
        <div className="flex gap-1">
          {TABS.map((tb) => (
            <button
              key={tb.key}
              className="flex-1 rounded-t-lg py-1.5 text-[11px] font-bold text-center border-b-2 transition-colors"
              style={{
                background: tab === tb.key ? 'var(--card)' : 'transparent',
                borderColor: tab === tb.key ? 'var(--accent)' : 'transparent',
                color: tab === tb.key ? 'var(--accent)' : 'var(--muted)',
              }}
              onClick={() => setTab(tb.key)}
            >
              {tb.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-4 pb-20 flex flex-col gap-3">
        {tab === 'formation' && (
          <>
            {/* Formation picker */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.formation')}</div>
              <div className="mt-2">
                <div className="flex gap-1">
                  {(['4', '3', '5'] as const).map((bl) => (
                    <button
                      key={bl}
                      className="flex-1 rounded-lg py-1 text-xs font-bold border"
                      style={{
                        background: backLine === bl ? 'var(--accent)' : 'var(--card2)',
                        borderColor: backLine === bl ? 'var(--accent)' : 'var(--line)',
                        color: backLine === bl ? '#fff' : 'var(--muted)',
                      }}
                      onClick={() => setBackLine(bl)}
                    >
                      {bl === '4' ? t('tactics.back4') : bl === '3' ? t('tactics.back3') : t('tactics.back5')}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                {FORMATION_KEYS.filter((k) => k[0] === backLine).map((k) => (
                  <button
                    key={k}
                    className="shrink-0 rounded-lg border px-3 py-1.5 text-sm font-bold"
                    style={{
                      background: k === g.lineup.formation ? 'var(--accent)' : 'var(--card2)',
                      borderColor: k === g.lineup.formation ? 'var(--accent)' : 'var(--line)',
                      color: k === g.lineup.formation ? '#fff' : 'var(--muted)',
                    }}
                    onClick={() => {
                      if (k === g.lineup.formation) return
                      const fam = g.tacticalFamiliarity
                      const currentMentalityNum = MENTALITY_TO_NUM[g.tactics.mentality] ?? 3
                      const mult = familiarityDropMultiplierUI(fam.formation, k, fam.mentality, currentMentalityNum)
                      const predictedScore = Math.max(0, Math.round(fam.score * mult))
                      const drop = fam.score - predictedScore
                      if (drop > 15) {
                        setPendingFormation(k)
                      } else {
                        g.setFormation(k)
                      }
                    }}
                  >
                    {k}
                  </button>
                ))}
              </div>
            </Card>

            {/* Formation change warning */}
            {pendingFormation && (() => {
              const fam = g.tacticalFamiliarity
              const currentMentalityNum = MENTALITY_TO_NUM[g.tactics.mentality] ?? 3
              const mult = familiarityDropMultiplierUI(fam.formation, pendingFormation, fam.mentality, currentMentalityNum)
              const predictedScore = Math.max(0, Math.round(fam.score * mult))
              const oldLabel = familiarityLabel(fam.score, t)
              const newLabel = familiarityLabel(predictedScore, t)
              const isDanger = predictedScore <= 20
              return (
                <Card>
                  <div className="text-xs font-bold uppercase tracking-wide text-[var(--warn)] mb-2">
                    ⚠️ {t('tactics.famWarnTitle')}
                  </div>
                  <p className="text-sm mb-2">
                    {t('tactics.famWarnBody', { from: fam.score, to: predictedScore, oldLabel, newLabel })}
                  </p>
                  {isDanger && (
                    <p className="text-xs mb-2" style={{ color: '#ef4444' }}>
                      {t('tactics.famWarnDanger')}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      className="flex-1 rounded-lg py-2 text-sm font-bold"
                      style={{ background: '#ef4444', color: '#fff' }}
                      onClick={() => { g.setFormation(pendingFormation); setPendingFormation(null) }}
                    >
                      {t('tactics.famConfirm')}
                    </button>
                    <button
                      className="flex-1 rounded-lg py-2 text-sm font-bold border border-[var(--line)]"
                      style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                      onClick={() => setPendingFormation(null)}
                    >
                      {t('tactics.famCancel')}
                    </button>
                  </div>
                </Card>
              )
            })()}

            {/* Pitch / List toggle */}
            <div className="flex gap-1 rounded-lg overflow-hidden border border-[var(--line)]">
              {(['pitch', 'list'] as const).map((v) => (
                <button
                  key={v}
                  className="flex-1 py-1.5 text-xs font-bold"
                  style={{ background: view === v ? 'var(--accent)' : 'var(--card2)', color: view === v ? '#fff' : 'var(--muted)' }}
                  onClick={() => setView(v)}
                >
                  {v === 'pitch' ? t('tactics.pitchView') : t('tactics.listView')}
                </button>
              ))}
            </div>

            {view === 'pitch' ? (
              <Card>
                <PitchView
                  slots={slots}
                  pitch={pitchChips}
                  bench={benchChips}
                  benchTitle={t('tactics.bench')}
                  onSwapPitch={onSwapPitch}
                  onBenchToPitch={(benchId, slotIdx) => g.setStarter(slotIdx, benchId)}
                  onPitchToBench={(slotIdx) => g.setStarter(slotIdx, null)}
                  onSlotTap={(slotIdx) => setPickSlot(slotIdx)}
                />
                <FitLegend />
                <button className="btn-ghost w-full mt-2" onClick={autopick}>⚡ {t('tactics.autopick')}</button>
              </Card>
            ) : (
              <Card>
                <div className="flex flex-col">
                  {slots.map((slot, i) => {
                    const id = g.lineup.starters[i]
                    const p = id ? byId.get(id) : undefined
                    const unavailable = p && !isAvailable(p, g.playerStates, g.day)
                    const role = roles[i]
                    const fit = p ? positionFit(slot.label, p) : null
                    return (
                      <button
                        key={i}
                        className="row-tap flex items-center gap-2 border-b border-[var(--line)] last:border-0 py-2 text-left"
                        onClick={() => setPickSlot(i)}
                      >
                        <span className="w-10 text-xs font-bold text-[var(--muted)]">{slot.label}</span>
                        {p ? (
                          <>
                            {fit && (
                              <span className="shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: POS_FIT_COLOR[fit] }} />
                            )}
                            <OvrBadge value={p.stats.overall} estimated={p.estimated} />
                            <span className="flex-1 min-w-0">
                              <span className="truncate text-sm font-semibold block">
                                {p.name}
                                {unavailable && <span className="ml-1 text-[10px] text-[var(--bad)]">✕</span>}
                              </span>
                              <span className="mt-0.5 flex"><PositionBadges player={p} max={3} /></span>
                            </span>
                            {role && (
                              <span className="shrink-0 rounded px-1 py-0.5 text-[9px] font-extrabold text-white"
                                style={{ background: 'var(--accent)' }}>
                                {role}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="flex-1 text-sm text-[var(--muted)]">{t('tactics.empty')}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
                <button className="btn-ghost w-full mt-2" onClick={autopick}>⚡ {t('tactics.autopick')}</button>
              </Card>
            )}

            {/* Captain & Vice-Captain */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('tactics.captainSection')}</div>
              {(['captain', 'vice'] as const).map((role) => {
                const isCapRole = role === 'captain'
                const playerId = isCapRole ? g.lineup.captainId : g.lineup.viceCaptainId
                const player = playerId ? byId.get(playerId) : undefined
                const badge = isCapRole ? 'C' : 'VC'
                const badgeColor = isCapRole ? '#f59e0b' : '#9ca3af'
                return (
                  <div key={role} className="flex items-center gap-2 py-2 border-b border-[var(--line)] last:border-0">
                    <div
                      className="shrink-0 flex items-center justify-center rounded-full overflow-hidden"
                      style={{ width: 36, height: 36, background: 'var(--accent)', border: '2px solid rgba(255,255,255,.25)' }}
                    >
                      <Avatar params={player?.avatar ?? null} size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {player ? (
                        <>
                          <div className="flex items-center gap-1">
                            <span className="text-sm font-bold truncate">{player.name}</span>
                            <span
                              className="shrink-0 rounded px-1 text-[9px] font-extrabold leading-tight"
                              style={{ background: badgeColor, color: '#000' }}
                            >
                              {badge}
                            </span>
                          </div>
                          <div className="text-[10px] text-[var(--muted)] flex items-center gap-1">
                            <span className="font-semibold">{player.position}</span>
                            <span>·</span>
                            <span className="font-bold" style={{ color: 'var(--accent)' }}>OVR {player.stats.overall}</span>
                          </div>
                        </>
                      ) : (
                        <span className="text-sm text-[var(--muted)]">
                          {isCapRole ? t('tactics.captainNotSet') : t('tactics.vcNotSet')}
                        </span>
                      )}
                    </div>
                    <button
                      className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold"
                      style={{ background: 'var(--accent)', color: '#fff' }}
                      onClick={() => setPickCaptain(role)}
                    >
                      {t('tactics.changeCaptain')}
                    </button>
                  </div>
                )
              })}
              <p className="text-[10px] text-[var(--muted)] mt-1">{t('tactics.captainBonusNote')}</p>
            </Card>

            {/* Team strength */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.teamStrength')}</div>
              <div className="mt-1">
                <StatBar label="ATT" value={Math.round(ratings.att)} />
                <StatBar label="MID" value={Math.round(ratings.mid)} />
                <StatBar label="DEF" value={Math.round(ratings.def)} />
                <StatBar label="GK" value={Math.round(ratings.gk)} />
              </div>
            </Card>
          </>
        )}

        {tab === 'tactics' && (
          <>
            {/* Tactical Familiarity */}
            <TacticalFamiliarityCard />
            {/* Mentality */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('tactics.mentality')}</div>
              <div className="flex gap-1">
                {MENTALITIES.map((m) => {
                  const mColor = MENTALITY_COLOR[m]
                  const isActive = mentality === m
                  return (
                    <button
                      key={m}
                      className="flex-1 rounded-lg py-2 text-[10px] font-bold text-center border transition-all duration-150"
                      style={{
                        background: isActive ? mColor : 'var(--card2)',
                        borderColor: isActive ? mColor : 'var(--line)',
                        color: isActive ? '#fff' : 'var(--muted)',
                        boxShadow: isActive ? `0 2px 8px ${mColor}44` : undefined,
                      }}
                      onClick={() => g.setMentality(m)}
                    >
                      {t(`tactics.m_${m}`)}
                    </button>
                  )
                })}
              </div>
              {/* Color strip showing progression */}
              <div className="mt-2 h-1 rounded-full overflow-hidden flex">
                {MENTALITIES.map((m) => (
                  <div key={m} className="flex-1 transition-opacity duration-150"
                    style={{ background: MENTALITY_COLOR[m], opacity: mentality === m ? 1 : 0.25 }} />
                ))}
              </div>
              <p className="text-[10px] text-[var(--muted)] mt-1">{t(`tactics.mDesc_${mentality}`)}</p>
            </Card>

            {/* Sliders */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1">{t('tactics.sliders')}</div>
              {(Object.keys(sliders) as (keyof TacticSliders)[]).map((key) => (
                <SliderRow
                  key={key}
                  label={t(`tactics.slider_${key}`)}
                  desc={t(`tactics.slider_${key}_desc`)}
                  value={sliders[key]}
                  onChange={(v) => g.setSlider(key, v)}
                />
              ))}
            </Card>

            {/* Presets */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('tactics.presets')}</div>
              {([0, 1, 2] as const).map((slot) => {
                const preset = tacticPresets[slot]
                return (
                  <div key={slot} className="flex items-center gap-2 border-b border-[var(--line)] last:border-0 py-2">
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold truncate">{preset ? preset.name : t('tactics.presetEmpty')}</div>
                      {preset && (
                        <div className="text-[10px] text-[var(--muted)]">{t(`tactics.m_${preset.mentality}`)}</div>
                      )}
                    </div>
                    <button
                      className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold border border-[var(--line)]"
                      style={{ background: 'var(--card2)', color: 'var(--muted)' }}
                      onClick={() => {
                        setPresetSaveSlot(slot)
                        setPresetNameInput(preset?.name ?? `${t('tactics.presets')} ${slot + 1}`)
                      }}
                    >
                      {t('tactics.presetSave')}
                    </button>
                    {preset && (
                      <button
                        className="shrink-0 rounded-lg px-2 py-1 text-[10px] font-bold"
                        style={{ background: 'var(--accent)', color: '#fff' }}
                        onClick={() => g.loadTacticPreset(slot)}
                      >
                        {t('tactics.presetLoad')}
                      </button>
                    )}
                  </div>
                )
              })}
            </Card>
          </>
        )}

        {tab === 'setpieces' && (
          <>
            {/* Corners */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.cornerTaker')}</div>
              <button
                className="row-tap flex items-center gap-2 py-2 w-full text-left border-b border-[var(--line)]"
                onClick={() => setPickSlot(-1)}
              >
                <span className="text-sm font-semibold flex-1 truncate">{spName(setpieces.corner)}</span>
                <span className="text-xs text-[var(--muted)]">›</span>
              </button>
              <div className="text-xs font-bold text-[var(--muted)] mt-2 mb-1">{t('tactics.cornerDelivery')}</div>
              <OptionPicker
                options={(['inswinger', 'outswinger', 'short', 'driven'] as CornerDelivery[])}
                value={spo.cornerDelivery}
                label={(v) => t(`tactics.cd_${v}`)}
                onChange={(v) => g.setSetpieceOption('cornerDelivery', v)}
              />
            </Card>

            {/* Free Kicks */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.freekickTaker')}</div>
              <button
                className="row-tap flex items-center gap-2 py-2 w-full text-left border-b border-[var(--line)]"
                onClick={() => setPickSlot(-2)}
              >
                <span className="text-sm font-semibold flex-1 truncate">{spName(setpieces.freekick)}</span>
                <span className="text-xs text-[var(--muted)]">›</span>
              </button>
              <div className="text-xs font-bold text-[var(--muted)] mt-2 mb-1">{t('tactics.fkRoutine')}</div>
              <OptionPicker
                options={(['shoot', 'cross', 'layoff', 'wall'] as FKRoutine[])}
                value={spo.fkRoutine}
                label={(v) => t(`tactics.fk_${v}`)}
                onChange={(v) => g.setSetpieceOption('fkRoutine', v)}
              />
            </Card>

            {/* Penalties */}
            <Card>
              <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.penaltyTaker')}</div>
              <button
                className="row-tap flex items-center gap-2 py-2 w-full text-left border-b border-[var(--line)]"
                onClick={() => setPickSlot(-3)}
              >
                <span className="text-sm font-semibold flex-1 truncate">{spName(setpieces.penalty)}</span>
                <span className="text-xs text-[var(--muted)]">›</span>
              </button>
              <div className="text-xs font-bold text-[var(--muted)] mt-2 mb-1">{t('tactics.penaltyStyle')}</div>
              <OptionPicker
                options={(['power', 'placed', 'panenka'] as PenaltyStyle[])}
                value={spo.penaltyStyle}
                label={(v) => t(`tactics.ps_${v}`)}
                onChange={(v) => g.setSetpieceOption('penaltyStyle', v)}
              />
              {spo.penaltyStyle === 'panenka' && (
                <p className="text-[10px] text-[var(--muted)] mt-1">{t('tactics.panenkaNota')}</p>
              )}
            </Card>

            {/* Long Throw */}
            <Card>
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)]">{t('tactics.longThrowTaker')}</div>
                <button
                  className="rounded-full px-3 py-0.5 text-[10px] font-bold border"
                  style={{
                    background: spo.longThrowOn ? 'var(--accent)' : 'var(--card2)',
                    borderColor: spo.longThrowOn ? 'var(--accent)' : 'var(--line)',
                    color: spo.longThrowOn ? '#fff' : 'var(--muted)',
                  }}
                  onClick={() => g.setSetpieceOption('longThrowOn', !spo.longThrowOn)}
                >
                  {spo.longThrowOn ? t('tactics.longThrowActive') : t('tactics.longThrowOff')}
                </button>
              </div>
              <button
                className="row-tap flex items-center gap-2 py-2 w-full text-left"
                onClick={() => setPickSlot(-4)}
              >
                <span className="text-sm font-semibold flex-1 truncate">{spName(setpieces.longThrow)}</span>
                <span className="text-xs text-[var(--muted)]">›</span>
              </button>
            </Card>
          </>
        )}

        {tab === 'opposition' && (
          <>
            {!oppTeam ? (
              <Card>
                <p className="text-sm text-[var(--muted)] text-center py-4">{t('tactics.noOpponentSet')}</p>
              </Card>
            ) : (
              <>
                {/* Man-marking */}
                <Card>
                  <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1">
                    {t('tactics.manMarkingTitle')} · <Flag code={oppId!} size={12} className="inline" /> {oppTeam.name}
                  </div>
                  <div className="flex flex-col">
                    {oppTop6.map((p) => {
                      const instr = instrMap[p.id] ?? 'normal'
                      return (
                        <div key={p.id} className="flex items-center gap-2 py-1.5 border-b border-[var(--line)] last:border-0">
                          <OvrBadge value={p.stats.overall} estimated={p.estimated} />
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold truncate">{p.name}</div>
                            <div className="text-[10px] text-[var(--muted)]">{p.position}</div>
                          </div>
                          <div className="flex rounded-lg overflow-hidden border border-[var(--line)]">
                            {(['tight', 'normal', 'space'] as const).map((opt) => (
                              <button
                                key={opt}
                                className="px-2 py-0.5 text-[10px] font-bold"
                                style={{
                                  background: instr === opt ? 'var(--accent)' : 'var(--card2)',
                                  color: instr === opt ? '#fff' : 'var(--muted)',
                                }}
                                onClick={() => g.setOppositionInstruction(p.id, opt)}
                              >
                                {t(`tactics.${opt}`)}
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </Card>

                {/* Pressing strategy hint */}
                <Card>
                  <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('tactics.pressingHintTitle')}</div>
                  <PressingHint oppTeam={oppTeam} />
                </Card>
              </>
            )}
          </>
        )}
      </div>

      {/* Player picker modal */}
      <Modal open={pickSlot !== null} onClose={() => setPickSlot(null)}>
        {pickSlot !== null && pickSlot >= 0 && (
          <PlayerPicker slotIndex={pickSlot} onDone={() => setPickSlot(null)} />
        )}
        {pickSlot === -1 && <SetPiecePicker type="corner" onDone={() => setPickSlot(null)} />}
        {pickSlot === -2 && <SetPiecePicker type="freekick" onDone={() => setPickSlot(null)} />}
        {pickSlot === -3 && <SetPiecePicker type="penalty" onDone={() => setPickSlot(null)} />}
        {pickSlot === -4 && <SetPiecePicker type="longThrow" onDone={() => setPickSlot(null)} />}
      </Modal>

      {/* Captain / Vice-captain picker modal */}
      <Modal open={pickCaptain !== null} onClose={() => setPickCaptain(null)}>
        {pickCaptain !== null && (
          <CaptainPicker role={pickCaptain} onDone={() => setPickCaptain(null)} />
        )}
      </Modal>

      {/* Preset save modal */}
      <Modal open={presetSaveSlot !== null} onClose={() => setPresetSaveSlot(null)}>
        <div className="p-1">
          <h2 className="text-lg font-extrabold mb-3">{t('tactics.presetNamePrompt')}</h2>
          <input
            className="w-full rounded-lg border border-[var(--line)] bg-[var(--card2)] px-3 py-2 text-sm font-semibold mb-3 outline-none"
            value={presetNameInput}
            maxLength={20}
            onChange={(e) => setPresetNameInput(e.target.value)}
            autoFocus
          />
          <button
            className="w-full rounded-lg py-2 text-sm font-bold"
            style={{ background: 'var(--accent)', color: '#fff' }}
            onClick={() => {
              if (presetSaveSlot !== null) {
                g.saveTacticPreset(presetSaveSlot, presetNameInput.trim() || `Preset ${presetSaveSlot + 1}`)
                setPresetSaveSlot(null)
              }
            }}
          >
            {t('common.confirm')}
          </button>
        </div>
      </Modal>
    </div>
  )
}

// ─── Position-fit legend ────────────────────────────────────────────────────

function FitLegend() {
  const { t } = useTranslation()
  const item = (color: string, label: string) => (
    <span className="flex items-center gap-1">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  )
  return (
    <div className="mt-2 flex items-center justify-center gap-3 text-[10px] text-[var(--muted)]">
      {item('#34c46a', t('tactics.fitNatural'))}
      {item('#e6b23a', t('tactics.fitAdjacent'))}
      {item('#e0485a', t('tactics.fitOut'))}
    </div>
  )
}

// ─── Slider row ─────────────────────────────────────────────────────────────

function SliderRow({ label, desc, value, onChange }: {
  label: string; desc: string; value: number; onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1 py-2 border-b border-[var(--line)] last:border-0">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold">{label}</span>
        <span className="text-sm font-extrabold w-6 text-right tabular-nums" style={{ color: 'var(--accent)' }}>{value}</span>
      </div>
      <input
        type="range" min={1} max={10} step={1} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full"
        style={{ accentColor: 'var(--accent)', height: '6px', cursor: 'pointer' }}
      />
      <span className="text-[10px] text-[var(--muted)]">{desc}</span>
    </div>
  )
}

// ─── Option picker row (styled buttons) ────────────────────────────────────

function OptionPicker<T extends string>({ options, value, label, onChange }: {
  options: T[]; value: T; label: (v: T) => string; onChange: (v: T) => void
}) {
  return (
    <div className="flex gap-1 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt}
          className="flex-1 rounded-lg py-1.5 text-[10px] font-bold border"
          style={{
            background: value === opt ? 'var(--accent)' : 'var(--card2)',
            borderColor: value === opt ? 'var(--accent)' : 'var(--line)',
            color: value === opt ? '#fff' : 'var(--muted)',
          }}
          onClick={() => onChange(opt)}
        >
          {label(opt)}
        </button>
      ))}
    </div>
  )
}

// ─── Pressing hint ──────────────────────────────────────────────────────────

function PressingHint({ oppTeam }: { oppTeam: ReturnType<typeof getTeam> }) {
  const { t } = useTranslation()
  const g = useGame()
  const oppAvg = Math.round(oppTeam.players.slice(0, 11).reduce((s, p) => s + p.stats.overall, 0) / Math.min(11, oppTeam.players.length))
  const team = getTeam(g.teamId!)
  const myAvg = Math.round(team.players.slice(0, 11).reduce((s, p) => s + p.stats.overall, 0) / 11)
  const diff = myAvg - oppAvg
  const hint = diff >= 5 ? t('tactics.pressingHintHigh') : diff <= -5 ? t('tactics.pressingHintLow') : t('tactics.pressingHintMid')
  const avgPass = Math.round(oppTeam.players.slice(0, 8).reduce((s, p) => s + (p.stats.passing ?? p.stats.overall * 0.55), 0) / 8)

  return (
    <div className="flex flex-col gap-2 text-sm">
      <div className="flex items-center justify-between">
        <span className="text-[var(--muted)] text-xs">{oppTeam.name} avg OVR</span>
        <span className="font-extrabold text-[var(--accent)]">{oppAvg}</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-[var(--muted)] text-xs">{oppTeam.name} avg Passing</span>
        <span className="font-extrabold text-[var(--accent)]">{avgPass}</span>
      </div>
      <p className="text-xs text-[var(--fg)] mt-1 leading-relaxed">{hint}</p>
    </div>
  )
}

// ─── Player picker modal ────────────────────────────────────────────────────

function PlayerPicker(props: { slotIndex: number; onDone: () => void }) {
  const { t } = useTranslation()
  const g = useGame()
  const team = getTeam(g.teamId!)
  const slots = FORMATIONS[g.lineup.formation]
  const slot = slots[props.slotIndex]
  const roles = g.lineup.roles ?? Array(slots.length).fill(null)
  const [, setPicked] = useState<string | null>(g.lineup.starters[props.slotIndex])
  const [step, setStep] = useState<'player' | 'role'>('player')

  const candidates = team.players
    .filter((p) => isAvailable(p, g.playerStates, g.day))
    .sort((a, b) => roleScore(b, slot.role) - roleScore(a, slot.role))

  const subRoleOptions = SUB_ROLES[slot.role] ?? []

  const confirmPlayer = (id: string | null) => {
    g.setStarter(props.slotIndex, id)
    if (id && subRoleOptions.length > 1) {
      setPicked(id)
      setStep('role')
    } else {
      props.onDone()
    }
  }

  const confirmRole = (role: string | null) => {
    g.setRole(props.slotIndex, role)
    props.onDone()
  }

  if (step === 'role') {
    const currentRole = roles[props.slotIndex]
    return (
      <div>
        <h2 className="text-lg font-extrabold">{t('tactics.pickRole', { slot: slot.label })}</h2>
        <p className="text-xs text-[var(--muted)] mt-0.5 mb-2">{t('tactics.pickRoleDesc')}</p>
        <div className="flex flex-col">
          <button
            className="row-tap py-2 text-left text-sm border-b border-[var(--line)]"
            style={{ color: !currentRole ? 'var(--accent)' : 'var(--muted)' }}
            onClick={() => confirmRole(null)}
          >
            {slot.label} ({t('tactics.default')})
          </button>
          {subRoleOptions.filter(r => r !== slot.label).map((r) => (
            <button
              key={r}
              className="row-tap py-2 text-left text-sm border-b border-[var(--line)] last:border-0 font-semibold"
              style={{ color: currentRole === r ? 'var(--accent)' : 'var(--fg)' }}
              onClick={() => confirmRole(r)}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-extrabold">{t('tactics.pickPlayer', { slot: slot.label })}</h2>
      <div className="mt-2 flex flex-col max-h-[60dvh] overflow-y-auto">
        <button
          className="row-tap py-2 text-left text-sm text-[var(--muted)]"
          onClick={() => { g.setStarter(props.slotIndex, null); props.onDone() }}
        >
          {t('tactics.empty')}
        </button>
        {candidates.map((p) => {
          const alreadyIn = g.lineup.starters.includes(p.id)
          const fit = positionFit(slot.label, p)
          return (
            <button
              key={p.id}
              className="row-tap flex items-center gap-2 border-t border-[var(--line)] py-2 text-left"
              onClick={() => confirmPlayer(p.id)}
            >
              <span className="shrink-0 h-2.5 w-2.5 rounded-full" style={{ background: POS_FIT_COLOR[fit] }} />
              <OvrBadge value={p.stats.overall} estimated={p.estimated} />
              <span className="flex-1 min-w-0">
                <span className="truncate text-sm font-semibold block">
                  {p.name}
                  {alreadyIn && ' •'}
                </span>
                <span className="mt-0.5 flex"><PositionBadges player={p} max={3} /></span>
              </span>
              <span className="text-xs text-[var(--muted)] shrink-0">
                {t('common.fitness').slice(0, 4)} {Math.round(g.playerStates[p.id].fitness)}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Set piece picker modal ─────────────────────────────────────────────────

function SetPiecePicker(props: { type: 'corner' | 'freekick' | 'penalty' | 'longThrow'; onDone: () => void }) {
  const { t } = useTranslation()
  const g = useGame()
  const team = getTeam(g.teamId!)
  const slots = FORMATIONS[g.lineup.formation]
  const inXI = new Set(g.lineup.starters.filter(Boolean) as string[])

  const labelKey = props.type === 'corner' ? 'tactics.cornerTaker'
    : props.type === 'freekick' ? 'tactics.freekickTaker'
    : props.type === 'longThrow' ? 'tactics.longThrowTaker'
    : 'tactics.penaltyTaker'

  const sortStat = (p: Player) => {
    if (props.type === 'penalty' || props.type === 'freekick') return p.stats.shooting ?? p.stats.overall * 0.6
    if (props.type === 'longThrow') return p.stats.physical ?? p.stats.overall * 0.5
    return p.stats.passing ?? p.stats.overall * 0.6
  }

  const candidates = team.players
    .filter((p) => inXI.has(p.id) && isAvailable(p, g.playerStates, g.day))
    .sort((a, b) => sortStat(b) - sortStat(a))

  const currentId = g.lineup.setpieces?.[props.type] ?? null

  return (
    <div>
      <h2 className="text-lg font-extrabold">{t(labelKey)}</h2>
      <div className="mt-2 flex flex-col max-h-[60dvh] overflow-y-auto">
        <button
          className="row-tap py-2 text-left text-sm text-[var(--muted)]"
          onClick={() => { g.setSetpiece(props.type, null); props.onDone() }}
        >
          {t('tactics.notSet')}
        </button>
        {candidates.map((p) => {
          const slotIdx = g.lineup.starters.indexOf(p.id)
          const slotLabel = slotIdx >= 0 ? slots[slotIdx]?.label : p.position
          const stat = sortStat(p)
          return (
            <button
              key={p.id}
              className="row-tap flex items-center gap-2 border-t border-[var(--line)] py-2 text-left"
              style={{ color: currentId === p.id ? 'var(--accent)' : undefined }}
              onClick={() => { g.setSetpiece(props.type, p.id); props.onDone() }}
            >
              <OvrBadge value={p.stats.overall} estimated={p.estimated} />
              <span className="flex-1 truncate text-sm font-semibold">{p.name}</span>
              <span className="text-xs text-[var(--muted)]">{slotLabel} · {Math.round(stat)}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Captain / Vice-Captain picker modal ────────────────────────────────────

function CaptainPicker(props: { role: 'captain' | 'vice'; onDone: () => void }) {
  const { t } = useTranslation()
  const g = useGame()
  const team = getTeam(g.teamId!)
  const [search, setSearch] = useState('')

  const isCaptainRole = props.role === 'captain'
  const currentId = isCaptainRole ? g.lineup.captainId : g.lineup.viceCaptainId
  // The other role's id — can't assign same player to both
  const blockedId = isCaptainRole ? g.lineup.viceCaptainId : g.lineup.captainId

  const candidates = [...team.players]
    .sort((a, b) => b.stats.overall - a.stats.overall)
    .filter((p) =>
      !search || p.name.toLowerCase().includes(search.toLowerCase())
    )

  const badge = isCaptainRole ? 'C' : 'VC'
  const badgeColor = isCaptainRole ? '#f59e0b' : '#9ca3af'
  const title = isCaptainRole ? t('tactics.captainTitle') : t('tactics.vcTitle')

  const confirm = (id: string | null) => {
    if (isCaptainRole) g.setCaptain(id)
    else g.setViceCaptain(id)
    props.onDone()
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <span
          className="rounded px-2 py-0.5 text-sm font-extrabold"
          style={{ background: badgeColor, color: '#000' }}
        >
          {badge}
        </span>
        <h2 className="text-lg font-extrabold">{title}</h2>
      </div>

      {/* Search */}
      <input
        className="w-full rounded-lg border border-[var(--line)] bg-[var(--card2)] px-3 py-2 text-sm font-semibold mb-2 outline-none"
        placeholder={t('tactics.searchPlayer')}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        autoFocus
      />

      <div className="flex flex-col max-h-[55dvh] overflow-y-auto">
        {/* Clear option */}
        <button
          className="row-tap py-2 text-left text-sm text-[var(--muted)] border-b border-[var(--line)]"
          onClick={() => confirm(null)}
        >
          {t('tactics.notSet')}
        </button>

        {candidates.map((p) => {
          const isSelected = p.id === currentId
          const isBlocked = p.id === blockedId
          return (
            <button
              key={p.id}
              disabled={isBlocked}
              className="row-tap flex items-center gap-2 border-b border-[var(--line)] last:border-0 py-2 text-left"
              style={{
                opacity: isBlocked ? 0.35 : 1,
                background: isSelected ? 'rgba(59,130,246,.08)' : undefined,
              }}
              onClick={() => !isBlocked && confirm(p.id)}
            >
              {/* Avatar */}
              <div
                className="shrink-0 flex items-center justify-center rounded-full overflow-hidden"
                style={{ width: 32, height: 32, background: 'var(--accent)', border: '2px solid rgba(255,255,255,.2)' }}
              >
                <Avatar params={p.avatar} size={28} />
              </div>

              {/* Name + badges */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1">
                  <span className="text-sm font-semibold truncate">{p.name}</span>
                  {isSelected && (
                    <span
                      className="shrink-0 rounded px-1 text-[9px] font-extrabold leading-tight"
                      style={{ background: badgeColor, color: '#000' }}
                    >
                      {badge}
                    </span>
                  )}
                  {isBlocked && (
                    <span
                      className="shrink-0 rounded px-1 text-[9px] font-extrabold leading-tight"
                      style={{ background: isCaptainRole ? '#9ca3af' : '#f59e0b', color: '#000' }}
                    >
                      {isCaptainRole ? 'VC' : 'C'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-[var(--muted)]">{p.position}</div>
              </div>

              {/* OVR */}
              <OvrBadge value={p.stats.overall} estimated={p.estimated} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tactical Familiarity helpers ───────────────────────────────────────────

function formationFamilyUI(f: string): number {
  const n = parseInt(f[0], 10)
  return [3, 4, 5].includes(n) ? n : 0
}

function familiarityDropMultiplierUI(oldFormation: string, newFormation: string, oldMentalityNum: number, newMentalityNum: number): number {
  let mult = 1.0
  if (oldFormation !== newFormation) {
    const of = formationFamilyUI(oldFormation)
    const nf = formationFamilyUI(newFormation)
    if (of === nf && of !== 0) mult *= 0.70
    else if (Math.abs(of - nf) <= 1) mult *= 0.50
    else mult *= 0.35
  }
  const steps = Math.abs(oldMentalityNum - newMentalityNum)
  if (steps === 1) mult *= 0.85
  else if (steps === 2) mult *= 0.70
  else if (steps >= 3) mult *= 0.50
  return mult
}

export function familiarityLabel(score: number, t: (k: string) => string): string {
  if (score <= 20) return t('tactics.fam_chaos')
  if (score <= 40) return t('tactics.fam_learning')
  if (score <= 60) return t('tactics.fam_developing')
  if (score <= 80) return t('tactics.fam_comfortable')
  return t('tactics.fam_excellent')
}

export function familiarityColor(score: number): string {
  if (score <= 20) return '#ef4444'   // red
  if (score <= 40) return '#f97316'   // orange
  if (score <= 60) return '#eab308'   // yellow
  if (score <= 80) return '#22c55e'   // green
  return '#f59e0b'                    // gold
}

function TacticalFamiliarityCard() {
  const { t } = useTranslation()
  const g = useGame()
  const fam = g.tacticalFamiliarity
  const score = fam.score
  const color = familiarityColor(score)
  const label = familiarityLabel(score, t)
  const isGold = score > 80

  return (
    <Card>
      <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">
        {t('tactics.famTitle')}
      </div>
      {/* Bar */}
      <div className="rounded-full overflow-hidden h-3 mb-1.5" style={{ background: 'var(--card2)' }}>
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: `${score}%`,
            background: color,
            boxShadow: isGold ? `0 0 8px 2px ${color}66` : undefined,
          }}
        />
      </div>
      {/* Labels row */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-extrabold" style={{ color }}>{label}</span>
        <span className="text-xs text-[var(--muted)] font-mono">{score}/100</span>
      </div>
      {/* Matches note */}
      <p className="text-[10px] text-[var(--muted)] mt-1">
        {t('tactics.famMatches', { n: fam.matchesWithCurrentSetup })}
      </p>
      {/* Penalty / bonus note */}
      {score <= 20 && <p className="text-[10px] mt-1" style={{ color: '#ef4444' }}>⚠️ {t('tactics.famPenaltyChaos')}</p>}
      {score <= 40 && score > 20 && <p className="text-[10px] mt-1" style={{ color: '#f97316' }}>⚠️ {t('tactics.famPenaltyLearning')}</p>}
      {score > 80 && <p className="text-[10px] mt-1" style={{ color: '#f59e0b' }}>⭐ {t('tactics.famBonusExcellent')}</p>}
    </Card>
  )
}
