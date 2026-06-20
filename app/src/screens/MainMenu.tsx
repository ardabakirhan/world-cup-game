import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useGame } from '../store/gameStore'
import { getTeam } from '../data/teams'
import type { SaveSlotMeta } from '../domain/types'
import { Modal, Segmented } from '../components/ui'
import { Flag } from '../components/Flag'
import { Avatar } from '../components/Avatar'
import i18n from '../i18n'

type ModalType = 'settings' | 'about' | 'load' | null

export function MainMenu() {
  const { t } = useTranslation()
  const nav = useNavigate()
  const [modal, setModal] = useState<ModalType>(null)

  return (
    <div className="flex flex-col h-dvh items-center justify-center p-6 gap-4 bg-[var(--bg)]">
      {/* Logo */}
      <div className="text-center mb-6">
        <div className="text-6xl mb-1">⚽</div>
        <div className="text-4xl font-black tracking-tight">{t('menu.title')}</div>
        <div className="text-base text-[var(--muted)] font-semibold mt-0.5 tracking-wide uppercase">
          {t('menu.subtitle')}
        </div>
      </div>

      {/* Main buttons */}
      <button className="btn w-full max-w-xs text-base" onClick={() => nav('/newgame')}>
        {t('menu.newGame')}
      </button>
      <button className="btn-ghost w-full max-w-xs text-base" onClick={() => setModal('load')}>
        {t('menu.loadGame')}
      </button>
      <button className="btn-ghost w-full max-w-xs text-base" onClick={() => setModal('settings')}>
        {t('menu.settings')}
      </button>
      <button className="btn-ghost w-full max-w-xs text-base" onClick={() => setModal('about')}>
        {t('menu.about')}
      </button>

      <Modal open={modal === 'settings'} onClose={() => setModal(null)}>
        <SettingsPanel onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'about'} onClose={() => setModal(null)}>
        <AboutPanel onClose={() => setModal(null)} />
      </Modal>
      <Modal open={modal === 'load'} onClose={() => setModal(null)}>
        <LoadPanel onClose={() => setModal(null)} />
      </Modal>
    </div>
  )
}

// ── Settings ─────────────────────────────────────────────────────────────────

function SettingsPanel(props: { onClose: () => void }) {
  const { t } = useTranslation()
  const g = useGame()
  const [lang, setLangLocal] = useState<'tr' | 'en'>(g.lang)
  const [music, setMusicLocal] = useState(g.music)
  const [sfx, setSfxLocal] = useState(g.sfx)
  const [difficulty, setDiffLocal] = useState(g.difficulty)

  const save = () => {
    g.setLang(lang)
    g.setSound(music, sfx)
    if (g.difficulty !== difficulty) g.setDifficulty(difficulty)
    void i18n.changeLanguage(lang)
    props.onClose()
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-extrabold">{t('settings.title')}</h2>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">{t('settings.language')}</div>
        <Segmented
          options={[{ value: 'en', label: 'EN' }, { value: 'tr', label: 'TR' }]}
          value={lang}
          onChange={setLangLocal}
        />
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">{t('settings.sound')}</div>
        <div className="flex gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={music} onChange={(e) => setMusicLocal(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            {t('settings.music')}
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={sfx} onChange={(e) => setSfxLocal(e.target.checked)} className="w-4 h-4 accent-[var(--accent)]" />
            {t('settings.sfx')}
          </label>
        </div>
      </div>

      <div>
        <div className="text-xs font-bold uppercase tracking-wide text-[var(--muted)] mb-1.5">{t('settings.difficulty')}</div>
        <Segmented
          options={[
            { value: 'easy', label: t('settings.easy') },
            { value: 'normal', label: t('settings.normal') },
            { value: 'hard', label: t('settings.hard') },
          ]}
          value={difficulty}
          onChange={setDiffLocal}
        />
        <p className="text-xs text-[var(--muted)] mt-1.5">
          {difficulty === 'easy' ? t('settings.easyDesc') : difficulty === 'hard' ? t('settings.hardDesc') : t('settings.normalDesc')}
        </p>
      </div>

      <button className="btn w-full mt-1" onClick={save}>{t('settings.save')}</button>
    </div>
  )
}

