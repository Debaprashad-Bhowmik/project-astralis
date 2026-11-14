import { missionOverlapGrid } from './mission-heat.mjs'

self.onmessage = ({ data: { frames, stepHours } }) => {
  const grid = missionOverlapGrid(frames, stepHours)
  self.postMessage(grid, grid.periods.map(period => period.values.buffer))
}
