"""Browser regressions for mission tools. Uses bundled data without network terrain.

Install playwright and its Chromium browser first. Pass --url to also exercise an
already-running terrain server, or --browser-path to use an installed browser.
"""

import argparse
import gzip
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread

from playwright.sync_api import expect, sync_playwright

ROOT = Path(__file__).resolve().parents[1]


class BundledHandler(SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass

    def do_GET(self):
        if self.path.startswith('/api/terrain'):
            self.send_error(503, 'Browser check uses the bundled terrain fallback')
        else:
            super().do_GET()


def audit(page, url):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.set_default_timeout(30_000)
    page.goto(url, wait_until='domcontentloaded')
    page.wait_for_function("!document.querySelector('#space-earth-view').disabled", timeout=60_000)

    def settled(mode):
        page.wait_for_function("mode => document.querySelector('#space').dataset.viewerMode === mode && !document.querySelector('#viewer-stage').hasAttribute('aria-busy')", arg=mode, timeout=60_000)

    def patches():
        page.wait_for_function("document.querySelectorAll('#landing-suggestions-list button').length > 0 && document.querySelector('#landing-suggestions-status').textContent.includes('sampled patches')", timeout=120_000)

    def tool(panel):
        page.click(f'[data-map-tool="{panel}"]')
        settled('map')
        assert page.locator('#' + panel).get_attribute('open') is not None

    toggle = page.locator('#layer-landing-suggestions')
    expect(toggle).to_be_visible()  # Regression: hidden on arrival in Orbit.
    toggle.check()
    patches()
    first_results = page.locator('#landing-suggestions-list').inner_text()
    assert page.locator('.compare-scenario').count() == 3, 'Compare all three mission scenarios'
    for key, mode in [('a', 'earth'), ('b', 'solar'), ('c', 'balanced')]:
        patch_id = page.locator('#compare-' + key).input_value()
        assert patch_id.startswith('landing-patch-'), patch_id
        expect(page.locator(f'#landing-{mode}-winner')).to_contain_text('Patch ' + patch_id.removeprefix('landing-patch-'))
    for mode in ['earth', 'solar', 'balanced']:
        page.check(f'input[name="landing-scenario"][value="{mode}"]')
        expect(page.locator(f'#landing-{mode}-winner')).not_to_be_empty(timeout=30_000)
    expect(page.locator('#landing-scenario-rule')).to_contain_text('continuous Earth-view')
    page.wait_for_function("expected => document.querySelector('#landing-suggestions-list').innerText === expected", arg=first_results)
    tool('viewer-analysis')
    for projection in ['show-map', 'show-coverage', 'show-globe']:
        page.click('#' + projection)
        expect(toggle).to_be_visible()
        expect(page.locator('#landing-suggestions')).to_be_visible()
        assert page.locator('#landing-suggestions-list').inner_text() == first_results, projection
    print('PASS: suggestions available from Orbit; all three scenarios and map projections preserve results', flush=True)

    page.locator('#landing-suggestions-list button').first.click()
    settled('surface')
    assert page.locator('#space-site').input_value().startswith('landing-patch-')
    next_patch = page.locator('#landing-suggestions-list button').nth(1).get_attribute('data-site')
    page.evaluate("window.siteTravelModes=[]; new MutationObserver(records => siteTravelModes.push(...records.map(record => record.oldValue))).observe(document.querySelector('#space'), {attributes:true, attributeFilter:['data-viewer-mode'], attributeOldValue:true})")
    page.locator('#landing-suggestions-list button').nth(1).click()
    page.wait_for_function("id => document.querySelector('#space-site').value === id && document.querySelector('#space').dataset.viewerMode === 'surface' && !document.querySelector('#viewer-stage').hasAttribute('aria-busy')", arg=next_patch, timeout=60_000)
    modes = page.evaluate('siteTravelModes')
    assert 'surface' in modes and 'map' in modes and modes.index('surface') < modes.index('map'), modes
    expect(toggle).to_be_visible()
    assert page.locator('#landing-suggestions-list').inner_text() == first_results
    expect(page.locator('#surface-paths')).to_be_visible()
    page.check('#surface-paths')
    page.click('#space-year-mode')
    page.select_option('#space-month', '6')
    for body in ['sun', 'earth']:
        page.click(f'#surface-primary-{body}')
        # Regression: Find Sun/Earth aimed at the mission time in whole-year mode.
        expect(page.locator(f'#surface-guide-{body}')).to_be_hidden()
    page.uncheck('#surface-paths')
    expect(page.locator('#surface-labels')).to_be_hidden()
    expect(page.locator('#surface-guides')).to_be_hidden()
    page.click('#space-mission-mode')
    page.click('[data-viewer="orbit"]')
    settled('orbit')
    assert page.locator('#landing-suggestions-list').inner_text() == first_results
    print('PASS: patch opens Surface; changing patch travels through the map; annual guides and shortlist persist', flush=True)

    page.fill('#landing-max-slope', '0.1')
    page.locator('#landing-max-slope').dispatch_event('change')
    patches()
    assert page.locator('#landing-suggestions-status').inner_text()
    page.fill('#landing-max-slope', '10')
    page.locator('#landing-max-slope').dispatch_event('change')
    patches()
    page.select_option('#duration', '168')
    patches()
    expect(page.locator('#landing-suggestions-window')).to_contain_text('8 Dec 2026')
    page.fill('#landing-date', '2026-12-25')
    page.locator('#landing-date').dispatch_event('change')
    patches()
    expect(page.locator('#landing-suggestions-window')).to_contain_text('1 Jan 2027')
    toggle.uncheck()
    expect(page.locator('#landing-suggestions')).to_be_hidden()
    print('PASS: slope and mission edits recalculate the shortlist; explicit toggle hides it', flush=True)

    tool('viewer-analysis')
    page.check('#mission-heat-south')
    page.check('#layer-sun')
    page.check('#layer-earth')
    expect(page.locator('#coverage-intersection-note')).to_be_visible()
    page.check('#layer-power')
    expect(page.locator('#power-details')).to_be_visible()
    page.check('#layer-overlap')
    expect(page.locator('#map-color-metric')).to_be_visible()
    page.select_option('#map-color-metric', 'overlap')
    expect(page.locator('#mission-heat-results')).to_be_visible(timeout=120_000)
    page.uncheck('#layer-shadows')
    assert page.locator('#model').input_value() == 'reference'
    page.check('#layer-shadows')
    assert page.locator('#model').input_value() == 'terrain'
    for layer in ['sun', 'earth', 'power', 'overlap']:
        page.uncheck('#layer-' + layer)
    page.uncheck('#mission-heat-south')
    print('PASS: intersection filters, South Pole scope, power/overlap metrics and crater shadows', flush=True)

    page.select_option('#site-group', 'clps')
    expect(page.locator('#future-clps-note')).to_be_visible()
    assert page.locator('#rank-list button').count() > 0
    page.select_option('#site-group', 'all')
    page.fill('#site-search', 'Apollo 12')
    assert page.locator('#rank-list button').count() == 1
    page.fill('#site-search', '')
    tool('named-features')
    expect(page.locator('#feature-search')).to_be_enabled(timeout=60_000)
    page.fill('#feature-search', 'Tycho')
    page.locator('#feature-results button').first.click()
    expect(page.locator('#feature-evaluate')).to_be_visible()
    tool('custom-coordinates')
    page.fill('#latitude', '-84.79')
    page.fill('#longitude', '29.2')
    page.click('#coordinates button')
    page.wait_for_function("document.querySelector('#space-site').value.startsWith('custom-')", timeout=60_000)
    custom = page.locator('#space-site').input_value()
    page.click('#pick-compare-a')
    assert page.locator('#compare-a').input_value() == custom
    page.select_option('#compare-b', 'apollo-12')
    page.click('.mission-tools a[href="#compare-heading"]')
    expect(page.locator('#compare-result')).to_be_visible()
    page.locator('#compare-schedule > summary').click()
    before = page.locator('#compare-time').input_value()
    page.click('#delay-b')
    assert page.locator('#compare-time').input_value() != before
    page.click('#same-date')
    assert page.locator('#compare-time').input_value() == before
    with page.expect_download() as download:
        page.click('#export')
    assert download.value.suggested_filename.endswith('.csv')
    print('PASS: CLPS/catalog search, gazetteer, custom coordinates, two-site/date comparison and CSV', flush=True)

    page.fill('#landing-date', '2028-01-01')
    page.locator('#landing-date').dispatch_event('change')
    page.select_option('#duration', 'year')
    assert float(page.locator('#space-time').get_attribute('max')) == 8784
    page.fill('#landing-date', '2027-01-01')
    page.locator('#landing-date').dispatch_event('change')
    assert float(page.locator('#space-time').get_attribute('max')) == 8760
    page.select_option('#duration', '24')
    page.set_viewport_size({'width': 390, 'height': 900})
    expect(toggle).to_be_visible()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    tool('custom-coordinates')
    expect(page.locator('#latitude')).to_be_visible()
    page.click('#mode-explore')
    expect(page.locator('#explore')).to_be_visible()
    page.click('#explore-open')
    expect(page.locator('#mission')).to_be_visible()
    assert not errors, errors
    print('PASS: leap/common year, mobile controls, Explore to Planner; no uncaught JavaScript errors', flush=True)


def audit_comparison(page, url):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(url + '#compare-heading', wait_until='domcontentloaded')
    page.wait_for_function("document.querySelector('#compare-c').value.startsWith('landing-patch-')", timeout=120_000)
    assert not page.locator('#layer-landing-suggestions').is_checked(), 'Comparison must load without showing the shortlist'
    page.locator('#compare').scroll_into_view_if_needed()
    page.wait_for_function("document.querySelectorAll('.compare-moon[data-ready=true]').length === 3", timeout=60_000)
    defaults = [page.locator('#compare-' + key).input_value() for key in ['a', 'b', 'c']]
    for key, mode in [('a', 'earth'), ('b', 'solar'), ('c', 'balanced')]:
        winner = page.locator(f'#landing-{mode}-winner').inner_text().split(' · ')
        expect(page.locator(f'#compare-view-{key} .compare-site-name')).to_have_text(winner[0])
        expect(page.locator(f'#compare-view-{key} .compare-totals')).to_contain_text(winner[1])
        assert page.locator(f'#compare-view-{key} canvas').evaluate("c => c.getContext('webgl').getError()") == 0
        assert page.locator(f'#compare-view-{key} canvas').evaluate("c => {const gl=c.getContext('webgl'),p=gl.getParameter(gl.CURRENT_PROGRAM);return gl.getUniform(p,gl.getUniformLocation(p,'dayNight'))}") == 1
    assert page.locator('#compare-view-a').bounding_box()['x'] < page.locator('#compare-view-b').bounding_box()['x'] < page.locator('#compare-view-c').bounding_box()['x']
    radius = "c => {const gl=c.getContext('webgl');return gl.getUniform(gl.getParameter(gl.CURRENT_PROGRAM),gl.getUniformLocation(gl.getParameter(gl.CURRENT_PROGRAM),'sphereRadius'))}"
    before = page.locator('#compare-view-c canvas').evaluate(radius)
    page.locator('#compare-view-c').get_by_role('button', name='Zoom in', exact=True).click()
    assert page.locator('#compare-view-c canvas').evaluate(radius) > before
    page.locator('#compare-view-c').get_by_role('button', name='South Pole', exact=True).click()
    page.locator('#compare-view-c').get_by_role('button', name='Center site', exact=True).click()
    page.locator('#compare-scrub').evaluate("e => {e.value=12;e.dispatchEvent(new Event('input',{bubbles:true}))}")
    times = page.locator('.compare-scenario time').evaluate_all('nodes => nodes.map(n => n.dateTime)')
    assert len(set(times)) == 1 and '12:00:00' in times[0], times
    page.select_option('#compare-c', 'apollo-12')
    assert [page.locator('#compare-' + key).input_value() for key in ['a', 'b']] == defaults[:2]
    page.select_option('#duration', '168')
    page.wait_for_function("document.querySelector('#compare-b').value.startsWith('landing-patch-')", timeout=120_000)
    assert page.locator('#compare-c').input_value() == 'apollo-12'
    expect(page.locator('#compare-choice-c')).to_have_text('Your selected site')
    page.locator('#compare-schedule > summary').click()
    page.fill('#compare-time-c', '')
    page.locator('#compare-time-c').dispatch_event('change')
    expect(page.locator('#compare-error')).to_be_visible()
    expect(page.locator('#compare-view-c .compare-moon')).to_be_hidden()
    expect(page.locator('#compare-view-a .compare-moon')).to_be_visible()
    page.click('#compare-recommended')
    expect(page.locator('#compare-error')).to_be_hidden()
    assert page.locator('#compare-c').input_value().startswith('landing-patch-')
    page.locator('#compare-view-c').get_by_role('button', name='Open Surface', exact=True).click()
    page.wait_for_function("document.querySelector('#space').dataset.viewerMode==='surface' && !document.querySelector('#viewer-stage').hasAttribute('aria-busy')", timeout=60_000)
    assert page.locator('#space-site').input_value() == page.locator('#compare-c').input_value()
    page.set_viewport_size({'width': 390, 'height': 900})
    page.locator('#compare').scroll_into_view_if_needed()
    assert page.evaluate('document.documentElement.scrollWidth <= innerWidth')
    assert page.locator('#compare-view-c').bounding_box()['y'] > page.locator('#compare-view-b').bounding_box()['y']
    assert not errors, errors
    print('PASS: three automatic recommendations, matching totals, original Moon zoom, shared clock, manual selection, invalid date, reset, Surface and mobile', flush=True)


def audit_empty_comparison(page, url):
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.route('**/data/landing-patches.json.gz', lambda route: route.fulfill(content_type='application/gzip', body=gzip.compress(b'[]')))
    page.goto(url + '#compare-heading', wait_until='domcontentloaded')
    expect(page.locator('#compare-recommendation-status')).to_contain_text('No sampled patch meets', timeout=60_000)
    assert all(page.locator('#compare-' + key).input_value() == '' for key in ['a', 'b', 'c'])
    assert page.locator('.compare-moon:visible').count() == 0
    page.select_option('#compare-c', 'apollo-12')
    expect(page.locator('#compare-view-c .compare-site-name')).to_have_text('Apollo 12')
    assert not errors, errors
    print('PASS: no eligible patches show an honest empty state; manual comparison still works', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--url', help='existing navigator server; omit for bundled-only checks')
    parser.add_argument('--browser-path', help='optional path to an installed Chrome/Chromium')
    args = parser.parse_args()
    server = None
    try:
        if not args.url:
            server = ThreadingHTTPServer(('127.0.0.1', 0), partial(BundledHandler, directory=str(ROOT)))
            Thread(target=server.serve_forever, daemon=True).start()
        url = args.url or f'http://127.0.0.1:{server.server_port}/'
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(executable_path=args.browser_path, headless=True, args=['--enable-unsafe-swiftshader'])
            try:
                page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                audit(page, url)
                page.close()
                page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                audit_comparison(page, url)
                page.close()
                page = browser.new_page(viewport={'width': 1440, 'height': 1000}, reduced_motion='reduce')
                audit_empty_comparison(page, url)
            finally:
                browser.close()
    finally:
        if server:
            server.shutdown()
            server.server_close()


if __name__ == '__main__':
    main()
