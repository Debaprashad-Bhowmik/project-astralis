import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { binaryFrames } from './planner.mjs'
import { framesFor, niceRange, offsetOrder, paretoFront, passes, regions, scenario, weightedScore } from './explore-model.mjs'

test('Pareto front keeps only points no other point beats on both axes', () => {
  const points = [
    { id: 'a', x: 90, y: 10 }, { id: 'b', x: 60, y: 60 }, { id: 'c', x: 10, y: 95 },
    { id: 'd', x: 50, y: 50 }, { id: 'e', x: 60, y: 40 }, { id: 'f', x: 90, y: 5 },
  ]
  assert.deepEqual([...paretoFront(points, 'x', 'y')].sort(), ['a', 'b', 'c'])
})

test('equal points both stay on the front only once per duplicate value', () => {
  const front = paretoFront([{ id: 'a', x: 5, y: 5 }, { id: 'b', x: 5, y: 5 }], 'x', 'y')
  assert.equal(front.size, 1)
})

test('weighted score sweeps from the y axis to the x axis', () => {
  const point = { sun: 80, earth: 20 }
  const scales = { x: 100, y: 100 }
  assert.equal(weightedScore(point, 1, 'sun', 'earth', scales), 80)
  assert.equal(weightedScore(point, 0, 'sun', 'earth', scales), 20)
  assert.equal(weightedScore(point, .5, 'sun', 'earth', scales), 50)
})

test('requirements filter minimum shares and the longest dark spell', () => {
  const point = { sun: 40, earth: 70, darkGap: 30 }
  assert.equal(passes(point, { sun: 40, earth: 0, darkGap: Infinity }), true)
  assert.equal(passes(point, { sun: 41, earth: 0, darkGap: Infinity }), false)
  assert.equal(passes(point, { sun: 0, earth: 0, darkGap: 24 }), false)
})

test('axis ranges are padded, clamped to the scale and non-empty', () => {
  assert.deepEqual(niceRange([42, 58], 100), [30, 70])
  assert.deepEqual(niceRange([0, 100], 100), [0, 100])
  const [low, high] = niceRange([3, 3], 100)
  assert.ok(high > low)
})

test('date offsets start at the chosen date and alternate outward', () => {
  assert.deepEqual(offsetOrder.slice(0, 5), [0, -1, 1, -2, 2])
  assert.equal(offsetOrder.length, 31)
})

test('regions classify the catalog and the south polar group is the focus', () => {
  const { catalog } = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)))
  const polar = catalog.filter(regions.pole.test).map(site => site.id)
  assert.ok(polar.includes('shackleton-rim') && polar.includes('athena'))
  assert.ok(!polar.includes('apollo-11'))
  for (const site of catalog) assert.ok(Object.values(regions).some(region => region.test(site)), site.id)
})

test('scenario metrics agree with the planner and report the next sunset or sunrise', () => {
  const metadata = JSON.parse(readFileSync(new URL('./data/catalog.json', import.meta.url)))
  const catalog = { ...metadata, startMs: Date.parse(metadata.start) }
  const bytes = readFileSync(new URL('./data/ephemeris.bin', import.meta.url))
  const ephemeris = binaryFrames(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength))
  const frames = framesFor(ephemeris, catalog, Date.parse('2026-12-01T00:00Z'), 72)
  const site = catalog.catalog.find(candidate => candidate.id === 'apollo-11')
  const row = scenario(site, frames, 72, true)
  for (const key of ['sun', 'earth', 'overlap']) assert.ok(row[key] >= 0 && row[key] <= 100, key)
  assert.ok(row.overlap <= Math.min(row.sun, row.earth) + 1e-9)
  const covered = row.sunWindows.reduce((total, [start, end]) => total + end - start, 0)
  assert.ok(Math.abs(100 * covered / 72 - row.sun) < 1e-9)
  if (row.sunChange !== null) {
    const inside = row.sunWindows.some(([start, end]) => start <= 0 && end >= row.sunChange - 1e-6)
    assert.equal(inside, row.sunUp)
  }
  assert.equal(framesFor(ephemeris, catalog, Date.parse('2023-01-01T00:00Z'), 24), null)
})

// ---------- detail funnel ----------
import { chooseCriteria, criteria, dateFloor, explain, funnelScore, meetsRequirements, presets } from './explore-model.mjs'
const row = (id, values) => ({ id, sun: 50, earth: 50, overlap: 25, darkGap: 24, earthGap: 24, touchdown: 0, hours: 168, ...values })

