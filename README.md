# Project Astralis

The Astralis is building a Lunar Site Navigator for the 2026 NASA Space Apps Challenge. The challenge asks teams to make it easier to compare lunar landing sites and dates using the Sun and Earth's positions relative to the horizon. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

**[Open Astralis](https://debaprashad-bhowmik.github.io/project-astralis/).** Choose a landing date, mission length, and priority to rank 39 landing and study locations. In Site ranking, choose **Site type → Future CLPS targets** to compare planned mission regions. Rotate the Moon to see sites on both hemispheres, search the 9,087 IAU-approved feature names, and click anywhere on the globe to evaluate the terrain horizon, daylight, and Earth visibility. Compare independently dated scenarios or scrub the Sun–Earth–Moon view in 3D.

**[Start with the Astralis handbook](ASTRALIS-HANDBOOK.md).** It covers the challenge, an example app screen, NASA data downloads, reproducible query settings, the build and testing workflow, team collaboration, the judging rubric, and submission.

**[Explore three guided examples](https://debaprashad-bhowmik.github.io/project-astralis/#explore).** Compare a three-day landing delay, near-side and far-side Earth visibility, or the solar power implications of a low Sun. Each example uses the mission planner’s data and can open as an editable comparison.

**[Open the local sky view](https://debaprashad-bhowmik.github.io/project-astralis/#local-sky).** Switch to the first-person 3D surface view to see the Sun and Earth at their apparent sizes. Choose Illustrated or Natural, or point toward a nearby named crater. Both styles use NASA LOLA terrain and LROC reflectance, with illustrative small impact pits and image-generated dust. The Shackleton Rim study site includes NASA’s 5 m/pixel local elevation raster.

**3D orbit view.** Switch between Earth-centered and Sun-centered views. Select **Whole year** to explore any calendar year from 2024 through 2030 in UTC. Jump to a month, scrub the date slider, or play at 1, 5, or 15 simulation days per second. **Mission window** returns to the shared mission timeline.

In **Mission setup → Operating window**, select **Full year** to run from landing to the same UTC date and time the next year. The window has 365 or 366 days, and a starting date of February 29 ends on March 1 the following year. The end must be within the bundled ephemeris, which runs through January 1, 2031 at 00:00 UTC. The heat map, comparisons, surface views, and orbit scene’s **Mission window** mode all use that window.

The **One lunar day** preset spans 29.5 Earth days. Use **Show paths over the mission** to trace both bodies, choose a playback speed, or open **Jump to a rise or set** to inspect a crossing from the event list.

**[Explore the South Pole on the 3D Moon](https://debaprashad-bhowmik.github.io/project-astralis/#south-pole).** The 90°S marker and 84°S ring show the pole and the edge of NASA’s six-degree Artemis exploration zone. Select a **Surface layer** to see sunlight, direct Earth visibility, or their overlap on the rotatable globe or flat visibility map. Global coverage uses a smooth reference horizon. Individual sites use the selected horizon model.

**Compare mission overlap on the Moon.** In **Lunar sites**, use **Mission overlap heat map** to see the hours with both sunlight and a direct view of Earth for the full mission or one quarter. Uncolored terrain has zero overlap. Green marks the highest overlap across the map and listed sites for that period. The legend shows that maximum alongside the full mission duration. Select a site to see the overlap track and the UTC times of overlap and gaps.

**[Check power and communications](https://debaprashad-bhowmik.github.io/project-astralis/#assessment).** Compare sunlight hours, direct Earth visibility windows, the longest gaps, and equivalent full-sun hours for a flat panel. Set mission limits to check or rank sites using your own requirements.

## Run locally

From the repository root, run `python -m http.server 4173` and open [localhost:4173](http://localhost:4173). The web app loads its data from this repository and needs no API keys or build step. Run `node --test planner.test.mjs` to verify the ranking and reference calculations.

## Working together

Clone the repo, create a branch from `main` for your task, and open a pull request when your work is ready for review. Use GitHub Issues to share questions and track tasks.

## References

- [NASA Space Apps Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [NASA JPL Horizons ephemeris service](https://ssd.jpl.nasa.gov/horizons/)
- [NASA Goddard LOLA south pole elevation data](https://pgda.gsfc.nasa.gov/products/90)
