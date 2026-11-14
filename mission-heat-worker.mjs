import { overviewOverlapGrid } from './mission-heat.mjs'
import { detailOverlapGrid } from './mission-heat-detail.mjs'

self.onmessage = async ({ data: { frames, stepHours, southOnly, detail } }) => {
  try {
    const grid = detail ? await detailOverlapGrid(frames, stepHours, detail.view, detail.northLatitude, detail.terrain, detail.anchor) :
      overviewOverlapGrid(frames, stepHours, southOnly)
    self.postMessage(grid, grid.periods.map(period => period.values.buffer))
  } catch (error) { self.postMessage({ error: error.message }) }
}
