import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { horizonAt, visibility, summarize, rank, observer, localAngles, binaryFrames, frameAt, evaluate } from './planner.mjs'
import { globeOrientation, projectSite } from './globe.mjs'
import { readSpaceSamples, siteDirection, spaceStep, systemAt } from './space-view.mjs'

test('interpolates terrain across north', () => {
  assert.equal(horizonAt([2, 4, 6, 8], 315), 5)
})

test('calculates crossings and overlaps at fractional hours', () => {
  const sun = visibility([-1, 3, 3, -1], 1)
  const earth = visibility([-3, -1, 1, 1], 1)
  assert.deepEqual(sun, [[0.25, 2.75]])
  assert.deepEqual(summarize(sun, earth, 3), {
    sun: 2.5, earth: 1.5, overlap: 1.25, darkness: .25, blackout: 1.5, both: [[1.5, 2.75]],
  })
})

test('honors requirements ahead of score and marks equivalent sites', () => {
  const rows = [
    { site: { name: 'A' }, metrics: { sun: 24, earth: 4, overlap: 4, darkness: 0 } },
    { site: { name: 'B' }, metrics: { sun: 10, earth: 12, overlap: 7, darkness: 14 } },
    { site: { name: 'C' }, metrics: { sun: 10, earth: 12, overlap: 7, darkness: 14 } },
  ]
  const results = rank(rows, { sun: 6, earth: 0, overlap: 0 }, { sun: 0, earth: 8, overlap: 0, darkness: 24 }, 24)
  assert.deepEqual(results.map(({ site, place }) => [site.name, place]), [['B', 1], ['C', 1], ['A', null]])
  assert.deepEqual(results[2].unmet, ['Earth visibility'])
})

test('derives local direction and elevation from Moon-fixed vectors', () => {
  const base = observer(0, 0, 0)
  assert.deepEqual(localAngles([1737400, 1000, 0], base).slice(0, 2), [90, 0])
  assert.equal(localAngles([1738400, 0, 0], base)[1], 90)
})

test('globe marker projection uses the same coordinate as the view center', () => {
  const site = { lat: -84.7906, lon: 29.1957 }
  const [x, y, depth] = projectSite(site, globeOrientation(site.lat, site.lon))
  assert.ok(Math.abs(x) < 1e-10 && Math.abs(y) < 1e-10 && depth > .999999)
  assert.ok(projectSite(site, globeOrientation(-site.lat, site.lon + 180))[2] < 0)
})

test('bundled ephemeris matches independent Horizons angles and terrain changes visibility', () => {
  const data = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)))
  const bytes = readFileSync(new URL('./data/ephemeris.bin', import.meta.url))
  const samples = binaryFrames(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const site = data.catalog.find(entry => entry.id === 'athena')
  const offset = (Date.parse('2026-11-14T00:00:00Z') - Date.parse(data.start)) / (data.step * 1000)
  const frames = Array.from({ length: 97 }, (_, index) => frameAt(samples, offset + index))
  const flat = evaluate(site, frames, 24, false)
  assert.ok(Math.abs(flat.timeline[0].sunEl - .878281) < .001)
  assert.ok(Math.abs(flat.timeline[0].earthEl - (-.153879)) < .001)
  assert.ok(flat.metrics.overlap > 20 && flat.metrics.overlap < 21)
  const terrain = evaluate(site, frames, 24, true)
  assert.ok(terrain.timeline[0].sunHorizon > 3)
  assert.equal(terrain.metrics.sun, 0)
})

test('space view interpolates Earth-centered positions at the selected instant', () => {
  const first = [0, 380000, 0, 150000000, 0, 0, 1, 0, 0, 0]
  const second = [0, 400000, 0, 152000000, 0, 0, 0, 0, 0, 1]
  const state = systemAt(Float32Array.from([...first, ...second]), .25)
  assert.deepEqual(state.moon, [0, 385000, 0])
  assert.deepEqual(state.sun, [150500000, 0, 0])
  const pin = siteDirection({ lat: 0, lon: 0 }, state)
  assert.ok(Math.abs(Math.atan2(pin[1], pin[0]) - 2 * Math.atan2(.25, .75)) < 1e-10)
  assert.throws(() => systemAt(Float32Array.from(first), 1), RangeError)
})

test('bundled 3D positions cover the mission date range and move over time', () => {
  const { start, end } = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)))
  const bytes = readFileSync(new URL('./data/space-positions.bin', import.meta.url))
  const startMs = Date.parse(start)
  const endMs = Date.parse(end)
  const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  const samples = readSpaceSamples(buffer, startMs, endMs)
  const at = (Date.parse('2026-11-14T00:00:00Z') - startMs) / (spaceStep * 1000)
  const first = systemAt(samples, at)
  const later = systemAt(samples, at + 6)
  assert.ok(Math.hypot(...first.moon) > 350000 && Math.hypot(...first.moon) < 410000)
  assert.ok(Math.hypot(...first.sun) > 147000000 && Math.hypot(...first.sun) < 153000000)
  assert.ok(Math.hypot(...later.moon.map((value, i) => value - first.moon[i])) > 18000)
  assert.ok(Math.hypot(...later.sun.map((value, i) => value - first.sun[i])) > 500000)
  assert.ok(systemAt(samples, (endMs - startMs) / (spaceStep * 1000)).rotation.every(Number.isFinite))
  assert.throws(() => readSpaceSamples(buffer.slice(0, -4), startMs, endMs), /incomplete/)
})
