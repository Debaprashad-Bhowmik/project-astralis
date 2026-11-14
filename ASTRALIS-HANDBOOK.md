# Project Astralis handbook

**2026 NASA Space Apps Challenge · Lunar Landing Site Navigator**

Astralis explores how a change in landing site or date affects sunlight and the view toward Earth from the Moon. This handbook gives the team one place to understand the challenge, reproduce the NASA data check, choose a direction, build a demo, and submit it for judging.

**Current state.** The Astralis built a navigator that ranks 39 landing and study locations using JPL and LOLA data. The 3D lunar globe supports terrain-based evaluation of any coordinate. Its searchable gazetteer contains 9,087 IAU-approved named features. The rotatable Sun–Earth–Moon view updates with the surface-operations timeline and shows how each body clears the site's skyline. The app also includes a 2D polar map, independently dated comparisons, visibility transitions, and CSV export. [Open Astralis](https://debaprashad-bhowmik.github.io/project-astralis/) · [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

## Contents

- [Start here](#start-here)
- [What the challenge asks for](#what-the-challenge-asks-for)
- [What the app could look like](#what-the-app-could-look-like)
- [NASA data and useful resources](#nasa-data-and-useful-resources)
- [Implementation and data provenance](#implementation-and-data-provenance)
- [Reproduce the NASA data check](#reproduce-the-nasa-data-check)
- [Build the prototype](#build-the-prototype)
- [Add a terrain horizon](#add-a-terrain-horizon)
- [Test and document the results](#test-and-document-the-results)
- [Work together on GitHub](#work-together-on-github)
- [Judging rubric](#judging-rubric)
- [Demo and submission](#demo-and-submission)

## Start here

1. **Pick a decision.** Would your user compare two sites on the same date, or check whether a delay changes the first day at the same site? Agree on who makes the decision and what they need to see.
2. **Open the data check.** Reproduce the Athena Sun reading of **+0.88°** with the query below so everyone knows where a number on the screen comes from.
3. **Pick owners.** Assign the data, interface, and demo work. Agree on the first site and date pair and what a working first demo must show.
4. **Build one complete comparison.** Get from site and date selection to a result someone can explain. Use the judging rubric to decide where to spend the remaining time.

## What the challenge asks for

Picture a solar-powered rover landing near the Moon's south pole. The Sun can be low enough for a crater rim to shade the rover. Terrain can also block the line toward Earth that the rover would need for a direct radio link. A different site or date changes the angles and sometimes changes which activities are feasible. The challenge is to make those differences easy to see. Mission planners can use a comparison to explore changes, and educators and the public can use it to understand what makes polar operations difficult. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) · [NASA lunar polar illumination](https://pgda.gsfc.nasa.gov/products/69)

| Term | What it means here |
| --- | --- |
| **Ephemeris** | A table of where an object is at given times. JPL Horizons can give the Sun and Earth positions as seen from a selected spot on the Moon. |
| **Azimuth** | The direction you look, measured clockwise from local north. East is 90°. |
| **Elevation angle** | How far up or down you look from a locally level line. Positive angles are above that line. |
| **Terrain horizon** | The skyline formed by the Moon's curvature, hills, and crater rims in the direction you're looking. |
| **Clearance** | The object's elevation angle minus the terrain-horizon angle in the same direction. A positive value places the object's center above the skyline. |
| **Overlap window** | An interval when both Sun-center and Earth-center visibility conditions are met in the model. |

NASA emphasizes fast comparisons and clear visualization. Site presets, custom coordinates, time controls, counts of sunlight hours, 2D or 3D views, and animations are suggested ways to meet the objective. A first version can focus on two presets and a shared timeline. Earth-center clearance is a geometry estimate for communications. A ground-station schedule also depends on the station's visibility and availability, the antenna, and whether the signal is strong enough. Sun-center clearance and solar elevation describe a lighting opportunity. Panel output also depends on orientation, hardware, and partial shading. [Challenge objectives](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) · [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html) · [NASA Deep Space Network](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/)

## What the app could look like

**Reference-horizon example.** Each side starts at its scenario's landing time. Align both timelines by hours since landing to make different dates comparable. The values below are from the original two-site Horizons check with a 0° reference horizon. The working app shows values from the selected model and can rank the full catalog.

```text
Astralis                                      0° reference horizon
Compare landing scenarios                     First 24 hours

A  IM-1 Odysseus                     B  IM-2 Athena
   Nov 14 2026, 00:00 UTC               Nov 14 2026, 00:00 UTC

AT THE SELECTED TIME                 AT THE SELECTED TIME
Sun    −4.13°  Below level           Sun    +0.88°  Above level
Earth  +5.21°  Above level           Earth  −0.15°  Below level

FIRST 24 HOURS                       FIRST 24 HOURS
Sun     Below throughout             Sun     Above throughout
Earth   Above throughout             Earth   Rises between +3h and +4h
Both    0h                           Both    About 20h

[Shared time slider]  +0h ─────────────────────────────────── +24h
[Chart]  Sun and Earth elevation curves with the horizon marked
```

Give the chart distinct line styles and text labels so the distinction survives grayscale and color-vision differences. Make it possible to read the current angles and the next transition with a keyboard or on a phone. Near a crossing, show an estimated time or bracket and state the sampling interval. If the series ends before a transition, display **Beyond the selected range**.

## NASA data and useful resources

### Official challenge resources

The Resources tab lists the following four entries. Horizons supplies the dated positions. QuickMap and Moon Trek help the team inspect the area, and the CSA portal supplies mission background. [Official challenge Resources tab](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/?tab=resources)

| Resource | How to use it |
| --- | --- |
| **NASA JPL Horizons** | Open an observer table for a point on the Moon. Export the Sun and Earth azimuth and elevation series. [Web app](https://ssd.jpl.nasa.gov/horizons/app.html) · [Manual](https://ssd.jpl.nasa.gov/horizons/manual.html) · [API parameters](https://ssd-api.jpl.nasa.gov/doc/horizons.html) · [Fair use terms](https://ssd-api.jpl.nasa.gov/) |
| **LROC QuickMap** | Inspect the landing-site coordinates, imagery, and surrounding terrain. [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) |
| **NASA Moon Trek** | Explore the south-pole map and use the Sun-angle and elevation tools for cross-checks. [Moon Trek](https://trek.nasa.gov/moon/) |
| **Canadian Space Agency Moon Exploration** | Read about lunar exploration and Canadian mission and technology contributions. [CSA portal](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) |

### Datasets and scientific references

| Resource | What it gives Astralis |
| --- | --- |
| **NASA NSSDC lunar spacecraft locations** | Published coordinates for site presets. The table includes landed spacecraft from multiple agencies. [Landing location table](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) |
| **NASA LRO Lunar Orbiter Laser Altimeter (LOLA)** | Laser-measured topography. Use Goddard's gridded height products for terrain calculations. Search the NASA Planetary Data System (PDS) for archive products and their documentation. [LRO mission](https://science.nasa.gov/mission/lro/) · [LOLA GeoTIFF products](https://pgda.gsfc.nasa.gov/products/90) · [PDS LOLA archive](https://pds-geosciences.wustl.edu/missions/lro/lola.htm) |
| **NASA lunar polar illumination and Earth visibility** | Long-term reference maps, including Earth visibility and permanently shadowed areas. The averaged layers cover about 18.6 years and are useful for regional context. Use ephemerides and terrain for date-specific windows. [NASA Goddard products](https://pgda.gsfc.nasa.gov/products/69) |
| **NASA Goddard 5 m terrain** | High-resolution individual regions and a polar mosaic. Check footprint and effective resolution before using them at a given site. The polar mosaic covers 87°–90° S, poleward of both test locations. [Individual sites](https://pgda.gsfc.nasa.gov/products/78) · [Polar mosaic](https://pgda.gsfc.nasa.gov/products/81) |
| **NASA research on terrain horizons** | Published method for tracing sightlines and understanding how terrain resolution and observer height affect predicted lighting. [Mazarico et al.](https://ntrs.nasa.gov/citations/20120010094) · [Barker et al.](https://ntrs.nasa.gov/citations/20205009660) |
| **NASA CLPS and candidate region studies** | Mission background and candidate-region context. Label any point you choose within a research region as a team-selected example. [NASA CLPS](https://www.nasa.gov/commercial-lunar-payload-services/clps-providers/) · [2024 candidate-region research update](https://ntrs.nasa.gov/citations/20250011660) |
| **NASA JPL NAIF SPICE** | Optional local orbit and orientation calculations for users who need arbitrary sites and dates. Record the kernel versions and coverage, use a lunar frame compatible with the elevation data, and compare results with Horizons. [Generic kernels](https://naif.jpl.nasa.gov/naif/data_generic.html) · [Lunar frame guide](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf) |
| **USGS and NASA lunar coordinate reference** | How lunar Mean Earth coordinates and south polar stereographic projections work. [USGS lunar grid and projection report](https://pubs.usgs.gov/publication/tm11E1) |

### Direct terrain downloads

| Product | Use |
| --- | --- |
| [80 m per pixel, 80°–90° S](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) | Starting terrain grid for local detail at both test sites. About 180 MiB. |
| [240 m per pixel, 60°–90° S](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF) | Wider coverage for distant terrain, especially important at the 80° S grid boundary near IM-1. About 209 MiB. |
| [20 m per pixel, 80°–90° S](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_20MPP_ADJ.TIF) | Finer candidate grid for sensitivity checks. About 2.5 GiB. |

These Cloud-Optimized GeoTIFFs use south polar stereographic coordinates in metres in the DE421 lunar Mean Earth frame. Use the raster's metadata and height values rather than reading pixels from a hillshade image. A separate map of effective resolution is available from the product page. For preprocessing, read only the windows you need and publish the compact derived skyline profiles with the source product names. [NASA product documentation](https://pgda.gsfc.nasa.gov/products/90) · [Rasterio windowed reads](https://rasterio.readthedocs.io/en/stable/topics/windowed-rw.html) · [GDAL remote raster access](https://gdal.org/en/stable/user/virtual_file_systems.html#vsicurl-http-https-ftp-files-random-access)

## Implementation and data provenance

### Files and downloads

The browser reads `data/catalog.json` and `data/ephemeris.bin` for surface operations and `data/space-positions.bin` for the solar system scene. The preprocessing script `scripts/prepare_data.py` builds those files from the dated ephemeris, elevation rasters and published coordinates below. The header is an illustration. The lunar globe uses LROC imagery.

| Input | Exact source |
| --- | --- |
| JPL planetary and lunar ephemeris | [de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) |
| JPL lunar rotational orientation | [moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) |
| Lunar reference frames | [moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) |
| UTC to ephemeris time | [naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) |
| Local and regional elevation | [80 m LOLA GeoTIFF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_80S_80MPP_ADJ.TIF) · [240 m LOLA GeoTIFF](https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/LDEM_60S_240MPP_ADJ.TIF) |
| Shackleton Rim local elevation | [NASA LOLA Site 04 5 m GeoTIFF](https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/Site04/Site04_final_adj_5mpp_surf.tif). The source pixel scale is 5 m. Radial mesh spacing increases with distance to keep the browser view lightweight. |
| Global elevation | [NASA SVS LOLA LDEM 16 pixels/degree, unsigned 16-bit TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif) |
| Historic sites | [NASA NSSDC lunar spacecraft catalog](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) |
| Future CLPS target regions | **Site ranking → Site type → Future CLPS targets** shows IM-3 / CP-11 at Reiner Gamma, CS-11 at Schrödinger Basin, Blue Ghost 3 / CP-21 at Mons Gruithuisen Gamma, IM-4 / CP-22 at Mons Mouton Plateau, and Blue Ghost 2 / CS-3/4 near Nassau Crater. Astralis evaluates the [Reiner Gamma](https://planetarynames.wr.usgs.gov/Feature/4987), [Schrödinger Basin](https://planetarynames.wr.usgs.gov/Feature/5381), [Mons Gruithuisen Gamma](https://planetarynames.wr.usgs.gov/Feature/3982), [Mons Mouton](https://planetarynames.wr.usgs.gov/Feature/16070), and [Nassau](https://planetarynames.wr.usgs.gov/Feature/4159) feature centers as representative points. [NASA CLPS deliveries](https://science.nasa.gov/lunar-science/clps-deliveries/) · [Firefly’s Nassau target region](https://fireflyspace.com/missions/blue-ghost-mission-2/) |
| Named lunar feature centers | [IAU and USGS lunar gazetteer](https://planetarynames.wr.usgs.gov/Page/MOON/target) · [Download center-point KMZ](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz) |
| Study-point coordinates | [NASA Lunar Surface Data Book](https://ntrs.nasa.gov/citations/20250002845) · USGS [Mons Mouton](https://planetarynames.wr.usgs.gov/Feature/16070), [Haworth](https://planetarynames.wr.usgs.gov/Feature/14502), [Shoemaker](https://planetarynames.wr.usgs.gov/Feature/5494), [Shackleton](https://planetarynames.wr.usgs.gov/Feature/5450) |
| Globe and header imagery | NASA's Scientific Visualization Studio [LROC 4K global texture](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_4k.tif) and [1K fallback](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_1k.jpg). The header illustration was generated for Astralis. |

To regenerate the browser data, download the four kernels and four elevation TIFFs into one directory, keeping their filenames. Install the Python dependencies and run the script from the repository root. [SpiceyPy](https://github.com/AndrewAnnex/SpiceyPy) · [Rasterio](https://rasterio.readthedocs.io/) · [pyproj](https://pyproj4.github.io/pyproj/stable/) · [NumPy](https://numpy.org/) · [Pillow](https://python-pillow.github.io/)

```sh
python -m pip install numpy rasterio pyproj spiceypy Pillow
python scripts/prepare_data.py /path/to/nasa-files
python scripts/prepare_gazetteer.py /path/to/MOON_nomenclature_center_pts.kmz
node --test planner.test.mjs
```

To regenerate the 3D positions alone, run `python scripts/prepare_data.py /path/to/nasa-files --space-only` with the four kernels.

### Calculation and limits

- **Ephemeris.** SPICE computes apparent Sun and Earth vectors from the Moon center in the DE440 lunar Mean Earth frame aligned with DE421. The browser interpolates the 15-minute samples and subtracts each surface observer position. The data cover January 2024 through December 2030. The dated calculations reflect the SPICE orbit and lunar orientation model, including libration. Near a crossing, the app estimates the time between neighboring samples. Events shorter than the sampling interval may be missed. [JPL lunar frames](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf)
- **3D scene.** SPICE supplies hourly geometric Sun and Moon vectors relative to Earth's center in the `ECLIPJ2000` inertial frame. The browser interpolates those vectors and the rotation from the lunar body frame to place the site's marker. Switch the reference point to the Sun to see Earth's path around it. Visual scales are compressed, with the physical center-to-center distances listed beside the scene. Surface visibility continues to use the apparent positions and the selected horizon model. [JPL SPICE kernels](https://naif.jpl.nasa.gov/naif/data_generic.html)
- **Local sky.** The panorama plots Sun and Earth elevation by compass bearing against the chosen skyline. The mission timeline controls the displayed UTC time. Sunrise, sunset, Earthrise, and Earthset are estimated by interpolating each body's center crossing between adjacent 15-minute samples. The countdown checks up to 30 days beyond the selected instant or until the ephemeris ends. Solar eclipses are shown separately from terrain crossings. [JPL apparent azimuth and elevation](https://ssd.jpl.nasa.gov/horizons/manual.html#output)
- **Motion through time.** The One lunar day preset spans 708 hours from the chosen landing time, approximately one mean solar cycle on the Moon. Full year runs to the next UTC anniversary (8,760 or 8,784 hours). A February 29 landing rolls forward to March 1 the next year. Each comparison scenario uses its own landing date to determine its year length. The heat map, local sky, surface view, and 3D orbit scene in Mission window mode use the shared mission window. Visibility calculations sample the ephemeris every 15 minutes, and the 3D orbit scene interpolates hourly positions. The rise/set list contains estimated terrain crossings within the mission. Selecting a crossing moves all views to the nearest 15-minute sample, and daylight tracks include the total-eclipse calculation. [NASA lunar-day reference](https://science.nasa.gov/wp-content/uploads/2023/05/ladee-press-kit-08292013.pdf)
- **Whole-Moon visibility.** The 3D Moon and flat visibility map apply a 0° reference horizon across a smooth lunar sphere using the same apparent Sun and Earth coordinates, finite distance, and center-based total-eclipse model. The shared layer and timeline controls show sunlight, direct Earth visibility, and overlap. The selected-site readout uses the chosen local horizon model. [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/)
- **Solar power layer.** At each selected time, the 3D Moon and the flat visibility map show an estimated electrical output in W/m² of horizontal panel area. Output scales as `0.20 × 1361 W/m² × (1 AU / Sun distance)² × max(0, sin(solar elevation))`. The model assumes constant 20% efficiency and direct sunlight, with zero output when the skyline blocks the Sun’s center or Earth causes a total solar eclipse. Partial eclipses, panel temperature, and hardware losses are outside this estimate. The global map uses a smooth horizon. Catalog pins and custom coordinates use the chosen site horizon model. The color scale stays fixed from 0 to 300 W/m² as time changes. The CSV includes the selected site's solar elevation and power for each 15-minute sample. [NASA solar irradiance](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/about) · [Sandia direct-beam projection](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-beam/)
- **Mission overlap heat map.** The default layer sums the hours of simultaneous Sun and Earth visibility over the full mission or one of its four equal quarters. Zero-overlap terrain keeps its original appearance. The scale is based on raw hours, with green marking the highest overlap across map cells and listed sites for the selected period. The upper label also gives the full mission duration for context. A 2° global grid uses a smooth reference horizon and estimates boundary crossings between adjacent 15-minute ephemeris samples. Catalog and custom-site markers use the chosen site horizon model. A cross marks a site with zero overlap. The selected-site strip shows overlap and gaps in order, with model-estimated windows available in UTC.
- **Artemis exploration zone.** The globe marks the geographic South Pole at 90°S and draws a constant-latitude boundary at 84°S, six degrees from the pole. The **South pole** control centers the camera and exposes the co-registered NASA LOLA polar relief. The ring represents the documented exploration-zone extent. Candidate landing regions are discrete areas studied within that zone. [NASA’s six-degree definition](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/moon-geology/) · [NASA LOLA polar terrain](https://pgda.gsfc.nasa.gov/products/90)
- **3D surface.** The camera is 2 m above the site. Triangulated ground points come from the global LOLA tiles or the preprocessed 80/240 m south-pole data. At Shackleton Rim, the mesh and skyline also incorporate NASA’s 5 m/pixel Site 04 raster where it has coverage. The mesh accounts for curvature and reaches 350 km. Both surface styles use the same geometry and time-dependent shadow calculation. Illustrated uses cel shading and ink accents, including display fill that makes permanently shadowed walls visible. Fine grit, tiny pebbles, and glare are illustrative. The nearby crater control uses IAU feature coordinates to aim the camera. Intervening terrain may obscure the crater. [NASA LROC reflectance and global LOLA](https://svs.gsfc.nasa.gov/4720/) · [Polar LOLA](https://pgda.gsfc.nasa.gov/products/90) · [NASA Site 04 data](https://pgda.gsfc.nasa.gov/products/78)
- **Surface material.** Small procedurally placed impact pits and an ImageGen dust-and-rock texture provide illustrative foreground shading. The DEM, modeled skyline, and Sun and Earth visibility calculations use the measured terrain datasets.
- **Local sky.** The sky arcs project each body's bearing and elevation across the mission. Apparent disk sizes use `2 × asin(radius / observer distance)`, approximating each body as a sphere. The Earth disk shows NASA’s archival Apollo 17 Blue Marble photograph with fixed orientation, phase, and weather. The selected time controls each body’s apparent size, position, and center-based visibility. Camera zoom magnifies the entire scene. [JPL angular diameter](https://ssd.jpl.nasa.gov/horizons/manual.html) · [NASA Apollo 17 photograph](https://eol.jsc.nasa.gov/Collections/EarthFromSpace/images.pl?photo=AS17-148-22727)
- **3D orbit view.** The annual and lunar paths use the bundled geometric ephemeris. Around Earth, the annual line shows the Sun's path as seen from Earth. Around the Sun, it follows Earth. The Moon's orbit is drawn relative to Earth's position at the selected time. In **Whole year** mode each annual path follows the selected UTC calendar year, 2024–2030, and the site readout uses the same apparent ephemeris and horizon model as the mission planner. The yearly preview has an independent clock. The annual path, lunar path, and dashed body links toggle independently. Display distances and body sizes use the scaling described below the view.
- **Power and communications.** Equivalent full-sun hours integrate `max(0, sin(Sun elevation))` during direct sunlight windows for a horizontal panel. The result is a geometric direct-beam estimate, in hours relative to a panel facing the Sun. Power output requires a hardware model. The direct Earth visibility windows use the Earth center and the chosen skyline. The optional maximum visibility gap uses the longest uninterrupted period out of view, including the start and end of the mission. Actual link availability also depends on ground stations, antennas, and relays. [NREL plane-of-array irradiance model](https://docs.nrel.gov/docs/fy14osti/60272.pdf) · [NASA lunar surface communications](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/scan/lunar-surface-propagation/)
- **Terrain.** Astralis traces bearings every 0.5° out to 350 km from a 2 m observer and accounts for lunar curvature. Eight existing polar profiles use 80 m near-field data where available and 240 m regional coverage. Custom coordinates and the expanded catalog use the global LOLA 16-pixel-per-degree grid, about 1.9 km north to south. The browser fetches only the elevation tiles needed to trace the custom skyline. Features smaller than the source grid, including local slopes and small ridges, may be missed. The 3D globe uses display lighting. [Polar LOLA](https://pgda.gsfc.nasa.gov/products/90) · [Global LOLA](https://svs.gsfc.nasa.gov/4720/#section2)
- **Gazetteer and landing catalog.** The gazetteer supplies named points independently of the mission ranking. Zoom the globe to see more labels, or search the complete bundled export by name. Select a feature to inspect its coordinates or evaluate its center as a custom site. The ranking uses historic surface landing locations, selected polar study points, and published CLPS region centers. Luna 9 and Luna 13 use the archive's reported vicinities. [IAU lunar nomenclature](https://planetarynames.wr.usgs.gov/Page/MOON/target) · [NASA spacecraft archive](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html)
- **Ranking.** Qualifying sites meet all user-entered minimum hours and the optional maximum dark gap. The score is the weighted share of the mission with sunlight, Earth visibility, or both, scaled to 100. Equal displayed scores share a rank. Figures use Sun-center and Earth-center geometry and exclude total solar eclipses from the Sun series. Solar array output, partial obscuration, ground-station availability, radio link budgets, and landing hazards require further analysis. [NASA polar illumination](https://pgda.gsfc.nasa.gov/products/69)
- **Cross-check.** In the reference-plane case at Mons Mouton on November 14, 2026 at 00:00 UTC, the app returns the Sun at about +0.87828° elevation and Earth at −0.15391°. The separate Horizons check below gives +0.87828° and −0.15388°. At the same position and time using LOLA, the Sun's skyline is about +3.29°, which places the Sun's center behind terrain. [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/)

### Evidence for judging

| Criterion | What to show in the working app |
| --- | --- |
| Impact | Compare the same Mons Mouton coordinate at November 14 and November 17, 2026, at 00:00 UTC for 24 hours. The modeled overlap grows from 0 to 24 hours. Explain the schedule decision it changes. |
| Creativity | At December 1, 2026 at 00:00 UTC, switch between **More sunlight** and **Both at the same time**. Connecting Ridge and Peak near Shackleton have full-day modeled sunlight, while Malapert A leads for overlap. |
| Validity | Use the independent Horizons values above, then reveal the terrain skyline and explain why an angle above 0° can still mean no sunlight. Show the model limits on the methods page. |
| Relevance | Open the 3D Moon, pick a site, and scrub the Sun and Earth elevation curves against their terrain horizons. Compare the visibility tracks for two sites or dates. |
| Presentation | Give the user a three-day delay and one goal. Show the before-and-after result in one comparison, then credit JPL SPICE and LOLA clearly. |

### Partner research and AI disclosure

The Canadian Space Agency's lunar rover descriptions provide mission context for the darkness constraint. NEOSSat's astronomy archive and CSA's composition spectroscopy data are useful for other questions. The listed ephemeris and LOLA products supply the numerical inputs here. [CSA utility rover](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canadian-utility-rover-on-the-moon.asp) · [Canada Open Government catalog](https://search.open.canada.ca/opendata/?owner_org=csa-asc) · [CSA NEOSSat archive](https://donnees-data.asc-csa.gc.ca/en/dataset/neossat) · [CSA planetary LIBS](https://open.canada.ca/data/en/dataset/137bdc17-2f46-4d70-98e7-acc46f602e9f)

OpenAI Codex assisted with implementation, data-processing code, and documentation. Built-in ImageGen produced two visibly watermarked UI concepts used during design. The app's globe and terrain imagery are attributed NASA resources, and its numbers are calculated from the source products above. The app uses DM Sans and Space Grotesk with their included SIL Open Font License notices. [DM Sans](https://fonts.google.com/specimen/DM+Sans) · [Space Grotesk](https://fonts.google.com/specimen/Space+Grotesk)

## Reproduce the NASA data check

### Site inputs

| Preset | Latitude | East longitude | Horizons input for the first check |
| --- | ---: | ---: | --- |
| IM-1 Odysseus, near Malapert A | −80.13° | +1.44° | `1.44,-80.13,0` |
| IM-2 Athena, Mons Mouton | −84.7906° | +29.1957° | `29.1957,-84.7906,0` |

These are published landing coordinates. The simulation date below is an example date, independent of the historical landing dates. Horizons takes **east longitude, latitude, and height in kilometres**, in that order. Height is relative to its lunar reference surface. Use zero for the reference check. When you model an elevated surface point, combine the terrain height and the instrument's height above the ground, convert units, and check that the height references agree. [NASA site coordinates](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) · [JPL observer coordinate documentation](https://ssd.jpl.nasa.gov/horizons/manual.html)

### Horizons settings

| Setting | Value |
| --- | --- |
| Table | Observer `EPHEM_TYPE=OBSERVER` |
| Center | User-defined coordinates on the Moon `CENTER=coord@301`, `COORD_TYPE=GEODETIC` |
| Target | Sun `COMMAND=10` or Earth center `COMMAND=399`, one request per target |
| Output | Quantity `4` (apparent azimuth and elevation), `APPARENT=AIRLESS`, `ANG_FORMAT=DEG`, `CSV_FORMAT=YES` |
| Range | `2026-Nov-14 00:00` to `2026-Dec-12 00:00` inclusive, `STEP_SIZE=1 h`. Use a zero time offset and read the modern UT output as UTC. |
| Filters | `ELEV_CUT=-90`, `SKIP_DAYLT=NO` to keep below-horizon rows and daylight samples |

Use the browser interface or the API. With the API, send requests one at a time, cache the returned tables, and set an application-specific user agent with a version and contact. Keep calls in a local preprocessing step. A static prototype can load the processed CSV or JSON files and work without reaching JPL from the browser. [Horizons query reference](https://ssd-api.jpl.nasa.gov/doc/horizons.html) · [JPL fair use and browser embedding terms](https://ssd-api.jpl.nasa.gov/)

The following terminal example requests the Athena Sun table and saves the full reply as JSON. Replace the example email with a team contact. Change the target from `10` to `399` for Earth, or use the other coordinate triplet for Odysseus.

```text
curl --get "https://ssd.jpl.nasa.gov/api/horizons.api" --user-agent "Astralis/0.1 (team@example.com)" --data-urlencode "format=json" --data-urlencode "COMMAND='10'" --data-urlencode "OBJ_DATA='NO'" --data-urlencode "EPHEM_TYPE='OBSERVER'" --data-urlencode "CENTER='coord@301'" --data-urlencode "COORD_TYPE='GEODETIC'" --data-urlencode "SITE_COORD='29.1957,-84.7906,0'" --data-urlencode "START_TIME='2026-Nov-14 00:00'" --data-urlencode "STOP_TIME='2026-Dec-12 00:00'" --data-urlencode "STEP_SIZE='1 h'" --data-urlencode "QUANTITIES='4'" --data-urlencode "ANG_FORMAT='DEG'" --data-urlencode "APPARENT='AIRLESS'" --data-urlencode "CSV_FORMAT='YES'" --data-urlencode "ELEV_CUT='-90'" --data-urlencode "SKIP_DAYLT='NO'" --output athena-sun.json
```

### Expected results

The four checked queries returned **673 rows each**, or 672 one-hour intervals with both endpoints included. The returned ephemeris header identified DE441 for the targets and the Moon, an airless observer table, and a 1737.4 km lunar reference radius. At **2026-11-14 00:00 UTC**:

| Site | Sun azimuth | Sun elevation | Earth azimuth | Earth elevation |
| --- | ---: | ---: | ---: | ---: |
| Odysseus | 124.995975° | −4.126239° | 357.328415° | +5.211283° |
| Athena | 97.531672° | +0.878281° | 329.676180° | −0.153879° |

At Athena, Earth-center elevation was **−0.034403° at 03:00 UTC** and **+0.006041° at 04:00 UTC**. Linear interpolation gives roughly **03:51 UTC** in the 0° reference model. Treat the one-hour bracket as the directly observed result of the sampling. The test provides useful control values for sign, timezone, site ordering, and target selection. [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) · [Output quantity 4](https://ssd.jpl.nasa.gov/horizons/manual.html)

## Build the prototype

| Step | Work | Done when |
| --- | --- | --- |
| **1. Choose the comparison** | Agree on an intended user, site or date change, and the duration to show. Sketch one screen. | A teammate can describe the decision in one sentence. |
| **2. Prepare the data** | Export a Sun and Earth table per site and join on UTC timestamp. For API exports, check the error response and parse rows between `$$SOE` and `$$EOE`. Read column names from the header and account for marker columns. | Each timestamp has valid Sun and Earth readings, and the first rows match the examples above. |
| **3. Calculate intervals** | Begin with a 0° reference plane and center visibility. Find transitions, totals, longest gaps, and overlap within the selected period. | A hand-worked example matches the app, and a missing sample shows as unknown. |
| **4. Build the comparison screen** | Add two site and date controls, shared playback or scrubbing, elevation curves, and visibility rows. Use the same displayed duration and scales. | Someone can switch a scenario and explain which window changed. |
| **5. Improve the model** | If time allows, use precomputed LOLA skyline profiles for supported sites and show which horizon the app uses. | At least one direction and transition has been checked against the terrain and the test model. |
| **6. Publish and demo** | Host the finished prototype, link the method and NASA data, and record the team-selected example. | The public links open in a private browser and the project form is complete. |

A simple architecture is **JPL export → local preprocessing → small CSV/JSON files → browser charts**. HTML, CSS, and JavaScript can handle the first version. Python is an option for combining the tables and preprocessing terrain. Use a library such as Plotly if it helps the team ship the chart. GitHub Pages is one option for a public static build. [Python CSV docs](https://docs.python.org/3/library/csv.html) · [Plotly.js](https://plotly.com/javascript/) · [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

**Suggested data fields.** Keep a stable site ID, name, latitude, east longitude, and coordinate source. Each observation can carry `site_id`, `timestamp_utc`, `sun_az_deg`, `sun_el_deg`, `earth_az_deg`, and `earth_el_deg`. Use timestamps like `2026-11-14T00:00:00Z`. Record the original source URL or parameters, retrieval date, ephemeris and software versions, sample step, reference frame, horizon mode, observer height, and units with the exported dataset.

**Calculate windows.** For each body and time, compute `clearance = elevation − horizon(azimuth)`. A positive clearance places the center above the chosen horizon. When adjoining samples cross zero, estimate the crossing between them. Merge contiguous positive intervals. Intersect the Sun and Earth intervals to get overlap and sum their lengths to get total duration. Crop all intervals to the selected time window. With hourly samples, two crossings inside one hour may go unseen. Compare against finer sampling when the result depends on a short window.

## Add a terrain horizon

1. **Locate the observer.** Read the DEM projection, frame, height reference, resolution, and NoData value. Convert the landing coordinates into the raster grid. Use the terrain surface height plus a stated instrument height, such as 2 m for an example scenario. Use one consistent lunar reference frame throughout.
2. **Trace the skyline.** For each azimuth, sample terrain along outward sightlines and keep the largest apparent elevation angle. Use the higher-resolution model near the site and a wider, coarser grid for distant terrain. Increase the search distance and angular resolution until important results stabilize. Record the chosen settings and flag directions with incomplete terrain coverage.
3. **Account for curvature.** One approach converts the observer and each terrain point to Moon-centered Cartesian coordinates using their radii and angles. Project the vector from the observer to a terrain point into local east, north, and up components. Compute the apparent terrain angle with `atan2(up, hypot(east, north))`. This gives a skyline in the same local angular convention as the ephemeris. A distant skyline can lie below the 0° local plane. Retain valid negative angles where the geometry supports them.
4. **Cache a small profile per site.** Store azimuth, horizon elevation, and coverage or quality flags. Interpolate the profile periodically across 360°/0°. A practical sensitivity check compares 1° and 0.5° azimuth spacing and checks whether the overlap result changes substantially.
5. **Compare the same scenario in both models.** Show the reference horizon and the terrain result under clear labels. The difference can reveal a direction where a crater rim changes a visibility interval. Missing terrain should show **Terrain unavailable** or a clearly labeled reference-horizon mode. [Published horizon method](https://ntrs.nasa.gov/citations/20205009660) · [NASA LOLA product and reference frame](https://pgda.gsfc.nasa.gov/products/90)

For a later iteration, model the Sun's finite disk and eclipses where the project claims illumination rather than center clearance. For a specific Earth station, model the actual station position, its local elevation limit and availability, and the radio link. The challenge's first-pass screening can use the simpler geometry with its assumptions visible in the interface. [NASA illumination products and Earth visibility assumptions](https://pgda.gsfc.nasa.gov/products/69) · [NASA Deep Space Network](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/)

## Test and document the results

- [ ] **Coordinates and times.** Southern latitudes are negative, east longitudes are positive, the API coordinate order is correct, and the UI labels UTC. The same site and date on both sides gives the same curves and metrics.
- [ ] **Numbers.** Reproduce both test rows and the Athena 03:00–04:00 UTC crossing. Check a later date directly in Horizons. Round displayed values only after calculations.
- [ ] **Windows.** Try always visible, always below, one rise, one set, an event outside the selected range, and a missing row. Confirm overlap never exceeds either input duration.
- [ ] **Terrain.** Verify one skyline direction against mapped features. Test the 359°/0° wrap, the grid edge and NoData, and whether changing observer height or grid resolution changes the selected outcome. Report which limits matter.
- [ ] **Interpretation.** Ask someone new to the project to compare two scenarios and explain the result. The app should identify whether it is using the reference horizon or terrain and what the Sun and Earth labels mean.
- [ ] **Reproducibility.** Save the input queries and product IDs, document how derived data were made, credit all resources, and record where AI assisted. For the demo, check that the links open when signed out and the first comparison loads without a live Horizons request.

## Work together on GitHub

Anyone can open or clone the public repository. For write access, the owner invites teammates by GitHub username and each teammate accepts from their own account. Each person can use their own editor. Codex use follows the account or workspace that runs it. [Astralis repository](https://github.com/Debaprashad-Bhowmik/project-astralis) · [Collaborator settings](https://github.com/Debaprashad-Bhowmik/project-astralis/settings/access) · [GitHub invitation guide](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/inviting-collaborators-to-a-personal-repository)

```sh
git clone https://github.com/Debaprashad-Bhowmik/project-astralis.git
cd project-astralis
git switch -c data/horizons-sample
```

Use a different branch name for each task. Start new tasks from the latest `main`. When ready, commit the files you changed, push your branch, and open a pull request into `main`. Use an issue for a task another teammate can take, with an owner and a quick check that shows when it is done. [GitHub branches](https://docs.github.com/en/pull-requests/reference/branches)

| Workstream | First handoff |
| --- | --- |
| **Data and science** | Share the two-site Sun and Earth exports, a short explanation of the 0° model, and the verified first rows. |
| **Interface** | Build the comparison around the agreed data fields. Show the chosen time, angles, and one clear interval result. |
| **Testing and story** | Recreate one number independently, try the interface cold, and turn a verified comparison into the demo. |
| **Submission** | Track deadlines, citations, public links, AI disclosure, and the final submit confirmation. |

## Judging rubric

NASA scores each criterion from **1 to 5** at every judging level. These are paraphrases of the criteria and examples of evidence Astralis could present. [Official 2026 Judging & Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/#judging-criteria)

| Criterion | What a high score demonstrates | Evidence to show |
| --- | --- | --- |
| **Impact** | The work addresses a meaningful problem and could substantially help or inspire its audience. | Show a change in site or schedule that alters a rover's opportunity to charge or send data. |
| **Creativity** | An original approach or a meaningful improvement on the way people solve the problem today. | Explain how your team's design makes a comparison easier to interpret than a set of separate tables. |
| **Validity** | Sound science, feasible implementation, and a usable solution that works as intended. | Reproduce one NASA reading, explain the model and assumptions, and walk through a working decision. |
| **Relevance** | The solution directly responds to the challenge, with NASA data doing core work. | Compare two site and date scenarios and show how NASA-derived angles and terrain produce the result. |
| **Presentation** | Clear, polished storytelling conveys the challenge, solution, and value through the demo and project. | Show the problem, one interaction, the result, and why it matters. Put the supporting method and source links in project details. |

## Demo and submission

**Website window.** Submission opens **Saturday, November 14, 2026 at 9:00 a.m.** and closes **Sunday, November 15, 2026 at 11:59 p.m.**, in the registered Local Event's time zone. For the Universal Event, use the Team Owner's local time. If registered in **Halifax**, the local schedule lists **Sunday at 2:00 p.m. Atlantic** to email intent to present and **3:00 p.m. Atlantic** for presentations and final judging. Check the schedule for the event your team registered with. [2026 event page](https://www.spaceappschallenge.org/2026/) · [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) · [Halifax schedule](https://www.spaceappschallenge.org/2026/local-events/halifax/?tab=registrations-and-schedule)

**Demo.** Make an English slide deck of up to **7 slides**, including the title and introduction, or a video of **30 seconds or less**. Add English subtitles if the video narration uses another language. A possible video sequence is 0–5 s for the team and problem, 5–20 s for the interaction and result, and 20–30 s for why the result matters and the data that made it possible. A slide deck can use the same story with space for an annotated screenshot and sources. Use public links that open without a login, password, or access request. [Submission guide and demo tips](https://www.spaceappschallenge.org/resources/project-submission-guide/) · [Official submission video at 1:13](https://www.youtube.com/watch?v=CV7AYfMRyMM&t=73s) · [Judging section at 10:48](https://www.youtube.com/watch?v=CV7AYfMRyMM&t=648s)

| Form field | What to enter |
| --- | --- |
| **Project Name** | Use the final team-approved title. The current form shows Project The Astralis. |
| **Summary** | Explain what the team built, how it answers the challenge, and who benefits. The form suggests 50–200 words and displays a 1,500-character limit. |
| **Project Demonstration** | Paste the complete public demo URL. |
| **Project** | Paste the complete URL of the finished project. The public Astralis repository can serve as the project link once it contains the final work. A published app or other public final-project page is also an option. |
| **Project Details** | Describe the user flow, the implementation and data, a verified example, and important assumptions. Include the languages or tools used and the team's original contribution. |
| **Use of Super Intelligence (SI)** | Select the options that reflect actual AI use. The guide assigns the original solution idea to the team and permits AI assistance. It calls for visible watermarks on AI-generated images or video and acknowledgments in descriptive text and metadata for AI-generated audio, code, and data. Keep NASA branding out of generated content. |
| **NASA Data** | List the actual NASA datasets and resources used, with names and complete URLs. Global Award eligibility requires at least one NASA data source or resource. Explain how it contributes to the solution. |
| **Space Agency Partner & Other Data** | List the other data, tools, libraries, code, images, audio, and text used. Cite each source and document the applicable permissions and licenses. |
| **Submission Verification** | A teammate reviews the terms and originality statements and checks the boxes if accurate. Click **Submit for Judging** and verify that the confirmation banner appears. If you edit, resubmit before the cutoff. |

Finish the form in English and have a teammate test both public links from a signed-out browser. Confirm all members appear on the team page and are registered for the same Local Event or the Universal Event. The judging guide sets a maximum of six members and a minimum of two for Universal Event teams seeking global judging. The submission guide excludes under-18 likenesses, images, video, and audio from the submitted demo and final project. Read the current official terms before confirming rights and originality. Local or Universal Event judges select the nominees who advance to Global Judging. [Submission guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) · [Global judging eligibility](https://www.spaceappschallenge.org/resources/judging-awards-guide/#eligibility-for-global-judging) · [Participant terms](https://www.spaceappschallenge.org/legal/) · [NASA images and media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/)
