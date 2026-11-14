import { annualMissionHours, binaryFrames, evaluate, flatPanelFactor, frameAt, longestGap, missionCrossings, nextSkyCrossing, radius, rank, siteSkyModel, siteSolarPower, skyCrossings, solarExposure } from './planner.mjs'
import { createGlobe } from './globe.mjs'
import { calendarSpaceWindow, createSpaceView, readSpaceSamples, spaceStep } from './space-view.mjs'
import { terrainAt } from './terrain.mjs'
import { drawLocalSky, skyPathSegments, skyRange } from './sky-view.mjs'
import { createSurfaceView, loadSurfaceMesh, nearbyCraters, surfacePaths } from './surface-view.mjs'
import { createCoverageMap, solarPowerColor, solarPowerPalette, solarPowerScaleMax, southPolePowerMax, subPoint } from './coverage-map.mjs'
import { artemisSouthLatitude, missionOverlapGrid, missionQuarters, overlapRgb, southPoleOverlapGrid, windowHours } from './mission-heat.mjs'

const get = id => document.getElementById(id)
const inputs = (...ids) => ids.map(get)
const hour = 3_600_000
const day = 24 * hour
const utc = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })
const monthLabel = new Intl.DateTimeFormat('en', { month: 'short', timeZone: 'UTC' })
const dateLabel = epoch => utc.format(new Date(epoch)) + ' UTC'
const controlDate = epoch => new Date(epoch).toISOString().slice(0, 16)
const formatHours = hours => (hours < .05 && hours > 1e-8 ? '<0.1' : Number(hours.toFixed(1))) + ' h'
const formatPercent = new Intl.NumberFormat('en', { style: 'percent', maximumFractionDigits: 1 })
const formatPower = watts => `${watts > 0 && watts < .1 ? '<0.1' : Number(watts.toFixed(1))} W/m²`
const compass = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
const skyLookahead = 30 * 24
const chartColumns = ['sunEl', 'earthEl', 'sunHorizon', 'earthHorizon']
const timelineStep = duration => duration > 24 ? 24 : 1
const signedDegrees = value => (value > 0 ? '+' : '') + value.toFixed(2) + '°'
const presets = { sun: [100, 0, 0], earth: [0, 100, 0], overlap: [0, 0, 100], balanced: [40, 40, 20] }
const weightInputs = inputs('sun-weight', 'earth-weight', 'overlap-weight')
const metricNames = { sun: 'Sunlight', earth: 'Earth in view', overlap: 'Both together' }
const lessons = {
  delay: {
    sites: ['athena', 'athena'], dates: ['2026-11-14', '2026-11-17'],
    answer: (a, b) => `At Mons Mouton, the time with sunlight and a view of Earth together grows from ${formatHours(a.metrics.overlap)} to ${formatHours(b.metrics.overlap)}. A schedule change can make the same spot much more useful.`,
  },
  far: {
    sites: ['apollo-11', 'change-4'], dates: ['2026-12-01', '2026-12-01'],
    answer: (a, b) => `Apollo 11’s site has ${formatHours(a.metrics.earth)} with Earth in view. Chang’e 4’s far-side site has ${formatHours(b.metrics.earth)}. A relay satellite can carry messages when Earth is out of direct view.`,
  },
  power: {
    sites: ['peak', 'apollo-12'], dates: ['2026-12-01', '2026-12-01'],
    answer: (a, b) => `Both sites get ${formatHours(a.metrics.sun)} of sunlight, but a flat panel receives about ${formatHours(a.power.beamHours)} of full-strength sunlight near Shackleton and ${formatHours(b.power.beamHours)} at Apollo 12. Low sunlight hits the panel at a shallow angle.`,
  },
}
const siteName = site => site.id === 'athena' ? 'Mons Mouton' : site.id === 'odysseus' ? 'Malapert A' : site.id === 'mouton' ? 'Mons Mouton Plateau' : site.name
const futureClps = site => site.kind.startsWith('Future CLPS target')
const siteDetail = site => ['odysseus', 'athena'].includes(site.id) ? site.name + ' · Historic landing site' : site.location || site.kind
const coordinate = (value, plus, minus) => Math.abs(value).toFixed(2) + '°' + (value < 0 ? minus : plus)
const terrainLabel = (site, model) => model === 'terrain' ? site.terrain : '0° reference plane'
const siteCoordinates = site => coordinate(site.lat, 'N', 'S') + ', ' + coordinate(site.lon, 'E', 'W')
const searchText = value => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const siteSource = site => ({ nssdc: 'https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html',
  'nasa-surface': 'https://ntrs.nasa.gov/citations/20250002845' }[site.source] ??
  (/^\d+$/.test(site.source) ? `https://planetarynames.wr.usgs.gov/Feature/${site.source}` : null))
const element = (tag, className, value) => {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (value !== undefined) node.textContent = value
  return node
}

