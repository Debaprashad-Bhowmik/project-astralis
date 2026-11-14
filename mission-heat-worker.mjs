import { missionOverlapGrid } from './mission-heat.mjs'

self.onmessage = ({ data: frames }) => {
  const grid = missionOverlapGrid(frames)
  self.postMessage(grid, [grid.values.buffer])
}
