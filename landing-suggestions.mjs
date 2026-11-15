import { evaluate, siteSolarPower } from './planner.mjs'

const artemisSlopeLimit = 10

export function landingPower(site, frames, duration) {
  const { metrics, timeline } = evaluate(site, frames, duration, true, { includeEnergy: true })
  return {
    averageWatts: metrics.energyKwh * 1000 / duration,
    energyKwh: metrics.energyKwh,
    sunHours: metrics.sun,
    sunFraction: metrics.sun / duration,
    earthHours: metrics.earth,
    earthFraction: metrics.earth / duration,
    touchdownWatts: siteSolarPower(timeline[0]),
  }
}

const terrainOrder = (a, b) => a.slope - b.slope || a.roughness - b.roughness

export async function evaluateLandingPatches(patches, frames, duration, maxSlope = artemisSlopeLimit, onProgress = () => true) {
  const candidates = patches.filter(patch => patch.slope < maxSlope)
  const results = []
  for (const [index, patch] of candidates.entries()) {
    if (index % 64 === 0) {
      if (!await onProgress(index, candidates.length)) return null
    }
    const { horizon, ...terrain } = patch
    results.push({ ...terrain, ...landingPower(patch, frames, duration) })
  }
  return results
}

export function rankLandingSuggestions(results, solarWeight = .5) {
  const maxPower = Math.max(0, ...results.map(row => row.averageWatts))
  const maxEarth = Math.max(0, ...results.map(row => row.earthFraction))
  const earthWeight = 1 - solarWeight
  const ranked = results.map(row => {
    const power = maxPower ? row.averageWatts / maxPower : 0
    const earth = maxEarth ? row.earthFraction / maxEarth : 0
    const score = solarWeight === 0 ? earth : earthWeight === 0 ? power : power ** solarWeight * earth ** earthWeight
    return { ...row, score }
  })
  let flattest = null
  for (const row of ranked) {
    if (!flattest || terrainOrder(row, flattest) < 0) flattest = row
  }
  ranked.sort((a, b) => b.score - a.score ||
    (solarWeight > 0 ? b.averageWatts - a.averageWatts : 0) || terrainOrder(a, b))
  return { rows: ranked.slice(0, 5), flattest, evaluated: ranked.length }
}
