import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useGame } from '../store/gameStore'
import type { FacilityType } from '../domain/types'
import { FACILITY_COST } from '../domain/types'

const FACILITY_INFO: Record<FacilityType, { icon: string; nameKey: string; descKey: string }> = {
  youth_academy:    { icon: '🌱', nameKey: 'fed.youthAcademy',   descKey: 'fed.youthAcademyDesc' },
  tactical_center:  { icon: '📋', nameKey: 'fed.tacticalCenter', descKey: 'fed.tacticalCenterDesc' },
  fitness_center:   { icon: '💪', nameKey: 'fed.fitnessCenter',  descKey: 'fed.fitnessCenterDesc' },
  scouting_network: { icon: '🔭', nameKey: 'fed.scoutingNet',    descKey: 'fed.scoutingNetDesc' },
  medical_center:   { icon: '🏥', nameKey: 'fed.medicalCenter',  descKey: 'fed.medicalCenterDesc' },
  stadium_upgrade:  { icon: '🏟', nameKey: 'fed.stadiumUpgrade', descKey: 'fed.stadiumUpgradeDesc' },
}

const FACILITY_ORDER: FacilityType[] = [
  'youth_academy', 'tactical_center', 'fitness_center',
  'scouting_network', 'medical_center', 'stadium_upgrade',
]

/** Format with Turkish-style dot thousands and ₺ suffix */
function fmtBudget(n: number): string {
  return n.toLocaleString('tr-TR') + ' ₺'
}

function fmtShort(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M ₺`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K ₺`
  return `${n} ₺`
}

export function Federation() {
  const { t } = useTranslation()
  const g = useGame()
  const [confirmFacility, setConfirmFacility] = useState<FacilityType | null>(null)

  const purchaseFacility = useGame((s) => s.purchaseFacility)

  const handlePurchase = () => {
    if (!confirmFacility) return
    purchaseFacility(confirmFacility)
    setConfirmFacility(null)
  }

  return (
    <div className="p-4 pb-24">
      <h1 className="text-2xl font-black mb-1">{t('fed.title')}</h1>
      <p className="text-xs text-[var(--muted)] mb-4">{t('fed.subtitle')}</p>

      {/* Budget card — large formatted number */}
      <div className="card p-4 mb-5 flex items-center gap-4">
        <span className="text-4xl shrink-0">💰</span>
        <div>
          <div className="text-[10px] text-[var(--muted)] font-bold uppercase tracking-wide">{t('fed.budget')}</div>
          <div className="text-2xl font-black tabular-nums leading-tight" style={{ color: 'var(--accent)' }}>
            {fmtBudget(g.federationBudget)}
          </div>
        </div>
      </div>

      {/* Facilities — 2×3 grid */}
      <h2 className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('fed.facilities')}</h2>
      <div className="grid grid-cols-2 gap-3">
        {FACILITY_ORDER.map((type) => {
          const info = FACILITY_INFO[type]
          const owned = g.facilitiesOwned.includes(type)
          const cost = FACILITY_COST[type]
          const canAfford = g.federationBudget >= cost
          const shortfall = cost - g.federationBudget

          return (
            <div
              key={type}
              className="card p-3 flex flex-col gap-2 relative overflow-hidden card-tap"
              style={{
                borderColor: owned ? 'var(--good)' : undefined,
                opacity: !owned && !canAfford ? 0.65 : 1,
              }}
            >
              {/* Owned overlay */}
              {owned && (
                <div className="absolute inset-0 pointer-events-none rounded-xl"
                  style={{ background: 'color-mix(in srgb, var(--good) 6%, transparent)' }} />
              )}

              <div className="text-3xl text-center">{info.icon}</div>
              <div className="text-center">
                <div className="text-sm font-bold leading-tight">{t(info.nameKey)}</div>
                <div className="text-[10px] text-[var(--muted)] mt-0.5 leading-tight">{t(info.descKey)}</div>
              </div>

              {owned ? (
                <div className="mt-auto flex items-center justify-center gap-1 text-xs font-black"
                  style={{ color: 'var(--good)' }}>
                  ✓ Aktif
                </div>
              ) : canAfford ? (
                <button
                  className="btn mt-auto text-xs py-2"
                  onClick={() => setConfirmFacility(type)}
                >
                  {fmtShort(cost)}
                </button>
              ) : (
                <div className="mt-auto text-center">
                  <div className="text-[10px] text-[var(--muted)] mb-1">🔒 {fmtShort(shortfall)} eksik</div>
                  <button
                    className="btn-ghost w-full text-[10px] py-1.5 opacity-50"
                    disabled
                  >
                    {fmtShort(cost)}
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Income hints */}
      <div className="mt-5 card p-3">
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-2">{t('fed.income')}</div>
        <div className="text-xs space-y-1.5 text-[var(--text)]">
          <div>🏆 {t('fed.incomeWin')}: <b>+500K ₺</b></div>
          <div>🥈 {t('fed.incomeQF')}: <b>+1M ₺</b></div>
          <div>🥇 {t('fed.incomeSF')}: <b>+2M ₺</b></div>
          <div>🏅 {t('fed.incomeTitle')}: <b>+5M ₺</b></div>
          <div>⚽ {t('fed.incomeFriendly')}: <b>+100K ₺</b></div>
        </div>
      </div>

      {/* Confirm modal */}
      {confirmFacility && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.75)' }}
          onClick={() => setConfirmFacility(null)}
        >
          <div className="card p-5 w-full max-w-xs" onClick={(e) => e.stopPropagation()}>
            <div className="text-2xl text-center mb-2">{FACILITY_INFO[confirmFacility].icon}</div>
            <div className="text-lg font-black text-center mb-1">
              {t(FACILITY_INFO[confirmFacility].nameKey)}
            </div>
            <div className="text-sm text-[var(--muted)] text-center mb-3">{t(FACILITY_INFO[confirmFacility].descKey)}</div>
            <div className="text-center mb-4">
              <span className="text-[var(--muted)] text-sm">{t('fed.cost')}: </span>
              <span className="font-black text-lg" style={{ color: 'var(--accent)' }}>{fmtBudget(FACILITY_COST[confirmFacility])}</span>
            </div>
            <div className="flex gap-2">
              <button className="btn flex-1" onClick={handlePurchase}>{t('common.confirm')}</button>
              <button className="btn-ghost flex-1" onClick={() => setConfirmFacility(null)}>{t('common.cancel')}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
