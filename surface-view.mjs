import { radius } from './planner.mjs'
import { loadTerrainSampler } from './terrain.mjs'

const radians = Math.PI / 180
const spokes = 180
const distance = [0, ...Array.from({ length: 184 }, (_, i) => (i + 1) * 1900), 350_000]
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const bearing = value => (value % 360 + 360) % 360
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0)

function direction(az, el) {
  const a = az * radians
  const e = el * radians
  return [Math.sin(a) * Math.cos(e), Math.sin(e), Math.cos(a) * Math.cos(e)]
}

export function surfaceCamera(azimuth, elevation) {
  const forward = direction(azimuth, elevation)
  const right = direction(azimuth + 90, 0)
  const up = direction(azimuth + 180, 90 - elevation)
  const projectVector = point => [dot(point, right), dot(point, up), dot(point, forward)]
  return { forward, right, up, azimuth, elevation, projectVector, project: (az, el) => projectVector(direction(az, el)) }
}

export function surfaceTarget(camera, az, el, angularRadius, width, height, scale) {
  const [x, y, z] = camera.project(az, el)
  const cx = width / 2 + x / z * scale
  const cy = height / 2 - y / z * scale
  const radius = scale * Math.tan(angularRadius) / Math.max(.1, z)
  const inView = z > 0 && cx >= 0 && cx <= width && cy >= 0 && cy <= height
  const turn = bearing(az - camera.azimuth + 180) - 180
  const edge = z <= 0 || Math.abs(x / width) >= Math.abs(y / height) ? (turn < 0 ? 'left' : 'right') : (y > 0 ? 'up' : 'down')
  return { x: cx, y: cy, radius, inView, edge }
}

export function terrainVertices(site, sample, ranges = distance) {
  const phi = site.lat * radians
  const lam = site.lon * radians
  const sinPhi = Math.sin(phi)
  const cosPhi = Math.cos(phi)
  const vertices = new Float32Array(ranges.length * spokes * 3)
  let index = 0
  for (const length of ranges) {
    const arc = length / radius
    const sinArc = Math.sin(arc)
    const cosArc = Math.cos(arc)
    for (let i = 0; i < spokes; i++) {
      const angle = (i / spokes) * 2 * Math.PI
      const sinAngle = Math.sin(angle)
      const cosAngle = Math.cos(angle)
      const latitude = Math.asin(clamp(sinPhi * cosArc + cosPhi * sinArc * cosAngle, -1, 1))
      const longitude = lam + Math.atan2(sinAngle * sinArc, cosPhi * cosArc - sinPhi * sinArc * cosAngle)
      const ground = length ? sample(latitude / radians, longitude / radians, length) : site.height
      const distanceFromAxis = (radius + ground) * sinArc
      vertices[index++] = distanceFromAxis * sinAngle
      vertices[index++] = (radius + ground) * cosArc - radius - site.height - 2
      vertices[index++] = distanceFromAxis * cosAngle
    }
  }
  return vertices
}

function indexTerrain(count) {
  const faces = []
  for (let base = 0; base < count - spokes; base += spokes) {
    for (let i = 0; i < spokes; i++) {
      const a = base + i
      const b = base + (i + 1) % spokes
      faces.push(a, b, a + spokes, b, b + spokes, a + spokes)
    }
  }
  return new Uint16Array(faces)
}

