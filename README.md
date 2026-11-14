# Project Astralis

The Astralis is building a Lunar Site Navigator for the 2026 NASA Space Apps Challenge. The challenge asks teams to make it easier to compare lunar landing sites and dates using the Sun and Earth's positions relative to the horizon. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

**[Open Astralis](https://debaprashad-bhowmik.github.io/project-astralis/).** Choose a landing date, mission length, and priority to rank 37 landing and study locations. Rotate the Moon to see sites on both hemispheres, search the 9,087 IAU-approved feature names, and click anywhere on the globe to evaluate the terrain horizon, daylight, and Earth visibility. Compare independently dated scenarios or scrub the Sun–Earth–Moon view in 3D.

**[Start with the Astralis handbook](ASTRALIS-HANDBOOK.md).** It covers the challenge, an example app screen, NASA data downloads, reproducible query settings, the build and testing workflow, team collaboration, the judging rubric, and submission.

**[Explore three guided examples](https://debaprashad-bhowmik.github.io/project-astralis/#explore).** Compare a three-day landing delay, near-side and far-side Earth visibility, or the solar power implications of a low Sun. Each example uses the mission planner’s data and can open as an editable comparison.

**[Open the local sky view](https://debaprashad-bhowmik.github.io/project-astralis/#local-sky).** Switch to the first-person 3D surface view to see the Sun and Earth at their apparent sizes. Scrub the timeline to see the modeled NASA LOLA terrain light up or fall into shadow as the Sun moves. The surface uses NASA LROC reflectance with illustrative fine grain. The timeline also updates the estimated time to the next sunrise, sunset, Earthrise, or Earthset.

**[Open the 3D orbit view](https://debaprashad-bhowmik.github.io/project-astralis/#space).** Switch between Earth-centered and Sun-centered views. Toggle the Moon’s orbit, the annual Sun or Earth path, and the dashed body links independently.

The **One lunar day** operating window plays 29.5 Earth days from landing. Use **Show paths over the mission** to trace both bodies, choose a playback speed, or open **Jump to a rise or set** to inspect a crossing from the event list. The map, orbit scene, and surface views share the same mission clock.

**[Explore the lunar maps](https://debaprashad-bhowmik.github.io/project-astralis/#map-heading).** Choose the 3D Moon, the south-pole map, or the whole-Moon visibility map to see where sunlight and a direct view of Earth overlap at the selected time. The global overlay uses a smooth sphere. Individual sites use the selected horizon model.

**[Check power and communications](https://debaprashad-bhowmik.github.io/project-astralis/#assessment).** Compare sunlight hours, direct Earth visibility windows, the longest gaps, and equivalent full-sun hours for a flat panel. Set mission limits to check or rank sites using your own requirements.

## Run locally

From the repository root, run `python -m http.server 4173` and open [localhost:4173](http://localhost:4173). The web app loads its data from this repository and needs no API keys or build step. Run `node --test planner.test.mjs` to verify the ranking and reference calculations.

## Working together

Clone the repo, create a branch from `main` for your task, and open a pull request when your work is ready for review. Use GitHub Issues to share questions and track tasks.

## References

- [NASA Space Apps Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [NASA JPL Horizons ephemeris service](https://ssd.jpl.nasa.gov/horizons/)
- [NASA Goddard LOLA south pole elevation data](https://pgda.gsfc.nasa.gov/products/90)
