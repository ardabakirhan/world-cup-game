import type { CSSProperties, ReactNode } from 'react'

export function Card(props: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties }) {
  return (
    <div className={`card p-3 ${props.onClick ? 'row-tap cursor-pointer' : ''} ${props.className ?? ''}`} onClick={props.onClick} style={props.style}>
      {props.children}
    </div>
  )
}

export function Segmented<T extends string>(props: {
  options: { value: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex rounded-lg overflow-hidden border border-[var(--line)]">
      {props.options.map((o) => (
        <button
          key={o.value}
          onClick={() => props.onChange(o.value)}
          className="flex-1 py-2 text-sm font-semibold"
          style={{
            background: o.value === props.value ? 'var(--accent)' : 'var(--card2)',
            color: o.value === props.value ? '#fff' : 'var(--muted)',
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function StatBar(props: { label: string; value: number | null }) {
  const v = props.value ?? 0
  const color = v >= 80 ? 'var(--good)' : v >= 65 ? 'var(--warn)' : 'var(--bad)'
  return (
    <div className="flex items-center gap-2 py-0.5">
      <span className="w-28 text-xs text-[var(--muted)]">{props.label}</span>
      <div className="flex-1 h-2.5 rounded-full bg-[var(--card2)]">
        <div className="h-2.5 rounded-full transition-all duration-500" style={{ width: `${v}%`, background: color }} />
      </div>
      <span className="w-7 text-right text-xs font-bold">{props.value ?? '—'}</span>
    </div>
  )
}

export function Modal(props: { open: boolean; onClose?: () => void; children: ReactNode }) {
  if (!props.open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={props.onClose}>
      <div
        className="w-full max-w-[560px] max-h-[85dvh] overflow-y-auto rounded-t-2xl bg-[var(--card)] border-t border-[var(--line)] p-4"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>
  )
}

/** Small colored dot scale for form/morale (1-10) or fitness (0-100). */
export function CondDot(props: { value: number; max: number }) {
  const r = props.value / props.max
  const color = r >= 0.65 ? 'var(--good)' : r >= 0.4 ? 'var(--warn)' : 'var(--bad)'
  return (
    <span className="inline-flex items-center gap-1 text-xs tabular-nums">
      <span className="inline-block w-2 h-2 rounded-full" style={{ background: color }} />
      {Math.round(props.value)}
    </span>
  )
}

export function OvrBadge(props: { value: number; estimated?: boolean }) {
  const v = props.value
  // Gold ≥85, green ≥75, neutral ≥65, muted below
  const bg    = v >= 85 ? '#78400a' : v >= 75 ? '#14532d' : v >= 65 ? '#1e2a3a' : '#2a1f2a'
  const color = v >= 85 ? '#fbbf24' : v >= 75 ? '#4ade80' : v >= 65 ? 'var(--text)' : 'var(--muted)'
  return (
    <span
      className="inline-block min-w-8 text-center rounded-md px-1 py-0.5 text-sm font-extrabold"
      style={{ background: bg, color, opacity: props.estimated ? 0.75 : 1 }}
      title={props.estimated ? '≈' : undefined}
    >
      {v}
      {props.estimated ? '*' : ''}
    </span>
  )
}
