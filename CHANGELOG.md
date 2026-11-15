# Version history

## v1.3.2 — Deb · Compact viewer controls (2026-11-15)

- Move **Mission window / Whole year** to the right end of the mission-tools row. Keep annual year, month, and playback controls together below it when enabled.
- Put the full coordinates and terrain-source/resolution label inline beside the landing-site selector on desktop, including **NASA LOLA South Pole · 10 m/pixel** where supplied by the terrain service.
- Align the Landing Suggestions checkbox with the other buttons. Adapt viewer height to the desktop viewport and reserve room for annual controls; narrow screens retain readable wrapping.
- Check desktop and mobile layouts, whole-year month selection and playback, mission mode, and all three camera modes. The Surface viewer and its primary controls fit at 1440×900 and 1920×1080 with the detail sections closed. Smaller screens or expanded analysis panels can still scroll.

Release prepared by **Deb**, team **Astralis**. Calculations, datasets, terrain geometry, and camera journeys are unchanged. See the [setup guide](README.md) and [references](REFERENCES.md).

## v1.3.1 — Deb · Viewer-first landing suggestions (2026-11-15)

- Hide the old best-fit headline/timelines, the “What matters most?” presets, and Advanced settings in Mission setup. Date, UTC time, duration, and the three-day shift remain visible.
- Move Landing Suggestions into its own full-width panel directly after the mission viewer, before the ordinary site ranking, on desktop and mobile.
- Preserve the scenario controls, slope limit, patch-to-Surface navigation, original map rendering, and three-panel comparison. Calculation defaults and scientific inputs are unchanged.
- Check the requested sections are hidden, the panel follows the viewer without a layout gap, mobile has no horizontal overflow, and suggested patches still open Surface with guides available.

Release prepared by **Deb**, team **Astralis**. See the [setup guide](README.md) and [references](REFERENCES.md).

## v1.3.0 — Deb · Three mission scenarios side by side (2026-11-15)

Release prepared by **Deb**, team **Astralis**. Project: **Lunar Landing Site Navigator**.

- Extend Compare landing sites to three panels: **Best communications**, **Best solar power**, and **Best balance**. Defaults come from the actual scenario winners, including winners outside the currently visible shortlist. The same patch may legitimately lead multiple scenarios.
- Put an editable site selector above each map. Manual choices remain selected across mission edits; **Use recommended patches** restores the calculated defaults. Recommendations load when the comparison opens, independently of the Landing Suggestions display toggle. Empty screens and closest alternatives are explicitly labeled.
- Reuse the original detailed Moon renderer for all three maps: dated illumination, crater shadows, Sun/Earth direction labels, rotation, zoom, centering, and South Pole controls. Each panel can open its selected site in the existing Surface viewer and suggested-patch camera journey.
- Compare total energy, average power, sunlight hours/percentage, Earth-view hours/percentage, longest continuous Earth view, slope, roughness, and visibility gaps. Patch totals use the original screening skyline and sampling cadence to match the suggestion results. A shared timeline synchronizes the views; optional dates for B and C retain schedule comparison.
- Validate with 72 numerical/geometry tests, 121 asset checksums, and browser regressions for all three defaults, matching totals, original-map zoom and lighting, manual overrides, mission edits, invalid dates, reset, Surface navigation, empty results, and stacked mobile panels.

Scientific datasets, ranking formulas, and generated-art disclosures are unchanged. See [REFERENCES.md](REFERENCES.md), [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md), and the [Windows/macOS update instructions](README.md). This remains a sampled planning tool, not a certified landing assessment. Repository access remains private.

## v1.2.2 — Deb · Connected flights between suggested sites (2026-11-15)

Release prepared by **Deb**, team **Astralis**.

