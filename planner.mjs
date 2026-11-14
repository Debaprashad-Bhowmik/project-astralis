const radians = Math.PI / 180
export const radius = 1737400
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const interpolate = (a, b, t) => a + (b - a) * t

export function observer(lat, lon, height) {
  const phi = lat * radians
  const lambda = lon * radians
  const up = [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)]
  const east = [-Math.sin(lambda), Math.cos(lambda), 0]
  const north = [-Math.sin(phi) * Math.cos(lambda), -Math.sin(phi) * Math.sin(lambda), Math.cos(phi)]
  return { up, east, north, position: up.map(value => value * (radius + height)) }
}

export function localAngles(position, base) {
  const relative = position.map((value, axis) => value - base.position[axis])
  const east = dot(relative, base.east)
  const north = dot(relative, base.north)
  const up = dot(relative, base.up)
  return [(Math.atan2(east, north) / radians + 360) % 360, Math.atan2(up, Math.hypot(east, north)) / radians, relative]
}

export function horizonAt(profile, azimuth) {
  if (!profile) return 0
  const index = ((azimuth % 360 + 360) % 360) * profile.length / 360
  const left = Math.floor(index)
  return interpolate(profile[left], profile[(left + 1) % profile.length], index - left)
}

export function skyCrossings(timeline, step) {
  function crossings(elevation, horizon) {
    const events = []
    const clearance = sample => sample[elevation] - sample[horizon]
    let before = clearance(timeline[0])
    for (let index = 1; index < timeline.length; index++) {
      const after = clearance(timeline[index])
      if ((before > 0) !== (after > 0)) {
        const at = (index - 1 + before / (before - after)) * step
        if (events.at(-1)?.at === at) events.pop()
        else events.push({ at, rising: after > 0 })
      }
      before = after
    }
    return events
  }
  return { sun: crossings('sunEl', 'sunHorizon'), earth: crossings('earthEl', 'earthHorizon') }
}

export function nextSkyCrossing(events, elapsedHours) {
  return events.find(event => event.at > elapsedHours)
}

export function visibility(values, step) {
  const windows = []
  let start = values[0] > 0 ? 0 : null
  for (let index = 1; index < values.length; index++) {
    const before = values[index - 1]
    const after = values[index]
    if ((before > 0) === (after > 0)) continue
    const crossing = (index - 1 + before / (before - after)) * step
    if (after > 0) start = crossing
    else {
      if (crossing > start) windows.push([start, crossing])
      start = null
    }
  }
  if (start !== null && start < (values.length - 1) * step) windows.push([start, (values.length - 1) * step])
  return windows
}

export function summarize(sun, earth, duration) {
  const both = []
  let left = 0
  let right = 0
  while (left < sun.length && right < earth.length) {
    const a = sun[left]
    const b = earth[right]
    const start = Math.max(a[0], b[0])
    const end = Math.min(a[1], b[1])
    if (start < end) both.push([start, end])
    if (a[1] <= b[1]) left++
    else right++
  }
  const total = windows => windows.reduce((hours, [start, end]) => hours + end - start, 0)
  function longestGap(windows) {
    let longest = 0
    let cursor = 0
    for (const [start, end] of windows) {
      longest = Math.max(longest, start - cursor)
      cursor = end
    }
    return Math.max(longest, duration - cursor)
  }
  return { sun: total(sun), earth: total(earth), overlap: total(both), darkness: longestGap(sun), blackout: longestGap(earth), both }
}

export function rank(rows, weights, limits, duration) {
  const totalWeight = weights.sun + weights.earth + weights.overlap
  const ranked = rows.map(row => {
    const { metrics } = row
    const unmet = []
    if (metrics.sun + 1e-8 < limits.sun) unmet.push('Sunlight')
    if (metrics.earth + 1e-8 < limits.earth) unmet.push('Earth visibility')
    if (metrics.overlap + 1e-8 < limits.overlap) unmet.push('Overlap')
    if (metrics.darkness - 1e-8 > limits.darkness) unmet.push('Dark gap')
    const score = Math.round(1000 * (weights.sun * metrics.sun + weights.earth * metrics.earth + weights.overlap * metrics.overlap) / (totalWeight * duration)) / 10
    return { ...row, unmet, score }
  })
  ranked.sort((a, b) => a.unmet.length - b.unmet.length || b.score - a.score || a.site.name.localeCompare(b.site.name))
  return ranked.map((row, index) => ({
    ...row,
    place: row.unmet.length ? null : 1 + ranked.findIndex(candidate => candidate.score === row.score),
    tied: !row.unmet.length && ranked.some((other, id) => id !== index && !other.unmet.length && other.score === row.score),
  }))
}

function eclipseMargin(sun, earth) {
  const sunDistance = Math.hypot(...sun)
  const earthDistance = Math.hypot(...earth)
  const separation = Math.acos(Math.min(1, Math.max(-1, dot(sun, earth) / (sunDistance * earthDistance))))
  return (separation + Math.asin(695700000 / sunDistance) - Math.asin(6378137 / earthDistance)) / radians
}

export function evaluate(site, frames, hours, useTerrain) {
  const base = observer(site.lat, site.lon, useTerrain ? site.height + 2 : 0)
  const profile = useTerrain ? site.horizon : null
  const sunClearance = []
  const earthClearance = []
  const timeline = frames.map(([sunPosition, earthPosition]) => {
    const [sunAz, sunEl, sunVector] = localAngles(sunPosition, base)
    const [earthAz, earthEl, earthVector] = localAngles(earthPosition, base)
    const sunHorizon = horizonAt(profile, sunAz)
    const earthHorizon = horizonAt(profile, earthAz)
    const eclipse = eclipseMargin(sunVector, earthVector)
    sunClearance.push(Math.min(sunEl - sunHorizon, eclipse))
    earthClearance.push(earthEl - earthHorizon)
    return { sunAz, sunEl, earthAz, earthEl, sunHorizon, earthHorizon, eclipse: eclipse <= 0 }
  })
  const step = hours / (frames.length - 1)
  const sun = visibility(sunClearance, step)
  const earth = visibility(earthClearance, step)
  return { site, timeline, sun, earth, metrics: summarize(sun, earth, hours) }
}

export function binaryFrames(buffer) {
  const values = new Int32Array(buffer)
  if (values.length % 6) throw new Error('Ephemeris data are incomplete.')
  for (let index = 6; index < values.length; index++) values[index] += values[index - 6]
  return values
}

export function frameAt(values, position) {
  const last = values.length / 6 - 1
  if (position < -1e-6 || position > last + 1e-6) throw new Error('Choose a time within the ephemeris coverage.')
  const left = Math.max(0, Math.min(last, Math.floor(position)))
  const right = Math.min(last, left + 1)
  const fraction = Math.max(0, Math.min(1, position - left))
  const coordinate = axis => 100 * interpolate(values[left * 6 + axis], values[right * 6 + axis], fraction)
  return [[coordinate(0), coordinate(1), coordinate(2)], [coordinate(3), coordinate(4), coordinate(5)]]
}
