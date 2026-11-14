import { binaryFrames, evaluate, frameAt, radius, rank } from './planner.mjs'
import { createGlobe } from './globe.mjs'
import { createSpaceView, readSpaceSamples, spaceStep } from './space-view.mjs'

const get = id => document.getElementById(id)
const inputs = (...ids) => ids.map(get)
const hour = 3_600_000
const day = 24 * hour
const utc = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const dateLabel = epoch => utc.format(new Date(epoch)) + ' UTC'
const controlDate = epoch => new Date(epoch).toISOString().slice(0, 16)
const formatHours = hours => (hours < .05 && hours > 1e-8 ? '<0.1' : Number(hours.toFixed(1))) + ' h'
const presets = { sun: [100, 0, 0], earth: [0, 100, 0], overlap: [0, 0, 100], balanced: [40, 40, 20] }
const weightInputs = inputs('sun-weight', 'earth-weight', 'overlap-weight')
const metricNames = { sun: 'Sunlight', earth: 'Earth in view', overlap: 'Both together' }
const siteName = site => site.id === 'athena' ? 'Mons Mouton' : site.id === 'odysseus' ? 'Malapert A' : site.id === 'mouton' ? 'Mons Mouton Plateau' : site.name
const siteDetail = site => ['odysseus', 'athena'].includes(site.id) ? site.name + ' · Historic landing site' : site.kind
const coordinate = (value, plus, minus) => Math.abs(value).toFixed(2) + '°' + (value < 0 ? minus : plus)
const element = (tag, className, value) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined) node.textContent = value
  return node
}

let catalog
let ephemeris
let custom
let horizonBeforeCustom
let ranked = []
let active
let selected
let elapsed = 0
let settings
let playing = null
let comparisonEdited = false
let globe
let updateSpace
let inspectedSite = false

function error(id, message = '') {
  get(id).textContent = message
  get(id).hidden = !message
}

function currentSettings() {
  const start = Date.parse(get('landing-date').value + 'T' + get('landing-time').value + 'Z')
  const duration = Number(get('duration').value)
  const [sun, earth, overlap] = weightInputs.map(input => Number(input.value))
  const weightSum = sun + earth + overlap
  weightInputs.forEach(input => {
    document.querySelector('output[for="' + input.id + '"]').value = weightSum ? Math.round(Number(input.value) / weightSum * 100) + '%' : '0%'
  })
  if (!Number.isFinite(start) || !get('landing-date').validity.valid || start < catalog.startMs || start + duration * hour > catalog.endMs) {
    throw new Error('Choose a UTC landing time that keeps the mission between 1 Jan 2024 and 1 Jan 2031.')
  }
  if (!weightSum) throw new Error('Set at least one priority weight above zero.')
  const requirements = inputs('min-sun', 'min-earth', 'min-overlap', 'max-dark')
  if (requirements.some(input => !input.validity.valid)) throw new Error('Enter requirement values from 0 to 720 hours.')
  const [minSun, minEarth, minOverlap, maxDark] = requirements.map(input => Number(input.value))
  return { start, duration, horizon: get('model').value, weights: { sun, earth, overlap },
    limits: { sun: minSun, earth: minEarth, overlap: minOverlap, darkness: get('max-dark').value ? maxDark : Infinity } }
}

function framesFor(start, duration) {
  const sample = catalog.step * 1000
  const first = (start - catalog.startMs) / sample
  return Array.from({ length: duration * 4 + 1 }, (_, index) => frameAt(ephemeris, first + index))
}

