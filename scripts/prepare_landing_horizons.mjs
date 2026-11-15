import { readFileSync, writeFileSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { polarTerrainSampler } from '../polar-shadows.mjs'
import { polarHorizon } from '../terrain.mjs'

const input = process.argv[2]
if (!input) throw new Error('Supply the patch coordinates from prepare_landing_patches.py.')
const folder = new URL('../data/polar-shadows/', import.meta.url)
const manifest = JSON.parse(readFileSync(new URL('grids.json', folder)))
const grids = manifest.map(grid => {
  const bytes = gunzipSync(readFileSync(new URL(grid.file, folder)))
  const values = new Uint16Array(bytes.buffer, bytes.byteOffset, bytes.length / 2)
  if (values.length !== grid.width * grid.height) throw new Error('Incomplete elevation grid.')
  return { ...grid, values }
})
const sample = polarTerrainSampler(grids)
const patches = JSON.parse(readFileSync(input)).map(([lat, lon, slope, roughness]) => {
  const { height, horizon } = polarHorizon(lat, lon, sample, 3)
  if (height === null || horizon.some(angle => !Number.isFinite(angle))) throw new Error(`No terrain at ${lat}, ${lon}.`)
  return [lat, lon, slope, roughness, Math.round(height * 10) / 10, horizon.map(angle => Math.round(angle * 100))]
})
const output = new URL('../data/landing-patches.json.gz', import.meta.url)
const compressed = gzipSync(JSON.stringify(patches), { level: 9 })
writeFileSync(output, compressed)
console.log(`Stored ${patches.length} terrain horizons in ${compressed.length} bytes.`)