test('each level shows more factors, and Essentials defaults to sunlight and Earth', () => {
  const pool = [row('a', { sun: 90, earth: 20 }), row('b', { sun: 30, earth: 80 }), row('c', { sun: 60, earth: 50 })]
  assert.deepEqual(chooseCriteria(pool, 1, .5).keys.sort(), ['earth', 'sun'])
  assert.equal(chooseCriteria(pool, 2, .5).keys.length, 4)
  assert.equal(chooseCriteria(pool, 4, .5).keys.length, 7)
})

test('a factor that barely differs gives way to one that decides (14-day lander, Mar 10 2026)', () => {
  const pool = [row('peak', { sun: 91, earth: 49, darkGap: 30, earthGap: 173, hours: 336 }),
    row('ridge', { sun: 51, earth: 45, darkGap: 163, earthGap: 182, hours: 336 })]
  const { keys, similar } = chooseCriteria(pool, 1, .5)
  assert.deepEqual(keys, ['sun', 'dark'])
  assert.deepEqual(similar.map(item => item.key), ['earth', 'blackout'])
  assert.equal(similar[0].range, '45%–49%')
})

test('the priority slider can rule factors out entirely', () => {
  const pool = [row('a', { sun: 90, earth: 20 }), row('b', { sun: 30, earth: 80 })]
  assert.ok(!chooseCriteria(pool, 1, 1).keys.includes('earth'))
})

test('the priority slider moves the essentials score between power and contact', () => {
  const sunny = row('sunny', { sun: 90, earth: 10 })
  assert.equal(funnelScore(sunny, ['sun', 'earth'], 1), 90)
  assert.equal(funnelScore(sunny, ['sun', 'earth'], 0), 10)
  assert.equal(funnelScore(sunny, ['sun', 'earth'], .5), 50)
})

test('lower-weight factors separate options that tie on the essentials', () => {
  const a = row('a', { darkGap: 100 })
  const b = row('b', { darkGap: 10 })
  const keys = ['sun', 'earth', 'dark', 'blackout']
  assert.equal(funnelScore(a, ['sun', 'earth'], .5), funnelScore(b, ['sun', 'earth'], .5))
  assert.ok(funnelScore(b, keys, .5) > funnelScore(a, keys, .5))
  const bright = row('bright', { sun: 95, earth: 60, darkGap: 60 })
  const dim = row('dim', { sun: 40, earth: 60, darkGap: 0 })
  assert.ok(funnelScore(bright, keys, .5) > funnelScore(dim, keys, .5))
})

test('requirements list every miss in plain words', () => {
  const misses = meetsRequirements(row('x', { sun: 30, darkGap: 100 }), { sun: 40, earth: 0, dark: 72, blackout: null })
  assert.equal(misses.length, 2)
  assert.match(misses[0], /sunlight 30% < 40%/)
  assert.deepEqual(meetsRequirements(row('x'), presets.explore.req), [])
})

test('the date-slip worst case uses only nearby computed dates', () => {
  const scores = new Map([[-3, 40], [-1, 50], [0, 60], [2, 80], [5, 0]])
  assert.equal(dateFloor(scores, 0), 40)
  assert.equal(dateFloor(new Map([[0, 50]]), 0), undefined)
  // A site that is always useless has a worst case of zero, not a perfect record.
  assert.equal(dateFloor(new Map([[-1, 0], [0, 0], [1, 0]]), 0), 0)
})

test('reasons name the leader strength and the trade-off of alternatives', () => {
  const leader = row('lead', { sun: 90, earth: 40 })
  const other = row('alt', { sun: 50, earth: 95 })
  const pool = [leader, other, row('c', { sun: 20, earth: 20 })]
  const keys = ['sun', 'earth']
  assert.equal(explain(leader, 0, leader, pool, keys), 'Most sunlight (90%), but Earth is in view only 40% of the time.')
  assert.equal(explain(other, 1, leader, pool, keys), 'More time with Earth in view (95% vs 40%), but less sunlight (50% vs 90%) than #1.')
  const balanced = row('even', { sun: 80, earth: 80 })
  assert.match(explain(balanced, 0, balanced, [balanced, other], keys), /no major weakness/)
})

test('axis ticks convert positions back into each factor\'s own units', () => {
  assert.equal(criteria.sun.tick(40, 168), '40%')
  assert.equal(criteria.dark.tick(75, 96), '24 h')
  assert.equal(criteria.slip.tick(90, 168), '90%')
})