function recalculate() {
  if (!catalog) return
  stop()
  let nextSettings
  try { nextSettings = currentSettings() } catch (reason) {
    error('input-error', reason.message + ' Showing the last valid result.')
    return
  }
  if (nextSettings.start !== settings?.start) elapsed = 0
  settings = nextSettings
  error('input-error')
  const { start, duration, weights, limits, horizon } = settings
  const frames = framesFor(start, duration)
  const sites = custom ? [...catalog.catalog, custom] : catalog.catalog
  ranked = rank(sites.map(site => evaluate(site, frames, duration, horizon === 'terrain')), weights, limits, duration)
  if (!inspectedSite || !ranked.some(row => row.site.id === selected)) selected = ranked[0].site.id
  elapsed = Math.min(elapsed, duration)
  get('time-slider').max = duration
  get('export').disabled = false
  showResult()
  updateComparisonOptions()
  if (!comparisonEdited) get('compare-time').value = controlDate(start)
  compare()
}

function availableAt(windows, at, duration) {
  return windows.some(([start, end]) => start <= at && (at < end || (at === duration && end === duration)))
}

function timelineTrack(key, windows, duration, at = null) {
  const row = element('div', 'track ' + (key === 'overlap' ? 'both' : key) + '-track')
  const bar = element('div', 'track-bar')
  bar.setAttribute('aria-hidden', 'true')
  windows.forEach(([start, end]) => {
    const span = element('i')
    span.style.left = (start / duration * 100) + '%'
    span.style.width = ((end - start) / duration * 100) + '%'
    bar.append(span)
  })
  if (at !== null) {
    const marker = element('i', 'now')
    marker.style.left = Math.min(99.8, at / duration * 100) + '%'
    bar.append(marker)
  }
  row.append(element('span', '', metricNames[key]), bar,
    element('span', 'track-total', formatHours(windows.reduce((sum, [a, b]) => sum + b - a, 0))))
  return row
}

function timeline(row, duration, at = null) {
  return [timelineTrack('sun', row.sun, duration, at), timelineTrack('earth', row.earth, duration, at),
    timelineTrack('overlap', row.metrics.both, duration, at)]
}

function axis(duration) {
  const labels = element('div', 'answer-axis')
  const useDays = duration >= 72
  for (let index = 0; index <= 4; index++) {
    const time = duration * index / 4
    labels.append(element('span', '', '+' + Number((time / (useDays ? 24 : 1)).toFixed(1)) + (useDays ? 'd' : 'h')))
  }
  return labels
}

function resultNarrative(best, second) {
  const { weights, duration } = settings
  const scoring = Object.keys(weights).filter(key => weights[key])
  if (scoring.length === 1) {
    const key = scoring[0]
    const metric = { sun: 'of sunlight', earth: 'with Earth in view', overlap: 'with sunlight and Earth in view at the same time' }[key]
    return [formatHours(best.metrics[key]) + ' ' + metric,
      second ? siteName(second.site) + ' has ' + formatHours(second.metrics[key]) + '.' : ''].filter(Boolean).join('. ').replace(/([^.!?])$/, '$1.')
  }
  return 'Mission fit ' + best.score + ' / 100 over ' + formatHours(duration) + '. ' +
    formatHours(best.metrics.sun) + ' of sunlight and ' + formatHours(best.metrics.earth) + ' with Earth in view.'
}