// ── About ─────────────────────────────────────────────────────────────────────

function AboutPanel(props: { onClose: () => void }) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col gap-3">
      <div className="text-center py-4">
        <div className="text-5xl mb-2">⚽</div>
        <div className="text-2xl font-black">2026 WC Manager</div>
        <div className="text-xs text-[var(--muted)] mt-1">{t('menu.version')}</div>
      </div>
      <div className="text-sm text-[var(--muted)] text-center whitespace-pre-line leading-relaxed">
        {t('menu.credits')}
      </div>
      <button className="btn-ghost w-full mt-2" onClick={props.onClose}>{t('common.ok')}</button>
    </div>
  )
}

// ── Load Game ─────────────────────────────────────────────────────────────────

function LoadPanel(props: { onClose: () => void }) {
  const { t } = useTranslation()
  const nav = useNavigate()
  const g = useGame()
  const [slots, setSlots] = useState<(SaveSlotMeta | null)[]>([null, null, null])
  const [confirmLoad, setConfirmLoad] = useState<0 | 1 | 2 | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<0 | 1 | 2 | null>(null)

  useEffect(() => {
    g.listSlots().then(setSlots)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const doLoad = async (n: 0 | 1 | 2) => {
    const ok = await g.loadFromSlot(n)
    if (ok) { props.onClose(); nav('/home') }
  }

  const doDelete = async (n: 0 | 1 | 2) => {
    await g.deleteSlot(n)
    const fresh = await g.listSlots()
    setSlots(fresh)
    setConfirmDelete(null)
  }

  const teamName = (meta: SaveSlotMeta) => {
    try { return getTeam(meta.teamId).name } catch { return meta.teamId }
  }

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-xl font-extrabold">{t('menu.loadGame')}</h2>

      {slots.every((s) => !s) && (
        <p className="text-sm text-[var(--muted)] py-4 text-center">{t('menu.noSaves')}</p>
      )}

      {slots.map((meta, idx) => {
        const n = idx as 0 | 1 | 2
        return (
          <div
            key={n}
            className="card p-3 flex items-center gap-3"
          >
            {meta ? (
              <>
                <Avatar params={meta ? g.coach?.avatar : null} size={40} round />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate">{meta.coachName}</div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Flag code={meta.teamId} size={14} />
                    <span className="text-xs text-[var(--muted)] truncate">{teamName(meta)} · Day {meta.day}</span>
                  </div>
                  <div className="text-[10px] text-[var(--muted)] mt-0.5">
                    {new Date(meta.savedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <button
                    className="btn text-xs py-1 px-3"
                    onClick={() => setConfirmLoad(n)}
                  >
                    Load
                  </button>
                  <button
                    className="btn-ghost text-xs py-1 px-3 text-[var(--bad)]"
                    onClick={() => setConfirmDelete(n)}
                  >
                    {t('menu.deleteSlot')}
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 text-sm text-[var(--muted)] text-center py-2">
                {t('menu.slot', { n: n + 1 })} — {t('menu.emptySlot')}
              </div>
            )}
          </div>
        )
      })}

      <button className="btn-ghost w-full mt-1" onClick={props.onClose}>{t('common.cancel')}</button>

      {/* Confirm load */}
      <Modal open={confirmLoad !== null} onClose={() => setConfirmLoad(null)}>
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{t('menu.loadConfirm')}</p>
          <button className="btn w-full" onClick={() => { doLoad(confirmLoad!); setConfirmLoad(null) }}>{t('common.confirm')}</button>
          <button className="btn-ghost w-full" onClick={() => setConfirmLoad(null)}>{t('common.cancel')}</button>
        </div>
      </Modal>

      {/* Confirm delete */}
      <Modal open={confirmDelete !== null} onClose={() => setConfirmDelete(null)}>
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold">{t('menu.deleteConfirm')}</p>
          <button
            className="btn w-full"
            style={{ background: 'var(--bad)' }}
            onClick={() => doDelete(confirmDelete!)}
          >
            {t('menu.deleteSlot')}
          </button>
          <button className="btn-ghost w-full" onClick={() => setConfirmDelete(null)}>{t('common.cancel')}</button>
        </div>
      </Modal>
    </div>
  )
}
