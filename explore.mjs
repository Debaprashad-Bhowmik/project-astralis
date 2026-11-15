import {
  chooseCriteria, criteria, dateFloor, day, dayOffsets, explain, formatHours, funnelScore, levels, meetsRequirements,
  niceRange, paretoFront, presets, siteName, tieTolerance,
} from './explore-model.mjs'
import { missionStrip } from './mission-visuals.mjs'
import { createExplorerViewers } from './explore-viewer.mjs'
import { artemisSouthLatitude } from './mission-heat.mjs'

const $ = id => document.getElementById(id)
const svgNs = 'http://www.w3.org/2000/svg'
const pickColors = ['#ff9fb2', '#83dccb']

const state = {
  level: 1, preset: 'explore', date: '2026-12-01', time: '00:00', hours: presets.explore.hours, regions: new Set(['pole']),
  terrain: true, weight: presets.explore.weight, req: { ...presets.explore.req }, offset: 0, picks: [], x: null, y: null,
  sort: { key: 'score', descending: true }, showAll: false, heatAll: false,
}
let sites = []
let siteById = new Map()
let results = new Map()
let job = 0
let hovered = null
const worker = new Worker(new URL('./explore-worker.mjs', import.meta.url), { type: 'module' })
const comparisonViews = createExplorerViewers({ onShadowsChange(checked) { state.terrain = checked; compute() } })

// ---------- small helpers ----------
function svg(tag, attributes = {}, parent) {
  const node = document.createElementNS(svgNs, tag)
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value)
  parent?.append(node)
  return node
}
function html(tag, className, text) {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
const percent = value => `${Math.round(value)}%`
const startMs = () => Date.parse(`${state.date}T${state.time}:00Z`)
const dateLabel = ms => new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })
const inRegions = site => site.lat <= artemisSouthLatitude
const groupLabel = site => site.lat <= -60 ? 'South polar' : site.kind.startsWith('Historic') ? 'Historic landing' : site.kind.startsWith('Future CLPS') ? 'Future CLPS target' : 'Study point'

// ---------- shareable URL ----------
function saveHash() {
  const params = new URLSearchParams({
    l: state.level, pr: state.preset ?? '', d: state.date, t: state.time, h: state.hours, r: [...state.regions].join('.'),
    terrain: state.terrain ? 1 : 0, w: Math.round(state.weight * 100), s: state.req.sun, e: state.req.earth,
    dk: state.req.dark ?? '', bo: state.req.blackout ?? '', p: state.picks.join('.'), x: state.x ?? '', y: state.y ?? '',
  })
  history.replaceState(null, '', '#' + params)
}
function loadHash() {
  const params = new URLSearchParams(location.hash.slice(1))
  const number = (key, fallback, low, high) => {
    const value = Number(params.get(key))
    return params.get(key) !== null && params.get(key) !== '' && Number.isFinite(value) ? Math.min(high, Math.max(low, value)) : fallback
  }
  state.level = Math.round(number('l', 1, 1, 5))
  if (params.has('pr')) state.preset = params.get('pr') in presets ? params.get('pr') : null
  if (/^\d{4}-\d\d-\d\d$/.test(params.get('d'))) state.date = params.get('d')
  if (/^\d\d:\d\d$/.test(params.get('t'))) state.time = params.get('t')
  if (params.has('h')) state.hours = durationHours(Number(params.get('h')) / 24) ?? state.hours
  state.regions = new Set(['pole'])
  if (params.has('terrain')) state.terrain = params.get('terrain') !== '0'
  state.weight = number('w', state.weight * 100, 0, 100) / 100
  state.req = { sun: number('s', state.req.sun, 0, 100), earth: number('e', state.req.earth, 0, 100),
    dark: number('dk', state.req.dark, 0, 336), blackout: number('bo', state.req.blackout, 0, 336) }
  state.picks = []
  if (params.get('x') in criteria) state.x = params.get('x')
  if (params.get('y') in criteria) state.y = params.get('y')
}

// ---------- computation ----------
function compute() {
  job += 1
  results = new Map()
  $('progress').hidden = false
  $('progress').firstChild.style.width = '0%'
  worker.postMessage({ type: 'run', job, start: startMs(), hours: state.hours, terrain: state.terrain })
  render()
}
worker.onmessage = ({ data: message }) => {
  if (message.job !== job) return
  if (message.type === 'catalog') {
    sites = message.sites
    siteById = new Map(sites.map(site => [site.id, site]))
    state.picks = state.picks.filter(id => siteById.has(id))
    $('date').min = message.start.slice(0, 10)
    $('date').max = new Date(Date.parse(message.end) - 76 * day).toISOString().slice(0, 10)
    compute()
  } else if (message.type === 'offset') {
    results.set(message.offset, message.rows ? new Map(message.rows.map(row => [row.id, row])) : null)
    $('progress').firstChild.style.width = `${100 * results.size / dayOffsets.length}%`
    scheduleRender()
  } else if (message.type === 'done') {
    $('progress').hidden = true
    render()
  } else if (message.type === 'error') {
    $('note').hidden = false
    $('note').textContent = message.message
  }
}
let queued = false
function scheduleRender() {
  if (queued) return
  queued = true
  requestAnimationFrame(() => { queued = false; render() })
}