function showResult() {
  active = ranked.find(row => row.site.id === selected)
  const siteControl = get('space-site')
  siteControl.replaceChildren(...ranked.map(({ site }) => {
    const option = element('option', '', siteName(site))
    option.value = site.id
    return option
  }))
  siteControl.value = selected
  const [best, second] = ranked
  const alternative = active.site.id === best.site.id ? second : active
  const tied = ranked.filter(row => row.place === 1)
  let title = siteName(best.site) + ' fits this mission best'
  let body = resultNarrative(best, alternative)
  if (best.place === null) {
    title = 'No site meets all your requirements'
    body = 'Inspect the closest matches below or adjust your minimum hours in Advanced settings.'
  } else if (best.score === 0) {
    title = 'No site offers time for your chosen priority'
    body = 'Try a different date or priority. The timelines show what each site offers with this plan.'
  } else if (tied.length > 1) {
    title = tied.length + ' sites tie for the best fit'
    body = resultNarrative(best, alternative) + ' Compare the windows and longest gaps before choosing.'
  }
  get('answer-title').textContent = title
  get('answer-body').textContent = body + ' ' + (settings.horizon === 'terrain' ? 'Using the local terrain horizon.' : 'Using the 0° reference plane.')
  get('rank-summary').textContent = best.place === null ? 'Showing closest matches first.' : 'Ranked for your mission priorities.'
  get('site-count').textContent = ranked.length + ' sites'
  get('rank-note').textContent = 'Select a site to see the local horizon, next transition, and longest gaps.'
  get('rank-list').replaceChildren(...ranked.map(row => {
    const item = element('li')
    const button = element('button', 'rank-row' + (row.unmet.length ? ' unmet' : ''))
    button.type = 'button'
    button.setAttribute('aria-pressed', String(row.site.id === selected))
    button.setAttribute('aria-label', siteName(row.site) + ', ' + (row.place ? 'rank ' + row.place : 'misses ' + row.unmet.join(', ')) +
      ', sunlight ' + formatHours(row.metrics.sun) + ', Earth in view ' + formatHours(row.metrics.earth) + ', both ' + formatHours(row.metrics.overlap))
    const name = element('span', 'site-name')
    name.append(element('span', 'place', row.place ?? '–'), element('span', '', siteName(row.site)))
    button.append(name, ...['sun', 'earth', 'overlap'].map(key => element('span', 'value', formatHours(row.metrics[key]))))
    if (row.unmet.length) button.title = 'Misses: ' + row.unmet.join(', ')
    button.addEventListener('click', () => selectSite(row.site.id, true))
    item.append(button)
    return item
  }))
  get('answer-tracks').replaceChildren(...[best, alternative].filter(Boolean).map(row => {
    const card = element('article', 'answer-site')
    const label = element('div', 'site-label')
    label.append(element('h3', '', siteName(row.site)), element('p', '', siteDetail(row.site)))
    const tracks = element('div')
    tracks.append(axis(settings.duration), ...timeline(row, settings.duration))
    card.append(label, tracks)
    return card
  }))
  showMap()
  showTime()
}

function selectSite(id, focus) {
  selected = id
  inspectedSite = true
  showResult()
  if (focus) [...get('rank-list').querySelectorAll('button')].find(button => button.getAttribute('aria-pressed') === 'true')?.focus()
}

function showMap() {
  const pins = get('pins')
  pins.replaceChildren()
  globe?.setSites(ranked.map(({ site }) => ({ ...site, displayName: siteName(site) })), selected)
  const extent = catalog.mapExtent
  const radians = Math.PI / 180
  for (const { site } of ranked) {
    const distance = 2 * radius * Math.tan((90 + site.lat) * radians / 2)
    const x = .5 + distance * Math.sin(site.lon * radians) / (2 * extent)
    const y = .5 - distance * Math.cos(site.lon * radians) / (2 * extent)
    if (x < 0 || x > 1 || y < 0 || y > 1) continue
    const isActive = site.id === selected
    const button = element('button', 'pin' + (isActive ? ' selected' : '') +
      (!site.kind.includes('Historic') ? ' feature secondary' : '') + (x > .68 ? ' flip' : ''))
    button.type = 'button'
    button.style.setProperty('--x', (x * 100) + '%')
    button.style.setProperty('--y', (y * 100) + '%')
    button.setAttribute('aria-label', siteName(site) + ', ' + coordinate(site.lat, 'N', 'S') + ' ' + coordinate(site.lon, 'E', 'W'))
    button.setAttribute('aria-pressed', String(isActive))
    button.append(element('span', 'pin-text', siteName(site)))
    button.addEventListener('click', () => {
      selectSite(site.id, false)
      pins.querySelector('[aria-pressed=true]')?.focus()
    })
    pins.append(button)
  }
}

function useMap(view) {
  const isGlobe = view === 'globe'
  get('polar-view').hidden = isGlobe
  get('globe-view').hidden = !isGlobe
  get('show-map').setAttribute('aria-pressed', String(!isGlobe))
  get('show-globe').setAttribute('aria-pressed', String(isGlobe))
  if (isGlobe) globe?.draw()
}

