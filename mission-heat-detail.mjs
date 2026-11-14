import { globeOrientation, pointOnGlobe, projectSite } from './globe.mjs'
import { missionQuarters, windowHours } from './mission-heat.mjs'
import { evaluate } from './planner.mjs'
import { horizonProfile, loadTerrainForPoints } from './terrain.mjs'

export async function detailOverlapGrid(frames, stepHours, view, northLatitude, terrain, anchor, loadTerrain = loadTerrainForPoints) {
  const hours = (frames.length - 1) * stepHours
  const size = hours <= 168 ? (view.zoom >= 8 ? 61 : 45) : hours <= 31 * 24 ? 37 : 25
  const orientation = globeOrientation(view.lat, view.lon)
  const points = Array.from({ length: size * size }, (_, index) => {
    const col = index % size
    const row = Math.floor(index / size)
    const point = pointOnGlobe((2 * col / (size - 1) - 1) * view.x, (1 - 2 * row / (size - 1)) * view.y, orientation)
    return point?.lat <= northLatitude ? point : null
  })
  const sample = terrain ? await loadTerrain(points.filter(Boolean)) : null
  const periods = Array.from({ length: missionQuarters + 1 }, () => ({ values: new Float32Array(points.length).fill(-1), maxHours: 0 }))
  const quarter = hours / missionQuarters
  for (const [index, point] of points.entries()) {
    if (!point) continue
    const centeredOnAnchor = anchor && index === Math.floor(points.length / 2) && Math.abs(anchor.lat - point.lat) < .00001 &&
      Math.hypot(...projectSite(anchor, orientation).slice(0, 2)) < 1e-7
    const site = sample ? centeredOnAnchor ? anchor : { ...point, ...horizonProfile(point.lat, point.lon, sample, undefined, 4) } : point
    const { metrics } = evaluate(site, frames, hours, Boolean(sample), { includeTimeline: false })
    for (const [period, layer] of periods.entries()) {
      const value = period ? windowHours(metrics.both, (period - 1) * quarter, period * quarter) : metrics.overlap
      layer.values[index] = value
      layer.maxHours = Math.max(layer.maxHours, value)
    }
  }
  return { view, orientation, size, terrain, periods }
}

function bilinear(values, width, height, x, y, wrap = false) {
  const left = Math.floor(x)
  const top = Math.floor(y)
  const tx = x - left
  const ty = y - top
  let value = 0
  for (let row = 0; row < 2; row++) {
    for (let col = 0; col < 2; col++) {
      const weight = (row ? ty : 1 - ty) * (col ? tx : 1 - tx)
      if (weight <= 1e-10) continue
      const px = wrap ? (left + col + width) % width : Math.min(left + col, width - 1)
      const sample = values[Math.min(top + row, height - 1) * width + px]
      if (sample < 0) return null
      value += weight * sample
    }
  }
  return value
}

export function detailHoursAt(site, grid, period) {
  const [x, y, front] = projectSite(site, grid.orientation)
  const { view, size } = grid
  if (front <= 0 || Math.abs(x) > view.x || Math.abs(y) > view.y) return null
  return bilinear(grid.periods[period].values, size, size, (x / view.x + 1) * (size - 1) / 2, (1 - y / view.y) * (size - 1) / 2)
}

export function overviewHoursAt(site, grid, period) {
  const x = (((site.lon + 180) % 360 + 360) % 360) / 360 * grid.width - .5
  const y = (grid.northLatitude - site.lat) / (grid.northLatitude + 90) * (grid.height - 1)
  return bilinear(grid.periods[period].values, grid.width, grid.height, x, y, true)
}