// ---------- scoring for the current level ----------
function buildView() {
  const visible = sites.filter(inRegions)
  const byOffset = new Map()
  for (const [offset, rows] of results) {
    byOffset.set(offset, rows ? visible.map(site => rows.get(site.id)).filter(Boolean).map(row => ({
      ...row, site: siteById.get(row.id), misses: meetsRequirements(row, state.req), base: funnelScore(row, ['sun', 'earth'], state.weight),
    })) : null)
  }
  // Date tolerance: how much the essentials score moves within ±3 days of each landing date.
  const series = new Map()
  for (const [offset, points] of byOffset) for (const point of points ?? []) {
    if (!series.has(point.id)) series.set(point.id, new Map())
    series.get(point.id).set(offset, point.base)
  }
  for (const [offset, points] of byOffset) for (const point of points ?? []) {
    point.floor = dateFloor(series.get(point.id), offset)
    point.pass = point.misses.length === 0
  }
  const current = byOffset.get(state.offset)
  // Factors are chosen once, from the options on screen, and applied to every date so scores stay comparable.
  const passing = current?.filter(point => point.pass) ?? []
  const choice = chooseCriteria(passing.length >= 2 ? passing : current ?? [], state.level, state.weight)
  // The map's axes follow the two most decisive factors unless the user picks them at the Everything level.
  const xKey = state.level >= 5 && state.x ? state.x : choice.keys[0]
  const yKey = state.level >= 5 && state.y && state.y !== xKey ? state.y : choice.keys.find(key => key !== xKey)
  for (const points of byOffset.values()) for (const point of points ?? []) {
    point.score = funnelScore(point, choice.keys, state.weight)
    point.x = 100 * criteria[xKey].value(point)
    point.y = 100 * criteria[yKey].value(point)
  }
  let ranked = []
  if (current) {
    ranked = [...current].sort((a, b) => (b.pass - a.pass) || b.score - a.score)
    const front = paretoFront(passing, 'x', 'y')
    for (const point of current) point.front = front.has(point.id)
  }
  const all = [...byOffset.values()].flatMap(points => points ?? [])
  const xRange = niceRange(all.map(point => point.x), 100)
  const yRange = niceRange(all.map(point => point.y), 100)
  return { visible, byOffset, current, ranked, top: ranked.slice(0, 3), xRange, yRange, xKey, yKey, keys: choice.keys, similar: choice.similar }
}

// ---------- render ----------
function render() {
  syncControls()
  saveHash()
  if (!sites.length) return
  const view = lastView = buildView()
  renderLevelLine(view)
  renderNote(view)
  limits = view.current?.length ? {
    sun: Math.max(...view.current.map(point => point.sun)), earth: Math.max(...view.current.map(point => point.earth)),
    dark: Math.min(...view.current.map(point => point.darkGap)), blackout: Math.min(...view.current.map(point => point.earthGap)),
  } : null
  paintSliders()
  renderSuggestions(view)
  $('x-axis').value = state.x ?? ''
  $('y-axis').value = state.y ?? ''
  if (state.level >= 2 && state.level <= 4) renderList(view)
  if (state.level >= 5) renderChart(view)
  renderHeat(view)
  if (state.level >= 5) renderTable(view)
}

// Hovering a card or dot only highlights it on the map; rebuilding the cards would swallow clicks on their links.
let lastView = null
let hoverQueued = false
function hover(id) {
  hovered = id
  if (hoverQueued || state.level < 4 || !lastView) return
  hoverQueued = true
  requestAnimationFrame(() => { hoverQueued = false; renderChart(lastView) })
}

// Must-have sliders: the part of the track no site can satisfy on this date is red, and the thumb cannot enter it.
let limits = null
const failZone = 'color-mix(in srgb, var(--fail) 60%, transparent)'
function paintSliders() {
  for (const key of ['sun', 'earth', 'dark', 'blackout']) {
    const slider = $(`req-${key}`)
    const max = Number(slider.max)
    const fill = 100 * Number(slider.value) / max
    const layers = []
    let note = ''
    if (limits) {
      if (key === 'sun' || key === 'earth') {
        const edge = Math.min(100, limits[key])
        if (edge < 100) layers.push(`linear-gradient(90deg, transparent ${edge}%, ${failZone} ${edge}%)`)
        if (edge < 100) note = `No site has more than ${Math.round(limits[key])}% ${key === 'sun' ? 'sunlight' : 'Earth in view'} on this date.`
      } else {
        const edge = Math.min(100, 100 * limits[key] / max)
        if (edge > 0) layers.push(`linear-gradient(90deg, ${failZone} ${edge}%, transparent ${edge}%)`)
        if (edge > 0) note = `No site's ${key === 'dark' ? 'longest darkness' : 'longest Earth gap'} is shorter than ${formatHours(limits[key])} on this date.`
      }
    }
    layers.push(`linear-gradient(90deg, var(--accent) ${fill}%, var(--line) ${fill}%)`)
    slider.style.background = layers.join(', ')
    slider.title = note
  }
}
function clampRequirement(key, value) {
  if (!limits) return value
  const slider = $(`req-${key}`)
  const step = Number(slider.step)
  if (key === 'sun' || key === 'earth') return Math.min(value, Math.floor(limits[key] / step) * step)
  return Math.max(value, Math.min(Number(slider.max), Math.ceil(limits[key] / step) * step))
}