function installGlobe() {
  const canvas = get('globe-canvas')
  function fallback(message) {
    get('show-globe').disabled = true
    useMap('polar')
    error('globe-error', message)
  }
  try { globe = createGlobe(canvas, get('globe-markers'), id => selectSite(id, false)) }
  catch (reason) { fallback(reason.message); return }
  canvas.addEventListener('textureerror', () => fallback('The 3D texture could not load. The polar map is available.'))
  canvas.addEventListener('webglcontextlost', () => fallback('3D rendering became unavailable. The polar map is available.'))
  const controls = {
    'globe-left': () => globe.rotate(0, -15),
    'globe-right': () => globe.rotate(0, 15),
    'globe-north': () => globe.rotate(12, 0),
    'globe-south': () => globe.rotate(-12, 0),
    'globe-zoom-in': () => globe.zoom(1.25),
    'globe-zoom-out': () => globe.zoom(.8),
    'globe-focus': () => active && globe.center(active.site),
    'globe-reset': () => globe.reset(),
  }
  for (const [id, handler] of Object.entries(controls)) get(id).addEventListener('click', handler)
}

function drawGrid() {
  const grid = get('graticule')
  for (const latitude of [88, 86, 84, 82]) {
    const ring = document.createElementNS('http://www.w3.org/2000/svg', 'circle')
    const size = radius * Math.tan((90 - latitude) * Math.PI / 360) * 600 / catalog.mapExtent
    for (const [name, value] of Object.entries({ cx: 300, cy: 300, r: size })) ring.setAttribute(name, value)
    grid.append(ring)
    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text')
    text.setAttribute('x', 321)
    text.setAttribute('y', 294 - size)
    text.textContent = latitude + '°S'
    grid.append(text)
  }
}

function drawChart() {
  if (!active) return
  const canvas = get('elevation-chart')
  const width = canvas.clientWidth
  const height = canvas.clientHeight
  if (!width || !height) return
  const pixelRatio = Math.min(2, devicePixelRatio || 1)
  canvas.width = Math.round(width * pixelRatio)
  canvas.height = Math.round(height * pixelRatio)
  const ctx = canvas.getContext('2d')
  ctx.scale(pixelRatio, pixelRatio)
  const series = active.timeline
  const bottom = height - 25
  const left = 45
  const plotWidth = width - left - 13
  const plotHeight = bottom - 10
  const columns = ['sunEl', 'earthEl', 'sunHorizon', 'earthHorizon']
  const values = series.flatMap(row => columns.map(key => row[key]))
  const min = Math.min(-2, Math.floor(Math.min(...values) / 5) * 5)
  const max = Math.max(2, Math.ceil(Math.max(...values) / 5) * 5)
  const px = hours => left + hours / settings.duration * plotWidth
  const py = value => bottom - (value - min) / (max - min) * plotHeight

  ctx.font = '11px DM Sans, sans-serif'
  ctx.textBaseline = 'middle'
  function ruler(x1, y1, x2, y2) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
  }
  for (let i = 0; i <= 4; i++) {
    const value = min + (max - min) * i / 4
    ctx.strokeStyle = '#354b60'
    ctx.fillStyle = '#b3c1d1'
    ctx.textAlign = 'right'
    ctx.fillText(value.toFixed(1) + '°', left - 7, py(value))
    ruler(left, py(value), left + plotWidth, py(value))
  }
  for (let i = 0; i <= 4; i++) {
    const hours = settings.duration * i / 4
    ctx.strokeStyle = '#354b60'
    ctx.textAlign = i === 4 ? 'right' : i === 0 ? 'left' : 'center'
    ctx.fillText(settings.duration >= 72 ? '+' + Number((hours / 24).toFixed(1)) + 'd' : '+' + hours + 'h', px(hours), bottom + 13)
    ruler(px(hours), 10, px(hours), bottom)
  }
  const colors = ['#ffc975', '#acc4ff', '#ffc975ba', '#acc4ffb5']
  columns.forEach((key, index) => {
    ctx.beginPath()
    ctx.setLineDash(index >= 2 ? [5, 5] : [])
    ctx.lineWidth = index >= 2 ? 1.1 : 2
    ctx.strokeStyle = colors[index]
    series.forEach((row, i) => {
      const x = left + i / (series.length - 1) * plotWidth
      const y = py(row[key])
      if (i) ctx.lineTo(x, y)
      else ctx.moveTo(x, y)
    })
    ctx.stroke()
  })
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = '#f8f4e6'
  ctx.lineWidth = 1
  ruler(px(elapsed), 10, px(elapsed), bottom)
  ctx.setLineDash([])
  const item = series[Math.round(elapsed * 4)]
  columns.slice(0, 2).forEach((key, index) => {
    ctx.beginPath()
    ctx.fillStyle = colors[index]
    ctx.arc(px(elapsed), py(item[key]), 3.8, 0, Math.PI * 2)
    ctx.fill()
  })
}