function syncExperience() {
  const exploring = location.hash === '#explore'
  const wasExploring = get('workspace').dataset.mode === 'explore'
  get('workspace').dataset.mode = exploring ? 'explore' : 'planner'
  get('explore').hidden = !exploring
  for (const [mode, current] of [['explore', exploring], ['planner', !exploring]]) {
    if (current) get(`mode-${mode}`).setAttribute('aria-current', 'page')
    else get(`mode-${mode}`).removeAttribute('aria-current')
  }
  if (exploring) {
    stop()
    stopSpaceYear()
    renderLesson()
    requestAnimationFrame(() => get('explore').scrollIntoView({ behavior: 'instant' }))
  } else if (active) requestAnimationFrame(() => {
    showTime()
    if (wasExploring) get(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' })
  })
}

function renderLesson() {
  if (!catalog || !ephemeris) return
  const key = get('explore-case').value
  const lesson = lessons[key]
  const scenarios = lesson.sites.map((id, index) => {
    const site = catalog.catalog.find(entry => entry.id === id)
    const start = Date.parse(lesson.dates[index] + 'T00:00:00Z')
    const result = evaluate(site, framesFor(start, 24), 24, true)
    return { ...result, start, power: solarExposure(result.timeline, result.sun, 24) }
  })
  get('explore-conclusion').textContent = lesson.answer(...scenarios)
  get('explore-results').replaceChildren(...scenarios.map(result => {
    const card = element('article', 'explore-scenario')
    const time = element('time', '', dateLabel(result.start))
    time.dateTime = new Date(result.start).toISOString()
    card.append(element('h3', '', siteName(result.site)), time, axis(24), ...timeline(result, 24))
    if (key === 'power') card.append(element('p', 'muted', `${formatHours(result.power.beamHours)} equivalent full-sun hours for a flat panel`))
    return card
  }))
}

function openLessonInPlanner() {
  if (!settings) return
  const lesson = lessons[get('explore-case').value]
  get('landing-date').value = lesson.dates[0]
  get('landing-time').value = '00:00'
  get('duration').value = '24'
  get('model').value = 'terrain'
  selected = lesson.sites[0]
  inspectedSite = true
  elapsed = 0
  recalculate()
  get('compare-a').value = lesson.sites[0]
  get('compare-b').value = lesson.sites[1]
  get('compare-time').value = `${lesson.dates[1]}T00:00`
  comparisonEdited = true
  compare()
  location.hash = 'compare'
  syncExperience()
  get('compare-heading').focus({ preventScroll: true })
  get('compare').scrollIntoView({ behavior: 'instant' })
}

let catalog
let ephemeris
const customSites = []
let pendingCoordinate = 0
let customCount = 0
let ranked = []
let active
let selected
let elapsed = 0
let settings
let playing = null
let comparisonEdited = false
let globe
let updateSpace
let spaceYearMode = false
let spaceYearWindow
let spaceYearHours = 0
let spaceYearPlayback = null
let inspectedSite = false
let features = []
let gazetteerRequest
let surfaceCraters = []
let labelsBySize = []
let namedFeature
let fetchingFeatures = false
let localSky
let surfaceView
let surfaceSite
let surfaceRequest = 0
let drawCoverage
let coverageFrame
let coverageEpoch
let powerFrame
let regionalPowerMax
let missionFrames
let siteEvaluations
let activeRankedRow
let southOnly = false
const inMapRegion = site => !southOnly || site.lat <= artemisSouthLatitude
const heatMaps = new Map()
let heatDisplay
let heatReference

function error(id, message = '') {
  get(id).textContent = message
  get(id).hidden = !message
}

function currentSettings() {
  const start = Date.parse(get('landing-date').value + 'T' + get('landing-time').value + 'Z')
  const window = get('duration').value
  const annual = window === 'year'
  const duration = annual ? annualMissionHours(start) : Number(window)
  const [sun, earth, overlap] = weightInputs.map(input => Number(input.value))
  const weightSum = sun + earth + overlap
  weightInputs.forEach(input => {
    document.querySelector('output[for="' + input.id + '"]').value = weightSum ? Math.round(Number(input.value) / weightSum * 100) + '%' : '0%'
  })
  if (!Number.isFinite(start) || !get('landing-date').validity.valid || start < catalog.startMs || start + duration * hour > catalog.endMs) {
    if (annual) {
      const latest = new Date(catalog.endMs)
      latest.setUTCFullYear(latest.getUTCFullYear() - 1)
      throw new Error(`For a full year, choose a landing time from ${dateLabel(catalog.startMs)} through ${dateLabel(latest.getTime())}.`)
    }
    throw new Error('Choose a UTC landing time that keeps the mission between 1 Jan 2024 and 1 Jan 2031.')
  }
  if (!weightSum) throw new Error('Set at least one priority weight above zero.')
  const requirements = inputs('min-sun', 'min-earth', 'min-overlap', 'max-dark', 'max-earth-gap')
  if (requirements.some(input => !input.validity.valid)) throw new Error('Enter requirement values from 0 to 8,784 hours.')
  const [minSun, minEarth, minOverlap] = requirements.map(input => Number(input.value))
  const maximum = id => get(id).value === '' ? Infinity : Number(get(id).value)
  return { start, duration, annual, horizon: get('model').value, weights: { sun, earth, overlap },
    limits: { sun: minSun, earth: minEarth, overlap: minOverlap, darkness: maximum('max-dark'), blackout: maximum('max-earth-gap') } }
}

function framesFor(start, duration) {
  const sample = catalog.step * 1000
  const first = (start - catalog.startMs) / sample
  return Array.from({ length: duration * 4 + 1 }, (_, index) => frameAt(ephemeris, first + index))
}

function recalculate(reuseSettings = false) {
  if (!catalog) return
  stop()
  if (!reuseSettings) {
    let nextSettings
    try { nextSettings = currentSettings() } catch (reason) {
      error('input-error', reason.message + ' Showing the last valid result.')
      return
    }
    if (nextSettings.start !== settings?.start) elapsed = 0
    settings = nextSettings
    error('input-error')
  }
  const { start, duration, annual, weights, limits, horizon } = settings
  const yearDates = get('mission-year-dates')
  yearDates.hidden = !annual
  yearDates.textContent = annual ? `${duration / 24} days · Ends ${dateLabel(start + duration * hour)}` : ''
  if (missionFrames?.start !== start || missionFrames?.duration !== duration) {
    for (const { worker } of heatMaps.values()) worker?.terminate()
    heatMaps.clear()
    heatDisplay = undefined
    missionFrames = { start, duration, frames: framesFor(start, duration) }
    const menu = get('mission-heat-period')
    const period = menu.value || '0'
    const quarters = Array.from({ length: missionQuarters }, (_, index) => {
      const unit = annual ? 'd' : 'h'
      const length = duration / (annual ? 24 : 1) / missionQuarters
      return new Option(`Quarter ${index + 1} · +${index * length} to +${(index + 1) * length} ${unit}`, index + 1)
    })
    menu.replaceChildren(new Option('Entire mission', '0'), ...quarters)
    menu.value = period
  }
  const sites = [...catalog.catalog, ...customSites]
  if (siteEvaluations?.mission !== missionFrames || siteEvaluations.horizon !== horizon) {
    siteEvaluations = { mission: missionFrames, horizon, rows: new Map() }
  }
  const { rows } = siteEvaluations
  for (const site of rows.keys()) if (!sites.includes(site)) rows.delete(site)
  for (const site of sites) {
    if (!rows.has(site)) rows.set(site, evaluate(site, missionFrames.frames, duration, horizon === 'terrain', { includeTimeline: !annual }))
  }
  ranked = rank(sites.map(site => rows.get(site)), weights, limits, duration)
  for (const { layers } of heatMaps.values()) {
    for (const layer of layers.values()) layer.overlaps = undefined
  }
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

function withMissionTimeline(row) {
  if (row.timeline) return row
  if (row === activeRankedRow) return active
  const sampleSky = siteSkyModel(row.site, settings.horizon === 'terrain')
  return { ...row, timeline: missionFrames.frames.map(sampleSky) }
}

function showResult() {
  const row = ranked.find(candidate => candidate.site.id === selected)
  active = withMissionTimeline(row)
  activeRankedRow = row
  if (localSky?.row !== active) prepareLocalSky()
  for (const siteControl of inputs('space-site', 'assessment-site')) {
    siteControl.replaceChildren(...ranked.map(({ site }) => {
      const option = element('option', '', siteName(site))
      option.value = site.id
      return option
    }))
    siteControl.value = selected
  }
  showAssessment()
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
  get('answer-body').textContent = body + ' ' + (settings.horizon === 'terrain' ? 'Using LOLA terrain horizons.' : 'Using the 0° reference plane.')
  get('rank-summary').textContent = best.place === null ? 'Showing closest matches first.' : 'Ranked for your mission priorities.'
  showRanking()
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
  if (spaceYearMode) showSpaceTime()
}

function windowList(windows, start) {
  const list = element('ul')
  for (const [first, last] of windows) {
    list.append(element('li', '', `${dateLabel(start + first * hour)} → ${dateLabel(start + last * hour)} (${formatHours(last - first)})`))
  }
  if (!windows.length) list.append(element('li', '', 'None in this mission window'))
  return list
}

function showAssessment() {
  const { start, duration, horizon, limits } = settings
  const { site, timeline: samples, sun, earth, metrics, unmet } = active
  const landing = samples[0]
  const { beamHours, peak } = solarExposure(samples, sun, duration)
  const percentage = value => formatPercent.format(value)
  const sunStatus = landing.eclipse ? 'total eclipse' : landing.sunEl > landing.sunHorizon ? 'in view' : 'blocked by skyline'
  const earthVisible = landing.earthEl > landing.earthHorizon
  const panelFactor = sunStatus === 'in view' ? flatPanelFactor(landing.sunEl) : 0
  const longestView = Math.max(0, ...earth.map(([a, b]) => b - a))
  const values = {
    context: `${siteName(site)} · ${dateLabel(start)} · ${formatHours(duration)} · ${terrainLabel(site, horizon)}`,
    'sun-total': `${formatHours(metrics.sun)} of sunlight · ${percentage(metrics.sun / duration)} of mission`,
    'earth-total': `${formatHours(metrics.earth)} in view · ${percentage(metrics.earth / duration)} of mission`,
    'sun-angle': `${signedDegrees(landing.sunEl)} · ${sunStatus} · ${percentage(panelFactor)} of direct beam on a flat panel`,
    peak: peak === null ? 'No sunlight in this window' : signedDegrees(peak),
    exposure: formatHours(beamHours),
    'dark-gap': formatHours(metrics.darkness),
    'earth-angle': `${signedDegrees(landing.earthEl)} · ${earthVisible ? 'in view' : 'blocked by skyline'}`,
    'earth-run': formatHours(longestView),
    'earth-gap': formatHours(metrics.blackout),
    overlap: formatHours(metrics.overlap),
  }
  for (const [key, value] of Object.entries(values)) get(`assessment-${key}`).textContent = value

  for (const [key, windows] of [['dark', sun], ['earth', earth]]) {
    const gap = longestGap(windows, duration)
    get(`assessment-${key}-time`).textContent = gap ? `Longest gap · ${dateLabel(start + gap[0] * hour)} → ${dateLabel(start + gap[1] * hour)}` : ''
  }

  const checks = [
    ['Sunlight', 'sun', 'At least', 'Minimum sunlight'],
    ['Earth visibility', 'earth', 'At least', 'Minimum Earth visibility'],
    ['Overlap', 'overlap', 'At least', 'Minimum overlap'],
    ['Dark gap', 'darkness', 'At most', 'Maximum dark gap'],
    ['Earth visibility gap', 'blackout', 'At most', 'Maximum Earth visibility gap'],
  ].filter(([, key, mode]) => Number.isFinite(limits[key]) && (mode === 'At most' || limits[key] > 0))
  const status = get('assessment-status')
  const total = checks.length
  status.classList.toggle('failed', unmet.length > 0)
  status.textContent = 'No mission limits set. Set them in Mission setup → Advanced settings.'
  if (total === 1 && !unmet.length) status.textContent = 'Meets the mission limit'
  else if (total) status.textContent = unmet.length ? `Meets ${total - unmet.length} of ${total} mission limits` : `Meets all ${total} mission limits`
  get('assessment-limits').hidden = !total
  get('assessment-checks').replaceChildren(...checks.map(([failure, key, mode, label]) =>
    element('li', '', `${unmet.includes(failure) ? 'Misses' : 'Meets'} · ${label} · ${mode.toLowerCase()} ${formatHours(limits[key])} · modeled ${formatHours(metrics[key])}`)))

  get('assessment-windows').replaceChildren(...[['Sunlight', sun], ['Direct Earth visibility', earth], ['Both together', metrics.both]].map(([label, windows]) => {
    const column = element('div')
    column.append(element('h4', '', label), windowList(windows, start))
    return column
  }))
  get('assessment').hidden = false
}

function showRanking() {
  const query = searchText(get('site-search').value.trim())
  const group = get('site-group').value
  const matches = ranked.filter(({ site }) => {
    const text = searchText([siteName(site), site.name, site.kind, site.location].join(' '))
    const type = site.kind.includes('Historic') ? 'historic' : futureClps(site) ? 'clps' : site.kind === 'Custom coordinates' ? 'custom' : 'study'
    return (group === 'all' || group === type) && text.includes(query)
  })
  get('site-count').textContent = matches.length === ranked.length ? ranked.length + ' sites' : `${matches.length} of ${ranked.length}`
  get('future-clps-note').hidden = group !== 'clps'
  get('rank-empty').hidden = !!matches.length
  get('rank-list').replaceChildren(...matches.map(row => {
    const item = element('li')
    const button = element('button', 'rank-row' + (row.unmet.length ? ' unmet' : ''))
    button.type = 'button'
    button.setAttribute('aria-pressed', String(row.site.id === selected))
    const mission = futureClps(row.site) ? 'Future CLPS · ' + row.site.location : ''
    button.setAttribute('aria-label', siteName(row.site) + ', ' + (mission ? mission + ', ' : '') + (row.place ? 'rank ' + row.place : 'misses ' + row.unmet.join(', ')) +
      ', sunlight ' + formatHours(row.metrics.sun) + ', Earth in view ' + formatHours(row.metrics.earth) + ', both ' + formatHours(row.metrics.overlap))
    const name = element('span', 'site-name')
    const title = element('span', '', siteName(row.site))
    if (mission) title.append(element('small', 'rank-mission', mission))
    name.append(element('span', 'place', row.place ?? '–'), title)
    button.append(name, ...['sun', 'earth', 'overlap'].map(key => element('span', 'value', formatHours(row.metrics[key]))))
    if (row.unmet.length) button.title = 'Misses: ' + row.unmet.join(', ')
    button.addEventListener('click', () => selectSite(row.site.id, true, true))
    item.append(button)
    return item
  }))
}

function selectSite(id, focus, center = false) {
  selected = id
  inspectedSite = true
  showResult()
  if (center) {
    if (globe && !get('show-globe').disabled && get('coverage-view').hidden) useMap('globe')
    if (inMapRegion(active.site)) globe?.center(active.site)
  }
  if (focus) [...get('rank-list').querySelectorAll('button')].find(button => button.getAttribute('aria-pressed') === 'true')?.focus()
}

function showMap() {
  const { site } = active
  get('map-site-name').textContent = siteName(site)
  const details = [siteCoordinates(site), site.kind, terrainLabel(site, settings.horizon)]
  if (futureClps(site)) details.splice(1, 0, site.location)
  get('map-site-detail').textContent = details.join(' · ')
  const source = siteSource(site)
  get('map-site-source').hidden = !source
  if (source) get('map-site-source').href = source
  get('remove-custom').hidden = site.kind !== 'Custom coordinates'
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
    button.hidden = !inMapRegion(site)
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
  for (const [mode, button] of [['polar', 'show-map'], ['globe', 'show-globe'], ['coverage', 'show-coverage']]) {
    get(`${mode}-view`).hidden = view !== mode
    get(button).setAttribute('aria-pressed', String(view === mode))
  }
  get('site-map-legend').hidden = view === 'coverage'
  get('coverage-toolbar').hidden = view === 'polar'
  if (view === 'globe') {
    if (southOnly) globe?.southPole()
    else globe?.draw()
  }
  showCoverageLegend()
  showCoverage()
}

function evaluateMapPoint({ lat, lon }) {
  if (!inMapRegion({ lat })) return
  get('latitude').value = lat.toFixed(5)
  get('longitude').value = lon.toFixed(5)
  void addCoordinate()
}

function showCoverage() {
  const flat = !get('coverage-view').hidden
  const onGlobe = !get('globe-view').hidden
  const mode = get('coverage-layer').value
  const visible = Boolean(active) && (flat || onGlobe) && mode !== 'off'
  const mission = visible && mode === 'mission'
  const power = visible && mode === 'power'
  const northLatitude = southOnly ? artemisSouthLatitude : 90
  const heat = heatMaps.get(southOnly)
  get('mission-heat-details').hidden = !mission
  get('mission-heat-period-label').hidden = !mission
  get('mission-heat-models').hidden = !mission
  get('coverage-details').hidden = !visible || mission
  get('power-details').hidden = !power
  for (const id of ['coverage-legend', 'coverage-notes', 'coverage-summary']) get(id).hidden = power
  get('coverage-clock').hidden = !visible || mission
  get('coverage-canvas').hidden = Boolean(mission && !heat?.grid)
  if (!mission) heatDisplay = undefined
  if ((!mission || !heat?.grid) && (!power || flat)) globe?.setSiteScores()
  if (!visible) {
    if (onGlobe) {
      globe?.setCoverage(null, 'off', northLatitude)
      get('globe-canvas').setAttribute('aria-describedby', 'map-scope globe-pole-note')
    } else if (flat && active) {
      drawCoverage ??= createCoverageMap(get('coverage-canvas'), evaluateMapPoint)
      drawCoverage(null, active.site, 'off', { northLatitude })
      get('coverage-canvas').setAttribute('aria-label', `${southOnly ? 'South Pole' : 'Whole-Moon'} terrain map`)
      get('coverage-canvas').setAttribute('aria-describedby', 'map-scope')
    }
    return
  }
  if (mission) {
    showMissionHeat(flat)
    return
  }
  const epoch = settings.start + elapsed * hour
  if (coverageEpoch !== epoch) {
    coverageEpoch = epoch
    coverageFrame = frameAt(ephemeris, (epoch - catalog.startMs) / (catalog.step * 1000))
  }
  let powerScores
  let powerMax = solarPowerScaleMax
  if (power && (!flat || southOnly)) {
    const frameIndex = Math.round(elapsed * 4)
    powerScores = ranked.filter(({ site }) => inMapRegion(site)).map(({ site, timeline }) => {
      const sample = timeline?.[frameIndex] ?? siteSkyModel(site, settings.horizon === 'terrain')(coverageFrame)
      return { site, sample, watts: siteSolarPower(sample) }
    })
    if (southOnly) {
      if (powerFrame !== coverageFrame) {
        regionalPowerMax = southPolePowerMax(...coverageFrame, artemisSouthLatitude)
        powerFrame = coverageFrame
      }
      powerMax = Math.max(regionalPowerMax, ...powerScores.map(score => score.watts))
    }
  }
  if (power) {
    const gradient = get('power-gradient')
    gradient.classList.toggle('no-power', powerMax === 0)
    get('power-scale-mid').textContent = powerMax > 0 ? formatPower(powerMax / 2) : ''
    get('power-scale-max').textContent = powerMax > 0 ? formatPower(powerMax) : ''
    const scaleNote = get('power-scale-note')
    scaleNote.hidden = !southOnly
    scaleNote.textContent = powerMax > 0 ? 'Color scale follows the South Pole maximum at the selected time.' : 'Zero modeled solar power in the South Pole region at this time.'
  }
  if (flat) {
    drawCoverage ??= createCoverageMap(get('coverage-canvas'), evaluateMapPoint)
    drawCoverage(coverageFrame, active.site, mode, { northLatitude, powerMax })
  } else {
    globe?.setCoverage(coverageFrame, mode, northLatitude, powerMax)
    if (powerScores) {
      const scores = new Map(powerScores.map(({ site, sample, watts }) => {
        const number = formatPower(watts)
        return [site.id, { number, label: `Sun ${signedDegrees(sample.sunEl)} · ${number} estimated electrical output`,
          color: `rgb(${solarPowerColor(watts, powerMax).join(',')})`, nearZero: watts === 0 }]
      }))
      globe?.setSiteScores(scores)
    }
  }
  const time = dateLabel(epoch)
  const clock = get('coverage-clock')
  clock.textContent = time
  clock.dateTime = new Date(epoch).toISOString()
  const slider = get('coverage-time')
  slider.max = settings.duration
  slider.value = String(elapsed)
  slider.setAttribute('aria-valuetext', time)
  const sample = active.timeline[Math.round(elapsed * 4)]
  const siteOutside = `${siteName(active.site)} is outside the South Pole region. Choose a site between 84°S and 90°S.`
  const sun = sample.eclipse ? 'Total solar eclipse' : sample.sunEl > sample.sunHorizon ? 'Sun in view' : 'Sun blocked by skyline'
  if (power) {
    get('power-output').textContent = inMapRegion(active.site) ? `${siteName(active.site)} · ${formatPower(siteSolarPower(sample))}` : siteOutside
    get('power-site-angle').textContent = inMapRegion(active.site) ? `Sun elevation ${signedDegrees(sample.sunEl)} · ${sun} · ${terrainLabel(active.site, settings.horizon)}` : ''
  } else {
    const earth = sample.earthEl > sample.earthHorizon ? 'Earth in view' : 'Earth blocked by skyline'
    get('coverage-summary').textContent = inMapRegion(active.site) ? `${siteName(active.site)} · ${sun} · ${earth} · ${terrainLabel(active.site, settings.horizon)}` : siteOutside
  }
  const sunOverhead = `Sun overhead at ${siteCoordinates(subPoint(coverageFrame[0]))}`
  const overhead = power ? sunOverhead : `${sunOverhead} · Earth overhead at ${siteCoordinates(subPoint(coverageFrame[1]))}`
  get('coverage-overhead').textContent = overhead
  const description = power ? 'map-scope power-notes power-scale-note power-output power-site-angle' : 'map-scope coverage-notes coverage-summary'
  get('coverage-canvas').setAttribute('aria-label', `${southOnly ? 'South Pole' : 'Whole-Moon'} ${power ? 'solar power' : 'visibility'} map. ${overhead}.`)
  get('coverage-canvas').setAttribute('aria-describedby', description)
  if (!flat) get('globe-canvas').setAttribute('aria-describedby', `globe-pole-note ${description} coverage-overhead`)
}

function requestHeatMap(regional) {
  const { frames } = missionFrames
  const stepHours = catalog.step / 3600
  const heat = { layers: new Map() }
  heatMaps.set(regional, heat)
  const publish = grid => {
    if (heatMaps.get(regional) !== heat) return
    heat.grid = grid
    if (southOnly === regional) showCoverage()
  }
  const fallback = () => setTimeout(() => {
    if (heatMaps.get(regional) !== heat) return
    try {
      const calculate = regional ? southPoleOverlapGrid : missionOverlapGrid
      publish(calculate(frames, stepHours))
    } catch {
      heat.failed = true
      if (southOnly === regional) showCoverage()
    }
  }, 0)
  try {
    const worker = new Worker(new URL('./mission-heat-worker.mjs', import.meta.url), { type: 'module' })
    heat.worker = worker
    const stopWorker = () => {
      worker.terminate()
      heat.worker = undefined
    }
    worker.onmessage = ({ data }) => { stopWorker(); publish(data) }
    worker.onerror = () => { stopWorker(); fallback() }
    worker.postMessage({ frames, stepHours, southOnly: regional })
  } catch { heat.worker?.terminate(); fallback() }
  return heat
}

function showMissionHeat(flat) {
  const status = get('mission-heat-status')
  const results = get('mission-heat-results')
  const globeCanvas = get('globe-canvas')
  const { start, duration, horizon } = settings
  const models = get('mission-heat-models')
  const scope = southOnly ? 'South Pole · 84°S to 90°S' : 'Whole Moon'
  const modelNote = horizon === 'terrain'
    ? 'Shading assumes a smooth lunar horizon. Pins use the local LOLA skyline, where ridges and crater walls can block the Sun or Earth.'
    : 'Both the shading and the pins use a smooth horizon.'
  const description = 'mission-heat-models mission-heat-status mission-heat-site' + (horizon === 'terrain' ? ' mission-heat-reference' : '')
  globeCanvas.setAttribute('aria-describedby', 'globe-pole-note ' + description)
  const notice = `${scope}. ${modelNote}`
  if (models.textContent !== notice) models.textContent = notice
  const heat = heatMaps.get(southOnly) ?? requestHeatMap(southOnly)
  if (!heat.grid) {
    results.hidden = true
    if (!flat) globe?.setCoverage(null, 'off', southOnly ? artemisSouthLatitude : 90)
    const message = heat.failed ? 'The overlap heat map could not be calculated. Change the mission window to try again.' :
      `Calculating ${southOnly ? 'South Pole' : 'whole-Moon'} overlap…`
    if (status.textContent !== message) status.textContent = message
    return
  }
  const { grid: heatGrid, layers: heatLayers } = heat

  const period = Number(get('mission-heat-period').value)
  if (heatDisplay?.flat === flat && heatDisplay.active === active && heatDisplay.period === period && heatDisplay.heat === heat) return
  heatDisplay = { flat, active, period, heat }
  const hours = period ? duration / missionQuarters : duration
  const from = period ? (period - 1) * hours : 0
  const to = from + hours
  if (!heatLayers.has(period)) heatLayers.set(period, {})
  const layer = heatLayers.get(period)
  const { site, metrics, sun, earth } = active
  const siteInRegion = site.lat <= heatGrid.northLatitude
  const gridPeriod = heatGrid.periods[period]
  if (!layer.overlaps) {
    const listed = ranked.filter(row => row.site.lat <= heatGrid.northLatitude)
      .map(({ site, metrics }) => ({ site, hours: windowHours(metrics.both, from, to) }))
    layer.best = listed.reduce((best, entry) => !best || entry.hours > best.hours ? entry : best, null)
    layer.maxHours = Math.max(gridPeriod.maxHours, layer.best?.hours ?? 0)
    const model = horizon === 'terrain' ? 'local LOLA skyline' : 'smooth horizon'
    layer.overlaps = new Map(listed.map(({ site, hours }) => {
      const number = formatHours(hours)
      return [site.id, { number, hours, label: `${number} of simultaneous sunlight and Earth visibility using the ${model}`,
        color: hours > 0 ? 'rgb(' + overlapRgb(hours, layer.maxHours).join(',') + ')' : '#c6c3cc', nearZero: hours === 0 }]
    }))
  }
  const { maxHours, overlaps, best } = layer
  if (!layer.colors || layer.colorMax !== maxHours) {
    const colors = document.createElement('canvas')
    colors.width = heatGrid.width
    colors.height = heatGrid.height
    const ctx = colors.getContext('2d')
    const image = ctx.createImageData(heatGrid.width, heatGrid.height)
    gridPeriod.values.forEach((value, index) => {
      if (value > 0) image.data.set([...overlapRgb(value, maxHours), 255], index * 4)
    })
    ctx.putImageData(image, 0, 0)
    layer.colors = colors
    layer.colorMax = maxHours
  }
  const { colors } = layer
  if (flat) {
    drawCoverage ??= createCoverageMap(get('coverage-canvas'), evaluateMapPoint)
    drawCoverage(null, active.site, 'mission', { heatRaster: colors, northLatitude: heatGrid.northLatitude })
    get('coverage-canvas').setAttribute('aria-label', `${southOnly ? 'South Pole' : 'Whole-Moon'} overlap heat map${period ? ` for quarter ${period}` : ' for the entire mission'}`)
    get('coverage-canvas').setAttribute('aria-describedby', description)
  } else {
    globe?.setMissionHeat(colors, heatGrid.northLatitude)
    globe?.setSiteScores(overlaps)
  }
  const scale = get('mission-heat-scale')
  scale.classList.toggle('no-overlap', maxHours === 0)
  const maxLabel = `${formatHours(maxHours)} out of ${formatHours(duration)}`
  scale.setAttribute('aria-label', `Overlap from zero to a maximum of ${maxLabel} in the full mission`)
  get('mission-heat-mid').textContent = maxHours > 0 ? formatHours(maxHours / 2) : ''
  get('mission-heat-max').textContent = maxLabel
  get('mission-heat-scale-note').textContent = southOnly
    ? 'Green marks the highest overlap in the South Pole region. Uncolored areas inside the boundary have zero modeled overlap.'
    : 'Green marks the highest overlap across the map and pins. Uncolored areas have zero modeled overlap.'
  status.textContent = `${period ? 'Quarter ' + period : 'Entire mission'} · ${dateLabel(start + from * hour)} → ${dateLabel(start + to * hour)} · ${formatHours(hours)}`
  get('mission-heat-best').textContent = best?.hours > 0
    ? `${southOnly ? 'Best evaluated South Pole site' : 'Best evaluated site'} · ${siteName(best.site)} · ${formatHours(best.hours)} of ${formatHours(hours)}`
    : `No evaluated ${southOnly ? 'South Pole ' : ''}site has Sun and Earth in view together during this period.`
  get('mission-heat-site-details').hidden = !siteInRegion
  results.hidden = false
  if (!siteInRegion) {
    get('mission-heat-site').textContent = `${siteName(site)} is outside the 84°S to 90°S region. Pick a point inside the boundary.`
    return
  }
  const siteOverlap = overlaps.get(site.id).hours
  get('mission-heat-site').textContent = `${siteName(site)} · Sun ${formatHours(windowHours(sun, from, to))} · Earth ${formatHours(windowHours(earth, from, to))} · Both ${formatHours(siteOverlap)} of ${formatHours(hours)} · ${terrainLabel(site, horizon)}`
  const reference = get('mission-heat-reference')
  reference.hidden = horizon !== 'terrain'
  if (horizon === 'terrain') {
    if (heatReference?.mission !== missionFrames || heatReference.site !== site) {
      const smooth = evaluate(site, missionFrames.frames, duration, false, { includeTimeline: false })
      heatReference = { mission: missionFrames, site, windows: smooth.metrics.both }
    }
    reference.textContent = `Same coordinates with a smooth horizon · ${formatHours(windowHours(heatReference.windows, from, to))} of ${formatHours(hours)}`
  }
  showHeatWindows(metrics.both, from, to)
}

function showHeatWindows(windows, from, to) {
  const overlap = windows.map(([start, end]) => [Math.max(from, start), Math.min(to, end)])
    .filter(([start, end]) => start < end)
  const gaps = []
  let cursor = from
  for (const [start, end] of overlap) {
    if (cursor < start) gaps.push([cursor, start])
    cursor = end
  }
  if (cursor < to) gaps.push([cursor, to])
  const bar = element('div', 'mission-heat-track')
  bar.setAttribute('aria-hidden', 'true')
  for (const [start, end] of overlap) {
    const span = element('span')
    span.style.left = (start - from) * 100 / (to - from) + '%'
    span.style.width = (end - start) * 100 / (to - from) + '%'
    bar.append(span)
  }
  const labels = element('div', 'mission-heat-track-labels')
  labels.append(element('span', '', 'Start of period'), element('span', '', 'End of period'))
  get('mission-heat-track').replaceChildren(bar, labels)
  const columns = [['Sun and Earth together', overlap], ['No overlap', gaps]].map(([label, items]) => {
    const column = element('div')
    column.append(element('h4', '', label), items.length ? windowList(items, settings.start) : element('p', 'muted', 'None in this period.'))
    return column
  })
  get('mission-heat-window-list').replaceChildren(...columns)
}

function showCoverageLegend() {
  const entries = {
    all: [['sun', 'Sunlight only'], ['earth', 'Earth view only'], ['both', 'Both'], ['none', 'Neither']],
    sun: [['sun', 'Sunlight'], ['none', 'No direct sunlight']],
    earth: [['earth', 'Earth in view'], ['none', 'Earth below horizon']],
    both: [['both', 'Both in view'], ['none', 'At least one blocked']],
  }[get('coverage-layer').value] ?? []
  get('coverage-legend').replaceChildren(...entries.map(([color, name]) => element('li', `coverage-${color}`, name)))
}

get('power-gradient').style.setProperty('--power-ramp', `linear-gradient(90deg, ${solarPowerPalette.map(color => `rgb(${color.join(',')})`).join(', ')})`)

function installGlobe() {
  const canvas = get('globe-canvas')
  function fallback(message) {
    get('show-globe').disabled = true
    useMap('polar')
    error('globe-error', message)
  }
  try { globe = createGlobe(canvas, get('globe-markers'), get('globe-features'), get('globe-pole-marker'), catalog.mapExtent, id => selectSite(id, false), evaluateMapPoint, feature => {
    chooseFeature(feature)
    get('feature-search').value = feature.name
    showFeatureMatches()
  }) }
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
    'globe-focus': () => active && (inMapRegion(active.site) ? globe.center(active.site) : globe.southPole()),
    'globe-reset': () => globe.reset(),
    'globe-far': () => globe.center({ lat: 0, lon: 180 }),
    'globe-pole': () => globe.southPole(),
  }
  for (const [id, handler] of Object.entries(controls)) get(id).addEventListener('click', handler)
}

function updateFeatureLayer() {
  const show = get('named-features').open && get('feature-layer').checked
  globe?.showFeatures(show ? labelsBySize : [], show ? namedFeature : null)
}

function chooseFeature(feature) {
  namedFeature = feature
  get('feature-name').textContent = feature.name
  get('feature-location').textContent = `${siteCoordinates(feature)} · ${feature.kind}` +
    (feature.diameter ? ` · ${feature.diameter} km across` : '')
  get('feature-source').href = `https://planetarynames.wr.usgs.gov/Feature/${feature.id}`
  get('feature-detail').hidden = false
  get('feature-evaluate').hidden = false
  if (globe && !get('show-globe').disabled && inMapRegion(feature)) {
    useMap('globe')
    globe.center(feature)
  }
  updateFeatureLayer()
}

function showFeatureMatches() {
  const query = searchText(get('feature-search').value.trim())
  const matches = query ? features.filter(item => item.searchName.includes(query)) : []
  matches.sort((a, b) => Number(b.searchName === query) - Number(a.searchName === query) ||
    Number(b.searchName.startsWith(query)) - Number(a.searchName.startsWith(query)))
  get('feature-status').textContent = query ? `${matches.length.toLocaleString()} matches` +
    (matches.length > 30 ? ' · Showing the first 30' : '') : `${features.length.toLocaleString()} IAU-approved feature names`
  get('feature-results').replaceChildren(...matches.slice(0, 30).map(feature => {
    const row = element('li')
    const button = element('button', 'subtle')
    button.type = 'button'
    button.setAttribute('aria-current', String(feature.id === namedFeature?.id))
    button.append(element('span', '', feature.name), element('span', 'muted', feature.kind))
    button.addEventListener('click', () => {
      chooseFeature(feature)
      for (const match of get('feature-results').querySelectorAll('button')) match.setAttribute('aria-current', String(match === button))
    })
    row.append(button)
    return row
  }))
}

function readGazetteer() {
  gazetteerRequest ??= fetch('./data/gazetteer.json').then(response => {
    if (!response.ok) throw new Error('Gazetteer download failed')
    return response.json()
  }).catch(reason => {
    gazetteerRequest = undefined
    throw reason
  })
  return gazetteerRequest
}

async function loadFeatures() {
  if (features.length || fetchingFeatures) return
  fetchingFeatures = true
  get('feature-status').textContent = 'Loading named lunar features…'
  get('feature-retry').hidden = true
  try {
    features = (await readGazetteer()).map(item => ({ ...item, searchName: searchText(item.name) }))
    labelsBySize = [...features].sort((a, b) => b.diameter - a.diameter)
    get('feature-search').disabled = false
    showFeatureMatches()
    updateFeatureLayer()
  } catch {
    get('feature-status').textContent = 'Named lunar features could not load.'
    get('feature-retry').hidden = false
  } finally {
    fetchingFeatures = false
  }
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
  if (plotWidth <= 0 || plotHeight <= 0) return
  const [min, max] = localSky.chartRange
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
    ctx.strokeStyle = '#383841'
    ctx.fillStyle = '#b3c1d1'
    ctx.textAlign = 'right'
    ctx.fillText(value.toFixed(1) + '°', left - 7, py(value))
    ruler(left, py(value), left + plotWidth, py(value))
  }
  for (let i = 0; i <= 4; i++) {
    const hours = settings.duration * i / 4
    ctx.strokeStyle = '#383841'
    ctx.textAlign = i === 4 ? 'right' : i === 0 ? 'left' : 'center'
    ctx.fillText(settings.duration >= 72 ? '+' + Number((hours / 24).toFixed(1)) + 'd' : '+' + hours + 'h', px(hours), bottom + 13)
    ruler(px(hours), 10, px(hours), bottom)
  }
  const colors = ['#ffc975', '#acc4ff', '#ffc975ba', '#acc4ffb5']
  const stride = Math.max(1, Math.floor((series.length - 1) / plotWidth))
  const last = series.length - 1
  chartColumns.forEach((key, index) => {
    ctx.beginPath()
    ctx.setLineDash(index >= 2 ? [5, 5] : [])
    ctx.lineWidth = index >= 2 ? 1.1 : 2
    ctx.strokeStyle = colors[index]
    ctx.moveTo(left, py(series[0][key]))
    for (let i = stride; i < last; i += stride) ctx.lineTo(left + i / last * plotWidth, py(series[i][key]))
    ctx.lineTo(left + plotWidth, py(series[last][key]))
    ctx.stroke()
  })
  ctx.setLineDash([4, 3])
  ctx.strokeStyle = '#f8f4e6'
  ctx.lineWidth = 1
  ruler(px(elapsed), 10, px(elapsed), bottom)
  ctx.setLineDash([])
  const item = series[Math.round(elapsed * 4)]
  chartColumns.slice(0, 2).forEach((key, index) => {
    ctx.beginPath()
    ctx.fillStyle = colors[index]
    ctx.arc(px(elapsed), py(item[key]), 3.8, 0, Math.PI * 2)
    ctx.fill()
  })
}

