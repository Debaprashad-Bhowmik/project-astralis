// Pure model for the Trade-off Explorer: scenario metrics, Pareto fronts and weighted scores.
import { evaluate, frameAt, skyCrossings } from './planner.mjs'

export const dayOffsets = Array.from({ length: 31 }, (_, index) => index - 15)
export const hour = 3_600_000
export const day = 24 * hour

export const regions = {
  pole: { label: 'South polar (60°S–90°S)', test: site => site.lat <= -60 },
  clps: { label: 'Future CLPS targets', test: site => site.kind.startsWith('Future CLPS') },
  historic: { label: 'Historic landings', test: site => site.kind.startsWith('Historic') },
  other: { label: 'Other study points', test: site => !site.kind.startsWith('Future CLPS') && !site.kind.startsWith('Historic') },
}

const displayNames = { athena: 'Mons Mouton', odysseus: 'Malapert A', mouton: 'Mons Mouton Plateau' }
export const siteName = site => displayNames[site.id] ?? site.name

// Order offsets so the chosen date arrives first and neighbors fill outward.
export const offsetOrder = [...dayOffsets].sort((a, b) => Math.abs(a) - Math.abs(b) || a - b)

export function framesFor(ephemeris, catalog, start, hours) {
  const first = (start - catalog.startMs) / (catalog.step * 1000)
  const last = first + hours * 4
  if (first < 0 || last > ephemeris.length / 6 - 1) return null
  return Array.from({ length: hours * 4 + 1 }, (_, index) => frameAt(ephemeris, first + index))
}

// Time until the body next leaves (or, when below the skyline, next enters) view.
function nextChange(events, upAtStart) {
  const event = events.find(candidate => candidate.at > 0 && candidate.rising === !upAtStart)
  return event ? event.at : null
}

export function scenario(site, frames, hours, terrain) {
  const row = evaluate(site, frames, hours, terrain, { includeTimeline: true, includeEnergy: true })
  const first = row.timeline[0]
  const sunUp = !first.eclipse && first.sunEl > first.sunHorizon
  const earthUp = first.earthEl > first.earthHorizon
  const crossings = skyCrossings(row.timeline, .25)
  const { metrics } = row
  const share = value => 100 * value / hours
  return {
    id: site.id,
    sun: share(metrics.sun),
    earth: share(metrics.earth),
    overlap: share(metrics.overlap),
    energy: metrics.energyKwh,
    darkGap: metrics.darkness,
    earthGap: metrics.blackout,
    sunUp, earthUp,
    sunChange: nextChange(crossings.sun, sunUp),
    earthChange: nextChange(crossings.earth, earthUp),
    sunEl: first.sunEl,
    // Continuous time with both power and a direct link starting at touchdown.
    touchdown: metrics.both[0] && metrics.both[0][0] < 1e-6 ? metrics.both[0][1] : 0,
    hours,
    sunWindows: row.sun,
    earthWindows: row.earth,
  }
}