function showTime() {
  if (!active) return
  const { start, duration, horizon } = settings
  const window = active.timeline[Math.round(elapsed * 4)]
  const time = dateLabel(start + elapsed * hour)
  get('ops-subtitle').textContent = siteName(active.site) + ' · ' + coordinate(active.site.lat, 'N', 'S') + ', ' +
    coordinate(active.site.lon, 'E', 'W') + ' · ' + (horizon === 'terrain' ? 'LOLA terrain' : '0° reference plane')
  get('selected-time').value = time
  get('time-slider').value = String(elapsed)
  get('time-slider').setAttribute('aria-valuetext', time)
  get('tracks').replaceChildren(...timeline(active, duration, elapsed))
  const degrees = value => (value > 0 ? '+' : '') + value.toFixed(2) + '°'
  function next(windows, body) {
    const visible = availableAt(windows, elapsed, duration)
    const transition = visible ? windows.find(([a, b]) => a <= elapsed && b > elapsed)?.[1] : windows.find(([a]) => a > elapsed)?.[0]
    return (!transition || transition >= duration) ? 'No change within this window' :
      body + (visible ? ' leaves view in ' : ' comes into view in ') + formatHours(transition - elapsed)
  }
  const snapshot = get('snapshot')
  const entries = [
    ['Sun · ' + degrees(window.sunEl), window.eclipse ? 'Total eclipse' : (availableAt(active.sun, elapsed, duration) ? 'In view' : 'Below the skyline') +
      ' · ' + window.sunAz.toFixed(1) + '° bearing · skyline ' + degrees(window.sunHorizon), next(active.sun, 'Sun')],
    ['Earth · ' + degrees(window.earthEl), (availableAt(active.earth, elapsed, duration) ? 'In view' : 'Below the skyline') +
      ' · ' + window.earthAz.toFixed(1) + '° bearing · skyline ' + degrees(window.earthHorizon), next(active.earth, 'Earth')],
  ]
  const list = element('dl')
  for (const [title, condition, change] of entries) {
    list.append(element('dt', '', title), element('dd', '', condition), element('dd', '', change))
  }
  list.append(element('dt', '', 'Longest gaps'), element('dd', '', 'Darkness ' + formatHours(active.metrics.darkness) +
    ' · Earth out of view ' + formatHours(active.metrics.blackout)))
  snapshot.replaceChildren(element('p', 'muted', time), list)
  if (updateSpace) {
    const { lunarKm, solarKm } = updateSpace((start + elapsed * hour - catalog.startMs) / (spaceStep * 1000), active.site)
    const slider = get('space-time')
    slider.max = duration
    slider.value = String(elapsed)
    slider.setAttribute('aria-valuetext', time)
    get('space-clock').value = time
    const skyline = horizon === 'terrain' ? 'local skyline' : '0° reference horizon'
    const clearance = difference => {
      if (Math.abs(difference) < .005) return 'at the ' + skyline
      return Math.abs(difference).toFixed(2) + '° ' + (difference > 0 ? 'above' : 'below') + ' the ' + skyline
    }
    get('space-caption').textContent = horizon === 'terrain' ? 'LOLA terrain horizon' : '0° reference horizon'
    get('space-sun').textContent = clearance(window.sunEl - window.sunHorizon) + (window.eclipse ? ' · Total solar eclipse' : '')
    get('space-earth').textContent = clearance(window.earthEl - window.earthHorizon)
    get('space-lunar-km').textContent = lunarKm + ' km'
    get('space-solar-km').textContent = solarKm + ' km'
  }
  drawChart()
}

