# Project Astralis

Team workspace for the 2026 NASA Space Apps Challenge, [Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/). The challenge asks teams to make it easier to compare lunar landing sites and dates using the Sun and Earth's positions relative to the horizon.

**[Open Astralis](https://debaprashad-bhowmik.github.io/project-astralis/).** Choose a landing date, mission length, and priority to rank eight lunar sites. Compare independently dated scenarios, rotate the 3D Moon, and inspect the computed local horizon, daylight, and Earth-visibility windows.

**[Start with the Astralis handbook](ASTRALIS-HANDBOOK.md).** It covers the challenge, an example app screen, NASA data downloads, reproducible query settings, the build and testing workflow, team collaboration, the judging rubric, and submission.

## Run locally

From the repository root, run `python -m http.server 4173` and open [localhost:4173](http://localhost:4173). The web app loads its data from this repository and needs no API keys or build step. Run `node --test planner.test.mjs` to verify the ranking and reference calculations.

## Working together

Clone the repo, create a branch from `main` for your task, and open a pull request when your work is ready for review. Use GitHub Issues to share questions and track tasks.

## References

- [NASA Space Apps Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [NASA JPL Horizons ephemeris service](https://ssd.jpl.nasa.gov/horizons/)
- [NASA Goddard LOLA south pole elevation data](https://pgda.gsfc.nasa.gov/products/90)
