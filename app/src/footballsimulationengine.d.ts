declare module 'footballsimulationengine' {
  export function initiateGame(team1: unknown, team2: unknown, pitch: unknown): Promise<unknown>
  export function playIteration(matchDetails: unknown): Promise<unknown>
  export function startSecondHalf(matchDetails: unknown): Promise<unknown>
}