function updateComparisonOptions() {
  const ids = inputs('compare-a', 'compare-b')
  const previous = ids.map(select => select.value)
  for (const [index, select] of ids.entries()) {
    select.replaceChildren(...ranked.map(({ site }) => {
      const option = element('option', '', siteName(site))
      option.value = site.id
      return option
    }))
    select.value = ranked.some(row => row.site.id === previous[index]) ? previous[index] : ranked[index].site.id
  }
}

function compare() {
  if (!settings) return
  const startB = Date.parse(get('compare-time').value + 'Z')
  const { start, duration, horizon, weights, limits } = settings
  const result = get('compare-result')
  const windowDetail = get('window-detail')
  if (!Number.isFinite(startB) || startB < catalog.startMs || startB + duration * hour > catalog.endMs) {
    error('compare-error', 'Choose a UTC time for B that keeps its full mission inside the supported dates.')
    result.replaceChildren()
    windowDetail.replaceChildren()
    return
  }
  error('compare-error')
  const a = ranked.find(row => row.site.id === get('compare-a').value)
  const siteB = ranked.find(row => row.site.id === get('compare-b').value).site
  const [b] = rank([evaluate(siteB, framesFor(startB, duration), duration, horizon === 'terrain')], weights, limits, duration)
  const scenarios = [[a, start], [b, startB]]
  const decision = a.unmet.length && b.unmet.length ? 'Both scenarios miss mission requirements.' :
    a.unmet.length ? 'Only B meets the mission requirements.' : b.unmet.length ? 'Only A meets the mission requirements.' :
      a.score === b.score ? 'The scenarios tie for the chosen priorities.' :
        'Scenario ' + (a.score > b.score ? 'A' : 'B') + ' scores higher for the chosen priorities.'
  const grid = element('div', 'compare-grid')
  const details = element('div', 'window-grid')
  scenarios.forEach(([row, epoch], index) => {
    const title = (index === 0 ? 'A' : 'B') + ' · ' + siteName(row.site)
    const card = element('article', 'compare-scenario')
    const time = element('time', '', dateLabel(epoch))
    time.dateTime = new Date(epoch).toISOString()
    card.append(element('h3', '', title), time, element('p', 'compare-status' + (row.unmet.length ? ' failed' : ''),
      row.unmet.length ? 'Misses: ' + row.unmet.join(', ') : 'Mission fit: ' + row.score + ' / 100'),
    axis(duration), ...timeline(row, duration), element('p', 'muted stats', 'Longest dark gap ' + formatHours(row.metrics.darkness) +
      ' · Longest Earth gap ' + formatHours(row.metrics.blackout)))
    grid.append(card)
    const detail = element('article')
    detail.append(element('h3', '', title))
    for (const [key, windows] of [['sun', row.sun], ['earth', row.earth], ['overlap', row.metrics.both]]) {
      detail.append(element('p', '', metricNames[key]))
      const list = element('ul')
      const texts = windows.map(([a, b]) => dateLabel(epoch + a * hour) + ' → ' + dateLabel(epoch + b * hour))
      list.append(...(texts.length ? texts : ['No visible interval']).map(text => element('li', '', text)))
      detail.append(list)
    }
    details.append(detail)
  })
  result.replaceChildren(element('p', 'compare-context', decision + ' Timelines are aligned by hours since landing.'), grid)
  windowDetail.replaceChildren(details)
}

