import { missionOverlapGrid, southPoleOverlapGrid } from './mission-heat.mjs'

self.onmessage = ({ data: { frames, stepHours, southOnly } }) => {
  const grid = southOnly ? southPoleOverlapGrid(frames, stepHours) : missionOverlapGrid(frames, stepHours)
  self.postMessage(grid, grid.periods.map(period => period.values.buffer))
}
