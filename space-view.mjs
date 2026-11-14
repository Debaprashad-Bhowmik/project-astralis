import { observer } from './planner.mjs'

const stride = 10
const magnitude = vector => Math.hypot(...vector)
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0)
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
const scale = (vector, factor) => vector.map(value => value * factor)
const unit = vector => scale(vector, 1 / magnitude(vector))
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
export const spaceStep = 3600
const hourMs = spaceStep * 1000

export function calendarSpaceWindow(year) {
  const start = Date.UTC(year, 0, 1)
  const end = Date.UTC(year + 1, 0, 1)
  return {
    start,
    end,
    last: end - hourMs / 4,
    hours: (end - start) / hourMs - .25,
    months: Array.from({ length: 12 }, (_, month) => (Date.UTC(year, month, 1) - start) / hourMs),
  }
}

export function readSpaceSamples(buffer, start, end) {
  const count = (end - start) / (spaceStep * 1000) + 1
  if (buffer.byteLength !== count * stride * Float32Array.BYTES_PER_ELEMENT) {
    throw new Error('The 3D ephemeris is incomplete.')
  }
  return new Float32Array(buffer)
}

export function systemAt(samples, index) {
  const last = samples.length / stride - 1
  if (!Number.isInteger(last) || !Number.isFinite(index) || index < 0 || index > last) {
    throw new RangeError('Time is outside the 3D ephemeris.')
  }
  const first = Math.floor(index)
  const second = Math.min(first + 1, last)
  const fraction = index - first
  const a = samples.subarray(first * stride, (first + 1) * stride)
  const b = samples.subarray(second * stride, (second + 1) * stride)
  const mix = (value, i) => value + (b[i] - value) * fraction
  const sign = dot(a.subarray(6), b.subarray(6)) < 0 ? -1 : 1
  const rotation = Array.from(a.subarray(6), (value, i) => value + (sign * b[i + 6] - value) * fraction)
  return {
    moon: Array.from(a.subarray(0, 3), mix),
    sun: Array.from(a.subarray(3, 6), (value, i) => mix(value, i + 3)),
    rotation: unit(rotation),
  }
}

export function siteDirection(site, state) {
  const normal = observer(site.lat, site.lon, 0).up
  const [scalar, ...axis] = state.rotation
  const t = scale(cross(axis, normal), 2)
  const term = cross(axis, t)
  return normal.map((value, i) => value + scalar * t[i] + term[i])
}

const distanceLabel = new Intl.NumberFormat('en', { maximumFractionDigits: 0 })
const earthMoonScale = 384400
const sunDrawingDistance = 2.25
const defaultPitch = -.57
const colors = { sun: '#ffc975', earth: '#acc4ff', moon: '#e8e8eb', site: '#83dccb' }

