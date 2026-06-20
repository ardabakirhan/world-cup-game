import { useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import type { FormationSlot } from '../domain/types'
import { Avatar } from './Avatar'
import type { AvatarParams } from './avatarGen'
import { POS_FIT_COLOR, type PosFit } from '../domain/positions'

export interface ChipData {
  id: string
  number: number
  label: string // short display name
  effOvr: number // overall after position penalty
  ovr: number // natural overall
  icons: string // status emojis ('' if fine)
  disabled?: boolean // not draggable/selectable (injured bench player etc.)
  avatar?: AvatarParams | null
  subRole?: string | null  // user-assigned sub-role (null = slot default)
  isCaptain?: boolean
  isViceCaptain?: boolean
  posFit?: PosFit // green/yellow/red fit for the slot the chip sits in
}

type Source = { kind: 'pitch'; idx: number } | { kind: 'bench'; id: string }

interface Props {
  slots: FormationSlot[]
  pitch: (ChipData | null)[] // aligned with slots
  bench: ChipData[]
  benchTitle: string
  onSwapPitch: (i: number, j: number) => void
  onBenchToPitch: (benchId: string, slotIdx: number) => void
  /** optional: drop a pitch player onto the bench strip (clear slot) */
  onPitchToBench?: (slotIdx: number) => void
  /** optional: tap a filled pitch slot to open player/role picker */
  onSlotTap?: (slotIdx: number) => void
}

const DRAG_THRESHOLD = 10

export function PitchView(props: Props) {
  const [selected, setSelected] = useState<Source | null>(null)
  const [drag, setDrag] = useState<{ src: Source; chip: ChipData; x: number; y: number } | null>(null)
  const pressRef = useRef<{ src: Source; chip: ChipData; x: number; y: number; moved: boolean } | null>(null)

  const sameSource = (a: Source, b: Source) =>
    a.kind === b.kind &&
    (a.kind === 'pitch' ? a.idx === (b as { idx: number }).idx : a.id === (b as { id: string }).id)

  const dropOn = (src: Source, target: Source | 'benchzone') => {
    if (target === 'benchzone') {
      if (src.kind === 'pitch') props.onPitchToBench?.(src.idx)
      return
    }
    if (sameSource(src, target)) return
    if (src.kind === 'pitch' && target.kind === 'pitch') props.onSwapPitch(src.idx, target.idx)
    else if (src.kind === 'bench' && target.kind === 'pitch') props.onBenchToPitch(src.id, target.idx)
    else if (src.kind === 'pitch' && target.kind === 'bench') props.onPitchToBench?.(src.idx)
  }

  const tap = (target: Source, chip: ChipData | null) => {
    if (!selected) {
      if (chip && !chip.disabled) {
        if (target.kind === 'pitch') {
          // Tap filled pitch slot → open player/role picker
          props.onSlotTap?.(target.idx)
        } else {
          setSelected(target)
        }
      }
      return
    }
    if (sameSource(selected, target)) {
      setSelected(null)
      return
    }
    dropOn(selected, target)
    setSelected(null)
  }

  const findTarget = (clientX: number, clientY: number): Source | 'benchzone' | null => {
    const el = document.elementFromPoint(clientX, clientY)
    if (!el) return null
    const slotEl = el.closest('[data-slotidx]')
    if (slotEl) return { kind: 'pitch', idx: Number(slotEl.getAttribute('data-slotidx')) }
    const benchEl = el.closest('[data-benchid]')
    if (benchEl) return { kind: 'bench', id: benchEl.getAttribute('data-benchid')! }
    if (el.closest('[data-benchzone]')) return 'benchzone'
    return null
  }

  const handleDown = (src: Source, chip: ChipData | null) => (e: ReactPointerEvent) => {
    if (!chip || chip.disabled) {
      if (selected) tap(src, chip) // allow dropping onto an empty slot via tap
      return
    }
    e.currentTarget.setPointerCapture(e.pointerId)
    pressRef.current = { src, chip, x: e.clientX, y: e.clientY, moved: false }
  }

  const handleMove = (e: ReactPointerEvent) => {
    const press = pressRef.current
    if (!press) return
    if (!press.moved) {
      const d = Math.hypot(e.clientX - press.x, e.clientY - press.y)
      if (d < DRAG_THRESHOLD) return
      press.moved = true
    }
    setDrag({ src: press.src, chip: press.chip, x: e.clientX, y: e.clientY })
  }

  const handleUp = (src: Source, chip: ChipData | null) => (e: ReactPointerEvent) => {
    const press = pressRef.current
    pressRef.current = null
    setDrag(null)
    if (!press) {
      if (!chip || chip.disabled) tap(src, chip)
      return
    }
    if (press.moved) {
      const target = findTarget(e.clientX, e.clientY)
      if (target) dropOn(press.src, target)
      setSelected(null)
    } else {
      tap(src, chip)
    }
  }

  const isSelected = (src: Source) => selected !== null && sameSource(selected, src)

  return (
    <div className="select-none">
      {/* pitch */}
      <div className="relative w-full overflow-hidden rounded-xl border border-[var(--line)]" style={{ aspectRatio: '100 / 128' }}>
        <PitchLines />
        {props.slots.map((slot, i) => {
          const chip = props.pitch[i]
          const src: Source = { kind: 'pitch', idx: i }
          return (
            <div
              key={i}
              data-slotidx={i}
              className="absolute"
              style={{
                left: `${slot.x}%`,
                top: `${slot.y}%`,
                transform: 'translate(-50%, -50%)',
                transition: 'left .25s ease, top .25s ease',
                touchAction: 'none',
              }}
              onPointerDown={handleDown(src, chip)}
              onPointerMove={handleMove}
              onPointerUp={handleUp(src, chip)}
            >
              {chip ? (
                <Chip chip={chip} selected={isSelected(src)} dimmed={drag?.src.kind === 'pitch' && drag.src.idx === i} />
              ) : (
                <EmptySlot label={slot.label} highlight={selected !== null} />
              )}
            </div>
          )
        })}
      </div>

      {/* bench strip */}
      <div data-benchzone className="mt-2">
        <div className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{props.benchTitle}</div>
        <div className="mt-1 flex gap-2 overflow-x-auto pb-2">
          {props.bench.map((chip) => {
            const src: Source = { kind: 'bench', id: chip.id }
            return (
              <div
                key={chip.id}
                data-benchid={chip.id}
                className="shrink-0"
                style={{ touchAction: 'pan-x', opacity: chip.disabled ? 0.4 : 1 }}
                onPointerDown={handleDown(src, chip)}
                onPointerMove={handleMove}
                onPointerUp={handleUp(src, chip)}
              >
                <Chip chip={chip} selected={isSelected(src)} dimmed={drag?.src.kind === 'bench' && drag.src.id === chip.id} />
              </div>
            )
          })}
        </div>
      </div>

      {/* drag ghost */}
      {drag && (
        <div
          className="pointer-events-none fixed z-50"
          style={{ left: drag.x, top: drag.y, transform: 'translate(-50%, -60%) scale(1.08)' }}
        >
          <Chip chip={drag.chip} selected={false} dimmed={false} />
        </div>
      )}
    </div>
  )
}

function Chip(props: { chip: ChipData; selected: boolean; dimmed: boolean }) {
  const { chip } = props
  const penalized = chip.effOvr < chip.ovr
  const fitColor = chip.posFit ? POS_FIT_COLOR[chip.posFit] : null
  return (
    <div className="flex w-14 flex-col items-center" style={{ opacity: props.dimmed ? 0.35 : 1 }}>
      <div className="relative">
        <div
          className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full border-2"
          style={{
            background: 'var(--accent)',
            borderColor: props.selected ? '#fff' : fitColor ?? 'rgba(255,255,255,.35)',
            boxShadow: props.selected
              ? '0 0 0 3px var(--accent)'
              : fitColor ? `0 0 0 2px ${fitColor}` : '0 1px 4px rgba(0,0,0,.5)',
          }}
        >
          <Avatar params={chip.avatar} size={36} />
        </div>
        {chip.number > 0 && (
          <span
            className="absolute -bottom-0.5 -left-1.5 rounded px-0.5 text-[9px] font-extrabold leading-tight text-white"
            style={{ background: 'rgba(0,0,0,.55)' }}
          >
            {chip.number}
          </span>
        )}
        {chip.icons && (
          <span className="absolute -right-2 -top-1.5 text-[11px] leading-none">{chip.icons}</span>
        )}
        {chip.isCaptain && (
          <span
            className="absolute -bottom-0.5 -right-2 rounded px-0.5 text-[8px] font-extrabold leading-tight"
            style={{ background: '#f59e0b', color: '#000' }}
          >
            C
          </span>
        )}
        {chip.isViceCaptain && (
          <span
            className="absolute -bottom-0.5 -right-2 rounded px-0.5 text-[8px] font-extrabold leading-tight"
            style={{ background: '#9ca3af', color: '#000' }}
          >
            VC
          </span>
        )}
      </div>
      <div className="mt-0.5 flex max-w-14 items-center gap-0.5">
        <span className="truncate text-[10px] font-semibold leading-tight">{chip.label}</span>
        <span
          className="rounded px-0.5 text-[10px] font-extrabold tabular-nums"
          style={{ background: penalized ? 'var(--bad)' : 'var(--card2)', color: penalized ? '#fff' : 'var(--text)' }}
        >
          {chip.effOvr}
        </span>
      </div>
      {chip.subRole && (
        <div className="text-[8px] font-bold text-[var(--accent)] leading-none mt-0.5">{chip.subRole}</div>
      )}
    </div>
  )
}

function EmptySlot(props: { label: string; highlight: boolean }) {
  return (
    <div className="flex w-14 flex-col items-center">
      <div
        className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-dashed text-[10px] font-bold"
        style={{
          borderColor: props.highlight ? 'var(--accent)' : 'rgba(255,255,255,.3)',
          color: 'var(--muted)',
          background: 'rgba(0,0,0,.25)',
        }}
      >
        {props.label}
      </div>
    </div>
  )
}

/** Static SVG pitch markings, dark-theme friendly. */
function PitchLines() {
  const line = 'rgba(255,255,255,0.22)'
  return (
    <svg viewBox="0 0 100 128" className="absolute inset-0 h-full w-full" style={{ background: '#16301f' }}>
      {/* mowing stripes */}
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect key={i} x="0" y={i * 16} width="100" height="8" fill="rgba(255,255,255,0.025)" />
      ))}
      <rect x="3" y="3" width="94" height="122" fill="none" stroke={line} strokeWidth="0.7" />
      <line x1="3" y1="64" x2="97" y2="64" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="64" r="11" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="64" r="0.9" fill={line} />
      {/* top (opponent) box */}
      <rect x="24" y="3" width="52" height="19" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="37" y="3" width="26" height="7" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="16" r="0.9" fill={line} />
      {/* bottom (own) box */}
      <rect x="24" y="106" width="52" height="19" fill="none" stroke={line} strokeWidth="0.7" />
      <rect x="37" y="118" width="26" height="7" fill="none" stroke={line} strokeWidth="0.7" />
      <circle cx="50" cy="112" r="0.9" fill={line} />
    </svg>
  )
}
