const rad = Math.PI / 180
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
precision highp float;
uniform sampler2D lunarMap;
uniform vec2 viewport;
uniform float sphereRadius;
uniform vec3 east;
uniform vec3 north;
uniform vec3 front;
const float pi = 3.14159265359;
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
  float shading = 0.50 + 0.50 * max(0.0, dot(vec3(p, depth), normalize(vec3(-0.5, 0.7, 1.0))));
  gl_FragColor = vec4(reflectance * shading * 1.21, 1.0);
}
`

export function createGlobe(canvas, markerLayer, featureCanvas, onSelect, onPoint, onFeature) {
  const gl = canvas.getContext('webgl', { antialias: true, alpha: true })
  if (!gl) throw new Error('3D is unavailable in this browser. Use the polar map to select sites.')
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
  const uniforms = Object.fromEntries(['viewport', 'sphereRadius', 'east', 'north', 'front'].map(name => [name, gl.getUniformLocation(program, name)]))
  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  for (const parameter of [gl.TEXTURE_WRAP_S, gl.TEXTURE_WRAP_T]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.CLAMP_TO_EDGE)
  for (const parameter of [gl.TEXTURE_MIN_FILTER, gl.TEXTURE_MAG_FILTER]) gl.texParameteri(gl.TEXTURE_2D, parameter, gl.LINEAR)

  let latitude = -12
  let longitude = 17
  let zoom = 1
  let sites = []
  let labels = []
  let feature
  let featureHits = []
  let selected
  let drag
  const pointers = new Map()
  let ready = false
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
      for (const [name, direction] of Object.entries(orientation)) gl.uniform3fv(uniforms[name], direction)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    }
    for (const site of sites) {
      const [x, y, depth] = projectSite(site, orientation)
      const left = width / 2 + size * x
      const top = height / 2 - size * y
      const marker = markers.get(site.id)
      marker.hidden = depth <= 0 || left < 10 || left > width - 10 || top < 10 || top > height - 10
      marker.style.setProperty('--x', left + 'px')
      marker.style.setProperty('--y', top + 'px')
      marker.classList.toggle('selected', selected === site.id)
      marker.classList.toggle('secondary', selected !== site.id && zoom < 2.4)
      marker.classList.toggle('flip', left > width * .65)
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
    latitude = clamp(latitude + north, -89.9, 89.9)
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
    center(site) { latitude = clamp(site.lat, -89.9, 89.9); longitude = site.lon; draw() },
    reset() { latitude = -12; longitude = 17; zoom = 1; draw() },
    showFeatures(index, selectedFeature) {
      labels = index
      feature = selectedFeature
      featureCanvas.hidden = !labels.length && !feature
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
        marker.setAttribute('aria-label', site.displayName + ' on the Moon')
        marker.title = site.displayName
        marker.firstChild.textContent = site.displayName
      }
      draw()
    },
  }
}