function syncControls() {
  for (const node of document.querySelectorAll('[data-min-level]')) node.hidden = state.level < Number(node.dataset.minLevel)
  for (const node of document.querySelectorAll('[data-max-level]')) node.hidden = state.level > Number(node.dataset.maxLevel)
  for (const button of $('levels').children) button.setAttribute('aria-pressed', String(Number(button.dataset.level) === state.level))
  $('presets').value = state.preset ?? 'custom'
  if (document.activeElement !== $('duration')) $('duration').value = +(state.hours / 24).toFixed(2)
  $('date').value = state.date
  $('time').value = state.time
  $('weight').value = Math.round(state.weight * 100)
  const capMax = Math.min(state.hours, 720)
  for (const key of ['dark', 'blackout']) {
    const slider = $(`req-${key}`)
    slider.max = capMax
    slider.step = capMax > 240 ? 12 : capMax > 48 ? 4 : 1
    slider.value = state.req[key] === null ? capMax : Math.min(state.req[key], capMax)
    $(`req-${key}-out`).textContent = state.req[key] === null ? 'any' : formatHours(state.req[key])
  }
  $('req-sun').value = state.req.sun
  $('req-earth').value = state.req.earth
  $('req-sun-out').textContent = state.req.sun ? `${state.req.sun}%` : 'any'
  $('req-earth-out').textContent = state.req.earth ? `${state.req.earth}%` : 'any'
  const needs = [state.req.sun && `≥ ${state.req.sun}% sunlight`, state.req.earth && `≥ ${state.req.earth}% Earth in view`,
    state.req.dark !== null && `darkness ≤ ${formatHours(state.req.dark)}`, state.req.blackout !== null && `Earth gap ≤ ${formatHours(state.req.blackout)}`].filter(Boolean)
  $('needs').textContent = needs.length ? `Needs ${needs.join(' · ')}` : 'No hard requirements'
}

const lower = text => text.replace(/^(\w)/, letter => letter.toLowerCase()).replace(/\bearth\b/, 'Earth').replace(/^sun and/, 'Sun and')
function renderLevelLine(view) {
  $('level-name').textContent = levels[state.level - 1].name
  const names = view.keys.map(key => lower(criteria[key].label))
  const ranked = names.length > 2 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names.join(' and ')
  const similar = view.similar.length && state.level < 4
    ? ` ${view.similar.map((item, index) => `${index ? lower(criteria[item.key].label) : criteria[item.key].label} (${item.range})`).join(' and ')} barely differ${view.similar.length === 1 ? 's' : ''} here.` : ''
  $('level-criteria').textContent = `Ranked by ${ranked}.${similar}`
}

// Explain a change of leader when the user goes one level deeper or shallower.
let noteText = ''
function renderNote(view) {
  const note = $('note')
  const leader = view.top[0]
  if (view.current && !view.ranked.some(point => point.pass)) {
    note.hidden = false
    note.textContent = 'No site meets every requirement on this date. The closest options are shown with what they miss.'
    return
  }
  note.hidden = !noteText
  note.textContent = noteText
}
function leaderChanged(previous, view) {
  const leader = view.top[0]
  if (!previous || !leader || previous.id === leader.id) return ''
  const before = view.current.find(point => point.id === previous.id)
  if (!before) return ''
  const deciding = view.keys.map(key => ({ key, change: criteria[key].diff(leader, before) }))
    .filter(item => item.change && criteria[item.key].value(leader) > criteria[item.key].value(before))
    .sort((a, b) => b.change.size - a.change.size)[0]
  const why = deciding ? ` It has ${deciding.change.text}.` : ''
  return `At ${levels[state.level - 1].name}, ${siteName(leader.site)} moves ahead of ${siteName(before.site)}.${why}`
}

