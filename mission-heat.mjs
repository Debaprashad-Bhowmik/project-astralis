import { eclipseMargin, radius } from './planner.mjs'
import { totalityPossible } from './coverage-map.mjs'

export const overlapColors = [[198, 56, 70], [239, 177, 75], [57, 214, 148]]
export const missionGridHeight = 91
export const missionQuarters = 4
export const overlapScore = (hours, duration) => duration > 0 ? Math.min(1, Math.max(0, hours / duration)) : 0

export function windowHours(windows, start, end) {
  return windows.reduce((hours, [from, to]) => hours + Math.max(0, Math.min(to, end) - Math.max(from, start)), 0)
}

// Signed horizon clearance varies linearly between adjacent samples.
export function overlapStep(sunBefore, sunAfter, earthBefore, earthAfter, from = 0, to = 1) {
  if ((sunBefore <= 0 && sunAfter <= 0) || (earthBefore <= 0 && earthAfter <= 0)) return 0
  if (sunBefore > 0 && sunAfter > 0 && earthBefore > 0 && earthAfter > 0) return to - from
  const start = Math.max(from, sunBefore > 0 ? 0 : sunBefore / (sunBefore - sunAfter),
    earthBefore > 0 ? 0 : earthBefore / (earthBefore - earthAfter))
  const end = Math.min(to, sunAfter > 0 ? 1 : sunBefore / (sunBefore - sunAfter),
    earthAfter > 0 ? 1 : earthBefore / (earthBefore - earthAfter))
  return Math.max(0, end - start)
}

export function missionOverlapGrid(frames, width = 180, height = missionGridHeight) {
  const radians = Math.PI / 180
  const longitude = Array.from({ length: width }, (_, col) => ((col + .5) * 360 / width - 180) * radians)
  const directions = longitude.map(angle => [Math.cos(angle), Math.sin(angle)])
  const samples = frames.map(([sun, earth]) => {
    const sunDistance = Math.hypot(...sun)
    const earthDistance = Math.hypot(...earth)
    return { sun, earth, sunDistance, earthDistance, eclipse: totalityPossible(sun, earth) }
  })
  const periods = Array.from({ length: missionQuarters + 1 }, () => ({ values: new Float32Array(width * height) }))
  const quarterLength = (samples.length - 1) / missionQuarters
  const intervals = samples.slice(1).map((_, i) => {
    const first = Math.floor(i / quarterLength)
    const last = Math.ceil((i + 1) / quarterLength) - 1
    return Array.from({ length: last - first + 1 }, (_, offset) => {
      const quarter = first + offset
      return { quarter, from: Math.max(0, quarterLength * quarter - i), to: Math.min(1, quarterLength * (quarter + 1) - i) }
    })
  })
  const totals = new Float64Array(missionQuarters)
  for (let row = 0; row < height; row++) {
    const lat = (90 - row * 180 / (height - 1)) * radians
    const cosLat = row === 0 || row === height - 1 ? 0 : Math.cos(lat)
    const z = Math.sin(lat)
    for (let col = 0; col < width; col++) {
      const x = cosLat * directions[col][0]
      const y = cosLat * directions[col][1]
      let previousSun
      let previousEarth
      totals.fill(0)
      let count = 0
      for (const { sun, earth, sunDistance, earthDistance, eclipse } of samples) {
        let sunlight = (x * sun[0] + y * sun[1] + z * sun[2] - radius) / sunDistance
        const earthView = (x * earth[0] + y * earth[1] + z * earth[2] - radius) / earthDistance
        if (eclipse) {
          const offset = [x * radius, y * radius, z * radius]
          const margin = eclipseMargin(sun.map((v, i) => v - offset[i]), earth.map((v, i) => v - offset[i]))
          sunlight = Math.min(sunlight, margin * radians)
        }
        if (count > 0) {
          const parts = intervals[count - 1]
          if (parts.length === 1) totals[parts[0].quarter] += overlapStep(previousSun, sunlight, previousEarth, earthView)
          else for (const { quarter, from, to } of parts) {
            totals[quarter] += overlapStep(previousSun, sunlight, previousEarth, earthView, from, to)
          }
        }
        previousSun = sunlight
        previousEarth = earthView
        count++
      }
      const index = row * width + col
      for (let quarter = 0; quarter < missionQuarters; quarter++) {
        periods[quarter + 1].values[index] = overlapScore(totals[quarter], quarterLength)
      }
      periods[0].values[index] = overlapScore(totals.reduce((sum, value) => sum + value, 0), samples.length - 1)
    }
  }
  return { width, height, periods }
}

export function overlapRgb(score) {
  const segment = score < .5 ? 0 : 1
  const amount = score * 2 - segment
  return overlapColors[segment].map((start, channel) => Math.round(start + (overlapColors[segment + 1][channel] - start) * amount))
}
