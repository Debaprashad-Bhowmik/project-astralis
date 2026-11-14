import { eclipseMargin, radius } from './planner.mjs'

const radians = Math.PI / 180
const wrapLongitude = lon => ((lon + 180) % 360 + 360) % 360 - 180
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))

export function coverageProject({ lat, lon }) {
  return { x: (wrapLongitude(lon) + 180) / 360, y: (90 - lat) / 180 }
}

export function coverageUnproject(x, y) {
  return { lat: 90 - clamp(y, 0, 1) * 180, lon: wrapLongitude(clamp(x, 0, 1) * 360 - 180) }
}

export function subPoint([x, y, z]) {
  return { lat: Math.atan2(z, Math.hypot(x, y)) / radians, lon: wrapLongitude(Math.atan2(y, x) / radians) }
}

export const coverageLayers = { off: 0, all: 1, sun: 2, earth: 3, both: 4, mission: 5 }
export const coveragePalette = [[60, 63, 74], [224, 174, 97], [125, 160, 231], [112, 210, 184]]
// The observer offset across the surface cannot produce totality outside this margin.
export const totalityPossible = (sun, earth) => eclipseMargin(sun, earth) <= .4

export function createCoverageModel(sun, earth) {
  const possibleEclipse = totalityPossible(sun, earth)
  return (x, y, z) => {
    const earthUp = x * earth[0] + y * earth[1] + z * earth[2] > radius
    let sunUp = x * sun[0] + y * sun[1] + z * sun[2] > radius
    if (sunUp && earthUp && possibleEclipse) {
      const offset = [x * radius, y * radius, z * radius]
      sunUp = eclipseMargin(sun.map((v, i) => v - offset[i]), earth.map((v, i) => v - offset[i])) > 0
    }
    return Number(sunUp) + 2 * Number(earthUp)
  }
}

const inks = ['#777986', '#ffc975', '#acc4ff', '#83dccb']
const rasterWidth = 480
const rasterHeight = 240

