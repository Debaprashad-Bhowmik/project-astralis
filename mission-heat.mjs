import { eclipseMargin, radius } from './planner.mjs'
import { totalityPossible } from './coverage-map.mjs'

export const overlapColors = [[198, 56, 70], [239, 177, 75], [57, 214, 148]]
export const missionGridHeight = 91
export const overlapScore = (value, peak) => peak > 0 ? Math.min(1, Math.max(0, value / peak)) : 0

// Signed horizon clearance varies linearly between adjacent samples.
export function overlapStep(sunBefore, sunAfter, earthBefore, earthAfter) {
  if ((sunBefore <= 0 && sunAfter <= 0) || (earthBefore <= 0 && earthAfter <= 0)) return 0
  if (sunBefore > 0 && sunAfter > 0 && earthBefore > 0 && earthAfter > 0) return 1
  const start = Math.max(sunBefore > 0 ? 0 : sunBefore / (sunBefore - sunAfter),
    earthBefore > 0 ? 0 : earthBefore / (earthBefore - earthAfter))
  const end = Math.min(sunAfter > 0 ? 1 : sunBefore / (sunBefore - sunAfter),
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
  const values = new Float32Array(width * height)
  let peak = 0
  for (let row = 0; row < height; row++) {
    const lat = (90 - row * 180 / (height - 1)) * radians
    const cosLat = row === 0 || row === height - 1 ? 0 : Math.cos(lat)
    const z = Math.sin(lat)
    for (let col = 0; col < width; col++) {
      const x = cosLat * directions[col][0]
      const y = cosLat * directions[col][1]
      let previousSun
      let previousEarth
      let overlap = 0
      for (const { sun, earth, sunDistance, earthDistance, eclipse } of samples) {
        let sunlight = (x * sun[0] + y * sun[1] + z * sun[2] - radius) / sunDistance
        const earthView = (x * earth[0] + y * earth[1] + z * earth[2] - radius) / earthDistance
        if (eclipse) {
          const offset = [x * radius, y * radius, z * radius]
          const margin = eclipseMargin(sun.map((v, i) => v - offset[i]), earth.map((v, i) => v - offset[i]))
          sunlight = Math.min(sunlight, margin * radians)
        }
        if (previousSun !== undefined) overlap += overlapStep(previousSun, sunlight, previousEarth, earthView)
        previousSun = sunlight
        previousEarth = earthView
      }
      const index = row * width + col
      values[index] = samples.length > 1 ? overlap / (samples.length - 1) : 0
      peak = Math.max(peak, values[index])
    }
  }
  return { width, height, values, peak }
}

export function overlapRgb(score) {
  const segment = score < .5 ? 0 : 1
  const amount = score * 2 - segment
  return overlapColors[segment].map((start, channel) => Math.round(start + (overlapColors[segment + 1][channel] - start) * amount))
}
