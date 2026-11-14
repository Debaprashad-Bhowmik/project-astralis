import { astronomicalUnit, earthRadius, radius, referencePanelPower, sunRadius } from './planner.mjs'
import { coverageLayers, coveragePalette, solarPowerPalette, solarPowerScaleMax, totalityPossible } from './coverage-map.mjs'
import { artemisSouthLatitude } from './mission-heat.mjs'
export { artemisSouthLatitude } from './mission-heat.mjs'

const rad = Math.PI / 180
export const southPoleView = { lat: -90, lon: 0 }
const clamp = (value, min, max) => Math.min(max, Math.max(min, value))
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2]
const position = (latitude, longitude) => {
  const phi = latitude * rad
  const lambda = longitude * rad
  return [Math.cos(phi) * Math.cos(lambda), Math.cos(phi) * Math.sin(lambda), Math.sin(phi)]
}

export function globeOrientation(latitude, longitude) {
  const phi = latitude * rad
  const lambda = longitude * rad
  return {
    front: position(latitude, longitude),
    east: [-Math.sin(lambda), Math.cos(lambda), 0],
    north: [-Math.sin(phi) * Math.cos(lambda), -Math.sin(phi) * Math.sin(lambda), Math.cos(phi)],
  }
}

export function projectSite(site, orientation) {
  const normal = position(site.lat, site.lon)
  return [dot(normal, orientation.east), dot(normal, orientation.north), dot(normal, orientation.front)]
}

export function pointOnGlobe(x, y, { east, north, front }) {
  const r2 = x * x + y * y
  if (r2 > 1) return null
  const depth = Math.sqrt(1 - r2)
  const [nx, ny, nz] = front.map((value, axis) => value * depth + east[axis] * x + north[axis] * y)
  return { lat: Math.asin(clamp(nz, -1, 1)) / rad, lon: Math.atan2(ny, nx) / rad }
}