function showTime() {
  if (!active) return
  const { start, duration } = settings
  const window = active.timeline[Math.round(elapsed * 4)]
  const time = dateLabel(start + elapsed * hour)
  get('selected-time').value = time
  get('time-slider').value = String(elapsed)
  get('time-slider').setAttribute('aria-valuetext', time)
  get('timeline-back').disabled = elapsed === 0
  get('timeline-forward').disabled = elapsed >= duration
  for (const marker of get('tracks').querySelectorAll('.now')) marker.style.left = Math.min(99.8, elapsed / duration * 100) + '%'
  showLocalSky(window, start + elapsed * hour)
  showCoverage()
  if (!spaceYearMode) showSpaceTime()
  drawChart()
}

function showSpaceTime() {
  if (!updateSpace || !active) return
  const { start, duration, annual, horizon } = settings
  const site = active.site
  const year = spaceYearMode ? spaceYearWindow : null
  const hours = year ? spaceYearHours : elapsed
  const epoch = (year?.start ?? start) + hours * hour
  const index = time => (time - catalog.startMs) / (spaceStep * 1000)
  const trail = year ? [index(year.start), index(year.end)] : annual ? [index(start), index(start + duration * hour)] : null
  const { lunarKm, solarKm } = updateSpace(index(epoch), site, trail)
  const sample = year
    ? siteSkyModel(site, horizon === 'terrain')(frameAt(ephemeris, (epoch - catalog.startMs) / (catalog.step * 1000)))
    : active.timeline[Math.round(elapsed * 4)]
  const time = dateLabel(epoch)
  const slider = get('space-time')
  slider.max = year?.hours ?? duration
  slider.value = String(hours)
  slider.setAttribute('aria-valuetext', time)
  get('space-clock').value = time
  if (year) get('space-month').value = new Date(epoch).getUTCMonth()
  const skyline = horizon === 'terrain' ? 'local skyline' : '0° reference horizon'
  const clearance = difference => {
    if (Math.abs(difference) < .005) return 'at the ' + skyline
    return Math.abs(difference).toFixed(2) + '° ' + (difference > 0 ? 'above' : 'below') + ' the ' + skyline
  }
  get('space-caption').textContent = terrainLabel(site, horizon)
  get('space-sun').textContent = clearance(sample.sunEl - sample.sunHorizon) + (sample.eclipse ? ' · Total solar eclipse' : '')
  get('space-earth').textContent = clearance(sample.earthEl - sample.earthHorizon)
  get('space-lunar-km').textContent = lunarKm + ' km'
  get('space-solar-km').textContent = solarKm + ' km'
}

