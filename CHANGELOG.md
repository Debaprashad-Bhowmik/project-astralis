# Version history

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