export function createCoverageMap(canvas, onPoint) {
  const ctx = canvas.getContext('2d')
  const raster = document.createElement('canvas')
  raster.width = rasterWidth
  raster.height = rasterHeight
  const rasterCtx = raster.getContext('2d', { willReadFrequently: true })
  const pixels = rasterCtx.createImageData(rasterWidth, rasterHeight)
  let basemap
  let frame
  let site
  let mode = 'all'
  let heatRaster
  let dirty = true
  const north = Array.from({ length: rasterHeight }, (_, row) => (90 - (row + .5) * 180 / rasterHeight) * radians)
  const east = Array.from({ length: rasterWidth }, (_, col) => ((col + .5) * 360 / rasterWidth - 180) * radians)
  const cosLat = north.map(Math.cos)
  const sinLat = north.map(Math.sin)
  const cosLon = east.map(Math.cos)
  const sinLon = east.map(Math.sin)

  const texture = new Image()
  texture.addEventListener('load', () => {
    rasterCtx.drawImage(texture, 0, 0, rasterWidth, rasterHeight)
    basemap = rasterCtx.getImageData(0, 0, rasterWidth, rasterHeight).data
    dirty = true
    draw()
  })
  texture.src = new URL('./assets/moon-color.jpg', import.meta.url).href

  function tint() {
    const mask = createCoverageModel(...frame)
    const layer = { all: 3, sun: 1, earth: 2, both: 3 }[mode]
    for (let row = 0; row < rasterHeight; row++) {
      for (let col = 0; col < rasterWidth; col++) {
        const point = mask(cosLat[row] * cosLon[col], cosLat[row] * sinLon[col], sinLat[row])
        const key = mode === 'both' ? (point === 3 ? 3 : 0) : point & layer
        const offset = 4 * (row * rasterWidth + col)
        const shade = basemap ? .56 + basemap[offset] / 360 : .83
        for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = coveragePalette[key][channel] * shade
        pixels.data[offset + 3] = 255
      }
    }
    rasterCtx.putImageData(pixels, 0, 0)
    dirty = false
  }

  function draw() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height || (!frame && !heatRaster)) return
    if (!heatRaster && dirty) tint()
    const pixel = Math.min(2, devicePixelRatio || 1)
    const pw = Math.round(width * pixel)
    const ph = Math.round(height * pixel)
    if (canvas.width !== pw || canvas.height !== ph) {
      canvas.width = pw
      canvas.height = ph
    }
    ctx.setTransform(pixel, 0, 0, pixel, 0, 0)
    if (heatRaster) {
      ctx.fillStyle = '#111116'
      ctx.fillRect(0, 0, width, height)
      if (basemap) ctx.drawImage(texture, 0, 0, width, height)
      ctx.drawImage(heatRaster, 0, 0, width, height)
    } else ctx.drawImage(raster, 0, 0, width, height)
    ctx.font = '600 11px DM Sans, sans-serif'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1
    ctx.strokeStyle = '#d8dfec45'
    ctx.beginPath()
    for (const fraction of [.25, .5, .75]) {
      ctx.moveTo(width * fraction, 0)
      ctx.lineTo(width * fraction, height)
      ctx.moveTo(0, height * fraction)
      ctx.lineTo(width, height * fraction)
    }
    ctx.stroke()
    const labels = []
    function mark(point, label, ink, shape, offset = -13) {
      const position = coverageProject(point)
      const x = clamp(position.x * width, 6, width - 6)
      const y = clamp(position.y * height, 6, height - 6)
      ctx.beginPath()
      if (shape === 'site') {
        ctx.moveTo(x, y - 6)
        ctx.lineTo(x + 6, y)
        ctx.lineTo(x, y + 6)
        ctx.lineTo(x - 6, y)
        ctx.closePath()
      } else ctx.arc(x, y, 4.5, 0, 2 * Math.PI)
      ctx.fillStyle = '#101014'
      ctx.fill()
      ctx.strokeStyle = ink
      ctx.lineWidth = 2
      ctx.stroke()
      ctx.font = '600 12px DM Sans, sans-serif'
      const textWidth = ctx.measureText(label).width
      const offsets = [offset, -offset, 2 * offset, -2 * offset, 3 * offset]
      const fits = (left, top) => !labels.some(box => Math.abs(top - box.top) < 16 && left < box.right + 4 && left + textWidth + 4 > box.left)
      let left, top
      for (const delta of offsets) {
        top = clamp(y + delta, 9, height - 9)
        const placements = [x + 9, x - textWidth - 9].map(value => clamp(value, 5, width - textWidth - 5))
        left = placements.find(value => fits(value, top))
        if (left !== undefined) break
      }
      if (left === undefined) return
      labels.push({ left, right: left + textWidth, top })
      ctx.lineWidth = 3
      ctx.strokeStyle = '#101014'
      ctx.strokeText(label, left, top)
      ctx.fillStyle = ink
      ctx.fillText(label, left, top)
    }
    mark(site, 'Selected site', '#fff', 'site', site.lat > 75 ? 14 : -14)
    if (!heatRaster) {
      mark(subPoint(frame[0]), 'Sun overhead', inks[1], 'point')
      mark(subPoint(frame[1]), 'Earth overhead', inks[2], 'point', 13)
    }
  }

  new ResizeObserver(draw).observe(canvas)
  canvas.addEventListener('click', event => {
    if (!frame && !heatRaster) return
    const rect = canvas.getBoundingClientRect()
    onPoint(coverageUnproject((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height))
  })

  return (nextFrame, nextSite, nextMode, nextHeatRaster) => {
    if (frame !== nextFrame || mode !== nextMode) dirty = true
    frame = nextFrame
    site = nextSite
    mode = nextMode
    heatRaster = nextHeatRaster
    draw()
  }
}
