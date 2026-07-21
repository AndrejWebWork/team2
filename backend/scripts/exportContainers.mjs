import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { fetchOsmContainers } from '../src/lib/osmContainers.js'

const dir = path.dirname(fileURLToPath(import.meta.url))
const pts = await fetchOsmContainers()
const rec = pts.filter((p) => p.type === 'recycling_container')
const wb = pts.filter((p) => p.type === 'waste_basket')
const wd = pts.filter((p) => p.type === 'waste_disposal')

function fmt(arr) {
  return arr
    .map(
      (p) =>
        `  { id: '${p.id}', lat: ${p.lat}, lng: ${p.lng}, type: '${p.type}', source: 'OpenStreetMap' },`,
    )
    .join('\n')
}

const out = `export const skopjeRecyclingContainers = [
${fmt(rec)}
]

export const skopjeWasteBaskets = [
${fmt(wb)}
]

export const skopjeWasteDisposals = [
${fmt(wd)}
]

export const skopjeAllContainerPoints = [
  ...skopjeRecyclingContainers,
  ...skopjeWasteBaskets,
  ...skopjeWasteDisposals,
]
`

const dataDir = path.join(dir, '../src/data')
fs.mkdirSync(dataDir, { recursive: true })
fs.writeFileSync(path.join(dir, '../../src/data/skopjeContainersMap.js'), out)
fs.writeFileSync(path.join(dataDir, 'containerPoints.json'), JSON.stringify(pts, null, 2))
console.log('wrote', pts.length, 'points')
