// Computes every site at every landing-date offset, nearest offsets first, so the chart fills in progressively.
import { binaryFrames } from './planner.mjs'
import { day, framesFor, offsetOrder, scenario } from './explore-model.mjs'

let data
let currentJob = 0
const pause = () => new Promise(resolve => setTimeout(resolve))

async function load() {
  const [catalogReply, ephemerisReply] = await Promise.all([fetch('./data/catalog.json'), fetch('./data/ephemeris.bin')])
  if (!catalogReply.ok || !ephemerisReply.ok) throw new Error('The lunar data files could not be loaded.')
  const metadata = await catalogReply.json()
  const catalog = { ...metadata, startMs: Date.parse(metadata.start), endMs: Date.parse(metadata.end) }
  return { catalog, ephemeris: binaryFrames(await ephemerisReply.arrayBuffer()) }
}

self.onmessage = async ({ data: request }) => {
  const job = currentJob = request.job
  try {
    data ??= load()
    const { catalog, ephemeris } = await data
    if (request.type === 'catalog') {
      self.postMessage({ type: 'catalog', job, sites: catalog.catalog, start: catalog.start, end: catalog.end })
      return
    }
    const { start, hours, terrain } = request
    for (const offset of offsetOrder) {
      if (job !== currentJob) return
      const frames = framesFor(ephemeris, catalog, start + offset * day, hours)
      const rows = frames ? catalog.catalog.map(site => scenario(site, frames, hours, terrain)) : null
      self.postMessage({ type: 'offset', job, offset, rows })
      await pause()
    }
    if (job === currentJob) self.postMessage({ type: 'done', job })
  } catch (error) {
    self.postMessage({ type: 'error', job, message: error.message })
  }
}