function setMissionTime(epoch) {
  if (!Number.isFinite(epoch)) return
  const [date, time] = controlDate(epoch).split('T')
  get('landing-date').value = date
  get('landing-time').value = time
  recalculate()
}

function addCoordinate(event) {
  event.preventDefault()
  if (!catalog) return
  const [latitude, longitude] = inputs('latitude', 'longitude')
  if (!latitude.validity.valid || !longitude.validity.valid || Number(latitude.value) === -90) {
    error('coordinate-error', 'Enter a latitude above −90° through −60° and an east longitude between −180° and 360°.')
    return
  }
  error('coordinate-error')
  if (!custom) horizonBeforeCustom = get('model').value
  const lon = ((Number(longitude.value) + 180) % 360 + 360) % 360 - 180
  custom = { id: 'custom', name: 'Custom site', kind: 'Custom coordinates', lat: Number(latitude.value), lon, height: 0 }
  selected = custom.id
  inspectedSite = true
  get('model').value = 'reference'
  get('model').disabled = true
  get('remove-custom').hidden = false
  recalculate()
  globe?.center(custom)
}

function stop() {
  if (playing !== null) cancelAnimationFrame(playing)
  playing = null
  get('play').textContent = '▶'
  get('play').setAttribute('aria-label', 'Play timeline')
  get('space-play').textContent = '▶'
  get('space-play').setAttribute('aria-label', 'Play 3D timeline')
}

function play() {
  if (!active) return
  if (playing !== null) { stop(); return }
  if (elapsed >= settings.duration) { elapsed = 0; showTime() }
  const initial = elapsed
  const began = performance.now()
  get('play').textContent = 'Ⅱ'
  get('play').setAttribute('aria-label', 'Pause timeline')
  get('space-play').textContent = 'Ⅱ'
  get('space-play').setAttribute('aria-label', 'Pause 3D timeline')
  function update(now) {
    const next = Math.min(settings.duration, Math.round((initial + (now - began) * settings.duration / 20_000) * 4) / 4)
    if (next !== elapsed) {
      elapsed = next
      showTime()
    }
    if (elapsed >= settings.duration) stop()
    else playing = requestAnimationFrame(update)
  }
  playing = requestAnimationFrame(update)
}

