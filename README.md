# Project Astralis

The Astralis is building a Lunar Site Navigator for the 2026 NASA Space Apps Challenge. The challenge asks teams to make it easier to compare lunar landing sites and dates using the Sun and Earth's positions relative to the horizon. [Challenge brief](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)

[Windows setup](#run-astralis-on-windows) · [macOS setup](#run-astralis-on-macos)

## Run Astralis on Windows

Accept your invitation to the private repository. Open **Windows PowerShell** in the folder where you want Astralis, use the copy button on the code block below, paste the whole block, and press Enter. If Git opens a sign-in window, use the GitHub account that accepted the invite. [GitHub sign-in for Git](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git?platform=windows)

The block uses WinGet to install Git and x64 Python 3.13 if needed. It then downloads the project and bundled lunar data, installs the terrain packages, and opens Astralis in your default browser. The terminal prints the localhost link. Keep the window open while using the site and press **Ctrl+C** to stop it. [Microsoft WinGet guide](https://learn.microsoft.com/en-us/windows/package-manager/winget/)

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
        $astralisFolder = (Get-Location).Path
        if (-not (Test-Path -LiteralPath (Join-Path $astralisFolder 'scripts\serve_astralis.py'))) {
            $astralisFolder = Join-Path $astralisFolder 'project-astralis'
        }
        $astralisServer = Join-Path $astralisFolder 'scripts\serve_astralis.py'
        if (-not (Test-Path -LiteralPath $astralisFolder)) {
            $astralisGit = Find-AstralisGit
            if (-not $astralisGit) {
                Install-AstralisTool 'Git.Git' 'Git for Windows'
                $astralisGit = Find-AstralisGit
            }
            if (-not $astralisGit) { throw 'Git is unavailable. Install Git for Windows using the link below, open a new PowerShell window, and paste this block again.' }
            & $astralisGit clone https://github.com/Debaprashad-Bhowmik/project-astralis.git $astralisFolder
            if ($LASTEXITCODE -ne 0) { throw 'Clone failed. Check your connection, GitHub invitation, and the account you signed in with.' }
        }
        if (-not (Test-Path -LiteralPath $astralisServer -PathType Leaf)) {
            throw "The Astralis server is missing from $astralisFolder. Update that checkout or run the setup in a different parent folder."
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
        & $astralisPython $astralisServer --port 0 --open
        if ($LASTEXITCODE -ne 0) { throw 'The local server could not start. Check the message above.' }
    } catch {
        Write-Host "Astralis setup stopped. $($_.Exception.Message)" -ForegroundColor Yellow
    }
}
```

If WinGet is missing or your computer blocks it, install or update App Installer, or install Git and the **64-bit Windows installer for Python 3.13** directly. Open a new PowerShell window and paste the block again. [Microsoft App Installer](https://learn.microsoft.com/en-us/windows/package-manager/winget/) · [Git for Windows](https://git-scm.com/install/win) · [Python for Windows](https://www.python.org/downloads/windows/)

Paste the same block from the same folder to reopen Astralis. To update an existing `main` checkout first, open PowerShell in the repository and run `git pull --ff-only`.

## Run Astralis on macOS

Accept your invitation to the private repository. Open **Terminal**, go to the folder where you want Astralis, and paste the whole block below. The block uses Homebrew when a tool is missing. During the first clone, sign in through the browser with the GitHub account that accepted the invite. [Homebrew](https://brew.sh/) · [GitHub CLI sign-in](https://cli.github.com/manual/gh_auth_login)

```sh
(
    set -eu

    astralis_fail() {
        printf 'Astralis setup stopped. %s\n' "$1" >&2
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

    astralis_folder="$PWD"
    if [ ! -f "$astralis_folder/scripts/serve_astralis.py" ]; then
        astralis_folder="$PWD/project-astralis"
    fi
    if [ ! -e "$astralis_folder" ]; then
        git --version >/dev/null 2>&1 || astralis_install git
        command -v gh >/dev/null 2>&1 || astralis_install gh
        if ! gh auth status --hostname github.com >/dev/null 2>&1; then
            gh auth login --hostname github.com --git-protocol https --web ||
                astralis_fail 'GitHub sign-in was interrupted. Sign in and retry.'
        fi
        gh repo clone https://github.com/Debaprashad-Bhowmik/project-astralis.git "$astralis_folder" ||
            astralis_fail 'Clone failed. Check your connection and the GitHub account that accepted the invite.'
    fi

    astralis_server="$astralis_folder/scripts/serve_astralis.py"
    [ -f "$astralis_server" ] || astralis_fail 'The project folder is missing the server. Update that checkout or choose a different parent folder.'

    astralis_python="$astralis_folder/.venv/bin/python"
    if [ ! -x "$astralis_python" ]; then
        command -v python3.13 >/dev/null 2>&1 || astralis_install python@3.13
        python3.13 -m venv "$astralis_folder/.venv" ||
            astralis_fail 'Could not create the Python environment. Check that you can write to the project folder.'
    fi
    "$astralis_python" -m pip install --disable-pip-version-check numpy rasterio ||
        astralis_fail 'Could not install the terrain packages. Check the pip message above and retry.'
    "$astralis_python" "$astralis_server" --port 0 --open
)
```

The terminal prints the localhost link and opens your default browser. Keep Terminal open while using Astralis. Press **Control+C** to stop the server. Paste the same block from the same folder to reopen it.

For a Mac without Homebrew, follow the installation links for any missing tools and paste the block again. Apple's Command Line Tools provide Git, and the Python 3.13 macOS installer is listed on Python.org. [Apple Command Line Tools](https://developer.apple.com/documentation/xcode/installing-the-command-line-tools) · [GitHub CLI](https://cli.github.com/) · [Python for macOS](https://www.python.org/downloads/macos/)

## Explore the app

Choose a landing date, mission length, and priority to rank 39 landing and study locations. In Site ranking, choose **Site type → Future CLPS targets** to compare planned mission regions. Rotate the Moon to see sites on both hemispheres, search the 9,087 IAU-approved feature names, and click anywhere on the globe to evaluate the terrain horizon, daylight, and Earth visibility. Compare independently dated scenarios or scrub the Sun–Earth–Moon view in 3D.

**[Start with the Astralis handbook](ASTRALIS-HANDBOOK.md).** It covers the challenge, an example app screen, NASA data downloads, reproducible query settings, the build and testing workflow, team collaboration, the judging rubric, and submission.

**Explore three guided examples.** Compare a three-day landing delay, near-side and far-side Earth visibility, or the solar power implications of a low Sun. Each example uses the mission planner’s data and can open as an editable comparison.

**Open the local sky view.** Switch to the first-person 3D surface view to see the Sun and Earth at their apparent sizes. Illustrated is the default style, and the Style menu also offers Natural. Both styles use NASA LOLA elevations for crater relief and time-dependent shadows, plus LROC reflectance with illustrative dust texture. Point toward a nearby named crater to see how its shadow moves with the timeline. Preset sites with dedicated elevation meshes use those meshes, including the 5 m near-field terrain at Shackleton Rim. For other coordinates, the view blends the bundled polar elevation grids into the global terrain wherever those grids cover the scene.

At Chang’e 5, the first-person view uses a 3.07 km square of the LROC stereo elevation model at its native 3 m/pixel spacing, blended into the global LOLA terrain. Select **Look toward → Xu Guangqi** to face the nearby crater. Use **View height → 100 m · survey** to see into the basin from above the near rim. The browser grid fills 101 small gaps from neighboring elevations. To regenerate it with NumPy and Rasterio, run `python scripts/prepare_surface_region.py NAC_DTM_CHANGE501.TIF data/surface/change5-elevation.bin.gz 43.0576 -51.9161`. [LROC stereo terrain](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_CHANGE501) · [IAU crater coordinates](https://planetarynames.wr.usgs.gov/Feature/15995)

Apollo 12 and Surveyor 3 share a 2.05 km square of LROC stereo elevation data with 2 m spacing. Select **Look toward → Surveyor crater** to see the measured depression southeast of Apollo 12's landing point. Run `python scripts/prepare_surface_region.py NAC_DTM_APOLLO12.TIF data/surface/apollo12-elevation.bin.gz -3.0128 -23.4219` to regenerate the crop. Local stereo terrain feeds the 3D surface view. The sky calculations show their own elevation source above the view. [LROC stereo terrain](https://data.lroc.im-ldi.com/lroc/view_rdr/NAC_DTM_APOLLO12) · [NASA Apollo 12 site visualization](https://svs.gsfc.nasa.gov/4767/)

Focus the 3D scene and hold **W, A, S, D** to move, or use the buttons below it to step 10 m at a time. The camera follows the same terrain triangles drawn on screen and can move up to 500 m from the landing point. The visibility timeline reports conditions at the selected landing coordinates. The near shadow map resolves local crater walls and rims, and the regional pass includes distant blockers. Low Sun angles make the relief easiest to see where the source elevations resolve it.

**3D orbit view.** Switch between Earth-centered and Sun-centered views. Select **Whole year** to explore any calendar year from 2024 through 2030 in UTC. Jump to a month, scrub the date slider, or play at 1, 5, or 15 simulation days per second. **Mission window** returns to the shared mission timeline.

In **Mission setup → Operating window**, select **Full year** to run from landing to the same UTC date and time the next year. The window has 365 or 366 days, and a starting date of February 29 ends on March 1 the following year. The end must be within the bundled ephemeris, which runs through January 1, 2031 at 00:00 UTC. The heat map, comparisons, surface views, and orbit scene’s **Mission window** mode all use that window.

The **One lunar day** preset spans 29.5 Earth days. Use **Show paths over the mission** to trace both bodies, choose a playback speed, or open **Jump to a rise or set** to inspect a crossing from the event list.

**Explore the South Pole on the 3D Moon.** The 90°S marker and 84°S ring show the pole and the edge of NASA’s six-degree Artemis exploration zone. The **Map layers** checkboxes show terrain that satisfies all selected conditions on the rotatable globe and flat map. Combined filters require positive overlap hours for the selected period and positive solar power at the displayed time when those layers are checked. When both numeric layers are selected, **Color by** chooses the legend and gradient. Global coverage uses a smooth reference horizon. Individual sites use the selected horizon model.

**Compare mission overlap on the Moon.** Check **Mission overlap** to see hours when sunlight and a direct view of Earth coincide. Deep blue means zero hours, and pale gold marks the maximum in the legend. The overview uses a smooth horizon and a 1° grid for windows up to 31 days. Zoom in on the **3D Moon** to calculate a finer map for the visible area. With **Terrain horizon · LOLA** selected, the close-up estimates shadows from measured elevations and increases color contrast over the local range. The legend still shows hours. Neutral pins report the site calculation, and selecting a pin also shows the map estimate at those coordinates.

Turn on **South Pole only** in the map controls to focus every surface layer on 84°S–90°S. The 3D Moon centers on the pole and clips overlays to that boundary. The flat map shows the selected latitude band. The overlap scale uses the regional maximum and labels it in hours out of the full mission duration.

**Map solar power.** Check **Solar power** and scrub the timeline on the 3D Moon or flat map. The map shows estimated electrical output per square meter of a horizontal panel at 20% efficiency. The whole-Moon scale is fixed at 0–300 W/m². In South Pole mode, the scale uses the maximum in that region at the displayed time. Select a site to read its solar elevation and power. Surface Operations CSV exports these estimates for every 15-minute sample at the selected site.

**Inspect crater shadows.** Turn on **South Pole only** and keep **Crater shadows** checked on the 3D Moon. Turn on **Sunlight now** or **Solar power** and scrub the timeline. The view traces current Sun and Earth rays through LOLA elevations, with 240 m terrain for 84°S–90°S, 80 m near the pole, and 10 m over the Shackleton study area. The flat map shows the smooth-horizon overview. Toggle **Crater shadows** to compare the reference model. In **Site ranking**, choose **Rank by → Solar energy** to compare estimated kWh/m² over the mission among sites that meet your limits. The NASA long-term sunlight value in the assessment is a separate reference for polar sites. [NASA LOLA polar terrain](https://pgda.gsfc.nasa.gov/products/90) · [NASA Shackleton terrain](https://pgda.gsfc.nasa.gov/products/78) · [NASA polar illumination](https://pgda.gsfc.nasa.gov/products/69)

**Compare landing sites.** Choose any two sites in the comparison panel, or select a map pin or coordinate and click **Use as Site A** or **Use as Site B**. The two site-centered lunar views and their live terrain-aware readouts share a time slider with the mission timeline. Both sites use the same landing time by default. Set a separate landing date for B to compare schedules. Each mission track includes visibility totals and gaps.

**Check power and communications.** Compare sunlight hours, direct Earth visibility windows, the longest gaps, and equivalent full-sun hours for a flat panel. Set mission limits to check or rank sites using your own requirements.

## Run manually

From the repository root, install the terrain reader with `python -m pip install numpy rasterio`. Run `python scripts/serve_astralis.py --open` to serve Astralis at [localhost:4173](http://localhost:4173). Add `--port 0` to pick any available port. The server reads elevation windows around the selected location and needs no API key. The static app uses bundled terrain when the terrain endpoint or its data source is unavailable. Run `node --test planner.test.mjs landing-suggestions.test.mjs` to verify the ranking and reference calculations.

The terrain server uses NASA’s 10 m LOLA product for South Pole patches and the USGS global LOLA grid at 256 samples per degree elsewhere. The global grid has about 118 m between north–south samples. Existing 2 m and 3 m stereo terrain and the prepared 5 m Shackleton Rim mesh provide finer detail in smaller areas. The caption shows the actual local source. The renderer and skyline blend into coarser terrain farther away, and grid spacing does not establish feature accuracy or resolve every obstacle. [NASA polar elevations](https://pgda.gsfc.nasa.gov/products/90) · [USGS global elevations](https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m) · [GMT tiles of the USGS grid](https://www.generic-mapping-tools.org/remote-datasets/moon-relief.html)

### South Pole landing suggestions

Turn on **Landing Suggestions** in the 3D Moon’s map layers and set the landing time and operating window. The editable slope control defaults to under 10° over 100 m based on NASA’s Artemis landing study. Each patch lists total solar energy in kWh/m², average power in W/m², and the hours and percentage of the mission with sunlight and with a direct view of Earth. Average power is total solar energy divided by the full mission duration. Terrain shadows and total eclipses contribute zero direct power. [NASA Artemis landing study](https://ntrs.nasa.gov/api/citations/20250009323/downloads/ArtemisOverview2025IntSPAPPSChallenge.pdf)

Select a suggestion or its pin to open **Surface operations** at the patch’s coordinates, 2 m above the modeled ground. The mission timeline updates Sun and Earth positions and calculates visibility. With the terrain server running, inspection recalculates the skyline from the finer elevation window. The suggestion list uses the precomputed inventory to screen the full region. The patch stays available for inspection and comparison during the current session.

Compare the three leading patches at the top of Landing Suggestions. Select a scenario to sort the shortlist. Every patch keeps its inventory ID and shows its rank under all three scenarios across the full eligible inventory.

- **Best communications** requires direct Earth visibility from landing to mission end and ranks the matching patches by total solar energy.
- **Best balance** uses the geometric mean of the patch’s share of maximum solar energy and the share of the mission in its longest continuous Earth-view window.
- **Best solar power** ranks by total solar energy, with longer uninterrupted Earth view breaking energy ties. The planner can add a minimum continuous Earth-view or sunlight window. The default is 0%.

The list shows the longest uninterrupted Earth view and sunlight windows, as well as the longest Earth-view outage. If a scenario has no match, the list labels the closest alternatives as missing the scenario. The terrain inventory selects the lowest-slope 100 m-baseline measurement with roughness data in each 4 km square of the 84°S–90°S region. Candidate skylines use the bundled LOLA elevation grids at 3° bearing intervals. The mission is sampled every 15 minutes through 30 days and every two hours for longer windows. [NASA LOLA slope and roughness](https://pgda.gsfc.nasa.gov/products/90)

To regenerate the inventory, download the `LDRM_80S_50MPP_ADJ_SLP_100M.TIF` and `LDRM_80S_50MPP_ADJ_ROUGH_100M.TIF` GeoTIFFs from the NASA source above. Run `python scripts/prepare_landing_patches.py SLOPE.TIF ROUGHNESS.TIF patches.json` with NumPy and Rasterio installed, then `node scripts/prepare_landing_horizons.mjs patches.json`. Run `node --test planner.test.mjs landing-suggestions.test.mjs` to verify the models.

## Working together

Clone the repo, create a branch from `main` for your task, and open a pull request when your work is ready for review. Use GitHub Issues to share questions and track tasks.

## References

- [NASA Space Apps Project Submission Guide](https://www.spaceappschallenge.org/resources/project-submission-guide/)
- [NASA JPL Horizons ephemeris service](https://ssd.jpl.nasa.gov/horizons/)
- [NASA Goddard LOLA south pole elevation data](https://pgda.gsfc.nasa.gov/products/90)