// ---------- suggestion cards ----------
function renderSuggestions(view) {
  const box = $('suggestions')
  void comparisonViews.update({ start: startMs() + state.offset * day, hours: state.hours, terrain: state.terrain })
  box.replaceChildren()
  if (!view.visible.length) { box.append(html('p', 'muted', 'No South Pole sites are available.')); return }
  if (view.current === undefined) { box.append(html('p', 'muted', 'Calculating sunlight and Earth visibility…')); return }
  if (view.current === null) { box.append(html('p', 'muted', 'That date is outside the 2024–2030 ephemeris coverage.')); return }
  const leader = view.top[0]
  const passing = view.ranked.filter(point => point.pass)
  const shown = view.top.map((point, index) => ({ point, rank: index }))
  for (const [index, entry] of shown.entries()) {
    const { point, rank, pick } = entry
    const card = html('article', 'suggestion' + (pick ? ' pick' : '') + (rank === 0 ? ' lead' : '') + (point && !point.pass ? ' fail' : ''))
    if (pick) card.style.setProperty('--pick', pickColors[(index - view.top.length) % pickColors.length])
    const head = html('div', 'suggestion-head')
    const site = point?.site ?? siteById.get(entry.id)
    const title = html('div', 'title')
    const name = html('button', 'site-visit', siteName(site))
    name.type = 'button'
    name.title = `Descend to ${siteName(site)} in 3D`
    name.onclick = () => comparisonViews.openSite(site.id)
    const heading = html('h3', '')
    heading.append(name)
    title.append(heading)
    // The group only adds information when more than one group is on screen.
    if (state.regions.size > 1) title.append(html('span', 'muted', groupLabel(site)))
    head.append(html('span', 'rank', pick ? '+' : String(rank + 1)), title)
    if (pick) {
      const remove = html('button', 'unpin', '×')
      remove.type = 'button'
      remove.setAttribute('aria-label', `Remove ${siteName(site)}`)
      remove.addEventListener('click', () => togglePick(site.id))
      head.append(remove)
    }
    card.append(head)
    comparisonViews.mount(index, card, site)
    if (!point) { card.append(html('p', 'muted', 'Hidden by the “Where” filter.')); box.append(card); continue }
    let reason
    if (!point.pass) reason = `Misses ${point.misses.join(', ')}.`
    else if (rank > 0 && Math.abs(point.score - leader.score) < tieTolerance) reason = 'Effectively tied with #1. A deeper level can separate them.'
    else {
      const twin = shown.slice(0, index).find(other => other.point && view.keys.every(key => criteria[key].show(other.point) === criteria[key].show(point)))
      reason = twin && twin.rank > 0 ? `Same numbers as #${twin.rank + 1} on these factors.`
        : explain(point, pick ? 1 : rank, leader, passing.length ? passing : view.ranked, view.keys)
    }
    card.append(html('p', 'reason' + (point.pass ? '' : ' fail'), reason))
    const facts = html('dl', 'facts')
    for (const key of view.keys) {
      const term = html('dt', '', criteria[key].short)
      term.title = criteria[key].help
      facts.append(term, html('dd', '', criteria[key].show(point)))
    }
    card.append(facts, missionStrip({ ...point, duration: state.hours }), html('p', 'status', `${sky(point.sunUp, point.sunChange, 'Sun')} · ${sky(point.earthUp, point.earthChange, 'Earth')}`))
    if (state.level >= 5) {
      card.append(html('p', 'muted small', `${Math.abs(site.lat).toFixed(2)}°${site.lat < 0 ? 'S' : 'N'} ${Math.abs(site.lon).toFixed(2)}°${site.lon < 0 ? 'W' : 'E'} · ${site.location || site.kind} · Sun ${point.sunEl.toFixed(1)}° at landing · ${point.energy.toFixed(2)} kWh/m² flat panel`))
      const check = html('p', 'horizons small')
      check.append('Check in JPL Horizons: ')
      for (const [body, code] of [['Sun', '10'], ['Earth', '399']]) {
        const link = html('a', '', `${body} ↗`)
        link.href = horizonsUrl(site, code)
        link.target = '_blank'
        link.rel = 'noopener'
        link.title = `Azimuth and elevation of the ${body} from this site over the mission (smooth Moon, no terrain)`
        check.append(link, ' ')
      }
      card.append(check)
    }
    card.addEventListener('pointerenter', () => hover(point.id))
    card.addEventListener('pointerleave', () => hover(null))
    box.append(card)
  }
}
const sky = (up, change, body) => change === null ? `${body} ${up ? 'up' : 'down'} all mission` : `${body} ${up ? 'sets' : 'rises'} in ${formatHours(change)}`

// Opens NASA JPL Horizons with the same observer, time span and step, for an independent check of our Sun and Earth angles.
function horizonsUrl(site, target) {
  const pad = number => String(number).padStart(2, '0')
  const stamp = ms => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}` }
  const longitude = ((site.lon % 360) + 360) % 360
  const params = new URLSearchParams({
    format: 'text', COMMAND: `'${target}'`, OBJ_DATA: "'NO'", MAKE_EPHEM: "'YES'", EPHEM_TYPE: "'OBSERVER'", CENTER: "'coord@301'",
    COORD_TYPE: "'GEODETIC'", SITE_COORD: `'${longitude.toFixed(4)},${site.lat.toFixed(4)},${((site.height + 2) / 1000).toFixed(4)}'`,
    START_TIME: `'${stamp(startMs())}'`, STOP_TIME: `'${stamp(startMs() + state.hours * 3_600_000)}'`,
    STEP_SIZE: state.hours > 168 ? "'1 h'" : "'15 m'", QUANTITIES: "'4'",
  })
  return `https://ssd.jpl.nasa.gov/api/horizons.api?${params}`
}

function togglePick(id) {
  comparisonViews.openSite(id)
}

// Red (worse) through yellow to green (better): ColorBrewer RdYlGn in eight steps. Distinct steps are easier to
// compare than a smooth blend, and full-strength colours keep neighbouring steps apart on the dark background.
const goodnessSteps = ['#d73027', '#f46d43', '#fdae61', '#fee08b', '#d9ef8b', '#a6d96a', '#66bd63', '#1a9850']
const goodnessStep = value => Math.min(goodnessSteps.length - 1, Math.floor(Math.max(0, Math.min(1, value)) * goodnessSteps.length))
const goodness = value => goodnessSteps[goodnessStep(value)]
const goodnessInk = value => [0, 7].includes(goodnessStep(value)) ? '#ffffff' : '#141414'