const vertex = `
attribute vec2 point;
void main() { gl_Position = vec4(point, 0.0, 1.0); }
`
const fragment = `
#extension GL_OES_standard_derivatives : enable
precision highp float;
uniform sampler2D lunarMap;
uniform sampler2D polarRelief;
uniform sampler2D missionHeat;
uniform vec2 heatGrid;
uniform float polarExtent;
uniform float reliefMix;
uniform vec2 viewport;
uniform float sphereRadius;
uniform vec3 east;
uniform vec3 north;
uniform vec3 front;
uniform vec3 sun, earth;
uniform int layer;
uniform bool possibleEclipse;
const float pi = 3.14159265359;
vec3 coverageColor(vec3 normal) {
  vec3 toSun = sun - normal;
  vec3 toEarth = earth - normal;
  bool sunlight = dot(normal, toSun) > 0.0;
  bool earthView = dot(normal, toEarth) > 0.0;
  if (sunlight && earthView && possibleEclipse) {
    vec3 s = normalize(toSun);
    vec3 e = normalize(toEarth);
    float separation = atan(length(cross(s, e)), dot(s, e));
    sunlight = separation + asin(${(sunRadius / radius).toFixed(8)} / length(toSun)) > asin(${(earthRadius / radius).toFixed(8)} / length(toEarth));
  }
  if (layer == ${coverageLayers.power}) {
    float distanceAu = length(toSun) / ${(astronomicalUnit / radius).toFixed(8)};
    float incidence = sunlight ? dot(normal, normalize(toSun)) : 0.0;
    float power = ${referencePanelPower.toFixed(2)} * incidence / (distanceAu * distanceAu);
    float scaled = 2.0 * clamp(power / ${solarPowerScaleMax.toFixed(1)}, 0.0, 1.0);
    if (scaled < 1.0) return mix(${glslColor(solarPowerPalette[0])}, ${glslColor(solarPowerPalette[1])}, scaled);
    return mix(${glslColor(solarPowerPalette[1])}, ${glslColor(solarPowerPalette[2])}, scaled - 1.0);
  }
  if (layer == ${coverageLayers.sun}) earthView = false;
  if (layer == ${coverageLayers.earth}) sunlight = false;
  if (sunlight && earthView) return ${coverageInk(3)};
  if (sunlight && layer != ${coverageLayers.both}) return ${coverageInk(1)};
  if (earthView && layer != ${coverageLayers.both}) return ${coverageInk(2)};
  return ${coverageInk(0)};
}
void main() {
  vec2 p = (gl_FragCoord.xy - viewport / 2.0) / sphereRadius;
  float distanceSquared = dot(p, p);
  if (distanceSquared > 1.0) discard;
  float depth = sqrt(1.0 - distanceSquared);
  vec3 normal = p.x * east + p.y * north + depth * front;
  float longitude = atan(normal.y, normal.x);
  float latitude = asin(clamp(normal.z, -1.0, 1.0));
  vec2 uv = vec2(longitude / (2.0 * pi) + 0.5, 0.5 - latitude / pi);
  vec3 reflectance = texture2D(lunarMap, uv).rgb;
  if (reliefMix > 0.0 && normal.z < -.97) {
    float polarDistance = tan((latitude + pi * .5) * .5) / polarExtent;
    vec2 polarUv = vec2(.5) + polarDistance * vec2(sin(longitude), -cos(longitude));
    float edge = length(polarUv - .5);
    float strength = reliefMix * (1.0 - smoothstep(.37, .49, edge));
    vec3 relief = texture2D(polarRelief, polarUv).rgb;
    reflectance = mix(reflectance, relief, strength);
  }
  float shading = 0.50 + 0.50 * max(0.0, dot(vec3(p, depth), normalize(vec3(-0.5, 0.7, 1.0))));
  vec3 surface = reflectance * shading * 1.21;
  if (layer == ${coverageLayers.mission}) {
    if (latitude <= heatGrid.x) {
      float fraction = (heatGrid.x - latitude) / (heatGrid.x + pi * .5);
      float heatLat = (fraction * (heatGrid.y - 1.0) + .5) / heatGrid.y;
      vec4 heat = texture2D(missionHeat, vec2(uv.x, heatLat));
      // Interpolate toward the terrain across the edge of a colored cell.
      surface = surface * (1.0 - heat.a) + heat.rgb * (.81 + reflectance.r * .25);
    }
  } else if (layer > 0) {
    float shade = .56 + reflectance.r * (255.0 / 360.0);
    surface = coverageColor(normal) * shade;
  }
  float edge = abs(latitude - ${(artemisSouthLatitude * rad).toFixed(10)});
  float pixel = max(length(vec2(dFdx(latitude), dFdy(latitude))), .00002);
  float ring = 1.0 - smoothstep(.65 * pixel, 1.55 * pixel, edge);
  float outline = 1.0 - smoothstep(1.75 * pixel, 2.75 * pixel, edge);
  surface = mix(surface, vec3(.12,.065,.17), outline * .72);
  surface = mix(surface, vec3(.91,.69,1.0), ring);
  gl_FragColor = vec4(surface, 1.0);
}
`

function coverageInk(index) {
  return glslColor(coveragePalette[index])
}

function glslColor(color) {
  return 'vec3(' + color.map(value => (value / 255).toFixed(6)).join(',') + ')'
}

