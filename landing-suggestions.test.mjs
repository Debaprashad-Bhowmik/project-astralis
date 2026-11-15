import assert from 'node:assert/strict'
import test from 'node:test'
import { astronomicalUnit, referencePanelPower } from './planner.mjs'
import { evaluateLandingPatches, landingPower, rankLandingScenarios, rankLandingSuggestions } from './landing-suggestions.mjs'

async function suggestLandings(patches, frames, duration, maxSlope, preference = { mode: 'solar', minimumShare: 0 }) {
  return rankLandingSuggestions(await evaluateLandingPatches(patches, frames, duration, maxSlope), { duration, ...preference })
}

const sun = degrees => {
  const angle = degrees * Math.PI / 180
  return [astronomicalUnit * Math.sin(angle), astronomicalUnit * Math.cos(angle), 0]
}
const earthBelow = [-384_400_000, 0, 0]
const site = { lat: 0, lon: 0, height: 0, horizon: [10, 10, 10, 10], slope: 3, roughness: .4 }

test('mission average counts the dark part of the window and accepts a dark touchdown', () => {
  const frames = [[sun(0), earthBelow], [sun(0), earthBelow], [sun(20), earthBelow]]
  const result = landingPower(site, frames, 2)
  assert.equal(result.touchdownWatts, 0)
  assert.ok(Math.abs(result.sunHours - .5) < .0001)
  assert.ok(Math.abs(result.sunFraction - .25) < .0001)
  assert.equal(result.earthHours, 0)
  const litMean = referencePanelPower * (Math.cos(Math.PI / 18) - Math.cos(Math.PI / 9)) / (Math.PI / 18)
  assert.ok(Math.abs(result.averageWatts - litMean / 4) < .01)
  assert.ok(Math.abs(result.energyKwh * 1000 - result.averageWatts * 2) < 1e-9)
})

test('ranks eligible patches by average power, keeping the flattest patch visible', async () => {
  const patches = [
    { ...site, id: 'steep', slope: 11, horizon: [-1] },
    { ...site, id: 'flat', slope: 1, horizon: [19] },
    { ...site, id: 'productive', horizon: [0] },
  ]
  const frames = [[sun(5), earthBelow], [sun(20), earthBelow]]
  const result = await suggestLandings(patches, frames, 1)
  assert.deepEqual(result.rows.map(row => row.id), ['productive', 'flat'])
  assert.deepEqual(result.rows[0].horizon, patches[2].horizon)
  assert.equal(result.flattest.id, 'flat')
  assert.equal(result.evaluated, 2)
})

test('uses the NASA study slope screen without a user setting', async () => {
  const patches = [
    { ...site, id: 'under', slope: 9.99 },
    { ...site, id: 'at-limit', slope: 10 },
    { ...site, id: 'above', slope: 10.01 },
  ]
  const frames = [[sun(15), earthBelow], [sun(20), earthBelow]]
  const result = await suggestLandings(patches, frames, 1)
  assert.deepEqual(result.rows.map(row => row.id), ['under'])
})

test('uses the selected slope when the user changes the limit', async () => {
  const patches = [
    { ...site, id: 'gentle', slope: 4.9 },
    { ...site, id: 'above-selected-limit', slope: 7 },
  ]
  const frames = [[sun(15), earthBelow], [sun(20), earthBelow]]
  const result = await suggestLandings(patches, frames, 1, 5)
  assert.deepEqual(result.rows.map(row => row.id), ['gentle'])
})

test('a continuous Earth window shares the balance rank with solar energy', async () => {
  const earthAt = degrees => {
    const angle = degrees * Math.PI / 180
    return [384_400_000 * Math.sin(angle), -384_400_000 * Math.cos(angle), 0]
  }
  const frames = [[sun(15), earthAt(5)], [sun(20), earthAt(25)]]
  const patches = [
    { ...site, id: 'power-only', horizon: [0, 0, 0, 30] },
    { ...site, id: 'balanced', horizon: [0, 17, 0, 0] },
    { ...site, id: 'partial-earth', horizon: [0, 17, 0, 15] },
  ]
  const result = await suggestLandings(patches, frames, 1, undefined, { mode: 'balanced' })
  assert.deepEqual(result.rows.map(row => row.id), ['balanced', 'partial-earth'])
  assert.equal(result.rows[0].earthFraction, 1)
  assert.ok(result.rows[1].earthFraction > .45 && result.rows[1].earthFraction < .55)
  assert.ok(Math.abs(result.rows[1].longestEarthHours - result.rows[1].earthHours) < 1e-8)
})

