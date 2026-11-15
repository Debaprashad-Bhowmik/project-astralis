# Lunar Landing Site Navigator

**Team: Astralis · v1.3.5 · Release prepared by Deb**

Astralis is the team behind **Lunar Landing Site Navigator**, our project for the 2026 NASA Space Apps Challenge. The challenge asks teams to make it easier to compare lunar landing sites and dates using the Sun and Earth's positions relative to the horizon. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

## Start here

| I want to… | Read this |
| --- | --- |
| Run the latest release | [Windows](#run-the-navigator-on-windows) or [macOS](#run-the-navigator-on-macos) copy/paste setup below |
| Understand the complete project | [Team handbook](ASTRALIS-HANDBOOK.md) |
| Find every source and data credit | [References and exact products](REFERENCES.md) · [Third-party notices](THIRD_PARTY_NOTICES.md) |
| Review what changed | [v1.3.5 release notes](CHANGELOG.md) |
| Prepare for judging | [Rubric](JUDGING-RUBRIC.md) · [Submission checklist](docs/SUBMISSION-CHECKLIST.md) |
| Contribute or publish an update | [Contribution and release guide](CONTRIBUTING.md) |

Choose a site and mission window, compare solar energy and Earth visibility, then inspect terrain in one Orbit / Moon Map / Surface viewer. South Pole suggestions add a slope screen and three mission scenarios. Calculations use JPL ephemerides and measured lunar terrain. Generated rocks and fine dust improve the view without entering the planning calculations.

The repository is maintained privately for the team. Collaborators need an accepted invitation. The local app requires no API key; finer on-demand terrain needs internet access. A GitHub release is source code, not a hosted deployment or a completed competition submission.

[Windows setup](#run-the-navigator-on-windows) · [macOS setup](#run-the-navigator-on-macos) · [Version history](https://github.com/Debaprashad-Bhowmik/project-astralis/tags)

Both commands start the newest version tagged on main. They keep a separate project-astralis-run folder for running the site, so teammates can keep their work in their existing checkout. Stop the server with Control+C and paste the same block again to check for an update.

## Run the navigator on Windows

Accept your invitation to the private repository. Open **Windows PowerShell** in the folder where you want the project, use the copy button on the code block below, paste the whole block, and press Enter. If Git opens a sign-in window, use the GitHub account that accepted the invite. [GitHub sign-in for Git](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git?platform=windows)

The block uses WinGet to install Git and x64 Python 3.13 if needed. It then downloads the project and bundled lunar data, installs the terrain packages, and opens the navigator in your default browser. The terminal prints the localhost link. Keep the window open while using the site and press **Ctrl+C** to stop it. [Microsoft WinGet guide](https://learn.microsoft.com/en-us/windows/package-manager/winget/)

<details>
<summary>Show the Windows copy/paste command</summary>

```powershell
& {
    $ErrorActionPreference = 'Stop'
    $PSNativeCommandUseErrorActionPreference = $false

    function Find-AstralisGit {
        $gitHomeKeys = 'HKCU:\Software\GitForWindows', 'HKLM:\Software\GitForWindows'
        @(
            Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
            Get-ItemProperty -LiteralPath $gitHomeKeys -ErrorAction SilentlyContinue |
                Where-Object InstallPath | ForEach-Object { Join-Path $_.InstallPath 'cmd\git.exe' }
            "$env:LOCALAPPDATA\Programs\Git\cmd\git.exe"
            "$env:ProgramFiles\Git\cmd\git.exe"
        ) | Where-Object { $_ -and (Test-Path -LiteralPath $_ -PathType Leaf) } | Select-Object -First 1
    }

    function Find-AstralisPython {
        $pythonKeys = 'HKCU:\Software\Python\PythonCore\3.13\InstallPath', 'HKLM:\Software\Python\PythonCore\3.13\InstallPath'
        $candidates = @(
            Get-ItemProperty -LiteralPath $pythonKeys -ErrorAction SilentlyContinue |
                Select-Object -ExpandProperty ExecutablePath -ErrorAction SilentlyContinue
            Get-Command python.exe -CommandType Application -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Source
            "$env:LOCALAPPDATA\Programs\Python\Python313\python.exe"
            "$env:ProgramFiles\Python313\python.exe"
        )
        foreach ($candidate in $candidates) {
            if (-not $candidate -or $candidate -like '*\Microsoft\WindowsApps\*' -or
                -not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
            $compatible = & $candidate -c "import sys, sysconfig; print(sys.version_info[:2] == (3, 13) and sysconfig.get_platform() == 'win-amd64')"
            if ($compatible -eq 'True') { return $candidate }
        }
    }

    function Install-AstralisTool($package, $label, [string[]]$options = @()) {
        $winget = Get-Command winget.exe -CommandType Application -ErrorAction SilentlyContinue
        if (-not $winget) {
            throw "${label} is missing and WinGet is unavailable. See the install links below this block, then reopen PowerShell and paste it again."
        }
        Write-Host "Installing $label..."
        & $winget.Source install --id $package --exact --source winget --scope user --silent --accept-package-agreements --accept-source-agreements @options
        if ($LASTEXITCODE -ne 0) { Write-Host "WinGet returned $LASTEXITCODE while installing $label. Checking for the installed program..." }
    }

    try {
        $astralisRepo = 'https://github.com/Debaprashad-Bhowmik/project-astralis.git'
        $astralisParent = (Get-Location).Path
        if (Test-Path -LiteralPath (Join-Path $astralisParent 'scripts\serve_astralis.py') -PathType Leaf) {
            $astralisParent = Split-Path -Parent $astralisParent
        }
        $astralisFolder = Join-Path $astralisParent 'project-astralis-run'
        $astralisServer = Join-Path $astralisFolder 'scripts\serve_astralis.py'
        $astralisGit = Find-AstralisGit
        if (-not $astralisGit) {
            Install-AstralisTool 'Git.Git' 'Git for Windows'
            $astralisGit = Find-AstralisGit
        }
        if (-not $astralisGit) { throw 'Git is unavailable. Install Git for Windows using the link below, open a new PowerShell window, and paste this block again.' }

        if (-not (Test-Path -LiteralPath $astralisFolder)) {
            & $astralisGit clone --branch main --single-branch $astralisRepo $astralisFolder
            if ($LASTEXITCODE -ne 0) { throw 'Clone failed. Check your connection, GitHub invitation, and the account you signed in with.' }
        } else {
            if (-not (Test-Path -LiteralPath (Join-Path $astralisFolder '.git') -PathType Container)) {
                throw 'project-astralis-run already exists. Paste the block in a different parent folder.'
            }
            $astralisOrigin = & $astralisGit -C $astralisFolder config --get remote.origin.url
            if ($LASTEXITCODE -ne 0 -or $astralisOrigin -ne $astralisRepo) { throw 'project-astralis-run is a different checkout. Paste the block in a different parent folder.' }
            $astralisEdits = & $astralisGit -C $astralisFolder status --porcelain --untracked-files=no
            if ($LASTEXITCODE -ne 0 -or $astralisEdits) { throw 'Save your edits in project-astralis-run or paste the block in a different parent folder.' }
            & $astralisGit -C $astralisFolder fetch --tags origin
            if ($LASTEXITCODE -ne 0) { throw 'Could not check GitHub for the latest version. Check your connection and repository access, then retry.' }
        }
        $astralisVersion = & $astralisGit -C $astralisFolder describe --tags --abbrev=0 --first-parent --match 'v[0-9]*.[0-9]*.[0-9]*' origin/main
        if ($LASTEXITCODE -ne 0) { throw 'A version tag could not be found on main.' }
        & $astralisGit -C $astralisFolder switch --detach "refs/tags/$astralisVersion"
        if ($LASTEXITCODE -ne 0) { throw "Could not check out $astralisVersion. See the Git message above." }
        if (-not (Test-Path -LiteralPath $astralisServer -PathType Leaf)) {
            throw "The navigator server is missing from $astralisVersion."
        }

        $astralisEnv = Join-Path $astralisFolder '.venv'
        $astralisPython = Join-Path $astralisEnv 'Scripts\python.exe'
        if (-not (Test-Path -LiteralPath $astralisPython -PathType Leaf)) {
            $basePython = Find-AstralisPython
            if (-not $basePython) {
                Install-AstralisTool 'Python.Python.3.13' 'Python 3.13 (x64)' -options @('--architecture','x64')
                $basePython = Find-AstralisPython
            }
            if (-not $basePython) { throw 'Python 3.13 (x64) is unavailable. Use the Python link below, open a new PowerShell window, and paste this block again.' }
            & $basePython -m venv $astralisEnv
            if ($LASTEXITCODE -ne 0) { throw 'Could not create the local Python environment. Check that you can write to the project folder, then retry.' }
        }

        & $astralisPython -m pip install --disable-pip-version-check numpy rasterio
        if ($LASTEXITCODE -ne 0) { throw 'Could not install the terrain packages. Check the pip message above and your internet connection, then retry.' }
        Write-Host "Starting Lunar Landing Site Navigator $astralisVersion"
        & $astralisPython $astralisServer --port 0 --open
        if ($LASTEXITCODE -ne 0) { throw 'The local server could not start. Check the message above.' }
    } catch {
        Write-Host "Navigator setup stopped. $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
```

</details>

If WinGet is missing or your computer blocks it, install or update App Installer, or install Git and the **64-bit Windows installer for Python 3.13** directly. Open a new PowerShell window and paste the block again. [Microsoft App Installer](https://learn.microsoft.com/en-us/windows/package-manager/winget/) · [Git for Windows](https://git-scm.com/install/win) · [Python for Windows](https://www.python.org/downloads/windows/)

## Run the navigator on macOS

Accept your invitation to the private repository. Open **Terminal**, go to the folder where you want the project, and paste the whole block below. The block uses Homebrew when a tool is missing. During the first clone, sign in through the browser with the GitHub account that accepted the invite. [Homebrew](https://brew.sh/) · [GitHub CLI sign-in](https://cli.github.com/manual/gh_auth_login)

<details>
<summary>Show the macOS copy/paste command</summary>

```sh
(
    set -eu

    astralis_fail() {
        printf 'Navigator setup stopped. %s\n' "$1" >&2
        exit 1
    }

    astralis_brew="$(command -v brew || true)"
    if [ -z "$astralis_brew" ]; then
        for candidate in /opt/homebrew/bin/brew /usr/local/bin/brew; do
            if [ -x "$candidate" ]; then
                astralis_brew="$candidate"
                break
            fi
        done
    fi
    if [ -n "$astralis_brew" ]; then
        astralis_brew_prefix="$("$astralis_brew" --prefix)"
        export PATH="$astralis_brew_prefix/bin:$PATH"
    fi

    astralis_install() {
        [ -n "$astralis_brew" ] || astralis_fail "$1 is missing. Install it using the links below, then paste the block again."
        "$astralis_brew" install "$1" || astralis_fail "Homebrew could not install $1. Check the message above and retry."
    }

    astralis_repo='https://github.com/Debaprashad-Bhowmik/project-astralis.git'
    astralis_parent="$PWD"
    if [ -f "$astralis_parent/scripts/serve_astralis.py" ]; then
        astralis_parent="$(dirname "$astralis_parent")"
    fi
    astralis_folder="$astralis_parent/project-astralis-run"
    git --version >/dev/null 2>&1 || astralis_install git
    command -v gh >/dev/null 2>&1 || astralis_install gh
    if ! gh auth status --hostname github.com >/dev/null 2>&1; then
        gh auth login --hostname github.com --git-protocol https --web ||
            astralis_fail 'GitHub sign-in was interrupted. Sign in and retry.'
    fi

    if [ ! -e "$astralis_folder" ]; then
        gh repo clone "$astralis_repo" "$astralis_folder" -- --branch main --single-branch ||
            astralis_fail 'Clone failed. Check your connection and the GitHub account that accepted the invite.'
    else
        [ -d "$astralis_folder/.git" ] ||
            astralis_fail 'project-astralis-run already exists. Paste the block in a different parent folder.'
        astralis_origin="$(git -C "$astralis_folder" config --get remote.origin.url)" ||
            astralis_fail 'The run checkout has no GitHub origin. Paste the block in a different parent folder.'
        case "$astralis_origin" in
            "$astralis_repo"|"${astralis_repo%.git}") ;;
            *) astralis_fail 'project-astralis-run is a different checkout. Paste the block in a different parent folder.' ;;
        esac
        astralis_edits="$(git -C "$astralis_folder" status --porcelain --untracked-files=no)" ||
            astralis_fail 'Could not check the run folder for edits.'
        [ -z "$astralis_edits" ] ||
            astralis_fail 'Save your edits in project-astralis-run or paste the block in a different parent folder.'
        git -C "$astralis_folder" -c credential.helper= -c 'credential.helper=!gh auth git-credential' fetch --tags origin ||
            astralis_fail 'Could not check GitHub for the latest version. Check your connection and repository access, then retry.'
    fi

    astralis_version="$(git -C "$astralis_folder" describe --tags --abbrev=0 --first-parent --match 'v[0-9]*.[0-9]*.[0-9]*' origin/main)" ||
        astralis_fail 'A version tag could not be found on main.'
    git -C "$astralis_folder" switch --detach "refs/tags/$astralis_version" ||
        astralis_fail "Could not check out $astralis_version. See the Git message above."
    astralis_server="$astralis_folder/scripts/serve_astralis.py"
    [ -f "$astralis_server" ] || astralis_fail "The navigator server is missing from $astralis_version."

    astralis_python="$astralis_folder/.venv/bin/python"
    if [ ! -x "$astralis_python" ]; then
        command -v python3.13 >/dev/null 2>&1 || astralis_install python@3.13
        python3.13 -m venv "$astralis_folder/.venv" ||
            astralis_fail 'Could not create the Python environment. Check that you can write to the project folder.'
    fi
    "$astralis_python" -m pip install --disable-pip-version-check numpy rasterio ||
        astralis_fail 'Could not install the terrain packages. Check the pip message above and retry.'
    printf 'Starting Lunar Landing Site Navigator %s\n' "$astralis_version"
    "$astralis_python" "$astralis_server" --port 0 --open
)
```

</details>

The terminal prints the localhost link and opens your default browser. Keep Terminal open while using the navigator. Press **Control+C** to stop the server. Paste the same block from the same folder to reopen it.

For a Mac without Homebrew, follow the installation links for any missing tools and paste the block again. Apple's Command Line Tools provide Git, and the Python 3.13 macOS installer is listed on Python.org. [Apple Command Line Tools](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools) · [GitHub CLI](https://cli.github.com/) · [Python for macOS](https://www.python.org/downloads/macos/)

## Explore the app

Choose a landing date, mission length, and priority to rank 39 landing and study locations. In Site ranking, choose **Site type → Future CLPS targets** to compare planned mission regions. Rotate the Moon to see sites on both hemispheres, search the 9,087 IAU-approved feature names, and click anywhere on the globe to evaluate the terrain horizon, daylight, and Earth visibility. Compare independently dated scenarios or scrub the Sun–Earth–Moon view in 3D.

**[Start with the Astralis handbook](ASTRALIS-HANDBOOK.md).** It covers the challenge, an example app screen, NASA data downloads, reproducible query settings, the build and testing workflow, team collaboration, the judging rubric, and submission.

**Explore three guided examples.** Compare a three-day landing delay, near-side and far-side Earth visibility, or the solar power implications of a low Sun. Each example uses the mission planner’s data and can open as an editable comparison.

**Open Surface in the Lunar mission viewer** to see the Sun and Earth at their apparent sizes from the selected coordinates. The same site and UTC time are used in Orbit, Moon Map, and Surface. Illustrated is the default style, and the Style menu also offers Natural. Both styles use NASA LOLA elevations for crater relief and time-dependent shadows, plus LROC reflectance with illustrative dust texture. Point toward a nearby named crater to see how its shadow moves with the timeline. Preset sites with dedicated elevation meshes use those meshes, including the 5 m near-field terrain at Shackleton Rim. For other coordinates, the view blends the bundled polar elevation grids into the global terrain wherever those grids cover the scene.

At Chang’e 5, the first-person view uses a 3.07 km square of the LROC stereo elevation model at its native 3 m/pixel spacing, blended into the global LOLA terrain. Select **Look toward → Xu Guangqi** to face the nearby crater. Use **View height → 100 m · survey** to see into the basin from above the near rim. The browser grid fills 101 small gaps from neighboring elevations. To regenerate it with NumPy and Rasterio, run `python scripts/prepare_surface_region.py NAC_DTM_CHANGE501.TIF data/surface/change5-elevation.bin.gz 43.0576 -51.9161`. [LROC stereo terrain](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_CHANGE501) · [IAU crater coordinates](https://planetarynames.wr.usgs.gov/Feature/15995)

Apollo 12 and Surveyor 3 share a 2.05 km square of LROC stereo elevation data with 2 m spacing. Select **Look toward → Surveyor crater** to see the measured depression southeast of Apollo 12's landing point. Run `python scripts/prepare_surface_region.py NAC_DTM_APOLLO12.TIF data/surface/apollo12-elevation.bin.gz -3.0128 -23.4219` to regenerate the crop. Local stereo terrain feeds the 3D surface view. The sky calculations show their own elevation source above the view. [LROC stereo terrain](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO12) · [NASA Apollo 12 site visualization](https://svs.gsfc.nasa.gov/4767/)

Focus the 3D scene and hold **W, A, S, D** to move, or use the buttons below it to step 10 m at a time. The camera follows the measured terrain and can move up to 500 m from the landing point. Generated rocks and shallow soil relief appear in the foreground at named sites, custom coordinates, and suggested patches. The rocks use closed, irregular shapes with blended face normals and texture on every side. A continuous centimeter-scale soil overlay adds uneven ground without flattening the measured elevations. These illustrative details cast moving shadows in both Illustrated and Natural styles. The timeline, power estimates, and landing rankings use the measured terrain at the selected coordinates.

**Distant softness** in **Camera, walking and terrain details** is on by default. A depth-aware camera effect gradually softens far terrain, with a maximum blur radius of 5.2 screen pixels (twice the v1.2.0 radius). At eye level and 1× zoom, the transition spans approximately 60–800 m in front of the camera; survey height and zoom move the focus range farther away. Nearby ground, sky bodies, labels, and the terrain silhouette stay sharp. Switch it off for a fully sharp view. It is a presentation choice, not lunar haze or extra measured detail. Synthetic rocks are loaded beyond their visible range and settle gradually into their support at distance, with the same transition in their cast shadows. The measured ground, crater elevations, and planning calculations are unchanged. If the device lacks a suitable depth framebuffer, the view remains sharp.

**Sun & Earth guides** sits beside **Find Sun** and **Find Earth**, directly below the Surface viewer. Turn it on for body labels, paths across the local sky, camera bearing, and clickable off-screen arrows. Turn it off to hide all those annotations. Paths follow the mission window or selected whole year; the yearly preview samples directions every six hours. These are apparent sky paths from the selected landing site, not orbital ellipses drawn on the lunar ground.

**Explore from orbit to the surface.** Use **Orbit**, **Moon Map**, or **Surface** below the shared viewer. Drag the orbit camera to change perspective. On the Moon Map, the shaded hemisphere is in lunar night. Earth and Sun remain in the same dated system as Orbit: rotating or zooming the map updates their apparent positions, sizes, lighting, and lunar occlusion. Direction labels identify bodies behind the camera or outside the frame; the map controls report their camera distances. Select a landing site or custom coordinate on the Moon Map, then open **Surface** to view its terrain. Select **Whole year** to scrub any UTC calendar year from 2024 through 2030 across all three views. **Mission window** returns to the selected landing date and operating window.

Orbit interpolates JPL geometric positions and displays physical distances in the readout. All radii and separations share one physical scale, projected through a perspective camera. Earth–Moon and solar overviews show how much empty space separates the bodies; use the Focus selector or camera zoom to inspect Earth, Moon, or Sun. A farther body and its glare cannot paint through a nearer sphere. Earth uses an archival satellite mosaic with approximate sidereal rotation and dynamic lighting in Orbit and Surface. The Sun disk uses an archival SDO observation recolored for display. Clouds and solar activity do not simulate weather at the selected date. [NASA Blue Marble](https://svs.gsfc.nasa.gov/3615/) · [NASA CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) · [NASA SDO archive](https://svs.gsfc.nasa.gov/4551/)


Orbit and Moon Map use one lunar renderer: the camera closes in on the same sphere. Surface first loads the selected coordinate's terrain, centers that point, and keeps zooming down toward it. The map and overhead terrain view use matching screen scale during a soft-focus handoff. The same descent then lowers the camera and gradually turns it toward the horizon, finishing at the selected viewing height. Blur masks coarse detail only in the middle of the journey. This is an illustrative navigation path, not a simulated landing trajectory. Reduced-motion settings skip camera travel. Screen resolution adapts during flight and returns to full resolution on arrival. Analysis colors start off. Use the layer checkboxes directly above the viewer to enable them; checking or unchecking a layer automatically transitions from Orbit or Surface to the 3D Moon Map and preserves the latest selections during the flight. Date, site, Sun/Earth positions and mission totals stay together, with advanced controls in expandable sections.

**Rendering data and limits.** The Moon uses an 8,192-pixel global color map on capable devices, with 4,096-pixel regional tiles cut from NASA's 16,384-pixel original when zoomed in. Image resolution is separate from elevation resolution. The global visual shadows and normals use the bundled LOLA grid (about 1.9 km spacing north–south); polar rendering uses the finer nested LOLA grids. Selected first-person views can use finer stereo elevation. Earth is a lit, rotating globe with an archival cloud mosaic, ocean highlights and a thin atmospheric rim. These are rendering effects, not an atmospheric simulation. Orbit and the Moon Map surroundings use physical sphere radii and JPL separations; close-ups change the camera, not the body size. The Moon retains its cartographic projection for map markers and picking. The celestial backdrop uses a perspective camera fitted to the displayed lunar silhouette, so its scale and occlusion remain aligned with the map. Surface disks use the modeled apparent angular sizes.

To reproduce the display textures, install Pillow and NumPy, then run `python scripts/prepare_visual_assets.py --moon-tiff <downloaded-lroc-tiff> --earth-tiff <downloaded-earth-tiff>`. Running the script without arguments repacks the existing global elevations losslessly for the GPU. It does not change the scientific terrain or ephemeris files.

| Display asset | Original source | Use |
| --- | --- | --- |
| 8K Moon map and eight regional tiles | [NASA 2019 LROC color map, 16K TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/lroc_color_poles_16k.tif) · [CGI Moon Kit](https://svs.gsfc.nasa.gov/4720/) | Lunar color; polar areas include lower-resolution LOLA albedo fill |
| Packed global elevation PNG | Repository `data/terrain/*.bin`, sourced from [NASA LOLA](https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/ldem_16_uint.tif) | Terrain normals and approximate visual shadow tracing; retains original half-meter encoding |
| Earth with clouds | [NASA global Earth TIFF](https://svs.gsfc.nasa.gov/vis/a000000/a003600/a003615/flat_earth03.tif) · [source page](https://svs.gsfc.nasa.gov/3615/) | Archival geography and cloud pattern, rotated and lit for the selected time |
| Sun disk | [NASA SDO archive](https://svs.gsfc.nasa.gov/4551/) | Archival disk texture, recolored with a display glow |

In **Mission setup → Operating window**, select **Full year** to run from landing to the same UTC date and time the next year. The window has 365 or 366 days, and a starting date of February 29 ends on March 1 the following year. The end must be within the bundled ephemeris, which runs through January 1, 2031 at 00:00 UTC. The heat map, comparisons, surface views, and orbit scene’s **Mission window** mode all use that window.

The **One lunar day** preset spans 29.5 Earth days. Use **Show paths over the mission** to trace both bodies, choose a playback speed, or open **Jump to a rise or set** to inspect a crossing from the event list.

**Explore the South Pole on the 3D Moon.** The 90°S marker and 84°S ring show the pole and the edge of NASA’s six-degree Artemis exploration zone. The **Map layers** checkboxes show terrain that satisfies all selected conditions on the rotatable globe and flat map. Combined filters require positive overlap hours for the selected period and positive solar power at the displayed time when those layers are checked. When both numeric layers are selected, **Color by** chooses the legend and gradient. Global coverage uses a smooth reference horizon. Individual sites use the selected horizon model.

**Compare mission overlap on the Moon.** Check **Mission overlap** to see hours when sunlight and a direct view of Earth coincide. Deep blue means zero hours, and pale gold marks the maximum in the legend. The overview uses a smooth horizon and a 1° grid for windows up to 31 days. Zoom in on the **3D Moon** to calculate a finer map for the visible area. With **Terrain horizon · LOLA** selected, the close-up estimates shadows from measured elevations and increases color contrast over the local range. The legend still shows hours. Neutral pins report the site calculation, and selecting a pin also shows the map estimate at those coordinates.

Turn on **South Pole only** in the map controls to focus every surface layer on 84°S–90°S. The 3D Moon centers on the pole and clips overlays to that boundary. The flat map shows the selected latitude band. The overlap scale uses the regional maximum and labels it in hours out of the full mission duration.

**Map solar power.** Check **Solar power** and scrub the timeline on the 3D Moon or flat map. The map shows estimated electrical output per square meter of a horizontal panel at 20% efficiency. The whole-Moon scale is fixed at 0–300 W/m². In South Pole mode, the scale uses the maximum in that region at the displayed time. Select a site to read its solar elevation and power. Surface Operations CSV exports these estimates for every 15-minute sample at the selected site.

**Inspect crater shadows.** Turn on **South Pole only** and keep **Crater shadows** checked on the 3D Moon. Turn on **Sunlight now** or **Solar power** and scrub the timeline. The view traces current Sun and Earth rays through LOLA elevations, with 240 m terrain for 84°S–90°S, 80 m near the pole, and 10 m over the Shackleton study area. The flat map shows the smooth-horizon overview. Toggle **Crater shadows** to compare the reference model. In **Site ranking**, choose **Rank by → Solar energy** to compare estimated kWh/m² over the mission among sites that meet your limits. The NASA long-term sunlight value in the assessment is a separate reference for polar sites. [NASA LOLA polar terrain](https://pgda.gsfc.nasa.gov/products/90) · [NASA Shackleton terrain](https://pgda.gsfc.nasa.gov/products/78) · [NASA polar illumination](https://pgda.gsfc.nasa.gov/products/69)

**Compare landing sites.** Three panels start with **Best communications**, **Best solar power**, and **Best balance** for the current mission and slope limit. Recommendations load when you open the comparison, even if the Landing Suggestions list is hidden. Each panel has an editable site selector above the original Moon Map renderer, with drag, zoom, South Pole, center-site, and Open Surface controls. The maps use dated sunlight, crater shadows, and Sun/Earth direction labels. A patch can legitimately lead more than one scenario.

Compare total solar energy, average power, total and continuous Earth view, sunlight share, slope, roughness, and the longest gaps. Patch comparisons use the original screening horizon and sampling (15 minutes through 30 days; two hours for longer windows), so opening a finer terrain inspection does not silently change the recommendation totals. The shared slider moves all three maps through the same elapsed time. **Compare different landing dates** retains separate dates for B and C. **Use recommended patches** restores all three defaults and the mission date. Manual choices stay selected when the mission changes and are labeled **Custom comparison**. Map coordinates can be assigned with **Use as Site A / B / C**. If no patch qualifies, the panel identifies the closest alternative; if none passes the slope screen, it offers manual selection instead.

**Check power and communications.** Compare sunlight hours, direct Earth visibility windows, the longest gaps, and equivalent full-sun hours for a flat panel. Use the Landing Suggestions scenarios to compare communications, solar power, and balance, with an editable maximum slope.

## Run manually

From the repository root, install the terrain reader with `python -m pip install numpy rasterio`. Run `python scripts/serve_astralis.py --open` to serve the navigator at [localhost:4173](http://localhost:4173). Add `--port 0` to pick any available port. The server reads elevation windows around the selected location and needs no API key. The static app uses bundled terrain when the terrain endpoint or its data source is unavailable. Run `node --test planner.test.mjs landing-suggestions.test.mjs orbital-geometry.test.mjs viewer-flight.test.mjs` to verify the ranking and reference calculations.

The terrain server uses NASA’s 10 m LOLA product for South Pole patches and the USGS global LOLA grid at 256 samples per degree elsewhere. The global grid has about 118 m between north–south samples. Existing 2 m and 3 m stereo terrain and the prepared 5 m Shackleton Rim mesh provide finer detail in smaller areas. The caption shows the actual local source. The renderer and skyline blend into coarser terrain farther away, and grid spacing does not establish feature accuracy or resolve every obstacle. [NASA polar elevations](https://pgda.gsfc.nasa.gov/products/90) · [USGS global elevations](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m) · [GMT tiles of the USGS grid](https://www.generic-mapping-tools.org/remote-datasets/moon-relief.html)

### South Pole landing suggestions

The mission tools row stays beside the viewer tabs. **Mission window / Whole year** sits at the right end of that row on desktop; year, month, and speed appear when needed. Coordinates and terrain resolution sit inline beside the site selector. The viewer retains its original dimensions; only the controls are compacted. Smaller screens wrap controls instead of clipping them. **Add coordinates** and **Find lunar features** open their map controls; **Compare sites** takes you to the three-panel comparison. **South Pole only** and all layer checkboxes remain above the viewer in every camera mode. Layer changes also switch a polar/flat map back to the 3D Moon. The old Map layers shortcut has been removed; **Layer details and legends** below the map explains the results. Visibility and power overlays remain opt-in, and multiple filters still form an intersection.

Mission setup now shows the landing date, UTC time, operating window, and date-shift button. The old best-fit summary, priority presets, and Advanced settings are hidden. Turn on **Landing Suggestions** beside the **Orbit / Moon Map / Surface** tabs to reveal a full-width panel directly below the viewer; the ordinary site ranking follows it. Set the landing time and operating window in Mission setup. The switch is available in every viewer mode, including the polar and visibility maps. Enabling it takes you to the ranked shortlist. Changing views keeps that shortlist; changing the mission or maximum slope recalculates it. The editable slope control defaults to under 10° over 100 m based on NASA’s Artemis landing study. Each patch lists total solar energy in kWh/m², average power in W/m², and the hours and percentage of the mission with sunlight and with a direct view of Earth. Average power is total solar energy divided by the full mission duration. Terrain shadows and total eclipses contribute zero direct power. [NASA Artemis landing study](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf)

Select a suggestion or its pin to open **Surface operations** at the patch’s coordinates, 2 m above the modeled ground. The mission timeline updates Sun and Earth positions and calculates visibility. With the terrain server running, inspection recalculates the skyline from the finer elevation window. The suggestion list uses the precomputed inventory to screen the full region. The patch stays available for inspection and comparison during the current session.

If Surface is already open, selecting a different suggested patch first ascends from the current site using the existing camera animation, rotates the Moon Map toward the destination, then descends into its terrain. The old terrain remains in view until ascent finishes. A new patch choice during travel updates the destination; reduced-motion preferences preserve the same navigation without the extended animation.

Compare the three leading patches at the top of Landing Suggestions. Select a scenario to sort the shortlist. Every patch keeps its inventory ID and shows its rank under all three scenarios across the full eligible inventory.

- **Best communications** requires direct Earth visibility from landing to mission end and ranks the matching patches by total solar energy.
- **Best balance** uses the geometric mean of the patch’s share of maximum solar energy and the share of the mission in its longest continuous Earth-view window.
- **Best solar power** ranks by total solar energy, with longer uninterrupted Earth view breaking energy ties. The planner can add a minimum continuous Earth-view or sunlight window. The default is 0%.

The list shows the longest uninterrupted Earth view and sunlight windows, as well as the longest Earth-view outage. If a scenario has no match, the list labels the closest alternatives as missing the scenario. The terrain inventory selects the lowest-slope 100 m-baseline measurement with roughness data in each 4 km square of the 84°S–90°S region. Candidate skylines use the bundled LOLA elevation grids at 3° bearing intervals. The mission is sampled every 15 minutes through 30 days and every two hours for longer windows. [NASA LOLA slope and roughness](https://pgda.gsfc.nasa.gov/products/90)

To regenerate the inventory, download the `LDRM_80S_50MPP_ADJ_SLP_100M.TIF` and `LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF` GeoTIFFs from the NASA source above. Run `python scripts/prepare_landing_patches.py SLOPE.TIF ROUGHNESS.TIF patches.json` with NumPy and Rasterio installed, then `node scripts/prepare_landing_horizons.mjs patches.json`. Run `node --test planner.test.mjs landing-suggestions.test.mjs orbital-geometry.test.mjs viewer-flight.test.mjs` to verify the models.

## Working together

Clone the repo, create a branch from `main` for your task, and open a pull request when your work is ready for review. Use GitHub Issues to share questions and track tasks.

### Publish a version

Give every published update to main a new annotated tag in vMAJOR.MINOR.PATCH format. Run the tests, update the version metadata and changelog, tag the release commit on main, and push both together. See [the release checklist](CONTRIBUTING.md#publish-a-named-version). For example, the next fix release could use v1.3.6. Each tag stays attached to its original release commit.

```sh
git tag -a v1.3.6 -m "Lunar Landing Site Navigator v1.3.6 — Deb"
git push --atomic origin main v1.3.6
```

The launch blocks use the newest tag reachable through main's first-parent history and print the version before opening the site. [All published versions](https://github.com/Debaprashad-Bhowmik/project-astralis/tags)

## References and attribution

The [source register](REFERENCES.md) maps scientific inputs and visual assets to their exact providers, products, preprocessing steps, and limitations. The [full link index](docs/references/link-index.md) preserves recorded research references. [Third-party notices](THIRD_PARTY_NOTICES.md) retain source credits and font terms; [CITATION.cff](CITATION.cff) identifies this release.

OpenAI Codex assisted with development and documentation; ImageGen assisted with the identified design artwork and dust material. Ephemerides and measured elevations come from the cited scientific products. Lunar Landing Site Navigator is a challenge project by team Astralis, not a NASA-certified landing solution.