// ---------- Detail funnel ----------
// side: which end of the power/contact priority slider a factor belongs to.
// more/less: how a difference reads in a sentence; help: one-line definition shown on hover.
export const criteria = {
  sun: { weight: 1, side: 'power', short: 'Sunlight', label: 'Sunlight', more: 'more sunlight', less: 'less sunlight',
    help: 'Share of the mission with the Sun above the local skyline.',
    value: row => row.sun / 100, show: row => `${Math.round(row.sun)}%`, tick: g => `${Math.round(g)}%`,
    best: row => `Most sunlight (${Math.round(row.sun)}%)`, weak: row => `only ${Math.round(row.sun)}% sunlight` },
  earth: { weight: 1, side: 'contact', short: 'Earth in view', label: 'Earth in view', more: 'more time with Earth in view', less: 'less time with Earth in view',
    help: 'Share of the mission with Earth above the local skyline, so direct radio contact is possible.',
    value: row => row.earth / 100, show: row => `${Math.round(row.earth)}%`, tick: g => `${Math.round(g)}%`,
    best: row => `Most time with Earth in view (${Math.round(row.earth)}%)`, weak: row => `Earth is in view only ${Math.round(row.earth)}% of the time` },
  dark: { weight: .6, side: 'power', lowerBetter: true, short: 'Darkness', label: 'Longest darkness', more: 'shorter darkness', less: 'longer darkness',
    help: 'Longest stretch without sunlight; batteries and heaters must last this long.',
    value: row => 1 - row.darkGap / row.hours, show: row => formatHours(row.darkGap), tick: (g, hours) => formatHours((1 - g / 100) * hours),
    best: row => row.darkGap < .5 ? 'Never dark' : `Shortest darkness (${formatHours(row.darkGap)})`, weak: row => `darkness lasts up to ${formatHours(row.darkGap)}` },
  blackout: { weight: .6, side: 'contact', lowerBetter: true, short: 'Earth gap', label: 'Longest Earth gap', more: 'shorter Earth gaps', less: 'longer Earth gaps',
    help: 'Longest stretch with Earth below the skyline and no direct contact.',
    value: row => 1 - row.earthGap / row.hours, show: row => formatHours(row.earthGap), tick: (g, hours) => formatHours((1 - g / 100) * hours),
    best: row => row.earthGap < .5 ? 'Never loses Earth' : `Shortest Earth gap (${formatHours(row.earthGap)})`, weak: row => `Earth is out of view for up to ${formatHours(row.earthGap)}` },
  together: { weight: .4, side: 'both', short: 'Sun + Earth', label: 'Sun and Earth together', more: 'more time with both', less: 'less time with both',
    help: 'Share of the mission with power and a direct link at the same time.',
    value: row => row.overlap / 100, show: row => `${Math.round(row.overlap)}%`, tick: g => `${Math.round(g)}%`,
    best: row => `Most time with Sun and Earth together (${Math.round(row.overlap)}%)`, weak: row => `Sun and Earth together only ${Math.round(row.overlap)}% of the time` },
  touchdown: { weight: .4, side: 'both', short: 'At touchdown', label: 'Power and link from touchdown', more: 'more power and link after touchdown', less: 'less power and link after touchdown',
    help: 'Unbroken time with both sunlight and Earth in view, starting at touchdown.',
    value: row => row.touchdown / row.hours, show: row => formatHours(row.touchdown), tick: (g, hours) => formatHours(g / 100 * hours),
    best: row => `Longest power and link from touchdown (${formatHours(row.touchdown)})`, weak: row => row.touchdown < .25 ? 'no power and link together at touchdown' : `only ${formatHours(row.touchdown)} of power and link after touchdown` },
  // Worst sunlight-and-Earth share (weighted by the priority slider) for any landing within ±3 days.
  slip: { weight: .4, side: 'both', short: 'If date slips', label: 'Worst case if landing slips 3 days', more: 'holds up better if the date slips', less: 'holds up worse if the date slips',
    help: 'Lowest sunlight and Earth share, weighted by your priority, for any landing up to 3 days earlier or later.',
    value: row => (row.floor ?? 0) / 100, show: row => row.floor === undefined ? '—' : `${Math.round(row.floor)}%`, tick: g => `${Math.round(g)}%`,
    best: row => `Holds up best if the date slips (never below ${Math.round(row.floor ?? 0)}%)`, weak: row => `a 3-day slip can drop it to ${Math.round(row.floor ?? 0)}%` },
}

// Differences read from the first option's point of view, in the factor's own units: "more sunlight (91% vs 51%)".
for (const factor of Object.values(criteria)) {
  factor.diff = (a, b) => {
    const gap = factor.value(a) - factor.value(b)
    if (Math.abs(gap) < .01 || factor.show(a) === factor.show(b)) return null
    return { size: Math.abs(gap), text: `${gap > 0 ? factor.more : factor.less} (${factor.show(a)} vs ${factor.show(b)})` }
  }
}

// Each level shows a fixed number of factors; which ones is decided by chooseCriteria.
export const levels = [
  { id: 1, name: 'Essentials', count: 2, question: 'The two factors that most separate these options.' },
  { id: 2, name: 'Closer look', count: 4, question: 'The four most decisive factors.' },
  { id: 3, name: 'Deep dive', count: 6, question: 'Six factors, including time right after landing.' },
  { id: 4, name: 'All factors', count: 7, question: 'Every factor, including what happens if the date slips.' },
  { id: 5, name: 'Everything', count: 7, question: 'All numbers, the raw table, export and a check against JPL Horizons.' },
]

