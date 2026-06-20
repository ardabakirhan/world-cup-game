// Pitch visualization entry point.
// All player/ball positions come directly from the match engine's spatial model
// (matchEngine.buildMinute / pitchTeam). Commentary and pitch are always in sync.
export type { MatchMinute, PlayerDot, PitchAction, PitchEvent, RoleCat } from './matchEngine'
export { matchMinute } from './matchEngine'

/** Attack-axis helper: 0 = own goal, 100 = opponent goal. Used by diagnostic scripts. */
export function attackAxis(x: number, team: 'home' | 'away'): number {
  return team === 'home' ? x : 100 - x
}
