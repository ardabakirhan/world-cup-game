import raw from './teams.json'
import type { Player, Team, TeamsFile } from './types'

export const TEAMS: Team[] = (raw as TeamsFile).teams

const teamById = new Map(TEAMS.map((t) => [t.id, t]))
const playerById = new Map<string, { player: Player; teamId: string }>()
for (const t of TEAMS)
  for (const p of t.players) playerById.set(p.id, { player: p, teamId: t.id })

export function getTeam(id: string): Team {
  const t = teamById.get(id)
  if (!t) throw new Error(`unknown team ${id}`)
  return t
}

export function getPlayer(id: string): Player {
  const e = playerById.get(id)
  if (!e) throw new Error(`unknown player ${id}`)
  return e.player
}

export function getPlayerTeam(id: string): string {
  const e = playerById.get(id)
  if (!e) throw new Error(`unknown player ${id}`)
  return e.teamId
}

export function teamAvgOverall(t: Team): number {
  const top = [...t.players].sort((a, b) => b.stats.overall - a.stats.overall).slice(0, 11)
  return Math.round(top.reduce((s, p) => s + p.stats.overall, 0) / top.length)
}

export const GROUPS = [...new Set(TEAMS.map((t) => t.group).filter((g): g is string => g !== null))].sort()

export function groupTeams(group: string): Team[] {
  return TEAMS.filter((t) => t.group === group)
}