function setSpaceYear(year, epoch) {
  spaceYearWindow = calendarSpaceWindow(year)
  spaceYearHours = epoch === undefined ? 0
    : Math.max(0, Math.min(spaceYearWindow.hours, Math.round((epoch - spaceYearWindow.start) / hour * 4) / 4))
  get('space-year').value = year
  const labels = spaceYearWindow.months.map((hours, month) => new Option(monthLabel.format(spaceYearWindow.start + hours * hour), month))
  get('space-month').replaceChildren(...labels)
  get('space-month-scale').replaceChildren(...labels.filter((_, month) => month % 3 === 0).map(label => {
    const tick = element('span', '', label.text)
    tick.style.setProperty('--month-position', spaceYearWindow.months[Number(label.value)] * 100 / spaceYearWindow.hours + '%')
    return tick
  }))
}

function setSpaceMode(year) {
  if (!updateSpace || spaceYearMode === year) return
  stop()
  stopSpaceYear()
  spaceYearMode = year
  if (year && !spaceYearWindow) {
    const epoch = settings.start + elapsed * hour
    setSpaceYear(new Date(Math.min(epoch, catalog.endMs - 1)).getUTCFullYear(), epoch)
  }
  get('space-mission-mode').setAttribute('aria-pressed', String(!year))
  get('space-year-mode').setAttribute('aria-pressed', String(year))
  for (const id of ['space-year-controls', 'space-month-scale', 'space-year-note']) get(id).hidden = !year
  get('space-time-label').textContent = year ? 'Time within selected year' : '3D view mission time'
  syncSpacePlayButton()
  showSpaceTime()
}

