/* Store-level integration test: play a full career as TUR through the real
   zustand store (the same code paths the UI uses).
   Usage: npx tsx scripts/playthrough.ts [TEAMID] */

// minimal browser shims for @capacitor/preferences web implementation
const mem = new Map<string, string>()
;(globalThis as Record<string, unknown>).localStorage = {
  getItem: (k: string) => mem.get(k) ?? null,
  setItem: (k: string, v: string) => void mem.set(k, v),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
  key: (i: number) => [...mem.keys()][i] ?? null,
  get length() { return mem.size },
}
;(globalThis as Record<string, unknown>).window = globalThis

const teamId = process.argv[2] ?? 'TUR'

async function main() {
  const { useGame } = await import('../src/store/gameStore')
  const { teamFixture, TIMELINE } = await import('../src/domain/tournament/schedule')
  const { champion, resultLabel } = await import('../src/domain/tournament/bracket')
  const { getTeam } = await import('../src/data/teams')

  const g = () => useGame.getState()
  g().newCareer(teamId)
  console.log(`career started as ${teamId}, phase=${g().phase}, fixtures=${g().fixtures.length}`)

  let guard = 0
  while (g().phase !== 'finished' && guard++ < 60) {
    const s = g()
    if (s.pendingEvent) {
      console.log(`  day ${s.day}: event '${s.pendingEvent.eventId}' -> choice 0`)
      s.resolveEvent(0)
    }
    if (s.phase === 'prep') {
      if (!s.prepActionUsed) s.doPrepAction(s.day % 2 === 0 ? 'rest' : 'talk')
      s.advanceDay()
      continue
    }
    if (s.phase === 'matchday') {
      const fx = teamFixture(s.fixtures, teamId, s.day)
      if (fx && !fx.result && !s.eliminated) {
        const created = s.createUserMatch()
        if (!created) throw new Error('createUserMatch failed on matchday')
        created.sim.finishFast()
        s.commitUserMatch(created.sim, created.fixture.id)
        const r = created.sim.result(false)
        console.log(`  day ${s.day} ${fx.round}: ${getTeam(fx.homeId!).name} ${resultLabel(r)} ${getTeam(fx.awayId!).name}`)
      }
      g().advanceDay()
      continue
    }
    throw new Error(`unexpected phase ${s.phase}`)
  }

  const s = g()
  console.log(`\nfinished: phase=${s.phase}, day=${s.day}/${TIMELINE.length}`)
  console.log(`eliminated=${s.eliminated} round=${s.eliminatedRound}`)
  const champ = champion(s.fixtures)
  console.log(`champion: ${champ ? getTeam(champ).name : 'NONE (bug!)'}`)
  const unplayed = s.fixtures.filter((f) => !f.result)
  console.log(`fixtures: ${s.fixtures.length} total, ${unplayed.length} unplayed`)
  if (unplayed.length) console.log('UNPLAYED:', unplayed.map((f) => f.id))

  // persistence smoke test (Capacitor prefixes keys with 'CapacitorStorage.')
  await new Promise((r) => setTimeout(r, 100)) // let async persist flush
  const saved = mem.get('CapacitorStorage.wc26-career')
  console.log(`save size: ${saved ? (saved.length / 1024).toFixed(0) : 0} KB`)
  if (!champ || unplayed.length) {
    console.error('PLAYTHROUGH FAILED')
    process.exit(1)
  }
  console.log('PLAYTHROUGH OK')
}

void main()