export function createSpaceView(canvas, samples, controls) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('This browser could not start the 3D view.')
  const sprite = document.createElement('canvas')
  const spriteContext = sprite.getContext('2d')
  let current
  let yaw = 0
  let pitch = defaultPitch
  let drag
  let scene = 'earth'
  let heading
  const paths = new Map()

  function trail(index, kind) {
    const last = samples.length / stride - 1
    const lunar = kind === 'moon'
    const yearRange = lunar ? null : current.yearRange
    const period = yearRange ? yearRange[1] - yearRange[0] : Math.min(last, lunar ? 656 : 8766)
    const segments = Math.max(1, Math.ceil(period / (lunar ? 4 : 36)))
    const start = yearRange ? yearRange[0] : clamp(Math.floor(index / 24) * 24 - Math.floor(period / 2), 0, last - period)
    const cached = paths.get(kind)
    if (cached?.start === start && cached.period === period) return cached.points
    const points = Array.from({ length: segments + 1 }, (_, i) => {
      const offset = (start + Math.round(i * period / segments)) * stride + (lunar ? 0 : 3)
      const vector = Array.from(samples.subarray(offset, offset + 3))
      if (lunar) return scale(vector, 1 / earthMoonScale)
      return kind === 'earth' ? scale(vector, -1 / 149597871) : scale(unit(vector), sunDrawingDistance)
    })
    paths.set(kind, { start, period, points })
    return points
  }

  function drawPhase(x, y, radius, light, color, dpi) {
    const diameter = Math.ceil(2 * radius * dpi)
    sprite.width = sprite.height = diameter
    const pixels = spriteContext.createImageData(diameter, diameter)
    for (let row = 0; row < diameter; row++) {
      const ny = 1 - (row + .5) * 2 / diameter
      for (let column = 0; column < diameter; column++) {
        const nx = (column + .5) * 2 / diameter - 1
        const r2 = nx * nx + ny * ny
        if (r2 >= 1) continue
        const nz = Math.sqrt(1 - r2)
        const glow = Math.max(0, light[0] * nx + light[1] * ny + light[2] * nz)
        const shade = .17 + .83 * Math.sqrt(glow)
        const offset = (row * diameter + column) * 4
        for (let channel = 0; channel < 3; channel++) pixels.data[offset + channel] = color[channel] * shade
        pixels.data[offset + 3] = Math.min(255, (1 - Math.sqrt(r2)) * diameter * 150)
      }
    }
    spriteContext.putImageData(pixels, 0, 0)
    ctx.drawImage(sprite, x - radius, y - radius, 2 * radius, 2 * radius)
  }

  function draw() {
    if (!current || !ctx) return
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    const dpi = Math.min(2, devicePixelRatio || 1)
    canvas.width = Math.round(width * dpi)
    canvas.height = Math.round(height * dpi)
    ctx.setTransform(dpi, 0, 0, dpi, 0, 0)

    const { state, site, index } = current
    const aroundSun = scene === 'sun'
    const sunPosition = aroundSun ? [0, 0, 0] : scale(state.sun, sunDrawingDistance / magnitude(state.sun))
    const earthPosition = aroundSun ? scale(state.sun, -1 / 149597871) : [0, 0, 0]
    const moonOffset = scale(state.moon, aroundSun ? .25 / earthMoonScale : 1 / earthMoonScale)
    const moonPosition = earthPosition.map((value, i) => value + moonOffset[i])
    const longitude = heading + yaw
    const right = [Math.cos(longitude), Math.sin(longitude), 0]
    const forward = [-Math.sin(longitude), Math.cos(longitude), 0]
    const up = [...scale(forward.slice(0, 2), -Math.sin(pitch)), Math.cos(pitch)]
    const toward = cross(right, up)
    const size = aroundSun
      ? Math.min((width - 62) / 2.6, (height - 55) / 2.4)
      : Math.min((width - 62) / 4.5, (height - 68) / (4.5 * Math.max(.46, Math.abs(Math.sin(pitch)))))
    const middle = [width / 2, height / 2]
    function project(vector) {
      return [middle[0] + dot(vector, right) * size, middle[1] - dot(vector, up) * size, dot(vector, toward)]
    }
    function line(points, color, dash = []) {
      ctx.beginPath()
      ctx.setLineDash(dash)
      ctx.strokeStyle = color
      points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
      ctx.stroke()
      ctx.setLineDash([])
    }
    const earth = project(earthPosition)
    const moon = project(moonPosition)
    const sun = project(sunPosition)
    if (controls.yearPath.checked) line(trail(index, aroundSun ? 'earth' : 'sun').map(project), aroundSun ? '#718bc2' : '#8e7248')
    if (controls.moonPath.checked) {
      const moonTrail = trail(index, 'moon')
      line(moonTrail.map(point => project(point.map((value, i) => earthPosition[i] + (aroundSun ? .25 : 1) * value))), '#8d8a9e')
    }
    if (controls.links.checked) {
      line([earth, sun], '#80643e', [4, 5])
      line([earth, moon], '#758bb4', [3, 4])
    }

    const moonRadius = aroundSun ? 8 : clamp(size * .19, 10, 19)
    const objects = [
      { point: sun, radius: clamp(size * .26, 15, 27), color: colors.sun, name: 'Sun' },
      { point: earth, radius: clamp(size * (aroundSun ? .12 : .26), 12, 24), color: colors.earth,
        name: 'Earth', light: unit(state.sun), surface: [139, 184, 251] },
      { point: moon, radius: moonRadius, color: colors.moon, name: 'Moon',
        light: unit(state.sun.map((component, i) => component - state.moon[i])), surface: [227, 225, 225] },
    ].sort((a, b) => a.point[2] - b.point[2])
    for (const { point: [x, y], radius, color, light, surface } of objects) {
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      if (light) {
        drawPhase(x, y, radius, [dot(light, right), dot(light, up), dot(light, toward)], surface, dpi)
      } else {
        const glow = ctx.createRadialGradient(x, y, radius * .25, x, y, radius)
        glow.addColorStop(0, '#fff2b8')
        glow.addColorStop(1, '#cd7735')
        ctx.fillStyle = glow
        ctx.fill()
      }
      ctx.strokeStyle = light ? color + '88' : color
      ctx.stroke()
    }
    if (!controls.yearPath.checked && !controls.moonPath.checked) return
    ctx.font = '600 13px DM Sans, sans-serif'
    ctx.textBaseline = 'middle'
    const labels = []
    for (const { point: [x, y], radius, color, name } of objects) {
      const textWidth = ctx.measureText(name).width
      let textX = clamp(x - textWidth / 2, 6, width - textWidth - 6)
      let textY = name === 'Moon' ? y + radius + 13 : y - radius - 13
      const collides = () => labels.some(label => Math.abs(textY - label.y) < 17 && textX < label.right + 7 && textX + textWidth > label.left - 7)
      if (textY > height - 12) textY = y - radius - 13
      if (textY < 12 || collides()) textY = y + radius + 13
      if (collides()) textX = clamp(x + radius + 9, 6, width - textWidth - 6)
      labels.push({ y: textY, left: textX, right: textX + textWidth })
      ctx.strokeStyle = '#0b1420'
      ctx.lineWidth = 3
      ctx.strokeText(name, textX, textY)
      ctx.fillStyle = color
      ctx.fillText(name, textX, textY)
      ctx.lineWidth = 1
    }
    const direction = siteDirection(site, state)
    const pin = [moon[0] + dot(direction, right) * moonRadius, moon[1] - dot(direction, up) * moonRadius]
    ctx.beginPath()
    ctx.arc(...pin, 3, 0, Math.PI * 2)
    const pinVisible = dot(direction, toward) > 0
    ctx.fillStyle = pinVisible ? colors.site : '#101e2c'
    ctx.strokeStyle = colors.site
    ctx.fill()
    ctx.stroke()
  }

  function turn(deltaYaw, deltaPitch) {
    yaw += deltaYaw
    pitch = clamp(pitch + deltaPitch, -Math.PI / 2, Math.PI / 2)
    draw()
  }
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId)
    drag = { x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('pointermove', event => {
    if (!drag) return
    turn((event.clientX - drag.x) * .01, (event.clientY - drag.y) * .01)
    drag = { x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('lostpointercapture', () => { drag = null })
  controls.left.addEventListener('click', () => turn(-.26, 0))
  controls.right.addEventListener('click', () => turn(.26, 0))
  controls.up.addEventListener('click', () => turn(0, .18))
  controls.down.addEventListener('click', () => turn(0, -.18))
  controls.reset.addEventListener('click', () => { yaw = 0; pitch = defaultPitch; draw() })
  for (const control of [controls.yearPath, controls.moonPath, controls.links]) control.addEventListener('change', draw)
  for (const button of [controls.earthView, controls.sunView]) {
    button.addEventListener('click', () => {
      scene = button.value
      controls.earthView.setAttribute('aria-pressed', String(scene === 'earth'))
      controls.sunView.setAttribute('aria-pressed', String(scene === 'sun'))
      controls.yearLabel.textContent = scene === 'earth' ? 'Sun’s annual path' : 'Earth’s orbit'
      controls.scale.textContent = scene === 'earth'
        ? 'The Sun follows its apparent annual path as seen from Earth. Sizes and the Sun’s distance are schematic.'
        : 'Earth’s path around the Sun is shown from the Sun. Body sizes and the Earth–Moon separation are enlarged.'
      draw()
    })
  }
  new ResizeObserver(draw).observe(canvas)

  return (index, site, yearRange = null) => {
    const state = systemAt(samples, index)
    heading ??= Math.atan2(state.sun[1], state.sun[0])
    current = { state, site, index, yearRange }
    draw()
    return {
      lunarKm: distanceLabel.format(magnitude(state.moon)),
      solarKm: distanceLabel.format(magnitude(state.sun)),
    }
  }
}