function prepareLocalSky() {
  const { start, duration, horizon } = settings
  const profile = horizon === 'terrain' ? active.site.horizon : null
  const reach = Math.min(duration + skyLookahead, (catalog.endMs - start) / hour)
  const extension = Math.floor((reach - duration) * 4 + 1e-8) / 4
  const sampleSky = siteSkyModel(active.site, Boolean(profile))
  const ahead = extension > 0 ? framesFor(start + duration * hour, extension).slice(1).map(sampleSky) : []
  let min = 0
  let max = 0
  for (const sample of active.timeline) {
    for (const key of chartColumns) {
      min = Math.min(min, sample[key])
      max = Math.max(max, sample[key])
    }
  }
  const chartRange = [Math.min(-2, Math.floor(min / 5) * 5), Math.max(2, Math.ceil(max / 5) * 5)]
  localSky = { row: active, profile, range: skyRange(active.timeline, profile),
    endsAt: duration + extension, crossings: skyCrossings([...active.timeline, ...ahead], .25), paths: null, chartRange }
  get('tracks').replaceChildren(...timeline(active, duration, elapsed))
  showMissionEvents()
  get('ops-subtitle').textContent = siteName(active.site) + ' · ' + siteCoordinates(active.site) + ' · ' + terrainLabel(active.site, horizon)
  const gaps = element('dl')
  gaps.append(element('dt', '', 'Longest gaps in this mission'),
    element('dd', '', 'Darkness ' + formatHours(active.metrics.darkness)),
    element('dd', '', 'Earth out of view ' + formatHours(active.metrics.blackout)))
  get('snapshot').replaceChildren(gaps)
  get('local-sky').hidden = false
  if (!get('surface-view').hidden) void showSurface()
}