// ---------- more options (Closer look and deeper), collapsed by default ----------
function renderList(view) {
  const box = $('options')
  box.replaceChildren()
  if (!view.current) return
  const shownIds = new Set([...view.top.map(point => point.id), ...state.picks])
  const rest = view.ranked.filter(point => !shownIds.has(point.id))
  // Sites with no sunlight and no Earth at all add rows but no information; name them in one line instead.
  const empty = rest.filter(point => point.sun === 0 && point.earth === 0)
  const rows = rest.filter(point => !empty.includes(point))
  if (!rest.length) return
  const toggle = html('button', 'link', state.showAll ? 'Show fewer' : `Show ${rest.length} more option${rest.length === 1 ? '' : 's'}`)
  toggle.type = 'button'
  toggle.setAttribute('aria-expanded', String(state.showAll))
  toggle.addEventListener('click', () => { state.showAll = !state.showAll; render() })
  box.append(toggle)
  if (!state.showAll) return
  const columns = `minmax(160px,1.4fr) repeat(${view.keys.length}, minmax(70px,1fr))`
  const header = html('div', 'option head')
  header.style.gridTemplateColumns = columns
  for (const [index, text] of ['Site', ...view.keys.map(key => criteria[key].short)].entries()) {
    const cell = html('span', '', text)
    if (index > 0) cell.title = criteria[view.keys[index - 1]].help
    header.append(cell)
  }
  if (rows.length) box.append(header)
  for (const point of rows) {
    const row = html('button', 'option' + (point.pass ? '' : ' fail'))
    row.type = 'button'
    row.style.gridTemplateColumns = columns
    const name = html('span', 'name')
    name.append(html('strong', '', `${point.pass ? view.ranked.indexOf(point) + 1 + '. ' : ''}${siteName(point.site)}`))
    if (!point.pass) name.append(html('span', 'miss', `misses ${point.misses[0]}`))
    row.append(name)
    for (const key of view.keys) {
      const cell = html('span', 'factor', criteria[key].show(point))
      cell.style.background = goodness(criteria[key].value(point))
      cell.style.color = goodnessInk(criteria[key].value(point))
      row.append(cell)
    }
    row.title = 'Click to compare'
    row.addEventListener('click', () => togglePick(point.id))
    box.append(row)
  }
  if (empty.length) box.append(html('p', 'muted small', `No sunlight or Earth view at all on this date: ${empty.map(point => siteName(point.site)).join(', ')}.`))
}

