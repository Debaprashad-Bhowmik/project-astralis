import { frameAt } from './planner.mjs'
import { evaluateLandingPatches, rankLandingScenarios } from './landing-suggestions.mjs?v=1.3.0'

let patchesPromise
let currentRequest
let preference
let evaluatedMission

function postRanking() {
  const { rows, duration, step, sampled } = evaluatedMission
  const result = rankLandingScenarios(rows, { duration, ...preference })
  self.postMessage({ request: currentRequest, result, preference, step, sampled })
}

function loadPatches() {
  patchesPromise ??= (async () => {
    const response = await fetch(new URL('./data/landing-patches.json.gz', import.meta.url))
    if (!response.ok) throw new Error('Could not load the South Pole terrain inventory.')
    const decoded = new Response(response.body.pipeThrough(new DecompressionStream('gzip')))
    const rows = await decoded.json()
    return rows.map(([lat, lon, slope, roughness, height, angles], index) => ({
      id: `landing-patch-${index}`, lat, lon, slope, roughness, height, horizon: angles.map(angle => angle / 100),
    }))
  })().catch(error => {
    patchesPromise = undefined
    throw error
  })
  return patchesPromise
}

self.addEventListener('message', async ({ data }) => {
  const { request, ephemeris, first, frameHours, duration, maxSlope } = data
  if (data.rankOnly) {
    if (request !== currentRequest) return
    preference = data.preference
    if (evaluatedMission) postRanking()
    return
  }
  currentRequest = request
  preference = data.preference
  evaluatedMission = undefined
  if (!ephemeris) return

  try {
    const patches = await loadPatches()
    if (currentRequest !== request) return
    const intervals = Math.ceil(duration / (duration <= 720 ? .25 : 2))
    const step = duration / intervals
    const frames = Array.from({ length: intervals + 1 }, (_, index) => frameAt(ephemeris, first + index * step / frameHours))
    const rows = await evaluateLandingPatches(patches, frames, duration, maxSlope, async (done, total) => {
      self.postMessage({ request, done, total })
      await new Promise(resolve => setTimeout(resolve, 0))
      return currentRequest === request
    })
    if (rows && currentRequest === request) {
      evaluatedMission = { rows, duration, step, sampled: patches.length }
      postRanking()
    }
  } catch (error) {
    if (currentRequest === request) self.postMessage({ request, error: error.message })
  }
})