function showMissionEvents() {
  const { start, duration } = settings
  const events = missionCrossings(localSky.crossings, duration)
  const step = timelineStep(duration) === 24 ? '1 day' : '1 h'
  get('timeline-back').textContent = '−' + step
  get('timeline-back').setAttribute('aria-label', 'Go back ' + step)
  get('timeline-forward').textContent = '+' + step
  get('timeline-forward').setAttribute('aria-label', 'Go forward ' + step)
  get('event-count').textContent = events.length ? 'Select an estimated crossing to jump to the nearest 15-minute sample.' : 'No horizon crossings in this mission window.'
  get('event-list').replaceChildren(...events.map(event => {
    const item = element('li')
    const button = element('button', `subtle crossing-${event.body}`)
    button.type = 'button'
    const estimate = start + event.at * hour
    const time = element('time', '', '≈ ' + dateLabel(Math.round(estimate / 60_000) * 60_000))
    time.dateTime = new Date(estimate).toISOString()
    button.append(element('strong', '', event.label), time)
    button.addEventListener('click', () => seekTime(event.sample))
    item.append(button)
    return item
  }))
}

function skyClearance(elevation, skyline) {
  const gap = elevation - skyline
  if (Math.abs(gap) < .005) return 'At the skyline'
  return Math.abs(gap).toFixed(2) + '° ' + (gap > 0 ? 'above' : 'below') + ' the skyline'
}

function skyCountdown(hours) {
  const minutes = Math.ceil(hours * 60 - 1e-8)
  if (minutes <= 15) return 'less than 15 min'
  if (minutes < 120) return `about ${Math.round(minutes / 5) * 5} min`
  if (hours < 48) return `about ${Number(hours.toFixed(1))} h`
  return `about ${Number((hours / 24).toFixed(1))} days`
}

function showLocalSky(sample, epoch) {
  const time = get('local-sky-time')
  time.textContent = dateLabel(epoch)
  time.dateTime = new Date(epoch).toISOString()
  const bodies = [
    ['sun', sample.sunAz, sample.sunEl, sample.sunHorizon, 'Sunrise', 'Sunset'],
    ['earth', sample.earthAz, sample.earthEl, sample.earthHorizon, 'Earthrise', 'Earthset'],
  ]
  const limit = Math.min(localSky.endsAt, elapsed + skyLookahead)
  for (const [key, bearing, elevation, skyline, rise, set] of bodies) {
    const direction = compass[Math.round(bearing / 45) % compass.length]
    const parts = [`${(Math.round(bearing * 10) / 10 % 360).toFixed(1)}° ${direction} · ${signedDegrees(elevation)} elevation`, skyClearance(elevation, skyline)]
    if (key === 'sun' && sample.eclipse) parts.push('Total eclipse')
    get(`sky-${key}-position`).textContent = parts.join(' · ')
    const crossing = nextSkyCrossing(localSky.crossings[key], elapsed)
    const hasCrossing = crossing && crossing.at <= limit
    const eventTime = get(`sky-${key}-utc`)
    eventTime.hidden = !hasCrossing
    if (hasCrossing) {
      const crossingTime = settings.start + crossing.at * hour
      const rounded = Math.round(crossingTime / 300000) * 300000
      get(`sky-${key}-event`).textContent = `${crossing.rising ? rise : set} in ${skyCountdown(crossing.at - elapsed)}`
      eventTime.textContent = '≈ ' + dateLabel(rounded)
      eventTime.dateTime = new Date(rounded).toISOString()
    } else {
      get(`sky-${key}-event`).textContent = limit - elapsed >= skyLookahead ? 'No crossing in the next 30 days' : 'No crossing before available data ends'
    }
  }
  redrawLocalSky()
}

function redrawLocalSky() {
  if (!localSky) return
  const sample = active.timeline[Math.round(elapsed * 4)]
  if (get('surface-view').hidden) {
    const showPaths = get('sky-paths').checked
    if (showPaths && !localSky.paths) localSky.paths = { sun: skyPathSegments(active.timeline, 'sun'), earth: skyPathSegments(active.timeline, 'earth') }
    drawLocalSky(get('sky-canvas'), sample, localSky.profile, localSky.range, showPaths ? localSky.paths : null)
  } else if (surfaceSite === active.site) updateSurface(sample)
}

function updateSurface(sample) {
  const showPaths = get('surface-paths').checked
  get('surface-heading').hidden = !showPaths
  get('surface-labels').hidden = !showPaths
  get('surface-guide-sun').parentElement.hidden = !showPaths
  if (showPaths && !localSky.surfacePaths) localSky.surfacePaths = surfacePaths(active.timeline)
  surfaceView?.update(sample, showPaths ? localSky.surfacePaths : null)
  const diameter = angle => (360 * angle / Math.PI).toFixed(2) + '°'
  get('surface-angles').textContent = `Apparent disk diameter · Sun ${diameter(sample.sunRadius)} · Earth ${diameter(sample.earthRadius)}`
  const condition = sample.eclipse ? 'Total eclipse' : sample.sunEl > sample.sunHorizon ? 'Sun above the selected skyline' : 'Sun below the selected skyline'
  get('surface-light').textContent = `${condition} · Sun elevation ${signedDegrees(sample.sunEl)}`
}

async function showNearbyCraters(site) {
  const control = get('surface-crater')
  const description = get('surface-landmark')
  control.parentElement.hidden = true
  description.hidden = true
  try {
    const gazetteer = await readGazetteer()
    if (surfaceSite !== site || active.site !== site) return
    surfaceCraters = nearbyCraters(site, gazetteer)
    control.replaceChildren(new Option('Nearby crater', ''), ...surfaceCraters.map(crater => new Option(crater.name, crater.id)))
    control.parentElement.hidden = !surfaceCraters.length
  } catch {
    if (active.site !== site) return
    description.textContent = 'Nearby crater names could not load.'
    description.hidden = false
  }
}

