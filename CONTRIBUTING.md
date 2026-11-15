# Working on Lunar Landing Site Navigator

Team: **Astralis**. Project: **Lunar Landing Site Navigator**. Current release: **v1.5.0 — Deb**. Start with the [README](README.md), [handbook](ASTRALIS-HANDBOOK.md), and [references](REFERENCES.md).

## Access and setup

This repository is private. Accept the collaborator invitation and sign in with that GitHub account. The README's Windows and macOS commands are for running the latest release in a separate `project-astralis-run` folder. Develop in your own checkout on a branch from current `main`, such as `codex/terrain-caption` or `feature/site-comparison`. Open a pull request for review.

Use `python scripts/serve_astralis.py --open` after installing `numpy` and `rasterio` to run a development checkout. No API keys are required. Keep terrain downloads and personal attachments outside tracked source. Do not commit `.venv`, secrets, screenshots of private accounts, or full upstream GeoTIFF archives.

## Changes that reviewers can assess

- State the user-visible problem and the resulting behavior in the pull request. Include a screenshot for a visual change and the relevant validation results.
- Preserve scientific terrain and ephemeris inputs when changing rendering. Generated rocks, dust, camera effects, and artistic shading must never silently enter visibility, slope, or power calculations.
- For a new dataset, record its original provider, exact product/file, local derivative, units, coordinate frame, resolution, transformation, and limitations in [REFERENCES.md](REFERENCES.md). Keep third-party credits with the asset.
- Add meaningful regression checks when changing calculations. Inspect visual changes at a named site, custom coordinates, and a suggested patch; include reduced-motion and a small screen when changing navigation.
- Do not move a published version tag or force-push shared history. Preserve private access unless Deb explicitly requests a change.

## Checks before publishing

Run from the repository root with Node.js 22+ and Python 3.13:

```sh
node --test planner.test.mjs landing-suggestions.test.mjs orbital-geometry.test.mjs viewer-flight.test.mjs
python -m compileall -q scripts
python scripts/asset_manifest.py --check
git diff --check
```

If intentionally changing a bundled asset or data file, update its reference entry, run `python scripts/asset_manifest.py`, and review the checksum diff before rerunning `--check`. Checksums identify the bundled derivatives; they do not independently validate the science.

Run the same browser regression check used in GitHub Actions:

```sh
python -m pip install playwright==1.65.2
python -m playwright install chromium
python scripts/check_browser.py
```

This starts a temporary local server and checks the real bundled data, landing suggestions, all three rankings, projection changes, patch inspection, yearly Sun/Earth targeting, map filters, coordinates, comparison, CSV export, and mobile navigation. It deliberately tests the bundled-terrain fallback without downloading remote elevation tiles. To also exercise your running terrain server, use `python scripts/check_browser.py --url http://localhost:4173/`. `--browser-path` accepts an installed Chrome/Chromium executable. Browser checks complement the numerical tests; they do not establish scientific accuracy.

## Publish a named version

Every release update to `main` gets a new annotated `vMAJOR.MINOR.PATCH` tag. Choose a minor version for a feature release and a patch version for fixes. Update `VERSION`, `CITATION.cff`, the README, app footer/cache token, and `CHANGELOG.md`. Credit the actual contributor; the v1.5.0 release is credited to Deb.

After review and tests, commit the intended files on `main`. For example, the *next fix release* could use:

```sh
git tag -a v1.4.1 -m "Lunar Landing Site Navigator v1.4.1 — Deb"
git push --atomic origin main v1.4.1
```

Create a GitHub Release from that tag using the corresponding changelog entry. Verify the tag and `main` point to the intended commit and that the README launch commands select it. Teammates stop the old server with Ctrl+C and rerun the same launch command to update. Feature branches do not need release tags.

The code's project-wide redistribution license has not been selected. Existing data and font terms remain in effect; see [third-party notices](THIRD_PARTY_NOTICES.md).