const sideMultiplier = (side, priority) => side === 'power' ? 2 * priority : side === 'contact' ? 2 * (1 - priority) : 1

// Adaptive ordering: a factor earns a place by how much it matters (weight and priority)
// times how much it actually separates the options being compared. Factors that barely differ drop down.
export function chooseCriteria(candidates, level, priority) {
  const count = levels[level - 1].count
  const ranked = Object.keys(criteria).map((key, order) => {
    const { weight, side, value } = criteria[key]
    const importance = weight * sideMultiplier(side, priority)
    const values = candidates.map(value)
    const spread = values.length > 1 ? Math.max(...values) - Math.min(...values) : 1
    return { key, order, importance, spread, relevance: importance * spread }
  }).sort((a, b) => b.relevance - a.relevance || b.importance - a.importance || a.order - b.order)
  const keys = ranked.slice(0, count).map(item => item.key)
  // Report core factors left out because every option scores about the same on them.
  const similar = ranked.slice(count).filter(item => item.importance > 0 && item.spread < .05 && criteria[item.key].weight >= .6).map(item => {
    // Ranges read low to high in display units, so gaps (where lower is better) sort the other way.
    const direction = criteria[item.key].lowerBetter ? -1 : 1
    const shown = candidates.map(row => ({ text: criteria[item.key].show(row), value: criteria[item.key].value(row) })).sort((a, b) => direction * (a.value - b.value))
    const range = shown.length ? (shown[0].text === shown.at(-1).text ? shown[0].text : `${shown[0].text}–${shown.at(-1).text}`) : ''
    return { key: item.key, range }
  })
  return { keys, similar }
}

// Mission presets play the role of buyer types: they set length, priority and requirements in one click.
export const presets = {
  explore: { label: 'Just exploring', hours: 168, weight: .5, req: { sun: 0, earth: 0, dark: null, blackout: null } },
  lander: { label: '14-day lander', hours: 336, weight: .6, req: { sun: 40, earth: 30, dark: null, blackout: null } },
  comms: { label: 'Talk to Earth often', hours: 168, weight: .3, req: { sun: 0, earth: 60, dark: null, blackout: 48 } },
  night: { label: 'Avoid long darkness', hours: 336, weight: .7, req: { sun: 0, earth: 0, dark: 72, blackout: null } },
}

export function meetsRequirements(row, req) {
  const misses = []
  if (row.sun + 1e-9 < req.sun) misses.push(`sunlight ${Math.round(row.sun)}% < ${req.sun}%`)
  if (row.earth + 1e-9 < req.earth) misses.push(`Earth view ${Math.round(row.earth)}% < ${req.earth}%`)
  if (req.dark !== null && row.darkGap - 1e-9 > req.dark) misses.push(`darkness ${formatHours(row.darkGap)} > ${formatHours(req.dark)}`)
  if (req.blackout !== null && row.earthGap - 1e-9 > req.blackout) misses.push(`Earth gap ${formatHours(row.earthGap)} > ${formatHours(req.blackout)}`)
  return misses
}

// Weighted mean of the chosen factors, 0–100. Lower-weight factors mostly break ties.
export function funnelScore(row, keys, priority) {
  let total = 0
  let weights = 0
  for (const key of keys) {
    const { weight, side, value } = criteria[key]
    const multiplier = sideMultiplier(side, priority)
    total += weight * multiplier * value(row)
    weights += weight * multiplier
  }
  return weights ? 100 * total / weights : 0
}

// Lowest score within ±reach days of a landing date: the worst case if the schedule slips.
export function dateFloor(scoresByOffset, offset, reach = 3) {
  const nearby = []
  for (let step = offset - reach; step <= offset + reach; step++) if (scoresByOffset.has(step)) nearby.push(scoresByOffset.get(step))
  return nearby.length > 1 ? Math.min(...nearby) : undefined
}

