import { observer, radius } from './planner.mjs'
import { loadTerrainSampler } from './terrain.mjs'

const radians = Math.PI / 180
const spokes = 180
const distance = [0, ...Array.from({ length: 184 }, (_, i) => (i + 1) * 1900), 350_000]
const clamp = (value, low, high) => Math.max(low, Math.min(high, value))
const bearing = value => (value % 360 + 360) % 360
const dot = (a, b) => a.reduce((sum, value, i) => sum + value * b[i], 0)
// Pixel bounds of Earth's limb in NASA's 540 × 540 Apollo 17 JPG.
const earthPhotoCrop = [15, 15, 508, 508]
const regolithSize = 256

// An unlit material with periodic relief. Elevation and reflectance at map scale come from NASA.
function regolithMaterial() {
  const size = regolithSize
  const relief = new Float32Array(size * size)
  const tone = new Float32Array(relief.length)
  const texels = new Uint8Array(relief.length * 4)
  let seed = 4073
  const random = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0
    return seed / 4294967296
  }
  const index = (x, y) => (y & (size - 1)) * size + (x & (size - 1))
  for (let k = 0; k < relief.length; k++) {
    relief[k] = random() * .12
    tone[k] = .41 + random() * .22
  }
  for (let stone = 0; stone < 1250; stone++) {
    const cx = Math.floor(random() * size)
    const cy = Math.floor(random() * size)
    const extent = 1.3 + random() ** 4 * 12
    const flatten = .5 + random() * .5
    const angle = random() * Math.PI * 2
    const tint = .36 + random() * .42
    const span = Math.ceil(extent)
    for (let y = -span; y <= span; y++) {
      for (let x = -span; x <= span; x++) {
        const across = (x * Math.cos(angle) + y * Math.sin(angle)) / extent
        const along = (-x * Math.sin(angle) + y * Math.cos(angle)) / (extent * flatten)
        const edge = Math.max(Math.abs(across), Math.abs(along * .65 + across * .35), Math.abs(along * .7 - across * .3))
        if (edge >= 1) continue
        const k = index(cx + x, cy + y)
        const height = Math.min(.85, (1 - edge) * extent * .16)
        if (height > relief[k]) {
          relief[k] = height
          tone[k] = tint
        }
      }
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = index(x, y)
      texels[k * 4] = Math.round(tone[k] * 255)
      texels[k * 4 + 1] = Math.round(clamp(.5 + relief[index(x - 1, y)] - relief[index(x + 1, y)], 0, 1) * 255)
      texels[k * 4 + 2] = Math.round(clamp(.5 + relief[index(x, y - 1)] - relief[index(x, y + 1)], 0, 1) * 255)
      texels[k * 4 + 3] = 255
    }
  }
  return texels
}

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