function exportCsv() {
  const header = 'utc,site_id,latitude_deg,east_longitude_deg,horizon_model,sun_az_deg,sun_elev_deg,sun_horizon_deg,earth_az_deg,earth_elev_deg,earth_horizon_deg,total_solar_eclipse,sun_visible,earth_visible'
  const rows = active.timeline.map((entry, index) => [
    new Date(settings.start + index * hour / 4).toISOString(), active.site.id, active.site.lat, active.site.lon, settings.horizon,
    entry.sunAz, entry.sunEl, entry.sunHorizon, entry.earthAz, entry.earthEl, entry.earthHorizon, entry.eclipse,
    availableAt(active.sun, index / 4, settings.duration), availableAt(active.earth, index / 4, settings.duration),
  ].join(','))
  const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' }))
  const link = element('a')
  link.href = url
  link.download = 'astralis-' + active.site.id + '-' + new Date(settings.start).toISOString().slice(0, 10) + '.csv'
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function start() {
  try {
    const replies = await Promise.all([fetch('./data/catalog.json'), fetch('./data/ephemeris.bin')])
    if (replies.some(response => !response.ok)) throw new Error('The lunar dataset could not be loaded. Reload the page and try again.')
    const [metadata, bytes] = await Promise.all([replies[0].json(), replies[1].arrayBuffer()])
    catalog = { ...metadata, startMs: Date.parse(metadata.start), endMs: Date.parse(metadata.end) }
    ephemeris = binaryFrames(bytes)
    if (ephemeris.length !== catalog.count * 6) throw new Error('The lunar dataset is incomplete. Reload the page and try again.')
    get('landing-date').min = metadata.start.slice(0, 10)
    get('landing-date').max = new Date(catalog.endMs - day).toISOString().slice(0, 10)
    installGlobe()
    drawGrid()
    recalculate()
    void startSpace()
  } catch (reason) {
    error('boot-error', reason.message + (location.protocol === 'file:' ? ' Open Astralis through a local web server.' : ''))
    get('answer-title').textContent = 'Lunar data could not be loaded'
    get('rank-summary').textContent = 'Reload to try again.'
  }
}

async function startSpace() {
  try {
    const response = await fetch('./data/space-positions.bin')
    if (!response.ok) throw new Error('The 3D ephemeris could not be loaded.')
    const samples = readSpaceSamples(await response.arrayBuffer(), catalog.startMs, catalog.endMs)
    const controls = {
      earthView: get('space-earth-view'), sunView: get('space-sun-view'), scale: get('space-scale'),
      left: get('space-left'), right: get('space-right'), up: get('space-up'), down: get('space-down'), reset: get('space-reset'),
    }
    updateSpace = createSpaceView(get('space-canvas'), samples, controls)
    get('space-content').hidden = false
    for (const button of Object.values(controls)) if (button.tagName === 'BUTTON') button.disabled = false
    for (const input of inputs('space-site', 'space-play', 'space-time')) input.disabled = false
    get('space-status').hidden = true
    showTime()
  } catch (reason) {
    updateSpace = undefined
    get('space-status').hidden = true
    error('space-error', reason.message + ' Site rankings and surface operations are available below.')
    get('space-content').hidden = true
  }
}

get('mission-form').addEventListener('submit', event => event.preventDefault())
get('mission-form').addEventListener('change', event => {
  if (weightInputs.includes(event.target)) for (const button of get('presets').children) button.setAttribute('aria-pressed', 'false')
  recalculate()
})
weightInputs.forEach(input => input.addEventListener('input', () => {
  for (const button of get('presets').children) button.setAttribute('aria-pressed', 'false')
  recalculate()
}))
for (const button of get('presets').children) button.addEventListener('click', () => {
  const values = presets[button.dataset.preset]
  weightInputs.forEach((input, index) => { input.value = values[index] })
  for (const option of get('presets').children) option.setAttribute('aria-pressed', String(option === button))
  recalculate()
})
get('offset').addEventListener('click', () => settings && setMissionTime(settings.start + 3 * day))
get('coordinates').addEventListener('submit', addCoordinate)
get('remove-custom').addEventListener('click', () => {
  if (selected === custom?.id) inspectedSite = false
  custom = null
  get('model').disabled = false
  get('model').value = horizonBeforeCustom
  get('remove-custom').hidden = true
  error('coordinate-error')
  recalculate()
})
get('compare-time').addEventListener('change', () => { comparisonEdited = true; compare() })
for (const select of inputs('compare-a', 'compare-b')) select.addEventListener('change', compare)
get('same-date').addEventListener('click', () => {
  if (!settings) return
  comparisonEdited = false
  get('compare-time').value = controlDate(settings.start)
  compare()
})
get('delay-b').addEventListener('click', () => {
  if (!settings) return
  comparisonEdited = true
  get('compare-time').value = controlDate(settings.start + 3 * day)
  compare()
})
get('space-site').addEventListener('change', event => selectSite(event.target.value, false))
for (const slider of inputs('time-slider', 'space-time')) slider.addEventListener('input', event => {
  stop()
  elapsed = Number(event.target.value)
  showTime()
})
get('show-map').addEventListener('click', () => useMap('polar'))
get('show-globe').addEventListener('click', () => useMap('globe'))
get('elevation-chart').addEventListener('pointerdown', event => {
  if (!active) return
  stop()
  const fraction = Math.max(0, Math.min(1, (event.offsetX - 45) / (event.currentTarget.clientWidth - 58)))
  elapsed = Math.round(fraction * settings.duration * 4) / 4
  showTime()
})
for (const button of inputs('play', 'space-play')) button.addEventListener('click', play)
get('export').addEventListener('click', exportCsv)
new ResizeObserver(drawChart).observe(get('elevation-chart'))
start()
