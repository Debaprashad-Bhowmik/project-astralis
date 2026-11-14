import { radius } from './planner.mjs'

const radians = Math.PI / 180
const range = 350_000
const pixelsPerDegree = 16
const tileSize = 480
const columns = 360 * pixelsPerDegree
const rows = 180 * pixelsPerDegree
const globalStep = 1900
const tiles = new Map()
const wrap = (value, length) => ((value % length) + length) % length
const clamp = (value, min, max) => Math.max(min, Math.min(max, value))

export function nearestTiles(lat, lon) {
  const reach = range / radius + .002
  const minRow = Math.floor(clamp((90 - lat - reach / radians) / 30, 0, 5))
  const maxRow = Math.floor(clamp((90 - lat + reach / radians) / 30, 0, 5))
  const span = Math.abs(lat) * radians + reach >= Math.PI / 2
    ? 180 : Math.asin(Math.sin(reach) / Math.cos(lat * radians)) / radians
  const center = wrap(lon + 180, 360)
  const first = span === 180 ? 0 : Math.floor((center - span) / 30)
  const last = span === 180 ? 11 : Math.floor((center + span) / 30)
  const result = []
  for (let row = minRow; row <= maxRow; row++) {
    for (let col = first; col <= last; col++) result.push([wrap(col, 12), row])
  }
  return result
}

export function horizonProfile(lat, lon, sample, step = globalStep) {
  const phi = lat * radians
  const lambda = lon * radians
  const height = sample(lat, lon)
  const observerRadius = radius + height + 2
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const shell = Array.from({ length: Math.floor(range / step) }, (_, index) => {
    const angle = (index + 1) * step / radius
    return [Math.sin(angle), Math.cos(angle)]
  })
  const horizon = Array.from({ length: 720 }, (_, index) => {
    const direction = index * .5 * radians
    const sinBearing = Math.sin(direction)
    const cosBearing = Math.cos(direction)
    let max = -90
    for (const [sinArc, cosArc] of shell) {
      const nextLat = Math.asin(clamp(sinPhi * cosArc + cosPhi * sinArc * cosBearing, -1, 1))
      const x = cosPhi * cosArc - sinPhi * sinArc * cosBearing
      const y = sinBearing * sinArc
      const nextLon = lambda + Math.atan2(y, x)
      const groundRadius = radius + sample(nextLat / radians, nextLon / radians)
      max = Math.max(max, Math.atan2(groundRadius * cosArc - observerRadius, groundRadius * sinArc) / radians)
    }
    return max
  })
  return { height, horizon }
}

async function fetchTile(x, y) {
  const key = `${x}-${y}`
  if (!tiles.has(key)) {
    const promise = fetch(new URL(`./data/terrain/${key}.bin`, import.meta.url)).then(async response => {
      if (!response.ok) throw new Error('A lunar elevation tile could not load. Try the point again.')
      const buffer = await response.arrayBuffer()
      if (buffer.byteLength !== tileSize * tileSize * 2) throw new Error('A lunar elevation tile is incomplete.')
      return new Uint16Array(buffer)
    }).catch(reason => {
      tiles.delete(key)
      throw reason
    })
    tiles.set(key, promise)
    if (tiles.size > 30) tiles.delete(tiles.keys().next().value)
  }
  return [key, await tiles.get(key)]
}

export async function loadTerrainSampler(lat, lon, interpolate = false) {
  const data = new Map(await Promise.all(nearestTiles(lat, lon).map(([x, y]) => fetchTile(x, y))))
  function pixel(x, y) {
    const col = wrap(x, columns)
    const row = clamp(y, 0, rows - 1)
    const tile = data.get(`${Math.floor(col / tileSize)}-${Math.floor(row / tileSize)}`)
    if (!tile) throw new Error('Lunar elevation data are missing for this point.')
    return tile[(row % tileSize) * tileSize + col % tileSize] * .5 - 10000
  }
  return (phi, lambda) => {
    const col = wrap(lambda + 180, 360) * pixelsPerDegree
    const row = (90 - phi) * pixelsPerDegree
    if (!interpolate) return pixel(Math.floor(col), Math.floor(row))
    const left = Math.floor(col - .5)
    const top = Math.floor(row - .5)
    const x = col - .5 - left
    const y = row - .5 - top
    const north = pixel(left, top) * (1 - x) + pixel(left + 1, top) * x
    const south = pixel(left, top + 1) * (1 - x) + pixel(left + 1, top + 1) * x
    return north * (1 - y) + south * y
  }
}

export async function terrainAt(lat, lon) {
  const sample = await loadTerrainSampler(lat, lon)
  return { ...horizonProfile(lat, lon, sample), terrain: 'LOLA 16 px/°' }
}
