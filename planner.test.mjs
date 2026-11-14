import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { horizonAt, visibility, summarize, rank, observer, localAngles, binaryFrames, frameAt, evaluate, skyCrossings, nextSkyCrossing, solarExposure, longestGap } from './planner.mjs'
import { globeOrientation, projectSite } from './globe.mjs'
import { readSpaceSamples, siteDirection, spaceStep, systemAt } from './space-view.mjs'
import { pointOnGlobe } from './globe.mjs'
import { horizonProfile, nearestTiles } from './terrain.mjs'
import { nearbyCraters, surfaceCamera, surfaceTarget, solarShadowFrame, terrainVertices } from './surface-view.mjs'
import { coverageProject, coverageUnproject, createCoverageModel, subPoint } from './coverage-map.mjs'
import { missionCrossings } from './planner.mjs'
import { skyPathSegments } from './sky-view.mjs'

test('interpolates terrain across north', () => {
  assert.equal(horizonAt([2, 4, 6, 8], 315), 5)
})

test('the polar surface mesh resolves the measured Shackleton basin', () => {
  const mesh = new Float32Array(new Uint8Array(readFileSync(new URL('./data/surface/shackleton.bin', import.meta.url))).buffer)
  const rim = []
  for (let offset = 0; offset < 180 * 3; offset += 3) {
    let highest = -Infinity
    let distance = 0
    for (let i = offset; i < mesh.length; i += 180 * 3) {
      const range = Math.hypot(mesh[i], mesh[i + 2])
      if (range < 7500 || range > 13_500 || mesh[i + 1] <= highest) continue
      highest = mesh[i + 1]
      distance = range
    }
    rim.push({ distance, relief: highest - mesh[offset + 1] })
  }
  const median = key => rim.map(point => point[key]).sort((a, b) => a - b)[90]
  assert.ok(Math.abs(2 * median('distance') / 1000 - 21) < 1)
  assert.ok(Math.abs(median('relief') / 1000 - 4.1) < .3)
})

test('the crater camera uses gazetteer coordinates and looks across the rim on the floor', () => {
  const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url))).catalog
  const gazetteer = JSON.parse(readFileSync(new URL('./data/gazetteer.json', import.meta.url)))
  const ridge = catalog.find(site => site.id === 'ridge')
  const nearby = nearbyCraters(ridge, gazetteer).find(crater => crater.name === 'Shackleton')
  assert.ok(nearby)
  assert.equal(nearby.inside, false)
  assert.ok(Math.abs(nearby.bearing - 211) < 1)
  const [inside] = nearbyCraters(catalog.find(site => site.id === 'shackleton'), gazetteer)
  assert.equal(inside.name, 'Shackleton')
  assert.equal(inside.bearing, 0)
})

test('Shackleton Rim uses the Site 04 elevation and has five-meter near-field samples', () => {
  const catalog = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url))).catalog
  const site = catalog.find(item => item.id === 'shackleton-rim')
  const mesh = new Float32Array(new Uint8Array(readFileSync(new URL('./data/surface/shackleton-rim.bin', import.meta.url))).buffer)
  assert.equal(site.terrain, 'LOLA 5/80/240 m')
  assert.ok(Math.abs(site.height - 769.68) < .05)
  assert.equal(site.horizon.length, 720)
  assert.ok(Math.abs(mesh[1] + 2) < .001)
  assert.ok(Math.abs(mesh[542] - 5) < .01)
  assert.ok(mesh.length / 3 < 65_536)
})

test('shadow projection places a sunward ridge in front of the ground behind it', () => {
  const light = solarShadowFrame(90, 5)
  const project = point => [light.right, light.up, light.depth].map(axis => axis.reduce((sum, value, i) => sum + value * point[i], 0))
  const ground = project([0, 0, 0])
  const ridge = project([1000, 1000 * Math.tan(5 * Math.PI / 180), 0])
  assert.ok(Math.abs(ridge[0] - ground[0]) < 1e-9)
  assert.ok(Math.abs(ridge[1] - ground[1]) < 1e-9)
  assert.ok(ridge[2] < ground[2])
})

