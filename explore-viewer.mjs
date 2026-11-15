// The Explorer uses the planner's Moon shader, terrain worker and camera journey.
import { createGlobe } from './globe.mjs'
import { binaryFrames } from './planner.mjs'
import { framesFor, siteName } from './explore-model.mjs'
import { artemisSouthLatitude, overlapRamp } from './mission-heat.mjs'
import { southPolePowerMax } from './coverage-map.mjs'

const $ = id => document.getElementById(id)
const hour = 3_600_000
const layerNames = ['overlap', 'sun', 'earth', 'both', 'power', 'shadows']
const node = (tag, className, text) => {
  const el = document.createElement(tag)
  el.className = className
  if (text) el.textContent = text
  return el
}

function heatImage(values, size, hours) {
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = size
  const context = canvas.getContext('2d')
  const image = context.createImageData(size, size)
  values.forEach((value, index) => {
    if (value < 0) return
    const encoded = Math.round(Math.min(1, Math.max(0, value / hours)) * 65535)
    image.data.set([encoded >> 8, encoded & 255, 0, 255], index * 4)
  })
  context.putImageData(image, 0, 0)
  return canvas
}

export function createExplorerViewers({ onShadowsChange }) {
  const slots = []
  let metadata, ephemeris, mission, frames, configKey = '', elapsed = 0
  let generation = 0
  let pendingSite, journeyReady = false, iframe, request = 0, returned = false
  const enabled = name => $(`explorer-${name}`).checked
  const ready = Promise.all([fetch('./data/catalog.json'), fetch('./data/ephemeris.bin')]).then(async replies => {
    if (replies.some(reply => !reply.ok)) throw new Error('The map data could not load. Reload to try again.')
    metadata = await replies[0].json()
    metadata.startMs = Date.parse(metadata.start)
    ephemeris = binaryFrames(await replies[1].arrayBuffer())
  }).catch(error => { $('map-layer-status').textContent = error.message })

  function frame() { return frames?.[Math.min(frames.length - 1, Math.round(elapsed * 4))] }
  function updateLayers() {
    const current = frame()
    if (!current) return
    const visibility = (enabled('sun') ? 1 : 0) | (enabled('earth') ? 2 : 0) | (enabled('both') ? 4 : 0)
    const maxPower = Math.max(1, southPolePowerMax(...current, artemisSouthLatitude))
    for (const slot of slots) {
      if (!slot.globe) continue
      // A transparent raster enables the common heat shader while the measured
      // view-specific grid supplies values; never substitute unshadowed values.
      slot.globe.setHeatDetail(enabled('overlap') ? slot.heat : null)
      slot.globe.setLayers(current, {
        visibility, power: enabled('power'), terrainShadows: enabled('shadows'),
        northLatitude: artemisSouthLatitude, powerMax: maxPower,
        heatRaster: enabled('overlap') && slot.heat ? slot.emptyHeat : undefined,
      })
    }
    $('map-time-label').textContent = new Date(mission.start + elapsed * hour).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'
    const legend = $('map-layer-legend')
    legend.replaceChildren()
    if (enabled('overlap') || enabled('power')) {
      const ramp = node('i', 'explorer-ramp')
      ramp.style.background = enabled('overlap') ? overlapRamp(mission.hours) : 'linear-gradient(90deg,#1c284a,#328997,#fae89b)'
      legend.append('0 ', ramp, enabled('overlap') ? ` ${mission.hours} h out of ${mission.hours} h` : ` ${maxPower.toFixed(1)} W/m²`)
    } else if (visibility) {
      legend.textContent = visibility === 1 ? 'Gold · sunlight' : visibility === 2 ? 'Blue · Earth in view' : 'Teal · Sun and Earth in view'
    } else legend.textContent = 'Lunar imagery'
    status()
  }
  function status() {
    const active = slots.filter(slot => slot.root.isConnected)
    for (const slot of slots) {
      const calculating = enabled('overlap') && slot.busy
      slot.root.dataset.calculating = String(calculating)
      slot.pending.hidden = !calculating
    }
    const errors = active.filter(slot => slot.error || (enabled('shadows') && slot.terrain === 'failed'))
    $('map-layer-status').textContent = errors.length ? 'Some terrain layers could not load. ' + (errors.find(slot => slot.error)?.error ?? 'Reload to retry crater shadows.') :
      enabled('overlap') && active.some(slot => slot.busy) ? 'Calculating mission overlap across the terrain…' :
      enabled('shadows') && active.some(slot => slot.terrain !== 'ready') ? 'Loading LOLA crater shadows…' :
      enabled('overlap') ? `${enabled('shadows') ? 'LOLA terrain horizons' : '0° reference horizon'} · same hours scale on all three maps` :
      'Checked layers intersect · drag to look around the South Pole'
  }
  function cancelHeat(slot) {
    clearTimeout(slot.timer)
    slot.worker?.terminate()
    slot.worker = null
    slot.busy = false
  }
  function queueHeat(slot) {
    cancelHeat(slot)
    slot.heat = null
    slot.globe?.setHeatDetail(null)
    if (!enabled('overlap') || !frames || !slot.root.isConnected) return
    slot.busy = true
    status()
    slot.timer = setTimeout(() => {
      const view = slot.globe?.heatViewport()
      if (!view || !slot.root.isConnected) { slot.busy = false; return }
      const token = generation
      const worker = slot.worker = new Worker(new URL('./mission-heat-worker.mjs', import.meta.url), { type: 'module' })
      const fail = message => { slot.busy = false; slot.error = message; worker.terminate(); status() }
      worker.onerror = () => fail('Mission overlap calculation failed; toggle it to retry.')
      worker.onmessage = ({ data }) => {
        if (token !== generation || slot.worker !== worker) return
        if (data.error) { fail(data.error); return }
        slot.heat = { ...data, image: heatImage(data.periods[0].values, data.size, mission.hours) }
        slot.busy = false
        slot.error = null
        worker.terminate()
        slot.worker = null
        updateLayers()
      }
      worker.postMessage({ frames, stepHours: .25, southOnly: true, detail: {
        view, northLatitude: artemisSouthLatitude, terrain: enabled('shadows'), anchor: slot.site,
      } })
    }, 250)
  }
  function makeSlot() {
    const root = node('div', 'explorer-map')
    const canvas = node('canvas', 'explorer-moon')
    canvas.setAttribute('role', 'img')
    canvas.setAttribute('aria-label', 'South Pole comparison map, 84°S to 90°S')
    const markers = node('div', 'explorer-markers')
    const features = node('canvas', 'explorer-features')
    features.hidden = true
    const pole = node('span', 'explorer-pole')
    const pending = node('span', 'map-pending', 'Calculating overlap…')
    pending.hidden = true
    const directions = { sun: node('span', ''), earth: node('span', '') }
    const controls = node('div', 'explorer-map-controls')
    const slot = { root, canvas, markers, controls, pending, site: null, heat: null, terrain: 'idle' }
    for (const [label, title, action] of [
      ['−', 'Zoom out', () => slot.globe.zoom(1 / 1.4)], ['+', 'Zoom in', () => slot.globe.zoom(1.4)],
      ['Center', 'Center on this site', () => slot.globe.center(slot.site)],
    ]) {
      const button = node('button', 'ghost', label)
      button.type = 'button'
      button.setAttribute('aria-label', title)
      button.onclick = action
      controls.append(button)
    }
    root.append(canvas, features, markers, pole, controls, pending)
    slot.emptyHeat = document.createElement('canvas')
    slot.emptyHeat.width = slot.emptyHeat.height = 1
    slot.init = () => {
      if (slot.globe || slot.failed) return
      try {
        slot.globe = createGlobe(canvas, markers, features, pole, metadata.mapExtent, id => openSite(id), null, null, {
          regionNorthLatitude: artemisSouthLatitude, directions,
          onViewChange: () => { queueHeat(slot) },
          onTerrainStatus: value => { slot.terrain = value; status() },
        })
      } catch (error) {
        slot.failed = true
        slot.error = error.message
        root.append(node('p', 'map-error', '3D unavailable. Select the site name to open its Surface view.'))
        controls.hidden = true
      }
    }
    return slot
  }

  function mount(index, parent, site) {
    const slot = slots[index] ??= makeSlot()
    parent.append(slot.root)
    const changed = slot.site?.id !== site.id
    slot.site = site
    void ready.then(() => {
      if (!metadata || !slot.root.isConnected) return
      slot.init()
      if (!slot.globe) { status(); return }
      slot.globe.setSites([{ ...site, displayName: siteName(site) }], site.id)
      if (changed) slot.globe.landCamera(site, 18)
      else slot.globe.draw()
      updateLayers()
    })
  }
  async function update(next) {
    const key = `${next.start}/${next.hours}/${next.terrain}`
    mission = next
    $('explorer-shadows').checked = next.terrain
    if (key === configKey) return
    returnToComparison(false)
    configKey = key
    const token = ++generation
    frames = null
    elapsed = 0
    $('map-time').value = 0
    $('map-time').max = next.hours
    for (const slot of slots) { cancelHeat(slot); slot.heat = null; slot.globe?.setLayers(null); slot.globe?.setHeatDetail(null) }
    await ready
    if (token !== generation || !metadata) return
    frames = framesFor(ephemeris, metadata, next.start, next.hours)
    if (!frames) { $('map-layer-status').textContent = 'This mission is outside ephemeris coverage.'; return }
    updateLayers()
    for (const slot of slots) queueHeat(slot)
  }

  function sendJourney() {
    if (!journeyReady || !pendingSite || returned) return
    iframe.contentWindow.postMessage({ type: 'astralis-explorer-visit', request, ...pendingSite }, location.origin)
  }
  function openSite(id) {
    const site = metadata?.catalog.find(site => site.id === id && site.lat <= artemisSouthLatitude)
    if (!site || !mission || !frames) return
    pendingSite = { id, start: mission.start, hours: mission.hours, terrain: mission.terrain, elapsed }
    request++
    returned = false
    $('explorer-journey').hidden = false
    $('suggestions').hidden = true
    $('explorer-map-tools').hidden = true
    $('journey-title').textContent = siteName(site)
    $('journey-status').textContent = journeyReady ? 'Flying to the landing site…' : 'Loading the lunar viewer…'
    if (!iframe) {
      iframe = document.createElement('iframe')
      iframe.title = 'Animated descent to the selected lunar landing site'
      iframe.src = './index.html?embed=explorer'
      $('journey-view').append(iframe)
    }
    sendJourney()
    $('explorer-journey').scrollIntoView({ behavior: 'smooth', block: 'start' })
    $('journey-back').focus({ preventScroll: true })
  }
  window.addEventListener('message', event => {
    if (event.origin !== location.origin || event.source !== iframe?.contentWindow) return
    const message = event.data
    if (message?.type === 'astralis-explorer-ready') { journeyReady = true; sendJourney() }
    if (message?.type === 'astralis-explorer-error' && message.request === undefined) $('journey-status').textContent = message.message
    if (message?.request !== request) return
    if (message.type === 'astralis-explorer-arrived') $('journey-status').textContent = 'Surface view · drag to look · WASD to walk'
    if (message.type === 'astralis-explorer-error') $('journey-status').textContent = message.message
  })
  function returnToComparison(focus = true) {
    if ($('explorer-journey').hidden) return
    returned = true
    request++
    iframe?.contentWindow.postMessage({ type: 'astralis-explorer-return', request }, location.origin)
    $('explorer-journey').hidden = true
    $('suggestions').hidden = false
    $('explorer-map-tools').hidden = false
    slots.forEach(slot => slot.globe?.draw())
    if (focus) $('explorer-both').focus({ preventScroll: true })
  }
  $('journey-back').onclick = () => returnToComparison()
  $('map-time').oninput = () => { elapsed = Number($('map-time').value); updateLayers() }
  for (const name of layerNames) $(`explorer-${name}`).onchange = () => {
    if (name === 'shadows') onShadowsChange(enabled('shadows'))
    if (name === 'overlap' || name === 'shadows') for (const slot of slots) queueHeat(slot)
    updateLayers()
  }
  return { mount, update, openSite, returnToComparison }
}
