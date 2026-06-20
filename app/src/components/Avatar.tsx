import { useMemo } from 'react'
import { avatarSvg, type AvatarParams } from './avatarGen'

const FALLBACK: AvatarParams = { skinTone: 3, hairStyle: 'short', hairColor: 'black', beard: 'none' }

/** Single avatar component for squad rows, pitch chips, event feed and detail card. */
export function Avatar(props: { params?: AvatarParams | null; size: number; round?: boolean }) {
  const { params, size } = props
  const html = useMemo(() => avatarSvg(params ?? FALLBACK, size), [params, size])
  return (
    <span
      className="inline-block shrink-0 overflow-hidden align-middle"
      style={{
        width: size,
        height: size,
        borderRadius: props.round === false ? 8 : '50%',
        background: 'var(--card2)',
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