// ---------- scatter chart ----------
const dots = new Map()
function renderChart(view) {
  const chart = $('chart')
  const width = Math.max(300, $('chart-wrap').clientWidth)
  const height = Math.round(Math.min(380, Math.max(240, width * .4)))
  chart.setAttribute('viewBox', `0 0 ${width} ${height}`)
  chart.setAttribute('width', width)
  chart.setAttribute('height', height)
  const margin = { left: 48, right: 16, top: 12, bottom: 40 }
  const [x0, x1] = view.xRange
  const [y0, y1] = view.yRange
  const px = value => margin.left + (value - x0) / (x1 - x0) * (width - margin.left - margin.right)
  const py = value => height - margin.bottom - (value - y0) / (y1 - y0) * (height - margin.top - margin.bottom)
  let layers = chart.querySelector('.layers')
  if (!layers) {
    layers = svg('g', { class: 'layers' }, chart)
    for (const name of ['grid', 'front', 'trails', 'dots', 'labels']) svg('g', { class: name }, layers)
    dots.clear()
  }
  const layer = name => layers.querySelector('.' + name)
  for (const name of ['grid', 'front', 'trails']) layer(name).replaceChildren()

  const grid = layer('grid')
  const ticks = (low, high) => {
    const raw = (high - low) / 5
    const step = [.1, .2, .5, 1, 2, 5, 10, 20].find(candidate => candidate >= raw) ?? 20
    const values = []
    for (let value = Math.ceil(low / step) * step; value <= high + 1e-9; value += step) values.push(+value.toFixed(6))
    return values
  }
  for (const value of ticks(x0, x1)) {
    svg('line', { x1: px(value), x2: px(value), y1: margin.top, y2: height - margin.bottom, class: 'gridline' }, grid)
    svg('text', { x: px(value), y: height - margin.bottom + 16, class: 'tick', 'text-anchor': 'middle' }, grid).textContent = criteria[view.xKey].tick(value, state.hours)
  }
  for (const value of ticks(y0, y1)) {
    svg('line', { x1: margin.left, x2: width - margin.right, y1: py(value), y2: py(value), class: 'gridline' }, grid)
    svg('text', { x: margin.left - 7, y: py(value) + 4, class: 'tick', 'text-anchor': 'end' }, grid).textContent = criteria[view.yKey].tick(value, state.hours)
  }
  svg('text', { x: width - margin.right, y: height - 6, class: 'axis-title sun', 'text-anchor': 'end' }, grid).textContent = `${criteria[view.xKey].label} (better →)`
  svg('text', { x: 12, y: margin.top, class: 'axis-title earth', transform: `rotate(-90 12 ${margin.top})`, 'text-anchor': 'end' }, grid).textContent = `${criteria[view.yKey].label} (better →)`

  const current = view.current
  if (!current) { for (const node of dots.values()) node.dot.style.opacity = 0; return }

  const front = current.filter(point => point.pass && point.front).sort((a, b) => a.x - b.x)
  if (front.length > 1) {
    let path = `M${px(front[0].x)},${py(front[0].y)}`
    for (let index = 1; index < front.length; index++) path += ` L${px(front[index].x)},${py(front[index - 1].y)} L${px(front[index].x)},${py(front[index].y)}`
    svg('path', { d: path, class: 'front-line' }, layer('front'))
  }

  // Date trails appear from the robustness level, for suggestions and picks only.
  if (state.level >= 5) {
    for (const id of new Set([...view.top.map(point => point.id), ...state.picks, hovered].filter(Boolean))) {
      const path = dayOffsets.map(offset => view.byOffset.get(offset)?.find(point => point.id === id)).filter(Boolean)
      if (path.length < 2) continue
      svg('polyline', { points: path.map(point => `${px(point.x)},${py(point.y)}`).join(' '), class: 'trail' + (id === hovered ? ' hot' : '') }, layer('trails'))
    }
  }

  const topRank = new Map(view.top.map((point, index) => [point.id, index + 1]))
  const seen = new Set()
  const labels = []
  for (const point of current) {
    seen.add(point.id)
    let node = dots.get(point.id)
    if (!node) {
      const dot = svg('g', { class: 'dot', tabindex: 0, role: 'button' }, layer('dots'))
      svg('circle', { r: 6, class: 'mark' }, dot)
      svg('text', { class: 'rank-text', 'text-anchor': 'middle', y: 4 }, dot)
      const label = svg('text', { class: 'dot-label' }, layer('labels'))
      const id = point.id
      const enter = event => { showTooltip(id, event); hover(id) }
      const leave = () => { $('tooltip').hidden = true; hover(null) }
      dot.addEventListener('pointerenter', enter)
      dot.addEventListener('pointerleave', leave)
      dot.addEventListener('focus', enter)
      dot.addEventListener('blur', leave)
      dot.addEventListener('click', () => togglePick(id))
      dot.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); togglePick(id) } })
      node = { dot, label }
      dots.set(point.id, node)
    }
    node.point = point
    const x = px(point.x)
    const y = py(point.y)
    const rank = topRank.get(point.id)
    const pickIndex = state.picks.indexOf(point.id)
    node.dot.style.transform = `translate(${x}px, ${y}px)`
    node.dot.style.opacity = 1
    node.dot.style.pointerEvents = ''
    node.dot.setAttribute('class', `dot ${!point.pass ? 'fail' : point.front ? 'front' : 'beaten'}${rank ? ' top' : ''}${point.id === hovered ? ' hovered' : ''}${pickIndex >= 0 ? ' picked' : ''}`)
    node.dot.style.setProperty('--pick', pickIndex >= 0 ? pickColors[pickIndex] : 'transparent')
    node.dot.querySelector('.mark').setAttribute('r', rank ? 10 : 6)
    node.dot.querySelector('.rank-text').textContent = rank ? String(rank) : ''
    node.dot.setAttribute('aria-label', `${siteName(point.site)}: ${criteria[lastView.xKey].label} ${criteria[lastView.xKey].show(point)}, ${criteria[lastView.yKey].label} ${criteria[lastView.yKey].show(point)}`)
    const labelled = rank || pickIndex >= 0 || point.id === hovered
    node.label.style.opacity = labelled ? 1 : 0
    node.label.textContent = siteName(point.site)
    if (labelled) labels.push({ node, x, y })
  }
  for (const [id, node] of dots) if (!seen.has(id)) { node.dot.style.opacity = 0; node.label.style.opacity = 0; node.dot.style.pointerEvents = 'none' }
  labels.sort((a, b) => a.y - b.y)
  const placed = []
  for (const label of labels) {
    const flip = label.x > width - margin.right - 150
    let y = label.y + 4
    for (const other of placed) if (Math.abs(other.x - label.x) < 150 && Math.abs(other.y - y) < 14) y = other.y + 14
    placed.push({ x: label.x, y })
    label.node.label.setAttribute('text-anchor', flip ? 'end' : 'start')
    label.node.label.style.transform = `translate(${label.x + (flip ? -15 : 15)}px, ${y}px)`
  }
}

function showTooltip(id, event) {
  const point = dots.get(id)?.point
  if (!point) return
  const tooltip = $('tooltip')
  tooltip.replaceChildren(html('strong', '', siteName(point.site)),
    html('span', '', `${criteria[lastView.xKey].label}: ${criteria[lastView.xKey].show(point)} · ${criteria[lastView.yKey].label}: ${criteria[lastView.yKey].show(point)}`),
    html('span', 'muted', point.pass ? 'Click to compare' : `Misses ${point.misses.join(', ')}`))
  tooltip.hidden = false
  const wrap = $('chart-wrap').getBoundingClientRect()
  const rect = event.currentTarget.getBoundingClientRect()
  const left = Math.min(wrap.width - tooltip.offsetWidth - 4, Math.max(4, rect.left - wrap.left + 16))
  tooltip.style.transform = `translate(${left}px, ${Math.max(4, rect.top - wrap.top - tooltip.offsetHeight - 8)}px)`
}