async function showSurface() {
  if (!active) return
  const { site } = active
  const request = ++surfaceRequest
  const sample = active.timeline[Math.round(elapsed * 4)]
  get('surface-caption').textContent = 'NASA ' + site.terrain + ' · Camera 2 m above the modeled surface. Small foreground pits and dust texture are illustrative.' +
    (settings.horizon === 'terrain' ? '' : ' The readouts use the selected 0° horizon.')
  if (surfaceSite === site) {
    get('surface-scene').hidden = false
    get('surface-retry').hidden = true
    get('surface-status').textContent = ''
    updateSurface(sample)
    return
  }
  get('surface-retry').hidden = true
  get('surface-scene').hidden = true
  get('surface-status').textContent = 'Loading NASA terrain…'
  try {
    surfaceView ??= createSurfaceView(get('surface-canvas'), get('surface-sky'), get('surface-labels'), (angle, targets) => {
      get('surface-heading').textContent = `${angle}° ${compass[Math.round(angle / 45) % compass.length]}`
      for (const [key, target] of Object.entries(targets)) {
        const button = get(`surface-guide-${key}`)
        const name = key === 'sun' ? 'Sun' : 'Earth'
        const arrow = { left: '←', right: '→', up: '↑', down: '↓' }[target.edge]
        button.textContent = `${arrow} ${name} off screen`
        button.dataset.direction = target.edge
        button.setAttribute('aria-label', `Find ${name}, off screen ${target.edge}`)
        button.hidden = target.inView
      }
    })
    const mesh = await loadSurfaceMesh(site)
    if (request !== surfaceRequest) return
    surfaceSite = site
    get('surface-scene').hidden = false
    get('surface-status').textContent = ''
    const current = active.timeline[Math.round(elapsed * 4)]
    surfaceView.setTerrain(mesh, site, current.sunAz)
    updateSurface(current)
    void showNearbyCraters(site)
  } catch (reason) {
    if (request !== surfaceRequest) return
    get('surface-status').textContent = reason.message
    get('surface-retry').hidden = false
  }
}

function useSkyView(surface) {
  get('skyline-view').hidden = surface
  get('surface-view').hidden = !surface
  get('show-skyline').setAttribute('aria-pressed', String(!surface))
  get('show-surface').setAttribute('aria-pressed', String(surface))
  get('sky-paths').parentElement.hidden = surface
  if (surface) void showSurface()
  else {
    surfaceRequest++
    redrawLocalSky()
  }
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
  const { start, duration, annual, horizon, weights, limits } = settings
  const durationB = annual ? annualMissionHours(startB) : duration
  const result = get('compare-result')
  const windowDetail = get('window-detail')
  if (!Number.isFinite(startB) || startB < catalog.startMs || startB + durationB * hour > catalog.endMs) {
    error('compare-error', 'Choose a UTC time for B that keeps its full mission inside the supported dates.')
    result.replaceChildren()
    windowDetail.replaceChildren()
    return
  }
  error('compare-error')
  const a = withMissionTimeline(ranked.find(row => row.site.id === get('compare-a').value))
  const rowB = ranked.find(row => row.site.id === get('compare-b').value)
  const b = startB === start ? withMissionTimeline(rowB) :
    rank([evaluate(rowB.site, framesFor(startB, durationB), durationB, horizon === 'terrain')], weights, limits, durationB)[0]
  const scenarios = [[a, start, duration], [b, startB, durationB]]
  const decision = a.unmet.length && b.unmet.length ? 'Both scenarios miss mission requirements.' :
    a.unmet.length ? 'Only B meets the mission requirements.' : b.unmet.length ? 'Only A meets the mission requirements.' :
      a.score === b.score ? 'The scenarios tie for the chosen priorities.' :
        'Scenario ' + (a.score > b.score ? 'A' : 'B') + ' scores higher for the chosen priorities.'
  const grid = element('div', 'compare-grid')
  const details = element('div', 'window-grid')
  scenarios.forEach(([row, epoch, duration], index) => {
    const title = (index === 0 ? 'A' : 'B') + ' · ' + siteName(row.site)
    const card = element('article', 'compare-scenario')
    const time = element('time', '', dateLabel(epoch))
    time.dateTime = new Date(epoch).toISOString()
    const power = solarExposure(row.timeline, row.sun, duration)
    card.append(element('h3', '', title), time,
      element('p', 'muted', annual ? `${duration / 24} days · Ends ${dateLabel(epoch + duration * hour)} · ${terrainLabel(row.site, horizon)}` : terrainLabel(row.site, horizon)),
      element('p', 'compare-status' + (row.unmet.length ? ' failed' : ''),
      row.unmet.length ? 'Misses: ' + row.unmet.join(', ') : 'Mission fit: ' + row.score + ' / 100'),
    axis(duration), ...timeline(row, duration), element('p', 'muted stats', 'Longest dark gap ' + formatHours(row.metrics.darkness) +
      ' · Longest Earth gap ' + formatHours(row.metrics.blackout)),
    element('p', 'muted stats', `${formatHours(power.beamHours)} equivalent full sun · ${power.peak === null ? 'No direct sunlight' : `Peak Sun ${signedDegrees(power.peak)}`}`))
    grid.append(card)
    const detail = element('article')
    detail.append(element('h3', '', title))
    for (const [key, windows] of [['sun', row.sun], ['earth', row.earth], ['overlap', row.metrics.both]]) {
      detail.append(element('p', '', metricNames[key]))
      detail.append(windowList(windows, epoch))
    }
    details.append(detail)
  })
  const context = duration === durationB ? 'Timelines are aligned to the same elapsed time after landing.' :
    'Each timeline runs from landing to its own one-year anniversary.'
  result.replaceChildren(element('p', 'compare-context', decision + ' ' + context), grid)
  windowDetail.replaceChildren(details)
}

function setMissionTime(epoch) {
  if (!Number.isFinite(epoch)) return
  const [date, time] = controlDate(epoch).split('T')
  get('landing-date').value = date
  get('landing-time').value = time
  recalculate()
}

async function addCoordinate(event, feature = null) {
  event?.preventDefault()
  if (!settings) return
  const [latitude, longitude] = inputs('latitude', 'longitude')
  const request = ++pendingCoordinate
  get('coordinate-status').textContent = ''
  if (!latitude.validity.valid || !longitude.validity.valid) {
    error('coordinate-error', 'Enter latitude from −90° to 90° and east longitude from −180° to 360°.')
    return
  }
  error('coordinate-error')
  const lat = Number(latitude.value)
  const lon = ((Number(longitude.value) + 180) % 360 + 360) % 360 - 180
  const previous = customSites.find(site => site.lat === lat && Math.abs(site.lon - lon) < 1e-8)
  if (previous) {
    selectSite(previous.id, false, true)
    return
  }
  get('coordinate-status').textContent = 'Calculating the terrain horizon…'
  try {
    const terrain = await terrainAt(lat, lon)
    if (request !== pendingCoordinate) return
    const label = ++customCount
    const site = { id: `custom-${label}`, name: feature?.name ?? `Custom site ${label}`, kind: 'Custom coordinates', lat, lon,
      source: feature ? String(feature.id) : null, ...terrain }
    customSites.push(site)
    selected = site.id
    inspectedSite = true
    recalculate(true)
    if (inMapRegion(site)) globe?.center(site)
    get('coordinate-status').textContent = site.name + ' added to the ranking and comparison.'
  } catch (reason) {
    if (request === pendingCoordinate) {
      get('coordinate-status').textContent = ''
      error('coordinate-error', reason.message)
    }
  }
}

function stop() {
  if (playing !== null) cancelAnimationFrame(playing)
  playing = null
  get('play').textContent = '▶'
  get('play').setAttribute('aria-label', 'Play timeline')
  syncSpacePlayButton()
  get('coverage-play').textContent = '▶'
  get('coverage-play').setAttribute('aria-label', 'Play map timeline')
}

function syncSpacePlayButton() {
  const running = (spaceYearMode ? spaceYearPlayback : playing) !== null
  get('space-play').textContent = running ? 'Ⅱ' : '▶'
  get('space-play').setAttribute('aria-label', (running ? 'Pause' : 'Play') + (spaceYearMode ? ' whole year' : ' 3D timeline'))
}

function stopSpaceYear() {
  if (spaceYearPlayback !== null) cancelAnimationFrame(spaceYearPlayback)
  spaceYearPlayback = null
  syncSpacePlayButton()
}

function playSpaceYear() {
  if (spaceYearPlayback !== null) { stopSpaceYear(); return }
  if (spaceYearHours >= spaceYearWindow.hours) spaceYearHours = 0
  const initial = spaceYearHours
  const began = performance.now()
  const rate = Number(get('space-year-speed').value) * 24 / 1000
  function tick(now) {
    const next = Math.min(spaceYearWindow.hours, Math.round((initial + (now - began) * rate) * 4) / 4)
    if (next !== spaceYearHours) {
      spaceYearHours = next
      showSpaceTime()
    }
    if (next >= spaceYearWindow.hours) stopSpaceYear()
    else spaceYearPlayback = requestAnimationFrame(tick)
  }
  spaceYearPlayback = requestAnimationFrame(tick)
  syncSpacePlayButton()
  showSpaceTime()
}

function seekTime(hours) {
  if (!active) return
  stop()
  elapsed = Math.max(0, Math.min(settings.duration, hours))
  showTime()
}

function play() {
  if (!active) return
  if (playing !== null) { stop(); return }
  if (elapsed >= settings.duration) { elapsed = 0; showTime() }
  const initial = elapsed
  const began = performance.now()
  const speed = Number(get('timeline-speed').value)
  get('play').textContent = 'Ⅱ'
  get('play').setAttribute('aria-label', 'Pause timeline')
  get('coverage-play').textContent = 'Ⅱ'
  get('coverage-play').setAttribute('aria-label', 'Pause map timeline')
  function update(now) {
    const next = Math.min(settings.duration, Math.round((initial + (now - began) * settings.duration * speed / 20_000) * 4) / 4)
    if (next !== elapsed) {
      elapsed = next
      showTime()
    }
    if (elapsed >= settings.duration) stop()
    else playing = requestAnimationFrame(update)
  }
  playing = requestAnimationFrame(update)
  syncSpacePlayButton()
}

