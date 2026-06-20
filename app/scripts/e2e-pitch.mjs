/* E2E test for the pitch-view tactics screen: drag-drop swap (mouse pointer),
   tap-select swap (touch emulation), bench->pitch substitution, formation change.
   Usage: node scripts/e2e-pitch.mjs <previewPort> */
import { chromium, devices } from 'playwright'

const PORT = process.argv[2] ?? '4824'
const BASE = `http://localhost:${PORT}`
let failures = 0

function check(name, cond, extra = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? ` (${extra})` : ''}`)
  if (!cond) failures++
}

const browser = await chromium.launch()
const ctx = await browser.newContext({
  ...devices['Pixel 7'], // mobile viewport + touch enabled
})
const page = await ctx.newPage()
page.on('pageerror', (e) => { console.log('PAGEERROR:', e.message); failures++ })

// --- start a fresh career
await page.goto(`${BASE}/#/select`)
await page.waitForSelector('text=2026')
const flagCount = await page.locator('img[src*=".svg"], img[src^="data:image/svg"]').count()
check('SVG flags rendered on team select (48 teams)', flagCount >= 48, `${flagCount} imgs`)
await page.screenshot({ path: 'scripts/select-flags.png' })
await page.locator('button.card').first().click() // first team card (Group A)
await page.locator('button.btn').first().click() // confirm manage
await page.waitForURL('**/#/home')

// a narrative event may fire on day 0 — resolve it so no modal blocks the UI
await page.waitForTimeout(300)
if (await page.locator('div.fixed.inset-0').isVisible().catch(() => false)) {
  await page.locator('div.fixed.inset-0 button').first().click()
  console.log('INFO  resolved day-0 narrative event')
}

// --- tactics screen, pitch view default
await page.goto(`${BASE}/#/tactics`)
await page.waitForSelector('[data-slotidx]')
check('no modal over tactics screen', !(await page.locator('div.fixed.inset-0').isVisible().catch(() => false)))

const slotCount = await page.locator('[data-slotidx]').count()
check('11 formation slots rendered', slotCount === 11, `got ${slotCount}`)

const chipName = async (i) =>
  (await page.locator(`[data-slotidx="${i}"]`).innerText()).split('\n')[1] ?? ''

const filled = async () => {
  let n = 0
  for (let i = 0; i < slotCount; i++) if ((await chipName(i)) !== '') n++
  return n
}
check('XI auto-filled on career start', (await filled()) === 11)

// --- 1) mouse-pointer drag: swap slot 9 (ST) with slot 1 (RB)
const nameA = await chipName(9)
const nameB = await chipName(1)
const boxA = await page.locator('[data-slotidx="9"]').boundingBox()
const boxB = await page.locator('[data-slotidx="1"]').boundingBox()
await page.mouse.move(boxA.x + boxA.width / 2, boxA.y + 20)
await page.mouse.down()
await page.mouse.move(boxB.x + boxB.width / 2, boxB.y + 20, { steps: 12 })
await page.mouse.up()
check('drag-drop swaps two pitch players', (await chipName(9)) === nameB && (await chipName(1)) === nameA,
  `${nameA}<->${nameB}`)

// position penalty must show after the swap (DF in ST slot or vice versa)
const badge9 = await page.locator('[data-slotidx="9"]').innerText()
check('effective OVR shown on chip', /\d{2}/.test(badge9))

// --- 2) tap-select-tap swap (touch): swap them back
const tapCenter = async (sel) => {
  const b = await page.locator(sel).boundingBox()
  await page.touchscreen.tap(b.x + b.width / 2, b.y + 20)
}
await tapCenter('[data-slotidx="9"]')
await tapCenter('[data-slotidx="1"]')
check('tap-select-tap swaps back', (await chipName(9)) === nameA && (await chipName(1)) === nameB)

// --- 3) bench -> pitch substitution by drag
const benchFirst = page.locator('[data-benchid]').first()
const benchName = (await benchFirst.innerText()).split('\n')[1] ?? ''
const benchBox = await benchFirst.boundingBox()
const slot5Box = await page.locator('[data-slotidx="5"]').boundingBox()
await page.mouse.move(benchBox.x + benchBox.width / 2, benchBox.y + 16)
await page.mouse.down()
await page.mouse.move(slot5Box.x + slot5Box.width / 2, slot5Box.y + 20, { steps: 14 })
await page.mouse.up()
check('bench player dragged into XI', (await chipName(5)) === benchName, `${benchName} -> slot 5`)

// --- 4) grouped formation picker: back-line segments filter the chip row
const formationBtn = (key) => page.locator('button', { hasText: key }).first()
const gkName = await chipName(0)

// '3-5-2' is hidden until the back-3 segment is selected
check("3'lü chips hidden under back-4 segment", (await page.locator('button', { hasText: '3-5-2' }).count()) === 0)
await formationBtn("3'lü").click()
check('segment switch alone keeps current formation 11 slots', (await filled()) === 11)
await formationBtn('3-5-2').click()
await page.waitForTimeout(400) // CSS transition
check('GK stays in goal after formation change', (await chipName(0)) === gkName, gkName)
check('still 11 slots after formation change', (await page.locator('[data-slotidx]').count()) === 11)
const filled352 = await filled()
check('players remapped to nearest roles (>=10 filled)', filled352 >= 10, `${filled352} filled`)

// --- 4b) back-5 group, then back to a back-4 formation
await formationBtn("5'li").click()
await formationBtn('5-4-1').click()
await page.waitForTimeout(350)
check('5-4-1 renders 11 slots', (await page.locator('[data-slotidx]').count()) === 11)
check('5-4-1 keeps GK', (await chipName(0)) === gkName)
await formationBtn("4'lü").click()
await formationBtn('4-1-2-1-2').scrollIntoViewIfNeeded()
await formationBtn('4-1-2-1-2').click()
await page.waitForTimeout(350)
const filled41212 = await filled()
check('4-1-2-1-2 fills >=10 slots', filled41212 >= 10, `${filled41212} filled`)

// --- 4c) avatars rendered inside pitch chips
const chipSvg = await page.locator('[data-slotidx="0"] svg').count()
check('avatar SVG rendered in pitch chip', chipSvg >= 1, `${chipSvg} svg`)

// --- 5) team strength bars present and numeric
const attBar = await page.locator('text=ATT').first().isVisible()
check('team strength bars visible', attBar)

// --- 6) list view toggle still works
await page.locator('button', { hasText: 'Liste' }).click()
await page.waitForSelector('text=GK')
check('list view renders after toggle', await page.locator('button.row-tap').first().isVisible())

await page.screenshot({ path: 'scripts/pitch-list.png' })
await page.locator('button', { hasText: 'Saha' }).click()
await page.waitForSelector('[data-slotidx]')
await page.screenshot({ path: 'scripts/pitch-view.png' })

await browser.close()
console.log(failures === 0 ? '\nE2E OK' : `\nE2E FAILED (${failures})`)
process.exit(failures === 0 ? 0 : 1)
