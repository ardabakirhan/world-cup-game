/** Schema of the bundled teams.json (built from FIFA API + Wikipedia + FC 26). */

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export interface PlayerStats {
  overall: number
  potential: number | null
  pace: number | null
  shooting: number | null
  passing: number | null
  dribbling: number | null
  defending: number | null
  physical: number | null
}

export interface GkStats {
  diving: number
  handling: number
  kicking: number
  reflexes: number
  speed: number | null
  positioning: number
}

export interface Player {
  id: string
  name: string
  number: number
  position: Position
  /** Detailed FC26 positions, primary first (e.g. ["CAM","CM"]). For
   *  estimated/generated players this is a single broad-derived default. */
  positions?: string[]
  /** Detailed FC26 primary position (positions[0]). */
  primaryPosition?: string
  birthDate: string
  club: string
  caps: number
  goals: number
  stats: PlayerStats
  gkStats: GkStats | null
  skillMoves: number
  weakFoot: number
  preferredFoot: string
  estimated: boolean
  /** Where the ratings came from: FC26 | FC25 | FC24 | estimate */
  source?: string
  /** True for players in the extended pool (not original 26-man squad). */
  poolPlayer?: boolean
  /** Procedural avatar parameters derived from the player's photo (avatars.py) */
  avatar?: {
    skinTone: number
    hairStyle: string
    hairColor: string
    beard: string
    fromPhoto?: boolean
  }
}

/** One entry in a team's tournaments[] array (from teams_full.json). */
export interface TournamentRef {
  id: string
  qualified: boolean
  group?: string              // e.g. "A" — only when qualified in a group stage
  confederation_member?: boolean
  potential_invitee?: boolean
}

export interface Team {
  id: string
  name: string
  group: string | null        // null for non-WC teams
  confederation: string
  players: Player[]
  /** Top 15-20 FC26-rated nationals not in the 26-man squad. */
  extendedPool?: Player[]
  tournaments?: TournamentRef[]
  generated?: boolean
}

export interface TeamsFile {
  teams: Team[]
}