// ---------- when-to-land heatmap (robustness level) ----------
function renderHeat(view) {
  const heat = $('heat')
  heat.replaceChildren()
  const anchor = view.byOffset.get(0) ?? view.current
  if (!anchor) return
  const width = Math.max(300, heat.parentElement.clientWidth)
  const narrow = width < 560
  const labelWidth = narrow ? 118 : 168
  const rowHeight = 20
  const header = 24
  const ranked = [...anchor].sort((a, b) => b.score - a.score)
  const focus = new Set([...view.top.map(point => point.id), ...state.picks])
  const rows = state.heatAll ? ranked : ranked.filter(point => focus.has(point.id))
  const toggle = $('heat-toggle')
  toggle.hidden = ranked.length <= rows.length && !state.heatAll
  toggle.textContent = state.heatAll ? 'Show top 3 only' : `Show all ${ranked.length} sites`
  const height = header + rows.length * rowHeight + 4
  heat.setAttribute('viewBox', `0 0 ${width} ${height}`)
  heat.setAttribute('width', width)
  heat.setAttribute('height', height)
  const cell = (width - labelWidth - 4) / dayOffsets.length
  const cellX = offset => labelWidth + (offset + 15) * cell
  const pattern = svg('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, svg('defs', {}, heat))
  svg('rect', { width: 5, height: 5, fill: '#111116' }, pattern)
  svg('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: '#46454f', 'stroke-width': 2 }, pattern)
  const scores = [...view.byOffset.values()].flatMap(points => points?.filter(point => point.pass).map(point => point.score) ?? [])
  const low = scores.length ? Math.min(...scores) : 0
  const high = scores.length ? Math.max(...scores) : 100
  for (const offset of [-15, -10, -5, 0, 5, 10, 15]) {
    if (narrow && Math.abs(offset) % 10 === 5) continue
    const anchorAt = offset === 15 ? 'end' : offset === -15 ? 'start' : 'middle'
    const x = offset === 15 ? cellX(offset) + cell : offset === -15 ? cellX(offset) : cellX(offset) + cell / 2
    svg('text', { x, y: 14, class: 'tick', 'text-anchor': anchorAt }, heat).textContent = offset === 0 ? 'your date' : `${offset > 0 ? '+' : ''}${offset} d`
  }
  svg('rect', { x: cellX(state.offset), y: header - 4, width: cell, height: rows.length * rowHeight + 6, class: 'heat-now' }, heat)
  for (const [index, anchorPoint] of rows.entries()) {
    const y = header + index * rowHeight
    const name = siteName(anchorPoint.site)
    const label = svg('text', { x: labelWidth - 8, y: y + 14, class: 'heat-label' + (anchorPoint.pass ? '' : ' fail'), 'text-anchor': 'end' }, heat)
    label.textContent = narrow && name.length > 16 ? name.slice(0, 15) + '…' : name
    label.setAttribute('role', 'button')
    label.setAttribute('tabindex', '0')
    label.setAttribute('aria-label', `View ${name} from the lunar surface`)
    label.style.cursor = 'pointer'
    label.addEventListener('click', () => comparisonViews.openSite(anchorPoint.id))
    label.addEventListener('keydown', event => {
      if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); comparisonViews.openSite(anchorPoint.id) }
    })
    for (const offset of dayOffsets) {
      const point = view.byOffset.get(offset)?.find(candidate => candidate.id === anchorPoint.id)
      if (!point) continue
      const rect = svg('rect', { x: cellX(offset) + .5, y: y + 1, width: Math.max(1, cell - 1), height: rowHeight - 2, rx: 2, class: 'heat-cell',
        fill: 'url(#hatch)' }, heat)
      if (point.pass) rect.style.fill = goodness(high > low ? (point.score - low) / (high - low) : 1)
      svg('title', {}, rect).textContent = `${name} · ${dateLabel(startMs() + offset * day)}: ${point.pass ? `score ${Math.round(point.score)}` : `misses ${point.misses.join(', ')}`}`
      // Clicking a day makes it the landing date, so the window re-centres on it.
      rect.addEventListener('click', () => {
        if (offset === 0) return
        const next = new Date(startMs() + offset * day).toISOString().slice(0, 10)
        if (next < $('date').min || next > $('date').max) return
        state.date = next
        noteText = `Landing date moved ${Math.abs(offset)} day${Math.abs(offset) === 1 ? '' : 's'} ${offset > 0 ? 'later' : 'earlier'}, to ${dateLabel(startMs())}.`
        compute()
      })
    }
  }
}

