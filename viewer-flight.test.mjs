import test from 'node:test'
import assert from 'node:assert/strict'
import { radius } from './planner.mjs'
import { surfaceFlightFrame, surfaceFocalLength } from './viewer-flight.mjs'

const options = { width: 1200, height: 600, startRadius: 276,
  eye: {height: 2, elevation: 2, azimuth: 0, zoom: 1} }

test('the map continues zooming and matches the overhead terrain scale through the handoff', () => {
  const frames = Array.from({length: 1001}, (_,i)=>surfaceFlightFrame(i/1000, options))
  const transfer = frames.filter(frame=>frame.surfaceOpacity>0 && frame.surfaceOpacity<1)
  assert.ok(transfer.length>10)
  assert.ok(transfer[0].mapRadius/options.startRadius>10, 'a full Moon needs a real approach, not a 3x fade')
  for (const frame of transfer) {
    assert.ok(Math.abs(frame.mapRadius/radius-surfaceFocalLength(1200,600,1)/frame.height)<1e-10)
    assert.equal(frame.elevation,-90, 'keep the same downward view until the handoff finishes')
    assert.equal(frame.alignment,1, 'finish centering the chosen coordinate first')
  }
  for (let i=1;i<frames.length;i++) {
    assert.ok(frames[i].height<=frames[i-1].height)
    assert.ok(frames[i].mapRadius>=frames[i-1].mapRadius)
  }
})

test('overview, close map, mobile, and survey-height approaches preserve their endpoints', () => {
  for (const setup of [options, {...options,startRadius:276*120}, {...options,width:380,height:305},
    {...options,eye:{height:100,elevation:-12,azimuth:350,zoom:4}}]) {
    const start=surfaceFlightFrame(0,setup), end=surfaceFlightFrame(1,setup)
    assert.ok(Math.abs(start.mapRadius-setup.startRadius)<1e-7)
    assert.equal(start.surfaceOpacity,0)
    assert.equal(start.blur,0)
    assert.equal(end.surfaceOpacity,1)
    assert.equal(end.blur,0)
    assert.ok(Math.abs(end.height-setup.eye.height)<1e-8)
    assert.equal(end.elevation,setup.eye.elevation)
    assert.ok(Math.abs(Math.sin((end.azimuth-setup.eye.azimuth)*Math.PI/180))<1e-10)
    assert.equal(end.zoom,setup.eye.zoom)
  }
})

test('focus masks the middle while travel continues and is fully removed before arrival', () => {
  const frames=Array.from({length:101},(_,i)=>surfaceFlightFrame(i/100,options))
  assert.ok(frames.some(frame=>frame.blur>10 && frame.surfaceOpacity>0 && frame.surfaceOpacity<1))
  assert.ok(frames.some(frame=>frame.blur===0 && frame.surfaceOpacity===1 && frame.height>options.eye.height*2))
  for(const frame of frames) assert.ok(Number.isFinite(frame.blur) && frame.blur>=0 && frame.blur<=16)
})
