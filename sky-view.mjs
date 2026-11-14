import { horizonAt } from './planner.mjs'

const bands = ['N', 'E', 'S', 'W', 'N']
const elevationStep = 15
const ink = '#e6e4ec'
const grid = '#34343b'
const skyline = '#aaa4ba'

export function skyRange(timeline, profile) {
  let minimum = -elevationStep
  let maximum = elevationStep
  for (const { sunEl, earthEl } of timeline) {
    minimum = Math.min(minimum, sunEl, earthEl)
    maximum = Math.max(maximum, sunEl, earthEl)
  }
  if (profile) {
    minimum = Math.min(minimum, ...profile)
    maximum = Math.max(maximum, ...profile)
  }
  return [Math.floor(minimum / elevationStep) * elevationStep, Math.ceil(maximum / elevationStep) * elevationStep]
}

export function drawLocalSky(canvas, sample, profile, [minimum, maximum]) {
  const { clientWidth: width, clientHeight: height } = canvas
  if (width < 100 || height < 100) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const dpr = Math.min(2, devicePixelRatio || 1)
  const pixelWidth = Math.round(width * dpr)
  const pixelHeight = Math.round(height * dpr)
  if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
    canvas.width = pixelWidth
    canvas.height = pixelHeight
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, width, height)
  const left = 41
  const right = width - 23
  const top = 23
  const bottom = height - 27
  const x = azimuth => left + azimuth / 360 * (right - left)
  const y = elevation => bottom - (elevation - minimum) / (maximum - minimum) * (bottom - top)
  const horizon = Array.from({ length: 721 }, (_, index) => [x(index / 2), y(horizonAt(profile, index / 2))])
  function path(points) {
    ctx.beginPath()
    ctx.moveTo(...points[0])
    for (const point of points.slice(1)) ctx.lineTo(...point)
  }

  ctx.fillStyle = '#0b0b10'
  ctx.fillRect(left, top, right - left, bottom - top)
  path(horizon)
  ctx.lineTo(right, bottom)
  ctx.lineTo(left, bottom)
  ctx.closePath()
  ctx.fillStyle = '#221e29'
  ctx.fill()

  ctx.font = '12px DM Sans, sans-serif'
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  for (let i = 0; i < bands.length; i++) {
    const px = x(i * 90)
    path([[px, top], [px, bottom]])
    ctx.strokeStyle = grid
    ctx.stroke()
    ctx.fillStyle = ink
    ctx.fillText(bands[i], px, height - 12)
  }
  ctx.textAlign = 'right'
  const span = maximum - minimum
  const interval = span > 90 ? 45 : span > 45 ? 30 : 15
  for (let elevation = Math.ceil(minimum / interval) * interval; elevation <= maximum; elevation += interval) {
    const py = y(elevation)
    path([[left, py], [right, py]])
    ctx.setLineDash(elevation === 0 && profile ? [4, 4] : [])
    ctx.strokeStyle = elevation === 0 ? skyline : grid
    ctx.stroke()
    ctx.setLineDash([])
    ctx.fillStyle = ink
    ctx.fillText(`${elevation}°`, left - 8, py)
  }
  path(horizon)
  ctx.strokeStyle = skyline
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.lineWidth = 1

  const bodies = [
    { name: 'Sun', az: sample.sunAz, el: sample.sunEl, horizon: sample.sunHorizon, color: '#ffc975', eclipse: sample.eclipse },
    { name: 'Earth', az: sample.earthAz, el: sample.earthEl, horizon: sample.earthHorizon, color: '#acc4ff' },
  ]
  const placed = []
  ctx.textAlign = 'left'
  ctx.font = '700 12px DM Sans, sans-serif'
  for (const body of bodies) {
    const px = x(body.az)
    const py = y(body.el)
    const clear = body.el > body.horizon && !body.eclipse
    ctx.setLineDash([3, 3])
    path([[px, y(body.horizon)], [px, py]])
    ctx.strokeStyle = body.color
    ctx.stroke()
    ctx.setLineDash([])

    ctx.beginPath()
    if (body.name === 'Sun') ctx.arc(px, py, 5, 0, 2 * Math.PI)
    else {
      ctx.moveTo(px, py - 6)
      ctx.lineTo(px + 6, py)
      ctx.lineTo(px, py + 6)
      ctx.lineTo(px - 6, py)
      ctx.closePath()
    }
    ctx.fillStyle = clear ? body.color : '#141420'
    ctx.fill()
    ctx.lineWidth = 1.5
    ctx.stroke()

    const textWidth = ctx.measureText(body.name).width
    const labelX = Math.max(left, Math.min(right - textWidth, px + 9))
    let labelY = py - 14
    if (placed.some(label => Math.abs(label.y - labelY) < 16 && Math.abs(label.x - labelX) < 42)) labelY = py + 16
    ctx.strokeStyle = '#141420'
    ctx.lineWidth = 3
    ctx.lineJoin = 'round'
    ctx.strokeText(body.name, labelX, labelY)
    ctx.fillStyle = body.color
    ctx.fillText(body.name, labelX, labelY)
    placed.push({ x: labelX, y: labelY })
  }
}
