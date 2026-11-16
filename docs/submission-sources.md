# Complete submission sources — Team Astralis

Project: **Lunar Landing Site Navigator**. This register accompanies the 2026 NASA Space Apps submission. The form allows 25 links in each category; this page preserves the complete inventory and distinguishes scientific inputs, display assets, methods, software, and background research. Background resources do not become numerical inputs simply because they appear here.

See [REFERENCES.md](../REFERENCES.md) for transformations, source resolutions, reference frames, and limitations; [THIRD_PARTY_NOTICES.md](../THIRD_PARTY_NOTICES.md) for credits and licenses; and the [demo](demo/) with its [media provenance](demo/credits.txt).

## NASA data
Each entry supplies a Link Text value and a complete Link URL. Its Use line explains the role and can be retained in Project Details or source notes. The list covers numerical inputs, images, scientific methods, and recorded NASA background references.

1. [NASA/JPL NAIF SPICE generic kernels](https://naif.jpl.nasa.gov/naif/data_generic.html) — Source framework for precomputed Sun/Earth positions, lunar orientation, and UTC handling. Exact four kernel links follow.

2. [JPL DE440s planetary and lunar ephemeris — de440s.bsp](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/spk/planets/de440s.bsp) — Numerical ephemeris input.

3. [JPL lunar orientation kernel — moon_pa_de440_200625.bpc](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/pck/moon_pa_de440_200625.bpc) — Lunar rotational orientation input.

4. [JPL lunar reference frames — moon_de440_250416.tf](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_de440_250416.tf) — Defines lunar frames, including the DE421-aligned Mean Earth frame used by the application.

5. [JPL leap-second kernel — naif0012.tls](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/lsk/naif0012.tls) — UTC conversion during preprocessing.

6. [JPL SPICE lunar frame tutorial](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/Tutorials/pdf/individual_docs/23_lunar-earth_pck-fk.pdf) — Reference for lunar orientation and frame selection.

7. [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) — Independent reference queries recorded in the handbook and used in regression checks.

8. [JPL Horizons observer-table manual](https://ssd.jpl.nasa.gov/horizons/manual.html) — Observer coordinates, azimuth/elevation, airless geometry, and time settings.

9. [JPL Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html) — Reproducible query settings and Explorer query links.

10. [NASA LRO/LOLA — A New View of the Lunar South Pole](https://pgda.gsfc.nasa.gov/products/90) — 80 m and 240 m elevation inputs, on-demand 10 m elevation windows, and the 50 m/pixel slope and roughness products measured over 100 m baselines. Exact filenames appear below.

11. [Barker et al. (2023), Planetary Science Journal 4, 183](https://doi.org/10.3847/PSJ/acf3e1) — Paper explicitly requested in the NASA PGDA product 90 data-usage citation.

12. [NASA PGDA LOLA South Pole dataset DOI](https://doi.org/10.60903/gsfcpgda-lola-spole) — Persistent dataset citation supplied by NASA PGDA product 90.

13. [NASA LOLA high-resolution South Pole topography — Site 04](https://pgda.gsfc.nasa.gov/products/78) — 5 m/pixel source for Shackleton Rim surface detail and a derived 10 m shadow grid.

14. [NASA LOLA lunar polar illumination](https://pgda.gsfc.nasa.gov/products/69) — Long-term sunlight reference layer from AVGVISIB_75S_120M_201608.TIF.

15. [NASA LROC stereo terrain — Apollo 12](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO12) — 2 m/pixel stereo terrain for a local Apollo 12/Surveyor 3 surface crop.

16. [NASA LROC stereo terrain — Chang'e 5](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_CHANGE501) — 3 m/pixel stereo terrain for a local Chang'e 5 surface crop.

17. [NASA Scientific Visualization Studio — CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) — The release uses the 2019 LROC color textures and ldem_16_uint.tif global LOLA elevation. The page also offers newer imagery, so retain the exact filenames below.

18. [NASA Scientific Visualization Studio — Earth for LARGEST](https://svs.gsfc.nasa.gov/3615/) — Earth globe texture from flat_earth03.tif. Credit NASA/GSFC/SVS and the Blue Marble Next Generation data courtesy of Reto Stockli and NASA's Earth Observatory.

19. [NASA Scientific Visualization Studio — A Solar Cycle from SDO](https://svs.gsfc.nasa.gov/4551/) — Archived SDO/HMI solar-disk display image SolarCycleHMI.02000_print.jpg.

20. [NASA/NSSDC lunar spacecraft and impact locations](https://nssdc.gsfc.nasa.gov/planetary/lunar/lunar_artifact_impacts.html) — Historical surface-site coordinates.

21. [NASA Lunar Surface Data Book](https://ntrs.nasa.gov/citations/20250002845) — Polar study-point coordinates and scientific context.

22. [NASA CLPS deliveries](https://science.nasa.gov/lunar-science/clps-deliveries/) — Context for planned-region catalog presets. Mission labels are a bundled snapshot.

23. [NASA Artemis overview and landing-site study](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf) — Reference cited by the app for the editable under-10-degree slope screen over 100 m.

24. [NASA Moon Geology discussion](https://www.nasa.gov/podcasts/houston-we-have-a-podcast/moon-geology/) — Context for the six-degree South Pole search area.

25. [NASA 2024 Artemis III landing-region update](https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/) — Candidate-region background for the displayed polar search boundary.

26. [NASA solar irradiance reference](https://earth.gsfc.nasa.gov/climate/projects/solar-irradiance/about) — Physical reference for incoming solar irradiance in the simplified power estimate.

27. [NASA lunar surface propagation](https://www.nasa.gov/glenn/glenn-expertise-space-exploration/scan/lunar-surface-propagation/) — Communications background and interpretation of geometric Earth visibility.

28. [NASA Deep Space Network overview](https://www.nasa.gov/directorates/somd/space-communications-navigation-program/what-is-the-deep-space-network/) — Ground-station context for interpreting communication opportunities.

29. [Mazarico et al. — Illumination Conditions of the Lunar Polar Regions Using LOLA Topography](https://ntrs.nasa.gov/citations/20120010094) — Research reference for terrain horizons and polar illumination.

30. [Barker et al. — Improved LOLA Elevation Maps for South Pole Landing Sites](https://ntrs.nasa.gov/citations/20205009660) — Research reference for terrain uncertainty and illumination sensitivity.

31. [NASA Moon Trek](https://trek.nasa.gov/moon/) — Challenge resource and terrain-exploration reference documented by the team.

32. [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) — Challenge resource and lunar imagery/terrain reference documented by the team.

33. [NASA Apollo 17 surface photography](https://nssdc.gsfc.nasa.gov/imgcat/html/object_page/a17_h_146_22294.html) — Visual reference for procedural rocks and surface appearance.

34. [NASA Apollo 17 Blue Marble photograph — AS17-148-22727](https://eol.jsc.nasa.gov/Collections/EarthFromSpace/images.pl?photo=AS17-148-22727) — Earlier Earth display asset retained in the repository.

35. [NASA LRO/LOLA South Pole flyover](https://svs.gsfc.nasa.gov/3686/) — Earlier header asset retained in the repository.

36. [NASA PDS LOLA archive](https://pds-geosciences.wustl.edu/missions/lro/lola.htm) — Instrument archive and dataset background.

37. [NASA LRO mission](https://science.nasa.gov/mission/lro/) — Mission and instrument context.

38. [NASA CLPS providers](https://www.nasa.gov/commercial-lunar-payload-services/clps-providers/) — Mission background recorded in the handbook.

39. [NASA CLPS candidate-region research update](https://ntrs.nasa.gov/citations/20250011660) — Additional candidate-region background recorded in the handbook.

40. [NASA images and media guidelines](https://www.nasa.gov/nasa-brand-center/images-and-media/) — Attribution and reuse guidance recorded in third-party notices.

## Space agency partner and other resources

1. [USGS/IAU Gazetteer of Planetary Nomenclature — Moon](https://planetarynames.wr.usgs.gov/Page/MOON/target) — Names and coordinates for the bundled 9,087 lunar feature centers.

2. [USGS/IAU lunar feature-center KMZ](https://asc-planetarynames-data.s3.us-west-2.amazonaws.com/MOON_nomenclature_center_pts.kmz) — Exact export used by the gazetteer preparation script.

3. [USGS Astrogeology — Moon LRO LOLA DEM 118 m](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m) — NASA LOLA-derived global elevation distributed by USGS for on-demand terrain.

4. [Generic Mapping Tools — USGS Moon Relief](https://www.generic-mapping-tools.org/remote-datasets/moon-relief.html) — Tiled distribution used by the terrain server.

5. [USGS — Lunar Grid Systems, Coordinate Systems, and Map Projections for the Artemis Missions and Lunar Surface Navigation](https://pubs.usgs.gov/publication/tm11E1) — Coordinate and projection reference.

6. [U.S. Naval Observatory — Computing Approximate Sidereal Time](https://aa.usno.navy.mil/faq/GAST) — Reference for approximate rotation of the displayed Earth globe.

7. [Sandia PV Performance Modeling Collaborative — POA Beam](https://pvpmc.sandia.gov/modeling-guide/1-weather-design-inputs/plane-of-array-poa-irradiance/calculating-poa-irradiance/poa-beam/) — Direct-beam projection reference for a horizontal solar panel.

8. [NREL — PVWatts Version 1 Technical Reference](https://docs.nrel.gov/docs/fy14osti/60272.pdf) — Solar-model background cited in the source register. Astralis implements its own simplified panel estimate.

9. [Firefly Aerospace — Blue Ghost Mission 2](https://fireflyspace.com/missions/blue-ghost-mission-2/) — Nassau Crater planned-region context.

10. [Canadian Space Agency — Moon exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) — Challenge background resource.

11. [Canadian Space Agency — Canadian utility rover](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/canadian-utility-rover-on-the-moon.asp) — Mission context for lunar night and remote operations.

12. [NumPy](https://numpy.org/) — Numerical processing and terrain server dependency.

13. [Rasterio](https://rasterio.readthedocs.io/) — Reading, cropping, and processing elevation rasters.

14. [GDAL virtual file systems and remote raster access](https://gdal.org/en/stable/user/virtual_file_systems.html#vsicurl-http-https-ftp-files-random-access) — Underlying geospatial access used by raster operations.

15. [SpiceyPy](https://github.com/AndrewAnnex/SpiceyPy) — Python SPICE wrapper used in ephemeris preprocessing.

16. [pyproj](https://pyproj4.github.io/pyproj/stable/) — Coordinate transformations and projection checks.

17. [Pillow](https://python-pillow.github.io/) — Image conversion, texture preparation, and elevation packing.

18. [Python](https://www.python.org/) — Data preparation and local terrain server.

19. [Node.js](https://nodejs.org/) — JavaScript regression tests and landing-horizon preparation.

20. [Playwright for Python](https://playwright.dev/python/) — Automated browser regression checks.

21. [Git](https://git-scm.com/) — Version control.

22. [GitHub Actions — checkout](https://github.com/actions/checkout) — CI repository checkout.

23. [GitHub Actions — setup-node](https://github.com/actions/setup-node) — CI JavaScript runtime setup.

24. [GitHub Actions — setup-python](https://github.com/actions/setup-python) — CI Python runtime setup.

25. [DM Sans](https://github.com/googlefonts/dm-fonts) — Bundled font with included SIL Open Font License notice.

26. [Space Grotesk](https://github.com/floriankarsten/space-grotesk) — Bundled font with included SIL Open Font License notice.

27. [SIL Open Font License](https://scripts.sil.org/OFL) — License reference for the bundled fonts.

28. [NVIDIA GPU Gems 3 — Practical Post-Process Depth of Field](https://developer.nvidia.com/gpugems/gpugems3/part-iv-image-effects/chapter-28-practical-post-process-depth-field) — Rendering-method reference for distant terrain focus.

29. [OpenAI Codex](https://openai.com/codex/) — AI assistance with research, scientific interpretation, code, debugging, and documentation.

30. [OpenAI image generation](https://openai.com/index/image-generation-api/) — Image-generation tool provider credit. The repository names ImageGen but does not establish an exact model version.

31. [Microsoft WinGet](https://learn.microsoft.com/en-us/windows/package-manager/winget/) — Dependency installation in the documented Windows setup.

32. [Homebrew](https://brew.sh/) — Dependency installation in the documented macOS setup.

## Additional background and submission references
The following are recorded research or guidance resources. Their role is stated individually. They can be entered as additional references without claiming that their datasets drive the app.

1. [Canadian Space Agency — NEOSSat archive](https://donnees-data.asc-csa.gc.ca/en/dataset/neossat) — Background resource discussed in the project documentation. It supplies no numerical input to this release.

2. [Canadian Space Agency — Planetary LIBS data](https://open.canada.ca/data/en/dataset/137bdc17-2f46-4d70-98e7-acc46f602e9f) — Background resource discussed in the project documentation. It supplies no numerical input to this release.

3. [Canada Open Government — CSA data catalog](https://search.open.canada.ca/opendata/?owner_org=csa-asc) — Data-discovery reference recorded in the handbook.

4. [Canada Open Government — Moon data search](https://search.open.canada.ca/data/?sort=metadata_modified+desc&search_text=moon&page=1) — Data-discovery reference recorded in the source register.

5. [NASA Space Apps — Lunar Landing Site Navigator challenge](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/) — Challenge requirements and suggested resources.

6. [NASA Space Apps — Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/) — Submission instructions. A saved guide is bundled in the repository.

7. [NASA Space Apps — Judging and Awards Guide](https://www.spaceappschallenge.org/resources/judging-awards-guide/) — Judging context recorded in the handbook.

8. [NASA Space Apps — Submission guidance video](https://www.youtube.com/watch?v=CV7AYfMRyMM&t=73s) — User-supplied guidance reference recorded in the project. This is external guidance, not the team's demo.

## Exact product identifiers and additional credits

NASA PGDA product 90
- LDEM_80S_80MPP_ADJ.TIF
- LDEM_60S_240MPP_ADJ.TIF
- LDEM_83S_10MPP_ADJ.TIF
- LDRM_80S_50MPP_ADJ_SLP_100M.TIF
- LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF

NASA PGDA product 78
- Site04_final_adj_5mpp_surf.tif

NASA PGDA product 69
- AVGVISIB_75S_120M_201608.TIF

NASA SVS CGI Moon Kit
- ldem_16_uint.tif
- lroc_color_poles_16k.tif
- lroc_color_poles_4k.tif
- lroc_color_poles_1k.jpg

NASA SVS Earth and Sun imagery
- flat_earth03.tif
- SolarCycleHMI.02000_print.jpg

Regional stereo terrain
- NAC_DTM_APOLLO12
- NAC_DTM_CHANGE501

The four SPICE kernel filenames and direct downloads are listed individually in the NASA Data entries. USGS/IAU feature pages used for catalog coordinates can be retained in the reference list as well.
- Haworth — https://planetarynames.wr.usgs.gov/Feature/14502
- Mons Mouton — https://planetarynames.wr.usgs.gov/Feature/16070
- Mons Gruithuisen Gamma — https://planetarynames.wr.usgs.gov/Feature/3982
- Nassau — https://planetarynames.wr.usgs.gov/Feature/4159
- Reiner Gamma — https://planetarynames.wr.usgs.gov/Feature/4987
- Schrödinger — https://planetarynames.wr.usgs.gov/Feature/5381
- Shackleton — https://planetarynames.wr.usgs.gov/Feature/5450
- Shoemaker — https://planetarynames.wr.usgs.gov/Feature/5494

GMT source-distribution mirrors recorded in the terrain server
- https://mirrors.nju.edu.cn/gmtdata/server/
- https://oceania.generic-mapping-tools.org/server/

Provider credits
NASA/JPL and NAIF for SPICE and ephemeris/orientation products.
NASA/GSFC and the LRO/LOLA team for elevation, slope, roughness, and illumination.
NASA/GSFC/SVS and the LROC/LOLA teams for Moon imagery and rendering products.
NASA/GSFC/Arizona State University and the LROC team for stereo terrain.
USGS Astrogeology and IAU/WGPSN for terrain distribution and lunar nomenclature.
NASA/GSFC/SVS, Reto Stockli, and NASA's Earth Observatory for the Earth mosaic.
NASA's Scientific Visualization Studio for the SDO/HMI Sun image.
DM Sans and Space Grotesk authors under the included SIL Open Font License notices.
OpenAI Codex and ImageGen for the documented AI assistance.
Deb supplied the Astralis logo. vnk11 authored the Trade-off Explorer contribution.


## Demo production resources

- [ElevenLabs](https://elevenlabs.io/) — synthetic Roger narration (eleven_v3) and generated transition/click/landing sound effects. [Speech directions](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices).
- [HyperFrames](https://hyperframes.heygen.com/) — local HTML-to-video composition and rendering.
- [GSAP](https://gsap.com/) — seekable motion graphics and annotations.
- [FFmpeg](https://ffmpeg.org/) — editing, encoding, loudness measurement and mastering.
- Original locally synthesized music — composed for this demonstration using Python/NumPy; no commercial song, stock music sample, or Music API output is included.
- The screen recording was supplied by Deb and depicts the team's application. The 30-second film condenses the recording and discloses time compression. It carries a visible AI-assisted/synthetic-audio label and descriptive metadata.

The novel result is a mission-specific candidate recommendation beyond the preset catalog, not a claim that a geographic location has never previously been studied. The demo's 25 December 2026, 168-hour example and its three criteria are described in its provenance file.
