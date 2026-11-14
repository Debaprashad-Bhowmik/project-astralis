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

export function createGlobe(canvas, markerLayer, onSelect) {
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

  let latitude = -89.9
  let longitude = 16
  let zoom = 1.32
  let sites = []
  let selected
  let drag
  let ready = false
  const markers = new Map()
  const globeImage = new Image()
  globeImage.onload = () => {
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, globeImage)
    ready = true
    draw()
  }
  globeImage.onerror = () => canvas.dispatchEvent(new Event('textureerror'))
  globeImage.src = new URL('./assets/moon-color.jpg', import.meta.url).href

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
      marker.classList.toggle('secondary', selected !== site.id)
      marker.classList.toggle('flip', left > width * .65)
      marker.setAttribute('aria-pressed', String(selected === site.id))
    }
  }

  function rotate(north, east) {
    latitude = clamp(latitude + north, -89.9, 89.9)
    longitude = (longitude + east) % 360
    draw()
  }
  canvas.addEventListener('pointerdown', event => {
    canvas.setPointerCapture(event.pointerId)
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('pointermove', event => {
    if (drag?.pointer !== event.pointerId) return
    rotate((event.clientY - drag.y) * .33 / zoom, (drag.x - event.clientX) * .42 / zoom)
    drag = { pointer: event.pointerId, x: event.clientX, y: event.clientY }
  })
  canvas.addEventListener('lostpointercapture', () => { drag = null })
  new ResizeObserver(draw).observe(canvas)

  return {
    draw, rotate,
    zoom(factor) { zoom = clamp(zoom * factor, .7, 7); draw() },
    center(site) { latitude = clamp(site.lat, -89.9, 89.9); longitude = site.lon; draw() },
    reset() { latitude = -89.9; longitude = 16; zoom = 1.32; draw() },
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
          marker.className = 'pin globe-pin'
          const label = document.createElement('span')
          label.className = 'pin-text'
          marker.append(label)
          marker.addEventListener('click', () => onSelect(site.id))
          markers.set(site.id, marker)
          markerLayer.append(marker)
        }
        const marker = markers.get(site.id)
        marker.setAttribute('aria-label', site.displayName + ' on the Moon')
        marker.firstChild.textContent = site.displayName
      }
      draw()
    },
  }
}