function exportCsv() {
  const header = 'utc,site_id,latitude_deg,east_longitude_deg,horizon_model,sun_az_deg,sun_elev_deg,sun_horizon_deg,earth_az_deg,earth_elev_deg,earth_horizon_deg,total_solar_eclipse,sun_visible,earth_visible,terrain_source,flat_panel_20pct_power_w_m2'
  const rows = active.timeline.map((entry, index) => [
    new Date(settings.start + index * hour / 4).toISOString(), active.site.id, active.site.lat, active.site.lon, settings.horizon,
    entry.sunAz, entry.sunEl, entry.sunHorizon, entry.earthAz, entry.earthEl, entry.earthHorizon, entry.eclipse,
    availableAt(active.sun, index / 4, settings.duration), availableAt(active.earth, index / 4, settings.duration), terrainLabel(active.site, settings.horizon),
    siteSolarPower(entry).toFixed(3),
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
    get('explore-case').disabled = false
    get('explore-open').disabled = false
    if (location.hash === '#explore') renderLesson()
    if (location.hash === '#coverage-view') {
      useMap('coverage')
      requestAnimationFrame(() => get('map-heading').scrollIntoView({ behavior: 'instant' }))
    }
    if (location.hash === '#south-pole' && globe) {
      useMap('globe')
      globe.southPole()
      requestAnimationFrame(() => get('map-heading').scrollIntoView({ behavior: 'instant' }))
    }
    if (['#local-sky', '#assessment'].includes(location.hash)) requestAnimationFrame(() => get(location.hash.slice(1))?.scrollIntoView({ behavior: 'instant' }))
    void startSpace()
  } catch (reason) {
    error('boot-error', reason.message + (location.protocol === 'file:' ? ' Open Astralis through a local web server.' : ''))
    get('answer-title').textContent = 'Lunar data could not be loaded'
    get('rank-summary').textContent = 'Reload to try again.'
    get('explore-conclusion').textContent = 'Lunar data could not load. Reload to try again.'
  }
}

async function startSpace() {
  try {
    const response = await fetch('./data/space-positions.bin')
    if (!response.ok) throw new Error('The 3D ephemeris could not be loaded.')
    const samples = readSpaceSamples(await response.arrayBuffer(), catalog.startMs, catalog.endMs)
    const controls = {
      earthView: get('space-earth-view'), sunView: get('space-sun-view'), scale: get('space-scale'),
      yearPath: get('space-year-path'), moonPath: get('space-moon-path'), links: get('space-links'), yearLabel: get('space-year-label'),
      left: get('space-left'), right: get('space-right'), up: get('space-up'), down: get('space-down'), reset: get('space-reset'),
    }
    updateSpace = createSpaceView(get('space-canvas'), samples, controls)
    const firstYear = new Date(catalog.startMs).getUTCFullYear()
    const lastYear = new Date(catalog.endMs - 1).getUTCFullYear()
    get('space-year').replaceChildren(...Array.from({ length: lastYear - firstYear + 1 }, (_, i) => new Option(firstYear + i, firstYear + i)))
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
get('explore-case').addEventListener('change', renderLesson)
get('explore-open').addEventListener('click', openLessonInPlanner)
window.addEventListener('hashchange', syncExperience)
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
  const index = customSites.findIndex(site => site.id === selected)
  if (index < 0) return
  customSites.splice(index, 1)
  inspectedSite = false
  pendingCoordinate++
  get('coordinate-status').textContent = ''
  error('coordinate-error')
  recalculate(true)
})
get('site-search').addEventListener('input', showRanking)
get('site-group').addEventListener('change', showRanking)
get('named-features').addEventListener('toggle', () => {
  if (get('named-features').open) void loadFeatures()
  updateFeatureLayer()
})
get('feature-retry').addEventListener('click', loadFeatures)
get('feature-search').addEventListener('input', showFeatureMatches)
get('feature-layer').addEventListener('change', updateFeatureLayer)
get('feature-evaluate').addEventListener('click', () => {
  if (!namedFeature) return
  get('latitude').value = namedFeature.lat
  get('longitude').value = namedFeature.lon
  void addCoordinate(null, namedFeature)
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
for (const select of inputs('space-site', 'assessment-site')) select.addEventListener('change', event => selectSite(event.target.value, false))
get('show-skyline').addEventListener('click', () => useSkyView(false))
get('show-surface').addEventListener('click', () => useSkyView(true))
get('surface-retry').addEventListener('click', showSurface)
const surfaceTurns = { left: [-15, 0], right: [15, 0], up: [0, 10], down: [0, -10] }
for (const [id, angles] of Object.entries(surfaceTurns)) get(`surface-${id}`).addEventListener('click', () => surfaceView?.turn(...angles))
for (const body of ['sun', 'earth']) {
  function findBody(event) {
    if (!active) return
    const sample = active.timeline[Math.round(elapsed * 4)]
    if (event.currentTarget.id.includes('guide')) get(`surface-${body}`).focus({ preventScroll: true })
    surfaceView?.aim(sample[`${body}Az`], sample[`${body}El`])
  }
  for (const button of inputs(`surface-${body}`, `surface-guide-${body}`)) button.addEventListener('click', findBody)
}
get('surface-north').addEventListener('click', () => surfaceView?.aim(0, 2))
get('sky-paths').addEventListener('change', redrawLocalSky)
get('surface-paths').addEventListener('change', redrawLocalSky)
get('surface-zoom').addEventListener('change', event => surfaceView?.setZoom(Number(event.target.value)))
get('surface-style').addEventListener('change', event => surfaceView?.setStyle(event.target.value))
get('surface-crater').addEventListener('change', event => {
  const crater = surfaceCraters.find(item => String(item.id) === event.target.value)
  const description = get('surface-landmark')
  description.hidden = !crater
  if (!crater) return
  const azimuth = Math.round(crater.bearing) % 360
  const width = Math.round(crater.diameter)
  const distance = crater.distance < 10 ? crater.distance.toFixed(1) : Math.round(crater.distance)
  const label = crater.inside
    ? `Within ${crater.name}’s mapped diameter · ${width} km across`
    : `${crater.name} · ${distance} km to center at ${azimuth}° · ${width} km across`
  description.textContent = label
  const zoom = get('surface-zoom')
  zoom.value = '1'
  surfaceView.setZoom(1)
  surfaceView.aim(crater.bearing, crater.distance < 1 ? 9 : -5)
})
get('timeline-back').addEventListener('click', () => active && seekTime(elapsed - timelineStep(settings.duration)))
get('timeline-forward').addEventListener('click', () => active && seekTime(elapsed + timelineStep(settings.duration)))
get('timeline-speed').addEventListener('change', () => {
  if (playing === null) return
  stop()
  play()
})
for (const slider of inputs('time-slider', 'coverage-time')) slider.addEventListener('input', event => {
  seekTime(Number(event.target.value))
})
get('space-time').addEventListener('input', event => {
  const hours = Number(event.target.value)
  if (!spaceYearMode) { seekTime(hours); return }
  stopSpaceYear()
  spaceYearHours = hours
  showSpaceTime()
})
get('space-mission-mode').addEventListener('click', () => setSpaceMode(false))
get('space-year-mode').addEventListener('click', () => setSpaceMode(true))
get('space-year').addEventListener('change', event => {
  stopSpaceYear()
  setSpaceYear(Number(event.target.value))
  showSpaceTime()
})
get('space-month').addEventListener('change', event => {
  stopSpaceYear()
  spaceYearHours = spaceYearWindow.months[Number(event.target.value)]
  showSpaceTime()
})
get('space-year-speed').addEventListener('change', () => {
  if (spaceYearPlayback === null) return
  stopSpaceYear()
  playSpaceYear()
})
get('show-map').addEventListener('click', () => useMap('polar'))
get('show-globe').addEventListener('click', () => useMap('globe'))
get('show-coverage').addEventListener('click', () => useMap('coverage'))
get('coverage-layer').addEventListener('change', () => {
  showCoverageLegend()
  showCoverage()
})
get('mission-heat-period').addEventListener('change', showCoverage)
get('mission-heat-south').addEventListener('click', event => {
  southOnly = !southOnly
  event.currentTarget.setAttribute('aria-pressed', String(southOnly))
  get('map-scope').hidden = !southOnly
  if (active) showMap()
  if (southOnly && !get('globe-view').hidden) globe?.southPole()
  showCoverage()
})
get('elevation-chart').addEventListener('pointerdown', event => {
  if (!active) return
  const fraction = Math.max(0, Math.min(1, (event.offsetX - 45) / (event.currentTarget.clientWidth - 58)))
  seekTime(Math.round(fraction * settings.duration * 4) / 4)
})
for (const button of inputs('play', 'coverage-play')) button.addEventListener('click', play)
get('space-play').addEventListener('click', () => spaceYearMode ? playSpaceYear() : play())
get('export').addEventListener('click', exportCsv)
new ResizeObserver(drawChart).observe(get('elevation-chart'))
new ResizeObserver(redrawLocalSky).observe(get('sky-canvas'))
syncExperience()
start()
