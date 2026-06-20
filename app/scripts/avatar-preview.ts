/* Generate an HTML grid of procedural avatars for 5 random squads
   (visual QA). Usage: npx tsx scripts/avatar-preview.ts [seed] */
import { writeFileSync } from 'node:fs'
import { TEAMS } from '../src/data/teams'
import { avatarSvg, type AvatarParams } from '../src/components/avatarGen'

const seed = Number(process.argv[2] ?? 7)
const shuffled = [...TEAMS].sort((a, b) =>
  ((a.id.charCodeAt(0) * seed) % 17) - ((b.id.charCodeAt(0) * seed) % 17) || a.id.localeCompare(b.id))
const picked = shuffled.slice(0, 5)

const cards: string[] = []
for (const t of picked) {
  cards.push(`<h2>${t.name} (${t.id})</h2><div class="grid">`)
  for (const p of t.players) {
    const av = (p.avatar ?? { skinTone: 3, hairStyle: 'short', hairColor: 'black', beard: 'none' }) as AvatarParams
    cards.push(`
      <figure>
        <div class="face">${avatarSvg(av, 72)}</div>
        <figcaption>
          <b>${p.name}</b><br>
          <small>${p.position} · OVR ${p.stats.overall}${av.fromPhoto ? '' : ' · <i>seeded</i>'}</small><br>
          <small>ten ${av.skinTone} · ${av.hairStyle}/${av.hairColor} · ${av.beard}</small>
        </figcaption>
      </figure>`)
  }
  cards.push('</div>')
}

const html = `<!doctype html><html><head><meta charset="utf-8"><title>Avatar QA</title>
<style>
  body { background:#0e1116; color:#e8eaf0; font-family:system-ui; padding:20px; }
  h2 { margin:24px 0 8px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:10px; }
  figure { margin:0; background:#181c24; border:1px solid #2a3040; border-radius:10px; padding:10px; text-align:center; }
  .face { display:inline-block; background:#1f2430; border-radius:50%; overflow:hidden; width:72px; height:72px; }
  small { color:#8a92a6; }
</style></head><body><h1>Avatar Önizleme — ${picked.map((t) => t.id).join(', ')}</h1>
${cards.join('\n')}</body></html>`

writeFileSync('scripts/avatar-preview.html', html, 'utf-8')
console.log(`written scripts/avatar-preview.html with ${picked.map((t) => t.id).join(', ')}`)
