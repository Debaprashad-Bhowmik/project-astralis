import assert from 'node:assert/strict'
import test from 'node:test'
import { astronomicalUnit, referencePanelPower } from './planner.mjs'
import { evaluateLandingPatches, landingPower, rankLandingSuggestions } from './landing-suggestions.mjs'

async function suggestLandings(patches, frames, duration, maxSlope) {
  return rankLandingSuggestions(await evaluateLandingPatches(patches, frames, duration, maxSlope))
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

test('earth visibility over the whole window shares the rank with solar power', async () => {
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
  const result = await suggestLandings(patches, frames, 1)
  assert.deepEqual(result.rows.map(row => row.id), ['balanced', 'partial-earth', 'power-only'])
  assert.equal(result.rows[0].earthFraction, 1)
  assert.ok(result.rows[1].earthFraction > .45 && result.rows[1].earthFraction < .55)
  assert.ok(result.rows[2].averageWatts > result.rows[0].averageWatts)
  assert.equal(result.rows[2].score, 0)
})

test('varying priority changes the winner from communication to solar energy', () => {
  const patches = [
    { ...site, id: 'communication', averageWatts: 2, earthFraction: 1 },
    { ...site, id: 'power', averageWatts: 8, earthFraction: .5 },
  ]
  assert.equal(rankLandingSuggestions(patches, .25).rows[0].id, 'communication')
  assert.equal(rankLandingSuggestions(patches, .5).rows[0].id, 'power')
  assert.equal(rankLandingSuggestions(patches, .75).rows[0].id, 'power')
})

test('either endpoint ranks by its only objective even when the other is zero', () => {
  const earthOnly = { ...site, id: 'earth-only', averageWatts: 0, earthFraction: 1 }
  const powerOnly = { ...site, id: 'power-only', averageWatts: 10, earthFraction: 0 }
  const ordered = weight => rankLandingSuggestions([earthOnly, powerOnly], weight).rows.map(row => [row.id, row.score])
  assert.deepEqual(ordered(0), [['earth-only', 1], ['power-only', 0]])
  assert.deepEqual(ordered(1), [['power-only', 1], ['earth-only', 0]])
  assert.equal(rankLandingSuggestions([earthOnly], 0).rows[0].score, 1)
  assert.equal(rankLandingSuggestions([powerOnly], 1).rows[0].score, 1)
  assert.equal(rankLandingSuggestions([earthOnly, powerOnly], .5).rows[0].score, 0)
})

test('communication-only ties ignore solar power and favor the flatter patch', () => {
  const patches = [
    { ...site, id: 'flatter', slope: 1, averageWatts: 2, earthFraction: 1 },
    { ...site, id: 'steeper', slope: 2, averageWatts: 8, earthFraction: 1 },
  ]
  assert.equal(rankLandingSuggestions(patches, 0).rows[0].id, 'flatter')
})