test('surface disks use the local angular radius and identify an off-screen Sun to the left', () => {
  const camera = surfaceCamera(345, 2)
  const sun = surfaceTarget(camera, 275.3, 2.4, .00465, 1060, 320, 265.6)
  assert.equal(sun.inView, false)
  assert.equal(sun.edge, 'left')
  const centered = surfaceTarget(surfaceCamera(275.3, 2.4), 275.3, 2.4, .00465, 1060, 320, 265.6)
  assert.equal(centered.inView, true)
  assert.ok(Math.abs(centered.radius - 1.235) < .001)
  assert.equal(surfaceTarget(camera, 345, 60, .015, 1060, 320, 265.6).edge, 'up')
})

test('mission events are ordered, scoped to the mission and jump to an available sample', () => {
  const events = missionCrossings({
    sun: [{ at: 1.12, rising: true }, { at: 8.6, rising: false }],
    earth: [{ at: .1, rising: false }, { at: 4, rising: true }],
  }, 4)
  assert.deepEqual(events, [
    { body: 'earth', label: 'Earthset', at: .1, sample: 0 },
    { body: 'sun', label: 'Sunrise', at: 1.12, sample: 1 },
    { body: 'earth', label: 'Earthrise', at: 4, sample: 4 },
  ])
})

test('sky paths join across north without drawing across the entire map', () => {
  assert.deepEqual(skyPathSegments([{ sunAz: 350, sunEl: 2 }, { sunAz: 10, sunEl: 6 }], 'sun'),
    [[[350, 2], [360, 4]], [[0, 4], [10, 6]]])
  assert.deepEqual(skyPathSegments([{ earthAz: 5, earthEl: 0 }, { earthAz: 355, earthEl: 4 }], 'earth'),
    [[[5, 0], [0, 2]], [[360, 2], [355, 4]]])
})

test('global coverage uses finite distance, both hemispheres, and local total eclipses', () => {
  const sun = [149600000000, 0, 0]
  const earth = [0, 384400000, 0]
  const mask = createCoverageModel(sun, earth)
  assert.equal(mask(.7071068, .7071068, 0), 3)
  assert.equal(mask(.7071068, -.7071068, 0), 1)
  assert.equal(mask(-.7071068, .7071068, 0), 2)
  assert.equal(mask(-.7071068, -.7071068, 0), 0)
  assert.equal(mask(-.9999955, .003, 0), 0)
  assert.equal(createCoverageModel(sun, [384400000, 0, 0])(1, 0, 0), 2)
  assert.deepEqual(subPoint(earth), { lat: 0, lon: 90 })
})

test('global map coordinates round-trip and wrap the longitude seam', () => {
  const site = { lat: -84.7906, lon: 29.1957 }
  const point = coverageProject(site)
  const result = coverageUnproject(point.x, point.y)
  assert.ok(Math.abs(result.lat - site.lat) < 1e-9 && Math.abs(result.lon - site.lon) < 1e-9)
  assert.deepEqual(coverageProject({ lat: 90, lon: 180 }), { x: 0, y: 0 })
  assert.equal(coverageUnproject(1, .5).lon, -180)
})

test('first-person terrain curves below the eye, and a camera centered on a body projects it to the center', () => {
  const mesh = terrainVertices({ lat: 0, lon: 0, height: 0 }, () => 0)
  assert.deepEqual(Array.from(mesh.slice(0, 3)), [0, -2, 0])
  const lastNorthVertex = mesh.length - 180 * 3
  assert.ok(mesh[lastNorthVertex + 1] < -34000)
  assert.ok(mesh[lastNorthVertex + 2] > 340000)
  const camera = surfaceCamera(359, 7)
  assert.ok(Math.abs(camera.project(359, 7)[0]) < 1e-12)
  assert.ok(Math.abs(camera.project(359, 7)[1]) < 1e-12)
  assert.ok(camera.project(179, 0)[2] < 0)
})

test('solar exposure integrates only illuminated time and projects light onto a flat panel', () => {
  const timeline = [30, 30, 30].map(sunEl => ({ sunEl }))
  const partial = solarExposure(timeline, [[.25, .75], [1, 2]], 2)
  assert.ok(Math.abs(partial.beamHours - .75) < 1e-12)
  assert.equal(partial.peak, 30)
  assert.deepEqual(solarExposure(timeline, [], 2), { beamHours: 0, peak: null })
  const rising = solarExposure([{ sunEl: -30 }, { sunEl: 30 }], [[0, 1]], 1)
  assert.ok(Math.abs(rising.beamHours - (1 - Math.cos(Math.PI / 6)) / (Math.PI / 3)) < 1e-12)
})