test('sums total Earth view separately from the longest uninterrupted window', () => {
  const earthAbove = [384_400_000, 0, 0]
  const frames = [earthAbove, earthAbove, earthBelow, earthAbove, earthAbove].map(earth => [sun(20), earth])
  const metrics = landingPower({ ...site, horizon: [0] }, frames, 4)
  assert.equal(metrics.earthHours, 3)
  assert.equal(metrics.longestEarthHours, 1.5)
  assert.equal(metrics.longestEarthGap, 1)
  assert.equal(metrics.longestSunHours, 4)
})

const patch = (id, energyKwh, longestEarthHours, longestSunHours, earthHours = longestEarthHours) =>
  ({ ...site, id, energyKwh, longestEarthHours, longestSunHours, earthHours, longestEarthGap: 10 - longestEarthHours })

test('each scenario can choose a different winner from the same patch inventory', () => {
  const rows = [patch('continuous', 10, 10, 8), patch('balance', 25, 9, 4),
    patch('solar', 30, 5, 7), patch('fragmented', 40, 4, 10, 9)]
  assert.equal(rankLandingSuggestions(rows, { duration: 10, mode: 'earth' }).rows[0].id, 'continuous')
  assert.equal(rankLandingSuggestions(rows, { duration: 10, mode: 'balanced' }).rows[0].id, 'balance')
  assert.equal(rankLandingSuggestions(rows, { duration: 10, mode: 'solar', minimumShare: .5 }).rows[0].id, 'solar')
  assert.equal(rankLandingSuggestions(rows, { duration: 10, mode: 'solar', minimumShare: .5, body: 'sun' }).rows[0].id, 'fragmented')
})

test('a mission with no full Earth window identifies the closest alternatives', () => {
  const rows = [patch('longest', 6, 8, 6), patch('more-solar', 12, 6, 7, 9.8)]
  const result = rankLandingSuggestions(rows, { duration: 10, mode: 'earth' })
  assert.equal(result.qualified, 0)
  assert.deepEqual(result.rows.map(row => row.id), ['longest', 'more-solar'])
  assert.ok(result.rows.every(row => !row.qualifies))
})

test('the full-window preset ranks qualified patches by energy', () => {
  const rows = [patch('continuous-low-energy', 4, 10, 8), patch('continuous-high-energy', 6, 10, 8),
    patch('almost-full', 12, 9.999, 9)]
  const result = rankLandingSuggestions(rows, { duration: 10, mode: 'earth' })
  assert.equal(result.qualified, 2)
  assert.deepEqual(result.rows.map(row => row.id), ['continuous-high-energy', 'continuous-low-energy'])
})

test('scenario summaries and cross-ranks use the whole slope-eligible inventory', () => {
  const rows = [patch('continuous', 2, 10, 10),
    ...Array.from({ length: 7 }, (_, i) => patch(`solar-${i}`, 10 + i, 3 + i / 2, 5))]
  const earth = rankLandingScenarios(rows, { duration: 10, mode: 'earth' })
  assert.equal(earth.summaries.earth.id, 'continuous')
  assert.equal(earth.summaries.solar.id, 'solar-6')
  assert.equal(earth.summaries.balanced.id, 'solar-6')
  assert.deepEqual(earth.rows[0].scenarioRanks, { earth: 1, solar: 8, balanced: 8 })
  const solar = rankLandingScenarios(rows, { duration: 10, mode: 'solar' })
  assert.equal(solar.rows[0].scenarioRanks.earth, null)
  assert.equal(solar.rows[0].scenarioRanks.solar, 1)
})

test('a no-match scenario identifies a closest patch with no qualifying rank', () => {
  const rows = [patch('closest', 3, 9, 7), patch('higher-energy', 5, 7, 8)]
  const result = rankLandingScenarios(rows, { duration: 10, mode: 'earth' })
  assert.equal(result.summaries.earth.qualified, 0)
  assert.equal(result.summaries.earth.id, 'closest')
  assert.equal(result.rows[0].scenarioRanks.earth, null)
  assert.equal(result.summaries.solar.id, 'higher-energy')
})

test('equal solar energy gives priority to a longer Earth window', () => {
  const rows = [patch('more-sunlight', 10, 3, 9), patch('better-earth-view', 10, 7, 7)]
  const result = rankLandingScenarios(rows, { duration: 10, mode: 'solar', minimumShare: .5, body: 'sun' })
  assert.equal(result.summaries.solar.id, 'better-earth-view')
  assert.equal(result.rows[0].scenarioRanks.solar, 1)
})
