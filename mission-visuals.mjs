// Shared presentation adapted from vnk11's Trade-off Explorer (e81fb40).
// These views display evaluated mission data; they never rank or change it.
const ns = 'http://www.w3.org/2000/svg'
const node = (tag, className, text) => {
  const item = document.createElement(tag)
  if (className) item.className = className
  if (text !== undefined) item.textContent = text
  return item
}
const svg = (tag, attributes = {}, parent) => {
  const item = document.createElementNS(ns, tag)
  for (const [name, value] of Object.entries(attributes)) item.setAttribute(name, value)
  parent?.append(item)
  return item
}
const fraction = (value, maximum) => maximum > 0 ? Math.max(0, Math.min(1, value / maximum)) : 0
const hours = value => `${Number(value.toFixed(1))} h`

export function missionStrip({ sunWindows = [], earthWindows = [], duration, at = null }) {
  const box = node('div', 'mission-strip')
  const ruler = node('div', 'mission-strip-ruler')
  ruler.append(node('span', '', 'Landing'), node('span', '', `End · ${hours(duration)}`))
  box.append(ruler)
  for (const [label, windows, kind] of [['Sunlight', sunWindows, 'sun'], ['Earth view', earthWindows, 'earth']]) {
    const total = windows.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0)
    const lane = svg('svg', { viewBox: '0 0 300 12', preserveAspectRatio: 'none', class: `mission-lane ${kind}`, role: 'img',
      'aria-label': `${label}: ${hours(total)} of ${hours(duration)}; gaps are dark` })
    svg('title', {}, lane).textContent = `${label}: ${hours(total)} (${Math.round(100 * fraction(total, duration))}% of the mission)`
    svg('rect', { width: 300, height: 12, class: 'mission-lane-base' }, lane)
    for (const [start, end] of windows) {
      const x = fraction(start, duration) * 300
      svg('rect', { x, width: Math.max(0, fraction(end, duration) * 300 - x), height: 12, class: 'mission-lane-on' }, lane)
    }
    for (let index = 1; index < 4; index++) svg('line', { x1: index * 75, x2: index * 75, y1: 0, y2: 12, class: 'mission-lane-tick' }, lane)
    const laneWrap = node('div', 'mission-lane-wrap')
    laneWrap.append(lane)
    if (at !== null) {
      const marker = node('i', 'now')
      marker.style.left = `${Math.min(99.8, fraction(at, duration) * 100)}%`
      laneWrap.append(marker)
    }
    box.append(node('span', `mission-strip-label ${kind}`, label), laneWrap,
      node('span', 'mission-strip-total', `${hours(total)} · ${Math.round(100 * fraction(total, duration))}%`))
  }
  return box
}

export function metricBar(label, value, maximum, formatted, kind, explanation) {
  const box = node('div', `mission-bar ${kind}`)
  box.dataset.value = value
  box.dataset.maximum = maximum
  const head = node('div', 'mission-bar-label')
  head.append(node('span', '', label), node('strong', '', formatted))
  const track = node('div', 'mission-bar-track')
  track.setAttribute('role', 'img')
  track.setAttribute('aria-label', `${label}: ${formatted}. ${explanation}`)
  track.title = explanation
  const fill = node('span')
  fill.style.width = `${fraction(value, maximum) * 100}%`
  track.append(fill)
  box.append(head, track)
  return box
}

export function terrainSlope(slope) {
  const box = node('span', 'mission-slope')
  if (!Number.isFinite(slope)) {
    box.textContent = 'Terrain not assessed'
    return box
  }
  const diagram = svg('svg', { viewBox: '0 0 42 24', 'aria-hidden': 'true' })
  svg('path', { d: 'M2 20H40', class: 'slope-reference' }, diagram)
  const rise = Math.min(18, Math.tan(slope * Math.PI / 180) * 36)
  svg('path', { d: `M3 19L39 ${19 - rise}`, class: 'slope-surface' }, diagram)
  box.append(diagram, node('span', '', `Slope ${slope.toFixed(2)}°`))
  return box
}

export function tradeoffPlot(sites, duration, select) {
  const box = node('div', 'mission-tradeoff')
  const chart = svg('svg', { viewBox: '0 0 760 290', role: 'group', 'aria-label': 'Shortlisted patches: solar energy against longest continuous Earth view' })
  const maxEnergy = Math.max(...sites.map(site => site.energyKwh), .01)
  const left = 76, right = 728, top = 34, bottom = 236
  for (let tick = 0; tick <= 4; tick++) {
    const t = tick / 4, x = left + t * (right - left), y = bottom - t * (bottom - top)
    svg('path', { d: `M${left} ${y}H${right}`, class: 'tradeoff-grid' }, chart)
    svg('text', { x: left - 10, y: y + 4, 'text-anchor': 'end', class: 'tradeoff-tick' }, chart).textContent = hours(duration * t)
    svg('text', { x, y: bottom + 20, 'text-anchor': 'middle', class: 'tradeoff-tick' }, chart).textContent = (maxEnergy * t).toFixed(2)
  }
  svg('text', { x: left, y: 17, class: 'tradeoff-label earth' }, chart).textContent = 'Longest continuous Earth view'
  svg('text', { x: right, y: 282, 'text-anchor': 'end', class: 'tradeoff-label sun' }, chart).textContent = 'Total solar energy (kWh/m²) →'
  // Coincident points share a position; each remains keyboard-selectable.
  sites.forEach((site, index) => {
    const x = left + fraction(site.energyKwh, maxEnergy) * (right - left)
    const y = bottom - fraction(site.longestEarthHours, duration) * (bottom - top)
    const point = svg('g', { transform: `translate(${x} ${y})`, tabindex: 0, role: 'button', class: 'tradeoff-point',
      'data-site': site.id, 'aria-label': `${site.displayName}: ${site.energyKwh.toFixed(2)} kWh per square metre, ${hours(site.longestEarthHours)} continuous Earth view. Open Surface.` }, chart)
    svg('circle', { r: 12 }, point)
    svg('text', { y: 4, 'text-anchor': 'middle' }, point).textContent = index + 1
    svg('title', {}, point).textContent = `${site.displayName} · ${site.energyKwh.toFixed(2)} kWh/m² · ${hours(site.longestEarthHours)} continuous Earth view · slope ${site.slope.toFixed(2)}°`
    point.addEventListener('click', () => select(site))
    point.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); select(site) }
    })
  })
  box.append(chart, node('p', 'muted', 'Numbers match the shortlist. Higher and farther right gives more of both; slope remains a separate limit. Select a point to open Surface.'))
  return box
}