- Connect suggested-patch selection to the shared camera journey. From Surface, keep the current site visible during ascent, rotate the Moon Map to the destination, and use the existing descent into its first-person terrain. From Orbit or Moon Map, join the same route at the relevant stage.
- Queue the latest selected patch during a transition instead of replacing the visible terrain mid-flight. Preserve the shortlist, existing transition focus, physical terrain, sunlight, and crater shadows. Reduced motion follows the same site changes without an extended flight.
- Add date-line/endpoint tests for map rotation and a browser regression requiring a surface-to-surface patch change to pass through the Moon Map. Validation includes 71 numerical/geometry tests, browser checks, 121 asset checksums, and an animated live-server check of ascent, rotation, descent, and a changed destination.

This is camera navigation, not a simulated spacecraft landing trajectory. Scientific inputs and ranking methods are unchanged; source and asset provenance remain in [REFERENCES.md](REFERENCES.md). Stop the old server and rerun the Windows or macOS block in [README.md](README.md) to update to **v1.2.2**. Private repository access is unchanged.

## v1.2.1 — Deb · Restore mission tools and strengthen distant focus (2026-11-15)

Release prepared by **Deb**, team **Astralis**. Project: **Lunar Landing Site Navigator**.

### Fixes

- Make **Landing Suggestions** visible beside the Orbit, Moon Map, and Surface tabs. Enabling it takes the user to the shortlist with Best communications, Best solar power, Best balance, and the editable slope limit.
- Fix projection changes cancelling the landing worker and clearing the shortlist. Results now persist across 3D, polar, visibility, Orbit, and Surface views; mission and slope changes still recalculate them. Selecting a patch still opens its first-person terrain.
- Add direct access to map layers, custom coordinates, named lunar features, and two-site comparisons. Expand map analysis controls by default without turning on visibility/power overlays.
- Fix **Find Sun**, **Find Earth**, and off-screen targeting in the whole-year Surface view: aim at the displayed date, not the mission's original time. Off-screen buttons return keyboard focus to the visible primary control.
- Double the maximum **Distant softness** blur radius from 2.6 to 5.2 CSS pixels. Keep foreground detail, sky bodies, annotations, terrain elevations, crater shadows, and planning calculations unchanged.

### Validation and references

- 69 numerical, terrain, geometry, and camera tests; 121 bundled asset/data checksums.
- Add a reproducible Chromium browser regression check and run it in GitHub Actions. It covers suggestion visibility/persistence, all three ranking scenarios, mission/slope changes, patch Surface inspection, annual targeting, map layers, custom and catalog sites, comparison dates, CSV, leap years, and mobile navigation.
- Check the live terrain server at named, custom, and suggested locations; verify stronger distant focus on the GPU while nearby and sky pixels remain unchanged. Windows and macOS launcher syntax is checked; both launchers continue to select the latest tagged release.
- Scientific sources and derived data are unchanged. Source provenance, rendering references, and AI/artwork disclosures remain in [REFERENCES.md](REFERENCES.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). These are sampled planning suggestions, not certified safe landing sites.

Stop the previous local server with **Ctrl+C** and rerun the Windows or macOS command in [README.md](README.md). The terminal and footer show **v1.2.1**. Repository access remains private.

## v1.2.0 — Deb · Connected lunar views and surface guides (2026-11-15)

Release prepared by **Deb**, team **Astralis**. Project: **Lunar Landing Site Navigator**.

### What changed

- Restore **Sun & Earth guides** beside the Surface viewer's **Find Sun** and **Find Earth** buttons. The switch shows or hides body labels, paths across the local sky, camera bearing, and clickable off-screen arrows together. Guides also work during the whole-year preview, using six-hour samples for yearly paths.
- Keep Earth and Sun in the Moon Map using the orbital renderer and dated JPL geometry. Synchronize their camera with lunar rotation and zoom, preserve physical radii and separations, apply lunar occlusion, and show camera-distance/off-screen status.
- Restore a continuous map-to-surface camera approach: zoom into the selected coordinate, match map/terrain scale during the soft-focus handoff, then descend and turn toward the horizon. Preserve reverse navigation, reduced motion, measured terrain, and final observer height.
- Add optional depth-aware **Distant softness** to all first-person sites, with sharp foreground and sky, height/zoom-aware focus, and a sharp fallback. Guard-band loading and smooth synthetic-rock distance transitions reduce abrupt arrivals while walking; both styles retain measured terrain and crater shadows.
- Replace the team logo with Deb's supplied outlined A and serif Astralis wordmark. Identify Astralis as the team and Lunar Landing Site Navigator as the project across the app and team documentation.