export function solarShadowFrame(azimuth, elevation) {
  const camera = surfaceCamera(azimuth, elevation)
  return { right: camera.right, up: camera.up, depth: camera.forward.map(value => -value) }
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

function terrainNormals(mesh) {
  const normals = new Float32Array(mesh.length)
  const rings = mesh.length / (3 * spokes)
  for (let ring = 1; ring < rings; ring++) {
    for (let spoke = 0; spoke < spokes; spoke++) {
      const index = (ring * spokes + spoke) * 3
      const inner = index - spokes * 3
      const outer = ring === rings - 1 ? index : index + spokes * 3
      const left = (ring * spokes + (spoke + spokes - 1) % spokes) * 3
      const right = (ring * spokes + (spoke + 1) % spokes) * 3
      const x = mesh[outer] - mesh[inner]
      const y = mesh[outer + 1] - mesh[inner + 1]
      const z = mesh[outer + 2] - mesh[inner + 2]
      const dx = mesh[right] - mesh[left]
      const dy = mesh[right + 1] - mesh[left + 1]
      const dz = mesh[right + 2] - mesh[left + 2]
      const normal = [y * dz - z * dy, z * dx - x * dz, x * dy - y * dx]
      const length = Math.hypot(...normal)
      normals.set(length ? normal.map(component => component / length) : [0, 1, 0], index)
    }
  }
  const center = [0, 0, 0]
  for (let spoke = 0; spoke < spokes; spoke++) {
    const index = (spokes + spoke) * 3
    for (let axis = 0; axis < 3; axis++) center[axis] += normals[index + axis]
  }
  const length = Math.hypot(...center)
  const siteNormal = length ? center.map(component => component / length) : [0, 1, 0]
  for (let spoke = 0; spoke < spokes; spoke++) normals.set(siteNormal, spoke * 3)
  return normals
}

const vertex = `
attribute vec3 position, normal;
uniform vec3 cameraRight, cameraUp, cameraForward;
uniform vec2 lens;
varying vec3 terrain;
varying vec3 groundNormal;
void main() {
  terrain = position;
  groundNormal = normal;
  float z = dot(position, cameraForward);
  gl_Position = vec4(dot(position, cameraRight) * lens.x, dot(position, cameraUp) * lens.y,
                     z * 1.000003 - 2.0, z);
}`
const fragment = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform vec3 sunDirection;
uniform float daylight;
uniform vec3 siteEast, siteNorth, siteUp;
uniform float siteRadius;
uniform vec3 shadowRight, shadowUp, shadowDepth, shadowExtent;
uniform sampler2D albedoMap, shadowMap, regolithMap;
uniform float shadowPixel;
varying vec3 terrain;
varying vec3 groundNormal;
const float pi = 3.14159265359;
float hash(vec2 cell) {
  return fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
}
float grain(vec2 p) {
  vec2 cell = floor(p);
  vec2 f = fract(p);
  f = f*f*(3.0-2.0*f);
  return mix(mix(hash(cell), hash(cell + vec2(1,0)), f.x),
    mix(hash(cell + vec2(0,1)), hash(cell + 1.0), f.x), f.y);
}
float shadow() {
  if (shadowPixel <= 0.0) return 1.0;
  vec3 position = vec3(dot(terrain, shadowRight), dot(terrain, shadowUp), dot(terrain, shadowDepth)) / shadowExtent;
  vec3 uv = position * .5 + .5;
  if (any(lessThan(uv, vec3(0))) || any(greaterThan(uv, vec3(1)))) return 1.0;
  float depth = uv.z - 40.0 / (2.0 * shadowExtent.z);
  vec2 texel = uv.xy / shadowPixel - .5;
  vec2 fraction = fract(texel);
  vec2 center = (floor(texel) + .5) * shadowPixel;
  float sum = 0.0;
  for (int x = -1; x <= 2; x++) {
    for (int y = -1; y <= 2; y++) {
      vec2 offset = vec2(float(x),float(y));
      vec3 pixel = texture2D(shadowMap, center + offset * shadowPixel).rgb;
      float occluder = dot(pixel, vec3(1.0, 1.0/255.0, 1.0/65025.0));
      vec2 weight = min(vec2(1.0), 2.0 - abs(offset - fraction));
      sum += step(depth, occluder) * weight.x * weight.y;
    }
  }
  return sum / 9.0;
}
void main() {
  vec3 n = normalize(groundNormal);
  vec3 point = normalize(siteUp * (siteRadius + terrain.y) + siteEast * terrain.x + siteNorth * terrain.z);
  vec2 uv = vec2(atan(point.y, point.x) / (2.0*pi) + .5, .5 - asin(clamp(point.z,-1.0,1.0)) / pi);
  float reflectance = dot(texture2D(albedoMap, uv).rgb, vec3(.299,.587,.114));
  vec2 local = terrain.xz;
  vec3 grit = texture2D(regolithMap, local / 4.0).rgb;
  vec3 fragments = texture2D(regolithMap, local / 28.0 + vec2(.29,.53)).rgb;
  float footprint = max(length(dFdx(local)),length(dFdy(local)));
  float patches = (grain(local*.009)-.5) * (1.0-smoothstep(30.0,115.0,footprint));
  vec2 relief = (grit.gb - .5) * .52 + (fragments.gb - .5) * .85;
  vec3 textured = normalize(n + vec3(relief.x,0,relief.y));
  float lit = 0.0;
  if (daylight > 0.0) lit = max(0.0, dot(textured, sunDirection)) * shadow();
  float material = 1.0 + (grit.r - .51) * .63 + (fragments.r - .51) * .75 + patches * .26;
  float albedo = (.20 + reflectance*.83) * material;
  // Display exposure and a faint fill preserve shape in modeled shadow.
  vec3 shade = vec3(.056,.064,.077) + vec3(1.04,1.0,.935) * (1.28 * sqrt(lit));
  vec3 exposed = albedo * shade;
  gl_FragColor = vec4(exposed / (1.0 + exposed * .38), 1.0);
}`

const shadowVertex = `
attribute vec3 position;
uniform vec3 shadowRight, shadowUp, shadowDepth, shadowExtent;
void main() {
  gl_Position = vec4(vec3(dot(position,shadowRight),dot(position,shadowUp),dot(position,shadowDepth)) / shadowExtent, 1.0);
}`
const shadowFragment = `
precision highp float;
void main() {
  vec3 depth = fract(gl_FragCoord.z * vec3(1.0, 255.0, 65025.0));
  depth.xy -= depth.yz / 255.0;
  gl_FragColor = vec4(depth, 1.0);
}`

function terrainProgram(gl, vertexSource, fragmentSource) {
  const program = gl.createProgram()
  for (const [kind, source] of [[gl.VERTEX_SHADER, vertexSource], [gl.FRAGMENT_SHADER, fragmentSource]]) {
    const shader = gl.createShader(kind)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('The 3D terrain renderer could not start. Use the skyline plot.')
    gl.attachShader(program, shader)
  }
  gl.bindAttribLocation(program, 0, 'position')
  gl.bindAttribLocation(program, 1, 'normal')
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('The 3D terrain renderer could not start. Use the skyline plot.')
  return program
}

export function createSurfaceView(canvas, skyCanvas, overlay, showHeading) {
  const gl = canvas.getContext('webgl', { alpha: true, antialias: true })
  const sky = skyCanvas.getContext('2d')
  const ctx = overlay.getContext('2d')
  if (!gl || !sky || !ctx || !gl.getExtension('OES_standard_derivatives')) throw new Error('3D terrain is unavailable in this browser. Use the skyline plot.')
  const program = terrainProgram(gl, vertex, fragment)
  const shadowProgram = terrainProgram(gl, shadowVertex, shadowFragment)
  const shadowNames = ['shadowRight', 'shadowUp', 'shadowDepth', 'shadowExtent']
  const locations = (owner, names) => Object.fromEntries(names.map(name => [name, gl.getUniformLocation(owner, name)]))
  const uniforms = locations(program, ['cameraRight', 'cameraUp', 'cameraForward', 'lens', 'sunDirection', 'daylight',
    'siteEast', 'siteNorth', 'siteUp', 'siteRadius', 'albedoMap', 'shadowMap', 'regolithMap', 'shadowPixel', ...shadowNames])
  const shadowUniforms = locations(shadowProgram, shadowNames)
  const vertices = gl.createBuffer()
  const normals = gl.createBuffer()
  const elements = gl.createBuffer()
  gl.useProgram(program)
  gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ARRAY_BUFFER, normals)
  gl.enableVertexAttribArray(1)
  gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0)
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements)
  gl.enable(gl.DEPTH_TEST)
  const albedo = gl.createTexture()
  gl.activeTexture(gl.TEXTURE0)
  gl.bindTexture(gl.TEXTURE_2D, albedo)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([122, 122, 122, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  const shadowSize = Math.min(2048, gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE))
  const shadowTarget = gl.createFramebuffer()
  gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarget)
  const shadowMap = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, shadowMap)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, shadowSize, shadowSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, null)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, shadowMap, 0)
  const shadowBuffer = gl.createRenderbuffer()
  gl.bindRenderbuffer(gl.RENDERBUFFER, shadowBuffer)
  gl.renderbufferStorage(gl.RENDERBUFFER, gl.DEPTH_COMPONENT16, shadowSize, shadowSize)
  gl.framebufferRenderbuffer(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.RENDERBUFFER, shadowBuffer)
  const hasShadows = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  const regolith = gl.createTexture()
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, regolith)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, regolithSize, regolithSize, 0, gl.RGBA, gl.UNSIGNED_BYTE, regolithMaterial())
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  const anisotropy = gl.getExtension('EXT_texture_filter_anisotropic')
  if (anisotropy) gl.texParameterf(gl.TEXTURE_2D, anisotropy.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, gl.getParameter(anisotropy.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))
  gl.uniform1i(uniforms.albedoMap, 0)
  gl.uniform1i(uniforms.shadowMap, 1)
  gl.uniform1i(uniforms.regolithMap, 2)
  gl.uniform1f(uniforms.shadowPixel, hasShadows ? 1 / shadowSize : 0)

  let sample
  let count = 0
  let azimuth = 0
  let elevation = 1
  let zoom = 1
  let drag
  let paths
  let shadowSample
  const earthPhoto = new Image()
  earthPhoto.addEventListener('load', draw)
  earthPhoto.src = new URL('./assets/earth-blue-marble.jpg', import.meta.url).href
  const moonPhoto = new Image()
  moonPhoto.addEventListener('load', () => {
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, albedo)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, moonPhoto)
    if (moonPhoto.naturalWidth === 4096) {
      gl.generateMipmap(gl.TEXTURE_2D)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
    }
    draw()
  })
  moonPhoto.src = new URL(gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096 ? './assets/moon-color-4k.webp' : './assets/moon-color.jpg', import.meta.url).href

  function drawShadows() {
    if (!hasShadows || shadowSample === sample || sample.eclipse) return
    shadowSample = sample
    const frame = solarShadowFrame(sample.sunAz, sample.sunEl)
    const width = 390_000
    const height = 40_000 + width * Math.abs(Math.sin(sample.sunEl * radians))
    for (const [owner, bindings] of [[shadowProgram, shadowUniforms], [program, uniforms]]) {
      gl.useProgram(owner)
      gl.uniform3fv(bindings.shadowRight, frame.right)
      gl.uniform3fv(bindings.shadowUp, frame.up)
      gl.uniform3fv(bindings.shadowDepth, frame.depth)
      gl.uniform3f(bindings.shadowExtent, width, height, width)
    }
    gl.useProgram(shadowProgram)
    gl.bindFramebuffer(gl.FRAMEBUFFER, shadowTarget)
    gl.viewport(0, 0, shadowSize, shadowSize)
    gl.clearColor(1, 1, 1, 1)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  }

  function draw() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!sample || !count || !width || !height) return
    const pixel = Math.min(devicePixelRatio || 1, 2)
    const pixelWidth = Math.round(width * pixel)
    const pixelHeight = Math.round(height * pixel)
    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = skyCanvas.width = overlay.width = pixelWidth
      canvas.height = skyCanvas.height = overlay.height = pixelHeight
    }
    const camera = surfaceCamera(azimuth, elevation)
    const scale = Math.min(width, height) * .83 * zoom
    drawShadows()
    gl.useProgram(program)
    gl.viewport(0, 0, canvas.width, canvas.height)
    gl.clearColor(0, 0, 0, 0)
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)
    gl.uniform3fv(uniforms.cameraRight, camera.right)
    gl.uniform3fv(uniforms.cameraUp, camera.up)
    gl.uniform3fv(uniforms.cameraForward, camera.forward)
    gl.uniform2f(uniforms.lens, 2 * scale / width, 2 * scale / height)
    gl.uniform3fv(uniforms.sunDirection, direction(sample.sunAz, sample.sunEl))
    gl.uniform1f(uniforms.daylight, sample.eclipse ? 0 : 1)
    gl.drawElements(gl.TRIANGLES, count, gl.UNSIGNED_SHORT, 0)

    sky.setTransform(pixel, 0, 0, pixel, 0, 0)
    sky.clearRect(0, 0, width, height)
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
    for (const [body, name, az, el, angle, horizon, eclipsed] of [
      ['sun', 'Sun', sample.sunAz, sample.sunEl, sample.sunRadius, sample.sunHorizon, sample.eclipse],
      ['earth', 'Earth', sample.earthAz, sample.earthEl, sample.earthRadius, sample.earthHorizon, false],
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
      const visible = el > horizon && !eclipsed
      const vectors = Array.from({ length: 32 }, (_, i) => {
        const roll = i * Math.PI / 16
        return axis.map((v, j) => cos * v + sin * (Math.cos(roll) * horizontal[j] + Math.sin(roll) * vertical[j]))
      })
      const limb = vectors.map(project).filter(Boolean)
      function traceDisk(targetContext, points) {
        targetContext.beginPath()
        targetContext.moveTo(...points[0])
        for (const point of points.slice(1)) targetContext.lineTo(...point)
        targetContext.closePath()
      }
      if (!limb.length) continue
      let exposed = limb
      if (Math.abs(el - horizon) < angle / radians) {
        const cutoff = Math.sin(horizon * radians)
        exposed = vectors.flatMap((from, i) => {
          const to = vectors[(i + 1) % vectors.length]
          const above = from[1] >= cutoff
          const points = above ? [from] : []
          if (above !== (to[1] >= cutoff)) {
            const fraction = (cutoff - from[1]) / (to[1] - from[1])
            points.push(from.map((v, j) => v + (to[j] - v) * fraction))
          }
          return points
        }).map(project).filter(Boolean)
      }
      if (!eclipsed && exposed.length && el + angle / radians > horizon) {
        if (body === 'sun') {
          if (visible) {
            const reach = clamp(target.radius * 16, 22, 76)
            const bloom = sky.createRadialGradient(cx, cy, target.radius * .5, cx, cy, reach)
            bloom.addColorStop(0, 'rgba(255,238,203,.66)')
            bloom.addColorStop(.15, 'rgba(247,212,165,.24)')
            bloom.addColorStop(.44, 'rgba(233,183,135,.068)')
            bloom.addColorStop(1, 'rgba(232,171,112,0)')
            sky.fillStyle = bloom
            sky.fillRect(cx - reach, cy - reach, reach * 2, reach * 2)
          }
          traceDisk(sky, exposed)
          sky.fillStyle = '#fff9e9'
          sky.fill()
        } else if (earthPhoto.naturalWidth) {
          const xs = limb.map(([x]) => x)
          const ys = limb.map(([, y]) => y)
          const left = Math.min(...xs)
          const top = Math.min(...ys)
          sky.save()
          traceDisk(sky, exposed)
          sky.clip()
          sky.drawImage(earthPhoto, ...earthPhotoCrop, left, top, Math.max(...xs) - left, Math.max(...ys) - top)
          sky.restore()
        } else {
          traceDisk(sky, exposed)
          sky.fillStyle = color
          sky.fill()
        }
      }
      if (!paths) continue
      ctx.strokeStyle = color
      ctx.lineWidth = 1
      if (!visible) {
        traceDisk(ctx, limb)
        ctx.stroke()
      }
      ctx.fillStyle = color
      const text = visible ? name : `${name} (${eclipsed ? 'eclipsed' : 'blocked'})`
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

  return { draw, turn, aim, setZoom(value) { zoom = value; draw() }, update(value, track = null) { sample = value; paths = track; draw() }, setTerrain(mesh, site, initialAzimuth) {
    const indices = indexTerrain(mesh.length / 3)
    gl.bindBuffer(gl.ARRAY_BUFFER, vertices)
    gl.bufferData(gl.ARRAY_BUFFER, mesh, gl.STATIC_DRAW)
    gl.bindBuffer(gl.ARRAY_BUFFER, normals)
    gl.bufferData(gl.ARRAY_BUFFER, terrainNormals(mesh), gl.STATIC_DRAW)
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, indices, gl.STATIC_DRAW)
    count = indices.length
    const siteFrame = observer(site.lat, site.lon, 0)
    gl.useProgram(program)
    gl.uniform3fv(uniforms.siteEast, siteFrame.east)
    gl.uniform3fv(uniforms.siteNorth, siteFrame.north)
    gl.uniform3fv(uniforms.siteUp, siteFrame.up)
    gl.uniform1f(uniforms.siteRadius, radius + site.height + 2)
    sample = null
    shadowSample = null
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
