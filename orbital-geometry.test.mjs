import { test } from 'node:test'
import assert from 'node:assert/strict'
import { physicalBodies, orbitUnitKm, raySphere, nearestBody, projectBody, lunarMapSystem } from './orbital-geometry.mjs'
import { globeOrientation } from './globe.mjs'

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

test('Moon map uses the same physical system with a camera fitted to the displayed lunar disk', () => {
  const state={moon:[384400,0,0],sun:[149597870.7,0,0],rotation:[1,0,0,0]}
  for(const [lat,lon,size] of [[0,0,260],[60,90,260],[0,180,400],[-90,17,2000]]) {
    const frame=lunarMapSystem(state,globeOrientation(lat,lon),size,550)
    const moon=projectBody(frame.view.moon,550,1200,600)
    assert.ok(Math.abs(moon.radius-size)<1e-7)
    assert.ok(Math.hypot(moon.center[0]-600,moon.center[1]-300)<1e-7)
    for(const [a,b] of [['earth','moon'],['sun','moon'],['sun','earth']]) {
      const separation=body=>Math.hypot(...body[a].slice(0,3).map((v,i)=>v-body[b][i]))
      assert.ok(Math.abs(separation(frame.view)-separation(frame.world))<1e-9)
      assert.equal(frame.view[a][3],frame.world[a][3])
    }
  }
})

test('rotating around the Moon moves Earth from behind the camera to behind the Moon', () => {
  const state={moon:[384400,0,0],sun:[0,149597870.7,0],rotation:[1,0,0,0]}
  const near=lunarMapSystem(state,globeOrientation(0,180),260,550)
  const far=lunarMapSystem(state,globeOrientation(0,0),260,550)
  assert.ok(near.view.earth[2]<0)
  assert.ok(far.view.earth[2]>0)
  assert.equal(nearestBody(far.view.earth.slice(0,3),far.view),'moon')
  const side=lunarMapSystem(state,globeOrientation(0,90),260,550)
  assert.ok(Math.abs(side.view.earth[0])>.9)
  assert.ok(Math.abs(side.view.sun[0]-1)<1e-10, 'retain the observer offset rather than pinning the Sun to a background')
  assert.ok(side.view.sun[2]<0, 'the Sun is behind the camera when looking from its side of the Moon')
})
