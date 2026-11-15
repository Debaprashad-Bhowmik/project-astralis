# Sources, data, and credits

**Lunar Landing Site Navigator v1.3.5 — Deb · Team Astralis · 2026-11-15**

This is the release's source register. It distinguishes numerical inputs, display imagery, methods, software, and background research. A realistic-looking image is not evidence of measured terrain. Source pixel spacing is not a guarantee of positional or height accuracy.

[Handbook and equations](ASTRALIS-HANDBOOK.md#calculation-and-limits) · [Third-party notices](THIRD_PARTY_NOTICES.md) · [All recorded links](docs/references/link-index.md) · [Bundled SHA-256 manifest](docs/asset-manifest.sha256) · [Submission checklist](docs/SUBMISSION-CHECKLIST.md)

## 1. Positions, time, and reference frames

The numerical positions are derived from NASA/JPL SPICE, not AI-generated trajectories. The browser reads precomputed samples; it does not call Horizons for every interaction.

| Source product | Role | Original download |
| --- | --- | --- |
| `de440s.bsp` | Planetary and lunar ephemeris | [JPL SPK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) |
| `moon_pa_de440_200625.bpc` | Lunar orientation | [JPL binary PCK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) |
| `moon_de440_250416.tf` | Lunar frame definitions | [JPL frame kernel](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) |
| `naif0012.tls` | Leap seconds / UTC conversion | [JPL LSK](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) |

**Derived files:** `data/catalog.json`, `data/ephemeris.bin`, and `data/space-positions.bin`. **Builder:** `scripts/prepare_data.py`. Coverage is January 1, 2024 through January 1, 2031. Surface operations interpolate 15-minute apparent Sun/Earth vectors in `MOON_ME_DE440_ME421`; the orbital view interpolates hourly geometric vectors in `ECLIPJ2000` and lunar orientation. These products have different purposes; apparent observer geometry and geometric orbital positions are not interchangeable.

**Method references:** [SPICE generic kernels](https://naif.jpl.nasa.gov/naif/data_generic.html), [lunar frame tutorial](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf), [Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [Horizons API](https://ssd-api.jpl.nasa.gov/doc/horizons.html). The handbook records an independent Horizons comparison and reproducible query. Earth's displayed rotation follows an approximate [USNO sidereal-time formulation](https://aa.usno.navy.mil/faq/GAST); UTC substitutes for UT1 and the pole is fixed to J2000 in this visualization.

## 2. Measured elevations, slopes, and illumination

| Product / provider | Local use and derivative | Source and resolution |
| --- | --- | --- |
| Global LOLA LDEM | `data/terrain/*.bin`; global fallback terrain and skylines. Repacked losslessly into `assets/moon-elevation.png` for GPU lighting. | [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/), [exact `ldem_16_uint.tif`](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif). 16 pixels/degree, approximately 1.9 km north–south spacing. |
| Adjusted south polar LOLA DEMs | `data/polar-shadows/*.bin.gz`, catalog profiles, regional surface geometry. Nested grids retain different spacings; see `data/polar-shadows/grids.json`. | [NASA product 90](https://pgda.gsfc.nasa.gov/products/90): [80 m DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF), [240 m DEM](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF). Bundled nested grids use 80, 240, and 960 m sampling. |
| LOLA Site 04 | Shackleton study-area surface and 10 m shadow grid derived from the finer source. | [NASA product 78](https://pgda.gsfc.nasa.gov/products/78), [5 m GeoTIFF](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif). Mesh spacing grows with distance. |
| Fine polar terrain endpoint | `scripts/serve_astralis.py` reads local windows on demand, used for surface inspection where covered. | [10 m polar GeoTIFF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_83S_10MPP_ADJ.TIF), [product documentation](https://pgda.gsfc.nasa.gov/products/90). The endpoint selects this source south of approximately 83.1°S. |
| USGS global LOLA terrain endpoint | On-demand global windows outside the fine polar source; falls back to bundled grids when unavailable. | [USGS global DEM](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m), [GMT distribution](https://www.generic-mapping-tools.org/remote-datasets/moon-relief.html). About 118 m north–south spacing. Mirrors: [Nanjing](https://mirrors.nju.edu.cn/gmtdata/server/) and [GMT Oceania](https://oceania.generic-mapping-tools.org/server/). |
| Apollo 12 LROC stereo DTM | `data/surface/apollo12-elevation.*`; local 2.05 km crop shared with Surveyor 3. | [ASU/LROC `NAC_DTM_APOLLO12`](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO12), 2 m/pixel. |
| Chang'e 5 LROC stereo DTM | `data/surface/change5-elevation.*`; local 3.07 km crop. Preprocessing fills 101 small missing cells from neighbors. | [ASU/LROC `NAC_DTM_CHANGE501`](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_CHANGE501), 3 m/pixel. |
| LOLA slope and roughness | `data/landing-patches.json.gz`; one low-slope measurement with roughness per 4 km square in the 84°S–90°S search area. | [NASA product 90](https://pgda.gsfc.nasa.gov/products/90): `LDRM_80S_50MPP_ADJ_SLP_100M.TIF` and `LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF`. Values describe a 100 m baseline, not every boulder or lander footpad. |
| NASA long-term illumination | `data/polar-shadows/illumination.*`; a separate reference value, not a replacement for selected mission dates. | [NASA product 69](https://pgda.gsfc.nasa.gov/products/69), [120 m average visibility raster](https://pgda.gsfc.nasa.gov/data/MoonIllumination/AVGVISIB_75S_120M_201608.TIF). Long-term illumination benchmark. |

**Builders:** `scripts/prepare_data.py`, `scripts/prepare_polar_shadows.py`, `scripts/prepare_surface_region.py`, `scripts/prepare_landing_patches.py`, and `scripts/prepare_landing_horizons.mjs`. Read their CLI help and the handbook before rebuilding; large original rasters and SPICE kernels are not checked into this repository.

Terrain is projected and height-referenced according to the source metadata. Skyline tracing includes lunar curvature and uses no atmospheric refraction. Resolution varies with location and distance. The surface caption reports the selected local source; custom sites do not automatically have centimeter-accurate measured terrain. Related methods: [USGS planetary coordinate guidance](https://pubs.usgs.gov/publication/tm11E1), [NASA polar illumination study](https://ntrs.nasa.gov/citations/20120010094), [NASA lunar polar analysis](https://ntrs.nasa.gov/citations/20205009660).

## 3. Site catalog and search boundary

| Reference | How the navigator uses it |
| --- | --- |
| [NASA/NSSDC lunar spacecraft archive](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) | Historical surface-site coordinates. Archive-reported vicinities remain approximate. |
| [IAU/USGS lunar gazetteer](https://planetarynames.wr.usgs.gov/Page/MOON/target), [exact KMZ export](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz) | The bundled searchable export contains 9,087 named feature centers. Names are geographic features, not 9,087 certified landing sites. `scripts/prepare_gazetteer.py` builds it. |
| [NASA Lunar Surface Data Book](https://ntrs.nasa.gov/citations/20250002845) | Selected polar study-point coordinates and context. |
| [NASA CLPS deliveries](https://science.nasa.gov/lunar-science/clps-deliveries/), [Firefly Blue Ghost Mission 2](https://fireflyspace.com/missions/blue-ghost-mission-2/) | Planned-region presets in the bundled catalog. Feature centers are representative evaluation points, not approved touchdown coordinates. Mission status is a snapshot, not a live feed. |
| [NASA Moon geology discussion](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/moon-geology/), [2024 Artemis candidate regions](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) | The 84°S boundary marks a six-degree polar search cap. The circle is not NASA's outline of selected landing regions or a safety certification. |
| [NASA Artemis landing study](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) | Reference for the editable under-10° slope screen over 100 m. It is not a universal limit for every lander. |

Individual USGS feature links and source IDs are retained in the catalog, handbook, and [link index](docs/references/link-index.md).

## 4. Energy, communications, and ranking

The electrical estimate for a horizontal panel is:

```text
P(t) = 0.20 × 1361 × (1 AU / Sun distance)² × max(0, sin(solar elevation)) W/m²
P(t) = 0 when the selected terrain skyline blocks the Sun's center or a total eclipse occurs
Energy = integral of P(t) across the mission / 1000, in kWh/m²
Average power = 1000 × Energy / full mission hours, in W/m²
```

The fixed 20% efficiency is an app assumption. It excludes temperature, degradation, dust losses, actual panel orientation, partial solar-disk blockage, and battery/storage behavior. Energy and average power describe the same integrated result for a fixed duration; they are not two independently weighted benefits.

References: [NASA solar irradiance](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/about), [Sandia direct-beam projection](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-beam/), [NREL plane-of-array model](https://docs.nrel.gov/docs/fy14osti/60272.pdf). [NASA lunar surface propagation](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/scan/lunar-surface-propagation/) and [Deep Space Network context](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/) explain why Earth-center visibility alone is not guaranteed communications.

South Pole suggestions first apply the slope and user constraints, then offer three **Astralis-defined** scenarios:

- **Best communications:** full-mission Earth visibility, then highest integrated solar energy. If none qualifies, alternatives are identified as missing the scenario.
- **Best solar power:** highest integrated energy, with longer continuous Earth visibility resolving energy ties.
- **Best balance:** geometric mean of energy relative to the best eligible energy and the fraction of the mission in the longest continuous Earth-view window.

These are transparent decision aids, not a NASA-prescribed universal optimization rule. Candidate horizons use 3° bearing samples; mission ranking samples every 15 minutes through 30 days and every two hours for longer windows. Short interruptions can be missed. Consult `landing-suggestions.mjs`, its tests, and the handbook for implementation details. Catalog ranking and map overview layers have their own documented models and must not be confused with fine terrain inspection.

## 5. Display imagery and synthesized details

| Asset | Original source / credit | Transformation and limits |
| --- | --- | --- |
| `assets/moon-color-8k.webp`, `assets/moon-tiles/*`, 4K and 1K fallbacks | [NASA SVS 2019 CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/); NASA/GSFC/SVS, LROC and LOLA teams. [16K TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif), [4K TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif), [1K JPEG](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg) | Resized/cropped WebP display textures. Polar albedo fill and color-image resolution do not supply extra terrain heights. |
| `assets/earth-clouds.webp` | [NASA SVS Earth for LARGEST](https://svs.gsfc.nasa.gov/3615/), [exact TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/flat_earth03.tif). NASA/GSFC Scientific Visualization Studio; Blue Marble Next Generation courtesy Reto Stockli (NASA/GSFC) and NASA Earth Observatory. | WebP conversion of an art-directed archival globe mosaic. Its cloud composite and geography do not depict the selected date's weather. Rotation and day/night shading are modeled separately. |
| `assets/sun-sdo.jpg` | [NASA SVS / SDO-HMI solar cycle](https://svs.gsfc.nasa.gov/4551/), [exact archived image](https://svs.gsfc.nasa.gov/vis/a000000/a004500/a004551/SolarCycleHMI.02000_print.jpg). Credit: NASA's Scientific Visualization Studio. | Display recoloring and glow; this is not a prediction of sunspots at the selected date. |
| `assets/astralis-hero.webp`, `assets/lunar-regolith.webp` | Generated for Astralis with OpenAI ImageGen. | Concept art and dust material. Neither is a photograph or a measured map of the selected site. |
| Foreground rocks and fine soil | Procedural code in `surface-detail.mjs`; visual inspiration includes [NASA Apollo 17 surface photography](https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/a17_h_146_22294.html). | Deterministic illustrative geometry over measured elevations at named sites, custom coordinates, and patches. Not surveyed boulder locations; excluded from scientific ranking and power calculations. |
| `assets/the-astralis-logo.png` | Astralis team logo supplied by Deb; outlined A and serif wordmark, updated November 15, 2026. Original PNG preserved. | Team identity; Astralis is the team name, and Lunar Landing Site Navigator is the project. Not a NASA logo or endorsement. |
| DM Sans / Space Grotesk | [DM Sans authors](https://github.com/googlefonts/dm-fonts), [Space Grotesk authors](https://github.com/floriankarsten/space-grotesk) | Local WOFF2 fonts; complete SIL OFL notices are included beside them. |

`scripts/prepare_visual_assets.py` rebuilds the Moon and Earth derivatives and packs the original global elevation values for rendering. Camera transitions, illustrated shading, glare, and atmospheric appearance are presentation choices. Historical reference: the [Apollo 17 Blue Marble photograph AS17-148-22727](https://eol.jsc.nasa.gov/Collections/EarthFromSpace/images.pl?photo=AS17-148-22727) was used by an earlier Earth display; the current renderer uses the global mosaic above.

**Retained legacy assets:** `assets/earth-blue-marble.jpg` is the earlier Apollo 17 Earth image; `assets/south-pole.jpg` is the earlier header visual credited in the original app to the [NASA SVS LRO/LOLA flyover](https://svs.gsfc.nasa.gov/3686/). They remain tracked for provenance but are not loaded by the current renderer. `data/polar-relief.webp` is a display derivative of the measured polar terrain prepared with the data pipeline.

## 6. Software and reproduction

**Surface distance focus:** [NVIDIA GPU Gems 3, Chapter 28: Practical Post-Process Depth of Field](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field) informed the depth-aware background gather approach. The implementation uses its own bounded terrain-only filter with depth rejection, preserving sky and nearby detail. Focus distances, blur strength, and synthetic rock distance transitions are display choices; they do not alter measured elevations or calculated visibility and energy. No third-party shader source was copied.

The browser application uses native JavaScript modules and WebGL. Runtime terrain support uses Python, [NumPy](https://numpy.org/), and [Rasterio](https://rasterio.readthedocs.io/). Preprocessing additionally uses [SpiceyPy](https://github.com/AndrewAnnex/SpiceyPy), [pyproj](https://pyproj4.github.io/pyproj/stable/), and [Pillow](https://python-pillow.github.io/). [GDAL remote raster access](https://gdal.org/en/stable/user/virtual_file_systems.html#vsicurl-http-https-ftp-files-random-access) underlies windowed terrain reads. These packages are installed dependencies, not bundled third-party application source.

[Node.js](https://nodejs.org/) runs regression tests. GitHub Actions uses the official [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node), and [setup-python](https://github.com/actions/setup-python) actions pinned to commit IDs. Setup references include [Git](https://git-scm.com/downloads), [Python](https://www.python.org/downloads/), [WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/), and [Homebrew](https://brew.sh/).

The manifest records SHA-256 hashes of **bundled derivatives**, not unknown original download checksums. Regenerate it deliberately after source changes. The terrain endpoint may fetch upstream data at runtime; those remote responses are not frozen by the bundled manifest. For an exact reproduction, retain the upstream raster versions and compare against the included derivative hashes. See [contribution and release checks](CONTRIBUTING.md).

## 7. Challenge, judging, and research context

- [Lunar Landing Site Navigator brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/): project objective and suggested capabilities.
- [Official judging and awards guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) and [submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/): governing sources. The existing local summaries need a final check against the event's live rules; both pages failed to load during the November 15 release audit.
- [User-supplied submission/judging video](https://www.youtube.com/watch?v=CV7AYfMRyMM&t=73s): presentation reference; it is not a scientific input or a replacement for current rules.
- [Canada Moon data search](https://search.open.canada.ca/data/?sort=metadata_modified+desc&search_text=moon&page=1), [CSA utility rover](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canadian-utility-rover-on-the-moon.asp), [NEOSSat archive](https://donnees-data.asc-csa.gc.ca/en/dataset/neossat), and [CSA LIBS dataset](https://open.canada.ca/data/en/dataset/137bdc17-2f46-4d70-98e7-acc46f602e9f): research resources discussed with the team. They do **not** supply this release's solar, terrain, or Earth-visibility calculations.

## 8. AI assistance and attribution

OpenAI Codex assisted with code, data-processing scripts, debugging, research, and documentation. ImageGen assisted with design concepts and the identified visual materials. Numerical celestial positions and measured terrain come from the cited products; procedural visual detail is explicitly separate. Deb and team Astralis are responsible for reviewing the release and describing AI assistance in the competition submission. This release does not make runtime calls to a generative AI service.

The link index preserves references found in this release's source, documentation, and metadata. A listed URL means it was recorded, not that every page was independently revalidated or that every linked dataset was used. Missing provenance should be resolved before making stronger scientific or licensing claims.
