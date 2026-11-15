import { test } from 'node:test'
import assert from 'node:assert/strict'
import { physicalBodies, orbitUnitKm, raySphere, nearestBody, projectBody } from './orbital-geometry.mjs'

test('all orbital bodies share the ephemeris distance scale and physical radii', () => {
  const bodies = physicalBodies({ moon: [384400,0,0], sun: [149597870.7,0,0] })
  assert.equal(bodies.moon[0], 1)
  assert.ok(Math.abs(bodies.sun[0] / bodies.moon[0] - 389.1724) < .001)
  assert.ok(Math.abs(bodies.moon[3] * orbitUnitKm - 1737.4) < 1e-9)
  assert.ok(Math.abs(bodies.sun[3] / bodies.earth[3] - 109.0757) < .001)
  assert.ok(bodies.moon[0] / (2*bodies.earth[3]) > 30)
})

test('perspective apparent sizes depend on both radius and camera distance', () => {
  const far = projectBody([0,0,100,1], 1000, 1200, 800)
  const near = projectBody([0,0,10,1], 1000, 1200, 800)
  assert.ok(Math.abs(far.radius - 1000/Math.sqrt(9999)) < 1e-10)
  assert.ok(near.radius / far.radius > 10)
  assert.equal(projectBody([0,0,-10,1], 1000, 1200,800).inFront, false)
  const solar = projectBody([0,0,149597870.7,695700], 1000,1200,800)
  assert.ok(Math.abs(2*Math.atan(solar.radius/1000)*180/Math.PI - .5329) < .001)
})

test('a nearer sphere occludes the Sun, including partial overlaps, in either depth order', () => {
  const sun = [0,0,100,2], earth = [0,0,5,.5], moon = [0,0,10,.1]
  assert.equal(nearestBody([0,0,1], { sun, earth, moon }), 'earth')
  assert.equal(nearestBody([0,0,1], { sun, moon, earth:[0,0,-5,.5] }), 'moon')
  assert.equal(nearestBody([0,0,1], { sun, earth:[0,0,105,.5] }), 'sun')
  const offset = {sun, earth:[.5,0,5,.5]}
  assert.equal(nearestBody([.005,0,1],offset),'earth')
  assert.equal(nearestBody([-.005,0,1],offset),'sun')
  assert.equal(nearestBody([0,1,1],offset),null)
  assert.equal(raySphere([0,0,1],[0,0,-5,1]),Infinity)
})