// Scores within this many points count as a tie; deeper criteria are the honest way to separate them.
export const tieTolerance = 2

// One-line reasons: what the leader is best at and its main weakness; what each alternative gains and gives up versus #1.
export function explain(row, rank, leader, candidates, keys) {
  if (rank === 0) {
    const best = keys.map(key => ({ key, place: candidates.filter(other => criteria[key].value(other) > criteria[key].value(row) + 1e-9).length }))
      .sort((a, b) => a.place - b.place)[0]
    const lead = best.place === 0 ? criteria[best.key].best(row) : `Strong on ${criteria[best.key].label.toLowerCase().replace('earth', 'Earth').replace('sun ', 'Sun ')} (${criteria[best.key].show(row)})`
    // A weakness is anything below half of its ideal value, regardless of how other sites fare.
    const weakest = keys.filter(key => key !== best.key).map(key => ({ key, value: criteria[key].value(row) })).sort((a, b) => a.value - b.value)[0]
    return weakest && weakest.value < .5 ? `${lead}, but ${criteria[weakest.key].weak(row)}.` : `${lead}, with no major weakness.`
  }
  const changes = keys.map(key => ({ key, change: criteria[key].diff(row, leader), better: criteria[key].value(row) > criteria[key].value(leader) }))
    .filter(item => item.change)
  const gain = changes.filter(item => item.better).sort((a, b) => b.change.size - a.change.size)[0]
  const loss = changes.filter(item => !item.better).sort((a, b) => b.change.size - a.change.size)[0]
  if (!gain && !loss) return 'Practically identical to #1.'
  const capital = text => text[0].toUpperCase() + text.slice(1)
  return capital([gain?.change.text, loss?.change.text].filter(Boolean).join(', but ')) + ' than #1.'
}

export const axes = {
  sun: { label: 'Sunlight', unit: '%', scale: () => 100 },
  energy: { label: 'Solar energy', unit: 'kWh/m²', scale: max => max },
  earth: { label: 'Earth in view', unit: '%', scale: () => 100 },
  overlap: { label: 'Sun and Earth together', unit: '%', scale: () => 100 },
}

export function passes(point, requirements) {
  return point.sun + 1e-9 >= requirements.sun && point.earth + 1e-9 >= requirements.earth &&
    point.darkGap - 1e-9 <= requirements.darkGap
}

// A point is on the front when no other point is at least as good on both axes and better on one.
export function paretoFront(points, xKey, yKey) {
  const sorted = [...points].sort((a, b) => b[xKey] - a[xKey] || b[yKey] - a[yKey])
  const front = new Set()
  let bestY = -Infinity
  for (const point of sorted) {
    if (point[yKey] > bestY + 1e-9) {
      front.add(point.id)
      bestY = point[yKey]
    }
  }
  return front
}

// Weight 1 values only the x axis; weight 0 values only the y axis. Axes are normalized by their scale.
export function weightedScore(point, weight, xKey, yKey, scales) {
  return 100 * (weight * point[xKey] / scales.x + (1 - weight) * point[yKey] / scales.y)
}

export function niceRange(values, scale) {
  const finite = values.filter(Number.isFinite)
  if (!finite.length) return [0, scale]
  const step = scale >= 50 ? 10 : niceStep(scale / 5)
  const low = Math.max(0, Math.floor((Math.min(...finite) - step * .3) / step) * step)
  const high = Math.min(scale, Math.ceil((Math.max(...finite) + step * .3) / step) * step)
  return high > low ? [low, high] : [Math.max(0, low - step), low + step]
}

function niceStep(raw) {
  const power = 10 ** Math.floor(Math.log10(raw))
  const fraction = raw / power
  return (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * power
}

export function formatHours(value) {
  if (value === null || value === undefined) return '—'
  if (value < 1) return `${Math.round(value * 60)} min`
  if (value < 48) return `${value < 10 ? value.toFixed(1).replace(/\.0$/, '') : Math.round(value)} h`
  const days = value / 24
  return `${days < 10 ? days.toFixed(1).replace(/\.0$/, '') : Math.round(days)} d`
}