// ---------- full table (everything level) ----------
const columns = [
  ['name', 'Site', point => siteName(point.site)],
  ['sun', 'Sun %', point => Math.round(point.sun)],
  ['earth', 'Earth %', point => Math.round(point.earth)],
  ['overlap', 'Both %', point => Math.round(point.overlap)],
  ['darkGap', 'Max dark', point => formatHours(point.darkGap)],
  ['earthGap', 'Max Earth gap', point => formatHours(point.earthGap)],
  ['touchdown', 'Both from landing', point => formatHours(point.touchdown)],
  ['floor', 'Worst ±3 d', point => point.floor === undefined ? '—' : Math.round(point.floor)],
  ['energy', 'kWh/m² (flat)', point => point.energy.toFixed(2)],
  ['score', 'Score', point => point.score.toFixed(1)],
  ['pass', 'Status', point => point.pass ? (point.front ? 'front' : 'dominated') : 'fails'],
]
function renderTable(view) {
  const table = $('table')
  table.replaceChildren()
  if (!view.current) return
  const { key, descending } = state.sort
  const value = point => key === 'name' ? siteName(point.site) : key === 'pass' ? (point.pass ? (point.front ? 2 : 1) : 0) : point[key] ?? -1
  const rows = [...view.current].sort((a, b) => {
    const left = value(a)
    const right = value(b)
    const order = typeof left === 'string' ? left.localeCompare(right) : left - right
    return descending ? -order : order
  })
  const head = html('tr')
  for (const [columnKey, label] of columns) {
    const th = html('th')
    th.setAttribute('aria-sort', columnKey === key ? (descending ? 'descending' : 'ascending') : 'none')
    const button = html('button', 'sort', label + (columnKey === key ? (descending ? ' ↓' : ' ↑') : ''))
    button.type = 'button'
    button.addEventListener('click', () => { state.sort = { key: columnKey, descending: columnKey === key ? !descending : columnKey !== 'name' }; render() })
    th.append(button)
    head.append(th)
  }
  const thead = html('thead')
  thead.append(head)
  const body = html('tbody')
  for (const point of rows) {
    const tr = html('tr', point.pass ? (point.front ? 'front' : '') : 'fail')
    tr.tabIndex = 0
    tr.addEventListener('click', () => togglePick(point.id))
    tr.addEventListener('keydown', event => { if (event.key === 'Enter') togglePick(point.id) })
    for (const [, , format] of columns) tr.append(html('td', '', String(format(point))))
    body.append(tr)
  }
  table.append(thead, body)
}
function exportCsv() {
  const view = buildView()
  const lines = [['site', 'lat', 'lon', 'landing_utc', 'mission_hours', 'terrain', 'offset_days', 'sun_pct', 'earth_pct', 'both_pct',
    'max_dark_h', 'max_earth_gap_h', 'both_from_landing_h', 'flat_panel_kwh_m2', 'level', 'score', 'meets_requirements'].join(',')]
  for (const [offset, points] of [...view.byOffset].sort((a, b) => a[0] - b[0])) {
    for (const point of points ?? []) {
      lines.push([JSON.stringify(siteName(point.site)), point.site.lat, point.site.lon, new Date(startMs() + offset * day).toISOString(), state.hours,
        state.terrain, offset, point.sun.toFixed(2), point.earth.toFixed(2), point.overlap.toFixed(2), point.darkGap.toFixed(2),
        point.earthGap.toFixed(2), point.touchdown.toFixed(2), point.energy.toFixed(4), state.level, point.score.toFixed(2), point.pass].join(','))
    }
  }
  const link = html('a')
  link.href = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv' }))
  link.download = `astralis-${state.date}.csv`
  link.click()
  setTimeout(() => URL.revokeObjectURL(link.href), 1000)
}

// ---------- controls ----------
for (const level of levels) {
  const button = html('button', '')
  button.type = 'button'
  button.dataset.level = level.id
  button.title = level.question
  button.append(html('span', 'step', String(level.id)), html('span', 'name', level.name))
  button.addEventListener('click', () => {
    comparisonViews.returnToComparison(false)
    const previous = buildView().top[0]
    state.level = level.id
    const view = buildView()
    noteText = leaderChanged(previous && { id: previous.id }, view)
    render()
  })
  $('levels').append(button)
}
for (const [key, preset] of Object.entries(presets)) $('presets').append(new Option(preset.label, key))
$('presets').append(Object.assign(new Option('Custom', 'custom'), { disabled: true }))
$('presets').addEventListener('change', () => {
  const preset = presets[$('presets').value]
  if (!preset) return
  const lengthChanged = preset.hours !== state.hours
  Object.assign(state, { preset: $('presets').value, hours: preset.hours, weight: preset.weight, req: { ...preset.req } })
  noteText = ''
  lengthChanged ? compute() : render()
})
const custom = () => { state.preset = null; noteText = '' }
// Any duration from 6 hours to 60 days, snapped to the 15-minute ephemeris step.
function durationHours(days) {
  if (!Number.isFinite(days) || days <= 0) return null
  return Math.min(60 * 24, Math.max(6, Math.round(days * 96) / 4))
}
$('duration').addEventListener('change', () => {
  const hours = durationHours(Number($('duration').value))
  if (hours === null) { $('duration').value = +(state.hours / 24).toFixed(2); return }
  if (hours === state.hours) return
  state.hours = hours
  custom()
  compute()
})
$('date').addEventListener('change', () => { if ($('date').value) { state.date = $('date').value; noteText = ''; compute() } })
$('time').addEventListener('change', () => { if ($('time').value) { state.time = $('time').value; compute() } })
$('weight').addEventListener('input', () => { state.weight = Number($('weight').value) / 100; custom(); render() })
for (const key of ['sun', 'earth']) {
  $(`req-${key}`).addEventListener('input', () => {
    state.req[key] = clampRequirement(key, Number($(`req-${key}`).value))
    $(`req-${key}`).value = state.req[key]
    custom()
    render()
  })
}
for (const key of ['dark', 'blackout']) {
  $(`req-${key}`).addEventListener('input', () => {
    const slider = $(`req-${key}`)
    const value = clampRequirement(key, Number(slider.value))
    slider.value = value
    state.req[key] = value >= Number(slider.max) ? null : value
    custom()
    render()
  })
}
for (const axis of ['x', 'y']) {
  const select = $(`${axis}-axis`)
  select.append(new Option('Most decisive', ''), ...Object.entries(criteria).map(([key, item]) => new Option(item.label, key)))
  select.addEventListener('change', () => { state[axis] = select.value || null; render() })
}
$('export').addEventListener('click', exportCsv)
$('heat-toggle').addEventListener('click', () => { state.heatAll = !state.heatAll; render() })

new ResizeObserver(() => scheduleRender()).observe($('chart-wrap'))

loadHash()
syncControls()
job += 1
worker.postMessage({ type: 'catalog', job })
