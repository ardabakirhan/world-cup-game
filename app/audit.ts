import { MatchSim, matchMinute } from './src/domain/engine/matchEngine'

const homeSide = {
  teamId: 'H',
  name: 'Home FC',
  formation: '4-3-3',
  tactics: { style: 'balanced', press: 'mid', mentality: 'balanced', sliders: {width:5, defLine:5, press:5, tempo:5, aggression:5, crossing:5, counter:5} },
  starters: Array.from({length: 11}).map((_, i) => ({ id: `h${i}`, name: `H${i}`, position: i===0?'GK':'MF', slotRole: i===0?'GK':(i<5?'DF':(i<8?'MF':'FW')), stats: {overall: 80}, fitness: 100, form: 7, morale: 7 })),
  bench: Array.from({length: 10}).map((_, i) => ({ id: `hb${i}`, name: `HB${i}`, position: 'MF', slotRole: 'MF', stats: {overall: 75}, fitness: 100, form: 7, morale: 7 })),
  manager: 'H',
  color: '#f00'
} as any

const awaySide = {
  teamId: 'A',
  name: 'Away FC',
  formation: '4-4-2',
  tactics: { style: 'balanced', press: 'mid', mentality: 'balanced', sliders: {width:5, defLine:5, press:5, tempo:5, aggression:5, crossing:5, counter:5} },
  starters: Array.from({length: 11}).map((_, i) => ({ id: `a${i}`, name: `A${i}`, position: i===0?'GK':'MF', slotRole: i===0?'GK':(i<5?'DF':(i<9?'MF':'FW')), stats: {overall: 80}, fitness: 100, form: 7, morale: 7 })),
  bench: Array.from({length: 10}).map((_, i) => ({ id: `ab${i}`, name: `AB${i}`, position: 'MF', slotRole: 'MF', stats: {overall: 75}, fitness: 100, form: 7, morale: 7 })),
  manager: 'A',
  color: '#00f'
} as any

const sim = new MatchSim(homeSide, awaySide, { knockout: false, seed: 12345 })
const issues: string[] = []

let steps = 0
while (sim.phase !== 'DONE' && steps < 200) {
  steps++
  sim.step()
  if (sim.phase === 'HT') {
    sim.applySubs('home', [{ outId: 'h10', inId: 'hb0' }])
    sim.home.tactics.mentality = 'attacking'
    sim.resumeFromBreak()
  }
  if (sim.phase === 'DONE') break

  const mm = matchMinute(sim, sim.minute)
  const dots = Object.entries(mm.players).map(([id, d]) => ({ id, ...d }))
  const hDots = dots.filter((p) => p.team === 'home')
  const aDots = dots.filter((p) => p.team === 'away')
  const reds = sim.events.some((e) => e.type === 'red')

  if (hDots.length !== 11 && !reds) issues.push(`Min ${sim.minute}: Home dots = ${hDots.length} (expected 11)`)
  if (aDots.length !== 11 && !reds) issues.push(`Min ${sim.minute}: Away dots = ${aDots.length} (expected 11)`)

  const oob = dots.find((p) => p.x < 0 || p.x > 100 || p.y < 0 || p.y > 100)
  if (oob) issues.push(`Min ${sim.minute}: Player ${oob.id} out of bounds (${oob.x.toFixed(1)}, ${oob.y.toFixed(1)})`)
  if (mm.ballX < -10 || mm.ballX > 110 || mm.ballY < -10 || mm.ballY > 110) {
    issues.push(`Min ${sim.minute}: Ball out of bounds (${mm.ballX.toFixed(1)}, ${mm.ballY.toFixed(1)})`)
  }

  // fixed orientation: home GK always left half, away GK always right half
  const hGk = hDots.find((p) => p.isGK)
  const aGk = aDots.find((p) => p.isGK)
  if (hGk && hGk.x >= 50) issues.push(`Min ${sim.minute}: Home GK crossed halfway (x=${hGk.x.toFixed(1)})`)
  if (aGk && aGk.x <= 50) issues.push(`Min ${sim.minute}: Away GK crossed halfway (x=${aGk.x.toFixed(1)})`)

  if (sim.minute > 45 && dots.some((p) => p.id === 'h10')) {
    issues.push(`Min ${sim.minute}: Subbed off player h10 still rendering!`)
  }
}

const dedup = Array.from(new Set(issues))
console.log('=== ISSUES FOUND ===')
if (dedup.length > 0) dedup.forEach((iss) => console.log(iss))
else console.log('No issues found in diagnostic constraints.')