export function createGlobe(canvas, markerLayer, featureCanvas, poleMarker, polarExtent, onSelect, onPoint, onFeature) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
  if (!gl || !gl.getExtension('OES_standard_derivatives')) throw new Error('3D is unavailable in this browser. Use the polar map to select sites.')
  const program = gl.createProgram()
  for (const [source, kind] of [[vertex, gl.VERTEX_SHADER], [fragment, gl.FRAGMENT_SHADER]]) {
    const shader = gl.createShader(kind)
    gl.shaderSource(shader, source)
    gl.compileShader(shader)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error('3D rendering failed. Use the polar map to select sites.')
    gl.attachShader(program, shader)
  }
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('3D rendering failed. Use the polar map to select sites.')
  gl.useProgram(program)
  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const point = gl.getAttribLocation(program, 'point')
  gl.enableVertexAttribArray(point)
  gl.vertexAttribPointer(point, 2, gl.FLOAT, false, 0, 0)
  const uniforms = Object.fromEntries(['viewport', 'sphereRadius', 'east', 'north', 'front',
    'sun', 'earth', 'layer', 'possibleEclipse', 'lunarMap', 'polarRelief', 'missionHeat', 'heatGrid', 'polarExtent', 'reliefMix'].map(name => [name, gl.getUniformLocation(program, name)]))
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR)
  const reliefTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE1)
  gl.bindTexture(gl.TEXTURE_2D, reliefTexture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR)
  gl.activeTexture(gl.TEXTURE0)
  gl.uniform1i(uniforms.lunarMap, 0)
  gl.uniform1i(uniforms.polarRelief, 1)
  gl.uniform1i(uniforms.missionHeat, 2)
  const heatTexture = gl.createTexture()
  gl.activeTexture(gl.TEXTURE2)
  gl.bindTexture(gl.TEXTURE_2D, heatTexture)
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]))
  gl.activeTexture(gl.TEXTURE0)
  gl.uniform1f(uniforms.polarExtent, polarExtent / radius)

  let latitude = -12
  let longitude = 17
  let zoom = 1
  let sites = []
  let labels = []
  let feature
  let featureHits = []
  let overlayFrame
  let heatImage
  let heatNorthLatitude = 90
  let appliedScores
  let scoresDirty = false
  let overlayLayer = 'off'
  let selected
  let drag
  const pointers = new Map()
  let ready = false
  let reliefReady = false
  const markers = new Map()
  const featureContext = featureCanvas.getContext('2d')
  const globeImage = new Image()
  globeImage.onload = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, globeImage)
    ready = true
    draw()
  }
  globeImage.onerror = () => canvas.dispatchEvent(new Event('textureerror'))
  globeImage.src = new URL('./assets/moon-color.jpg', import.meta.url).href
  const detailImage = new Image()
  const polarImage = new Image()
  polarImage.onload = () => {
    gl.activeTexture(gl.TEXTURE1)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, polarImage)
    gl.activeTexture(gl.TEXTURE0)
    reliefReady = true
    draw()
  }
  polarImage.src = new URL('./data/polar-relief.webp', import.meta.url).href
  detailImage.onload = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, detailImage)
    ready = true
    draw()
  }
  if (gl.getParameter(gl.MAX_TEXTURE_SIZE) >= 4096) {
    globeImage.addEventListener('load', () => {
      detailImage.src = new URL('./assets/moon-color-4k.webp', import.meta.url).href
    }, { once: true })
  }

  function draw() {
    const { clientWidth: width, clientHeight: height } = canvas
    if (!width || !height) return
    const ratio = Math.min(devicePixelRatio || 1, 2)
    const size = Math.min(width, height) * .46 * zoom
    const orientation = globeOrientation(latitude, longitude)
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
      canvas.width = Math.round(width * ratio)
      canvas.height = Math.round(height * ratio)
    }
    if (ready) {
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.uniform2f(uniforms.viewport, canvas.width, canvas.height)
      gl.uniform1f(uniforms.sphereRadius, size * ratio)
      gl.uniform1f(uniforms.reliefMix, reliefReady ? clamp((zoom - 2) / 2, 0, 1) : 0)
      for (const [name, direction] of Object.entries(orientation)) gl.uniform3fv(uniforms[name], direction)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    const [poleX, poleY, poleDepth] = projectSite(southPoleView, orientation)
    const poleLeft = width / 2 + size * poleX
    const poleTop = height / 2 - size * poleY
    poleMarker.hidden = poleDepth <= .05 || poleLeft < 6 || poleLeft > width - 6 || poleTop < 6 || poleTop > height - 6
    poleMarker.style.left = poleLeft + 'px'
    poleMarker.style.top = poleTop + 'px'
    poleMarker.classList.toggle('pole-caption-left', poleLeft > width - 122)
    for (const site of sites) {
      const [x, y, depth] = projectSite(site, orientation)
      const left = width / 2 + size * x
      const top = height / 2 - size * y
      const marker = markers.get(site.id)
      marker.hidden = (overlayLayer === 'mission' && site.lat > heatNorthLatitude) || depth <= 0 || left < 10 || left > width - 10 || top < 10 || top > height - 10
      marker.style.setProperty('--x', left + 'px')
      marker.style.setProperty('--y', top + 'px')
      marker.classList.toggle('selected', selected === site.id)
      const nearPoleMarker = !poleMarker.hidden && top > poleTop - 18 && top < poleTop + 37 && Math.abs(left - poleLeft) < 55
      marker.classList.toggle('secondary', selected !== site.id && (zoom < 2.4 || nearPoleMarker))
      const label = marker.firstChild.textContent
      marker.classList.toggle('flip', left > width - Math.min(width * .62, label.length * 6.6 + 24))
      marker.setAttribute('aria-pressed', String(selected === site.id))
    }
    drawFeatures(width, height, size, ratio, orientation)
  }

  function drawFeatures(width, height, size, ratio, orientation) {
    featureHits = []
    if (featureCanvas.hidden || !featureContext) return
    featureCanvas.width = Math.round(width * ratio)
    featureCanvas.height = Math.round(height * ratio)
    const ctx = featureContext
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0)
    ctx.font = '600 11px DM Sans, sans-serif'
    ctx.textBaseline = 'middle'
    const occupied = []
    function label(item, chosen) {
      const [x, y, depth] = projectSite(item, orientation)
      if (depth < .12) return
      const left = width / 2 + size * x
      const top = height / 2 - size * y
      const textWidth = ctx.measureText(item.name).width
      const textX = left + textWidth + 14 < width ? left + 8 : left - textWidth - 8
      const edge = Math.min(left - 4, textX)
      const end = Math.max(left + 4, textX + textWidth)
      if (edge < 4 || end > width - 4 || top < 10 || top > height - 10) return
      if (occupied.some(box => Math.abs(box.top - top) < 18 && box.left < end + 8 && box.right > edge - 8)) return
      occupied.push({ top, left: edge, right: end })
      featureHits.push({ feature: item, top, left: edge, right: end })
      ctx.fillStyle = chosen ? '#dfaaff' : '#f3f1f7'
      ctx.strokeStyle = '#171321'
      ctx.lineWidth = 3
      ctx.strokeText(item.name, textX, top)
      ctx.fillText(item.name, textX, top)
      ctx.beginPath()
      ctx.arc(left, top, chosen ? 3.5 : 2, 0, Math.PI * 2)
      ctx.stroke()
      ctx.fill()
    }
    if (feature) label(feature, true)
    const minimumDiameter = 320 / zoom ** 1.8
    for (const item of labels) {
      if (item.diameter < minimumDiameter || occupied.length >= 27) break
      if (item.id !== feature?.id) label(item, false)
    }
  }

  function rotate(north, east) {
    latitude = clamp(latitude + north, -90, 90)
    longitude = (longitude + east) % 360
    draw()
  }
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    canvas.setPointerCapture(event.pointerId)
    pointers.set(event.pointerId, [event.clientX, event.clientY])
    if (pointers.size === 1) drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, travel: 0 }
    else drag = null
  })
  canvas.addEventListener('pointermove', event => {
    const previous = pointers.get(event.pointerId)
    if (!previous) return
    pointers.set(event.pointerId, [event.clientX, event.clientY])
    if (pointers.size === 2) {
      const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1]
      const before = Math.hypot(previous[0] - other[0], previous[1] - other[1])
      const after = Math.hypot(event.clientX - other[0], event.clientY - other[1])
      if (before > 1) changeZoom(after / before)
      return
    }
    if (drag?.pointer !== event.pointerId) return
    const distance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y)
    if (drag.travel === 0 && distance < 5) return
    rotate((event.clientY - drag.y) * .33 / zoom, (drag.x - event.clientX) * .42 / zoom)
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY, travel: drag.travel + distance }
  })
  canvas.addEventListener('pointerup', event => {
    pointers.delete(event.pointerId)
    if (drag?.pointer !== event.pointerId) return
    if (ready && !drag.travel) {
      const bounds = canvas.getBoundingClientRect()
      const size = Math.min(bounds.width, bounds.height) * .46 * zoom
      const clientX = event.clientX - bounds.left
      const clientY = event.clientY - bounds.top
      const label = featureHits.find(hit => Math.abs(hit.top - clientY) < 8 && clientX >= hit.left && clientX <= hit.right)
      if (label) {
        onFeature(label.feature)
        drag = null
        return
      }
      const x = (clientX - bounds.width / 2) / size
      const y = (bounds.height / 2 - clientY) / size
      const point = pointOnGlobe(x, y, globeOrientation(latitude, longitude))
      if (point) onPoint(point)
    }
    drag = null
  })
  canvas.addEventListener('lostpointercapture', event => {
    pointers.delete(event.pointerId)
    if (drag?.pointer === event.pointerId) drag = null
  })
  function changeZoom(factor) { zoom = clamp(zoom * factor, .7, 12); draw() }
  canvas.addEventListener('wheel', event => {
    if (!event.ctrlKey) return
    event.preventDefault()
    changeZoom(Math.exp(-event.deltaY * .007))
  }, { passive: false })
  new ResizeObserver(draw).observe(canvas)

  return {
    draw, rotate,
    zoom: changeZoom,
    center(site) { latitude = clamp(site.lat, -90, 90); longitude = site.lon; draw() },
    southPole() { latitude = southPoleView.lat; longitude = southPoleView.lon; zoom = 7.6; draw() },
    setCoverage(frame, layer = 'off') {
      if (overlayFrame === frame && overlayLayer === layer) return
      overlayFrame = frame
      overlayLayer = layer
      gl.uniform1i(uniforms.layer, frame ? coverageLayers[layer] : 0)
      if (frame) {
        const [sun, earth] = frame
        gl.uniform3fv(uniforms.sun, sun.map(value => value / radius))
        gl.uniform3fv(uniforms.earth, earth.map(value => value / radius))
        gl.uniform1i(uniforms.possibleEclipse, Number(totalityPossible(sun, earth)))
      }
      draw()
    },
    setMissionHeat(image, northLatitude) {
      if (overlayLayer === 'mission' && heatImage === image) return
      if (heatImage !== image) {
        gl.activeTexture(gl.TEXTURE2)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image)
        gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
        gl.activeTexture(gl.TEXTURE0)
        heatImage = image
      }
      heatNorthLatitude = northLatitude
      gl.uniform2f(uniforms.heatGrid, northLatitude * rad, image.height)
      overlayLayer = 'mission'
      gl.uniform1i(uniforms.layer, coverageLayers.mission)
      draw()
    },
    reset() { latitude = -12; longitude = 17; zoom = 1; draw() },
    showFeatures(index, selectedFeature) {
      labels = index
      feature = selectedFeature
      featureCanvas.hidden = !labels.length && !feature
      draw()
    },
    setSiteScores(scores) {
      if (scores === appliedScores && !scoresDirty) return
      appliedScores = scores
      scoresDirty = false
      for (const [id, marker] of markers) {
        const score = scores?.get(id)
        marker.classList.toggle('mission-pin', Boolean(score))
        marker.classList.toggle('mission-zero', Boolean(score?.nearZero))
        marker.style.setProperty('--mission-color', score?.color ?? '')
        marker.setAttribute('aria-label', score ? marker.title + ' on the Moon · ' + score.label : marker.title + ' on the Moon')
        marker.firstChild.textContent = score ? marker.title + ' · ' + score.number : marker.title
      }
      draw()
    },
    setSites(newSites, active) {
      sites = newSites
      selected = active
      const ids = new Set(sites.map(site => site.id))
      for (const [id, marker] of markers) {
        if (!ids.has(id)) { marker.remove(); markers.delete(id) }
      }
      for (const site of sites) {
        if (!markers.has(site.id)) {
          const marker = document.createElement('button')
          marker.type = 'button'
          marker.className = 'pin globe-pin' + (site.kind.includes('Historic') ? '' : ' feature')
          const label = document.createElement('span')
          label.className = 'pin-text'
          marker.append(label)
          marker.addEventListener('click', () => onSelect(site.id))
          markers.set(site.id, marker)
          markerLayer.append(marker)
        }
        const marker = markers.get(site.id)
        if (marker.title !== site.displayName) {
          marker.setAttribute('aria-label', site.displayName + ' on the Moon')
          marker.title = site.displayName
          marker.firstChild.textContent = site.displayName
        }
      }
      scoresDirty = true
      draw()
    },
  }
}