### Validation and provenance

- 69 automated calculation, geometry, terrain, and camera tests pass, including a regression for rocks disappearing at a streaming-tile boundary.
- Browser checks cover named sites, custom coordinates, suggested patches, mobile sizing, both surface styles, camera travel, annotation on/off, whole-year guides, and off-screen targeting. A GPU check confirms distant contrast softens while foreground and sky pixels remain unchanged.
- The bundled-asset manifest verifies all 121 files. The new team logo's checksum is recorded; scientific data derivatives are unchanged. Rendering references and AI/artwork disclosures are maintained in [REFERENCES.md](REFERENCES.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

### Update and limitations

Stop the old local server with **Ctrl+C**, then rerun the Windows or macOS launch block in [README.md](README.md). Both commands fetch tags and select the latest tagged release on `main`; the terminal and app footer identify the version. Private repository access still requires an accepted collaborator invitation and GitHub sign-in.

Sky paths are apparent motion from the selected site, not orbital ellipses on the ground. Camera blur, generated rocks, fine soil, and transition effects are illustrative; none modifies the planning calculations or creates additional measured terrain resolution. This release is a hackathon planning and education tool, not a certified landing or communications solution.

## v1.1.0 — Deb · Unified lunar viewer (2026-11-15)

Release prepared by **Deb**, team **The Astralis**.

### Viewer and rendering

- Orbit, Moon Map, and Surface share one viewer, selected site, and UTC timeline. Advanced controls remain in expandable sections.
- The orbital view uses physical body radii and JPL separations with a perspective camera, focus controls, and foreground-body occlusion for the Sun, Earth, Moon, and glare.
- Lunar rendering adds an 8K overview and regional tiles derived from NASA's 16K imagery. Earth's archival global mosaic rotates and receives modeled lighting; the Sun uses an archival SDO disk.
- Surface entry uses a bounded zoom, short soft-focus dissolve, and low-altitude camera settle. Reduced-motion preferences skip the travel.
- Named sites, custom coordinates, and suggested patches share improved closed rock meshes and continuous fine soil relief. Illustrated and Natural styles retain measured terrain elevations and crater shadows. Synthetic foreground details remain outside the planning calculations.

### Reproducibility and team handoff

- Added a central reference register, third-party credits, bundled asset checksums, a citation file, contribution guidance, and a submission checklist.
- Documented source resolution, approximate models, archival imagery, and AI-assisted work. Retained older tracked images as explicitly identified legacy assets; local attachments and untracked scratch assets are excluded.
- Added automated Node regression tests, Python syntax checks, and bundled-file integrity checks to GitHub Actions.
- Windows and macOS launch commands continue to select the newest annotated release tag on `main`. The app footer identifies this version and Deb.

### Validation and limits

- Node tests cover ephemeris/reference calculations, ranking scenarios, terrain/geometry behavior, and orbital projection and occlusion math.
- Local browser checks covered the three view modes, surface handoff at a named site, custom coordinate, and polar site, reduced motion, and mobile sizing.
- Camera travel, fine rocks/soil, atmosphere, and display glow are illustrative. Terrain resolution varies by location. Earth visibility is geometric line of sight, not a validated radio link. See [model details](ASTRALIS-HANDBOOK.md#calculation-and-limits).

## v1.0.0 — Initial tagged release

Established versioned Windows and macOS setup, terrain detail, and the lunar planning workflow. See the [original release commit](https://github.com/Debaprashad-Bhowmik/project-astralis/commit/de9d1a5).