const vertex = `
attribute vec3 position;
uniform vec3 cameraRight, cameraUp, cameraForward;
uniform vec2 lens;
varying vec3 terrain;
void main() {
  terrain = position;
  float z = dot(position, cameraForward);
  gl_Position = vec4(dot(position, cameraRight) * lens.x, dot(position, cameraUp) * lens.y,
                     z * 1.000003 - 2.0, z);
}`
const fragment = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec3 sunDirection;
uniform float daylight;
varying vec3 terrain;
void main() {
  vec3 n = normalize(cross(dFdx(terrain), dFdy(terrain)));
  if (n.y < 0.0) n = -n;
  float lit = max(0.0, dot(n, sunDirection)) * daylight;
  float fade = exp(-length(terrain.xz) / 250000.0);
  float brightness = (0.18 + 0.36 * lit) * (0.62 + 0.38 * fade);
  gl_FragColor = vec4(vec3(0.94, 0.93, 0.99) * brightness, 1.0);
}`

export function createSurfaceView(canvas, overlay, showHeading) {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: true })
  const ctx = overlay.getContext('2d')
  if (!gl || !ctx || !gl.getExtension('OES_standard_derivatives')) throw new Error('3D terrain is unavailable in this browser. Use the skyline plot.')
  const program = gl.createProgram()
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
    const shader = gl.createShader(kind)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('The 3D terrain renderer could not start. Use the skyline plot.')
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The 3D terrain renderer could not start. Use the skyline plot.')
  const uniforms = Object.fromEntries(['cameraRight', 'cameraUp', 'cameraForward', 'lens', 'sunDirection', 'daylight']
    .map(name => [name, gl.getUniformLocation(program, name)]))
  const vertices = gl.createBuffer()
  const elements = gl.createBuffer()
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  const attribute = gl.getAttribLocation(program, 'position')
  gl.enableVertexAttribArray(attribute)
  gl.vertexAttribPointer(attribute, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements)
  gl.enable(gl.DEPTH_TEST)
  gl.clearColor(.02, .02, .03, 1)

  let sample
  let count = 0
  let azimuth = 0
  let elevation = 1
  let drag
  let paths

  function draw() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!sample || !count || !width || !height) return
    const pixel = Math.min(devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * pixel)
    const pixelHeight = Math.round(height * pixel)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = overlay.width = pixelWidth
      canvas.height = overlay.height = pixelHeight
    }
    const camera = surfaceCamera(azimuth, elevation)
    const scale = Math.min(width, height) * .83
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.uniform3fv(uniforms.cameraRight, camera.right)
    gl.uniform3fv(uniforms.cameraUp, camera.up)
    gl.uniform3fv(uniforms.cameraForward, camera.forward)
    gl.uniform2f(uniforms.lens, 2 * scale / width, 2 * scale / height)
    gl.uniform3fv(uniforms.sunDirection, direction(sample.sunAz, sample.sunEl))
    gl.uniform1f(uniforms.daylight, sample.eclipse ? 0 : 1)
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)

    ctx.setTransform(pixel, 0, 0, pixel, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.font = '700 13px DM Sans, sans-serif'
    ctx.textBaseline = 'middle'
    const colors = { sun: '#ffc975', earth: '#acc4ff' }
    function project(point) {
      const [x, y, depth] = camera.projectVector(point)
      if (depth <= .12) return null
      return [width / 2 + x / depth * scale, height / 2 - y / depth * scale]
    }
    if (paths) {
      ctx.setLineDash([4, 5])
      ctx.lineWidth = 1.3
      ctx.globalAlpha = .67
      for (const [body, points] of Object.entries(paths)) {
        ctx.beginPath()
        let connected = false
        for (const direction of points) {
          const position = project(direction)
          if (position) {
            if (connected) ctx.lineTo(...position)
            else ctx.moveTo(...position)
          }
          connected = Boolean(position)
        }
        ctx.strokeStyle = colors[body]
        ctx.stroke()
      }
      ctx.globalAlpha = 1
      ctx.setLineDash([])
    }
    const status = {}
    for (const [body, name, az, el, angle, visible] of [
      ['sun', 'Sun', sample.sunAz, sample.sunEl, sample.sunRadius, sample.sunEl > sample.sunHorizon && !sample.eclipse],
      ['earth', 'Earth', sample.earthAz, sample.earthEl, sample.earthRadius, sample.earthEl > sample.earthHorizon],
    ]) {
      const target = surfaceTarget(camera, az, el, angle, width, height, scale)
      status[body] = target
      if (!target.inView) continue
      const { x: cx, y: cy } = target
      const axis = direction(az, el)
      const horizontal = direction(az + 90, 0)
      const vertical = direction(az + 180, 90 - el)
      const sin = Math.sin(angle)
      const cos = Math.cos(angle)
      const color = colors[body]
      ctx.beginPath()
      for (let i = 0; i < 32; i++) {
        const roll = i * Math.PI / 16
        const position = project(axis.map((v, j) => cos * v + sin * (Math.cos(roll) * horizontal[j] + Math.sin(roll) * vertical[j])))
        if (!position) continue
        if (i) ctx.lineTo(...position)
        else ctx.moveTo(...position)
      }
      ctx.closePath()
      ctx.fillStyle = color
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      if (visible) ctx.fill()
      else ctx.stroke()
      const text = visible ? name : `${name} (${body === 'sun' && sample.eclipse ? 'eclipsed' : 'blocked'})`
      const labelX = clamp(cx + 11, 5, width - ctx.measureText(text).width - 8)
      const labelY = cy < 21 ? cy + 21 : cy - 13
      ctx.beginPath()
      ctx.moveTo(cx + 3, cy - 2)
      ctx.lineTo(labelX, labelY + 5)
      ctx.lineWidth = .8
      ctx.stroke()
      ctx.lineWidth = 3
      ctx.strokeStyle = '#09090e'
      ctx.strokeText(text, labelX, labelY)
      ctx.fillText(text, labelX, labelY)
    }
    showHeading(bearing(Math.round(azimuth)), status)
  }

  function aim(az, el) {
    azimuth = bearing(az)
    elevation = clamp(el, -89.9, 89.9)
    draw()
  }
  function turn(dx, dy) { aim(azimuth + dx, elevation + dy) }
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId)
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('pointermove', event => {
    if (drag?.pointer !== event.pointerId) return
    turn((drag.x - event.clientX) * .25, (event.clientY - drag.y) * .25)
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('lostpointercapture', () => { drag = null })
  new ResizeObserver(draw).observe(canvas)

  return { draw, turn, aim, update(value, track = null) { sample = value; paths = track; draw() }, setTerrain(mesh, initialAzimuth) {
    const indices = indexTerrain(mesh.length / 3)
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
    count = indices.length
    aim(initialAzimuth, 2)
  } }
}

export function surfacePaths(samples) {
  return Object.fromEntries(['sun', 'earth'].map(body => [body, samples.filter((_, i) => i % 4 === 0 || i === samples.length - 1)
    .map(item => direction(item[`${body}Az`], item[`${body}El`]))]))
}

export async function loadSurfaceMesh(site) {
  if (site.terrain === 'LOLA 80/240 m') {
    const response = await fetch(new URL(`./data/surface/${site.id}.bin`, import.meta.url))
    if (!response.ok) throw new Error('This site’s terrain mesh could not load. Try again or use the skyline plot.')
    const bytes = await response.arrayBuffer()
    const size = bytes.byteLength / (3 * Float32Array.BYTES_PER_ELEMENT)
    if (size < spokes * 2 || size % spokes || size > 65535) throw new Error('This site’s terrain mesh is incomplete.')
    return new Float32Array(bytes)
  }
  const sample = await loadTerrainSampler(site.lat, site.lon, true)
  return terrainVertices({ ...site, height: sample(site.lat, site.lon) }, sample)
}