test('outage limits use uninterrupted gaps including the mission boundaries', () => {
  assert.deepEqual(longestGap([[1, 2], [4, 5]], 8), [5, 8])
  assert.deepEqual(longestGap([], 8), [0, 8])
  assert.equal(longestGap([[0, 8]], 8), null)
  const metrics = summarize([[0, 8]], [[1, 2], [4, 5]], 8)
  const weights = { sun: 0, earth: 100, overlap: 0 }
  const limits = { sun: 0, earth: 0, overlap: 0, darkness: Infinity, blackout: 2 }
  const rows = [{ site: { name: 'A' }, metrics }]
  assert.deepEqual(rank(rows, weights, limits, 8)[0].unmet, ['Earth visibility gap'])
  assert.equal(rank(rows, weights, { ...limits, blackout: 3 }, 8)[0].place, 1)
})

test('sky countdowns use actual terrain crossings even during a total eclipse', () => {
  const timeline = [
    { sunEl: 6, sunHorizon: 4, earthEl: -2, earthHorizon: -1, eclipse: true },
    { sunEl: 4, sunHorizon: 5, earthEl: 3, earthHorizon: -1, eclipse: false },
    { sunEl: 2, sunHorizon: 5, earthEl: 2, earthHorizon: -1, eclipse: false },
  ]
  const events = skyCrossings(timeline, .25)
  assert.deepEqual(nextSkyCrossing(events.sun, 0), { at: (2 / 3) * .25, rising: false })
  assert.deepEqual(nextSkyCrossing(events.earth, 0), { at: .05, rising: true })
  assert.equal(nextSkyCrossing(events.sun, .25), undefined)
})

test('sky countdowns keep the last covered sample and skip an instantaneous skyline touch', () => {
  const events = skyCrossings([3, 0, 2, 0, -2].map(sunEl => ({ sunEl, sunHorizon: 0, earthEl: 1, earthHorizon: 0 })), .25)
  assert.deepEqual(events.sun, [{ at: .75, rising: false }])
  assert.equal(nextSkyCrossing(events.sun, .75), undefined)
  assert.equal(nextSkyCrossing(events.earth, 0), undefined)
  const atEnd = skyCrossings([{ sunEl: 1, sunHorizon: 0 }, { sunEl: 0, sunHorizon: 0 }], .25)
  assert.deepEqual(atEnd.sun, [{ at: .25, rising: false }])
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

test('click coordinates round-trip across the globe and reject empty space', () => {
  for (const target of [{ lat: -88, lon: -157 }, { lat: 16, lon: -179 }, { lat: 29, lon: 130 }]) {
    const view = globeOrientation(target.lat - 2, target.lon - 4)
    const [x, y] = projectSite(target, view)
    const point = pointOnGlobe(x, y, view)
    assert.ok(Math.abs(point.lat - target.lat) < 1e-9 && Math.abs(point.lon - target.lon) < 1e-9)
  }
  assert.equal(pointOnGlobe(1, 1, globeOrientation(0, 0)), null)
})

test('terrain horizon accounts for curvature at both poles and wraps tile coverage at the seam', () => {
  for (const lat of [-90, 0, 90]) {
    const profile = horizonProfile(lat, 180, () => 0, 1900).horizon
    assert.equal(profile.length, 720)
    assert.ok(profile.every(angle => angle < 0 && angle > -.2))
  }
  const tiles = nearestTiles(0, 179.9)
  assert.ok(tiles.some(([x]) => x === 0) && tiles.some(([x]) => x === 11))
  assert.equal(nearestTiles(90, 0).length, 12)
})

test('gazetteer includes unique valid features from both hemispheres', () => {
  const features = JSON.parse(readFileSync(new URL('./data/gazetteer.json', import.meta.url)))
  assert.ok(features.length >= 9000)
  assert.equal(new Set(features.map(feature => feature.id)).size, features.length)
  assert.ok(features.every(feature => Math.abs(feature.lat) <= 90 && Math.abs(feature.lon) <= 180))
  assert.equal(features.find(feature => feature.name === 'Tycho').kind, 'Crater')
  assert.ok(Math.abs(features.find(feature => feature.name === 'Von Kármán').lon) > 90)
})
