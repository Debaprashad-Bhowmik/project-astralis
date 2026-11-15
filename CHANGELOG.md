# Version history

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
