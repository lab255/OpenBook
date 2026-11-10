import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {expect, test} from './fixtures';
import {SERVER} from './seed';

test.use({freshWorkspace: true, video: 'on'});

for (const width of [1280, 390]) {
  test(`command polish at ${width}`, async ({page, request, browser}) => {
    test.setTimeout(120_000);
    const stage = process.env.POLISH_STAGE ?? 'after';
    const reduced = process.env.POLISH_REDUCED === '1';
    const out = resolve('../../_captures/card-9', stage, String(width));
    mkdirSync(out, {recursive: true});
    await page.setViewportSize({width, height: 800});
    await page.emulateMedia({colorScheme: 'light', reducedMotion: reduced ? 'reduce' : 'no-preference'});
    let id = '';
    for (let i = 0; i < 30; i++) {
      const res = await request.post(`${SERVER}/api/pages`, {data: {
        name: i === 29 ? 'Zebra reference' : `Polish page ${String(i).padStart(2, '0')}`,
        data: {editorjs: {blocks: []}, values: [], names: []},
      }});
      expect(res.ok()).toBe(true);
      if (!i) id = (await res.json()).id;
    }
    await page.goto(`/?page=${id}`);
    await expect(page.getByRole('button', {name: 'Page actions', exact: true})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const input = page.locator('[cmdk-input]');
    const open = async () => {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(input).toBeVisible();
      await page.waitForTimeout(350);
    };
    const close = async () => {
      await page.keyboard.press('Escape');
      await expect(input).toHaveCount(0);
      await page.waitForTimeout(100);
    };
    for (let i = 0; i < 3; i++) { await open(); await close(); }
    // Warm route and fonts; one browser session. The second rAF is a paint
    // opportunity proxy, NOT compositor presentation or physical scanout.
    await page.evaluate(() => {
      const state = {start: 0, samples: [] as number[], shifts: [] as {t: number; value: number; recent: boolean}[]};
      Object.assign(window, {commandPolish: state});
      document.addEventListener('keydown', event => {
        if (event.key.toLowerCase() !== 'k' || !(event.ctrlKey || event.metaKey)) return;
        state.start = event.timeStamp;
        const poll = () => {
          const row = document.querySelector<HTMLElement>('[cmdk-item]');
          let visible = !!row && row.getBoundingClientRect().height > 0;
          for (let node = row; node; node = node.parentElement) {
            const style = getComputedStyle(node);
            if (Number(style.opacity) === 0 || style.visibility === 'hidden' || style.display === 'none') visible = false;
          }
          if (visible) requestAnimationFrame(() => state.samples.push(performance.now() - state.start));
          else requestAnimationFrame(poll);
        };
        requestAnimationFrame(poll);
      }, true);
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {value: number; hadRecentInput: boolean};
          state.shifts.push({t: shift.startTime, value: shift.value, recent: shift.hadRecentInput});
        }
      }).observe({type: 'layout-shift', buffered: false});
    });
    for (let i = 0; i < 12; i++) { await open(); await close(); }
    await open();
    await page.screenshot({path: `${out}/open.png`});
    const geometry = () => page.evaluate(() => {
      const list = document.querySelector<HTMLElement>('[cmdk-list]')!;
      const selected = document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')!;
      const glide = document.querySelector<HTMLElement>('[data-fluid-hover="command"]')!;
      const r = selected.getBoundingClientRect(), h = glide.getBoundingClientRect();
      const panel = list.closest<HTMLElement>('[role="dialog"]')!;
      const nodes = [panel, ...panel.querySelectorAll<HTMLElement>('*')];
      const offTokenDurations = nodes.flatMap(el => ['animationDuration', 'transitionDuration'].flatMap(property =>
        getComputedStyle(el)[property as 'animationDuration' | 'transitionDuration'].split(',').map(v => Number.parseFloat(v)*1000)
          .filter(ms => ![0,60,80,120,160,240].includes(ms))));
      const decorativeOpacity = [panel.querySelector('[cmdk-input-wrapper] > svg')!, panel.querySelector(':scope > button')!]
        .map(el => ({opacity: getComputedStyle(el).opacity, color: getComputedStyle(el).color}));
      return {list: list.getBoundingClientRect().toJSON(), row: r.toJSON(), glide: h.toJSON(),
        offTokenDurations, decorativeOpacity,
        drift: Math.max(Math.abs(r.left-h.left), Math.abs(r.top-h.top), Math.abs(r.width-h.width), Math.abs(r.height-h.height)),
        minHeight: getComputedStyle(selected).minHeight, weight: getComputedStyle(selected).fontWeight,
        headings: [...document.querySelectorAll('[cmdk-group-heading]')].map(el => ({text: el.textContent, transform: getComputedStyle(el).textTransform})),
        hoverFills: [...document.querySelectorAll('[cmdk-item]')].filter(el => [...el.classList].some(c => /^hover:bg-/.test(c))).length,
        count: document.querySelectorAll('[data-fluid-hover="command"]').length};
    });
    const full = await geometry();
    const queryStart = await page.evaluate(() => performance.now());
    await input.fill('Zebra');
    await expect(page.locator('[cmdk-item]').filter({hasText: 'Zebra reference'}).first()).toBeVisible();
    await page.waitForTimeout(650);
    const filtered = await geometry();
    const queryEnd = await page.evaluate(() => performance.now());
    await page.screenshot({path: `${out}/query.png`});
    const clearStart = await page.evaluate(() => performance.now());
    await input.fill('');
    await page.waitForTimeout(500);
    const clearEnd = await page.evaluate(() => performance.now());
    const cleared = await geometry();
    await page.screenshot({path: `${out}/cleared.png`});
    const transit = await page.evaluate(async () => {
      const input = document.querySelector<HTMLElement>('[cmdk-input]')!;
      const glide = document.querySelector<HTMLElement>('[data-fluid-hover="command"]')!;
      const from = glide.getBoundingClientRect().toJSON();
      const frames: {t: number; top: number; bottom: number; opacity: string; count: number; same: boolean; filter: string; rowTransform: string}[] = [];
      input.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
      const start = performance.now();
      await new Promise<void>(done => {
        const frame = () => {
          const row = document.querySelector<HTMLElement>('[cmdk-item][aria-selected="true"]')!;
          const r = glide.getBoundingClientRect();
          frames.push({t: performance.now()-start, top: r.top, bottom: r.bottom, opacity: getComputedStyle(glide).opacity,
            count: document.querySelectorAll('[data-fluid-hover="command"]').length,
            same: document.querySelector('[data-fluid-hover="command"]') === glide,
            filter: getComputedStyle(row).filter, rowTransform: getComputedStyle(row).transform});
          if (performance.now()-start < 350) requestAnimationFrame(frame); else done();
        }; requestAnimationFrame(frame);
      });
      return {from, to: document.querySelector('[cmdk-item][aria-selected="true"]')!.getBoundingClientRect().toJSON(), frames};
    });
    for (let i = 0; i < 27; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(450);
    const scrolled = await geometry();
    await page.screenshot({path: `${out}/scrolled.png`});
    await close();
    // Escape during entry. Inspect actual opacity to expose restart flashes.
    const interruption = await page.evaluate(async () => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'k', ctrlKey: true, bubbles: true}));
      let panel: HTMLElement | null = null;
      await new Promise<void>(done => {
        const frame = () => {
          panel = document.querySelector<HTMLElement>('[role="dialog"]');
          if (panel && Number(getComputedStyle(panel).opacity) > 0) done(); else requestAnimationFrame(frame);
        }; requestAnimationFrame(frame);
      });
      const before = Number(getComputedStyle(panel!).opacity);
      panel!.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape', bubbles: true}));
      const samples: number[] = [];
      await new Promise<void>(done => {
        const frame = () => {
          if (!panel!.isConnected) { done(); return; }
          samples.push(Number(getComputedStyle(panel!).opacity));
          if (samples.length < 30) requestAnimationFrame(frame); else done();
        }; requestAnimationFrame(frame);
      });
      return {before, samples, removed: !panel!.isConnected};
    });
    const metrics = await page.evaluate(({queryStart, queryEnd, clearStart, clearEnd}) => {
      const state = (window as unknown as {commandPolish: {samples: number[]; shifts: {t: number; value: number; recent: boolean}[]}}).commandPolish;
      const samples = state.samples.slice(0, 12);
      const sorted = [...samples].sort((a,b) => a-b);
      const query = state.shifts.filter(s => s.t >= queryStart && s.t <= queryEnd);
      const opening = state.shifts.filter(s => s.t < queryStart);
      const clearing = state.shifts.filter(s => s.t >= clearStart && s.t <= clearEnd);
      const sum = (entries: typeof query, recent = false) => entries.filter(s => recent || !s.recent).reduce((n,s) => n+s.value, 0);
      return {samples, median: (sorted[5]+sorted[6])/2, min: sorted[0], max: sorted[11],
        cls: {open: sum(opening), query: sum(query), clear: sum(clearing), openIncludingRecentInput: sum(opening,true),
          queryIncludingRecentInput: sum(query,true), clearIncludingRecentInput: sum(clearing,true), entries: state.shifts}};
    }, {queryStart, queryEnd, clearStart, clearEnd});
    const environment = {browser: browser.version(), node: process.version, singleProcess: process.env.SINGLE_PROCESS === '1',
      buildId: await page.evaluate(() => JSON.parse(document.getElementById('__NEXT_DATA__')!.textContent!).buildId)};
    const result = {stage, width, reduced, environment,
      method: 'warm dev route; native keydown event.timeStamp to second rAF with visible row; proxy only',
      ...metrics, full, filtered, queryTopShift: filtered.list.top-full.list.top, cleared, transit, scrolled, interruption};
    writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2));
    console.log(`CARD9 ${JSON.stringify(result)}`);
    expect(metrics.samples).toHaveLength(12);
    expect(full.count).toBe(1);
    expect(transit.frames.every(f => f.same && f.count === 1 && Number(f.opacity) > 0)).toBe(true);
    expect(filtered.drift).toBeLessThan(1);
    expect(scrolled.drift).toBeLessThan(1);
    if (!stage.startsWith('before')) {
      expect(Math.abs(result.queryTopShift)).toBeLessThan(1);
      expect(metrics.cls.query).toBeLessThan(0.1);
      expect(metrics.cls.queryIncludingRecentInput).toBeLessThan(0.1);
      expect(metrics.cls.clear).toBeLessThan(0.1);
      expect(metrics.cls.clearIncludingRecentInput).toBeLessThan(0.1);
      expect(full.weight).toBe('500');
      expect(full.minHeight).toBe('28px');
      expect(full.hoverFills).toBe(0);
      // The pre-existing global reduced-motion override is 0.01ms; record it,
      // but do not misreport it as an ordinary palette timing regression.
      if (reduced) expect(full.offTokenDurations.every(ms => ms === 0.01)).toBe(true);
      else expect(full.offTokenDurations).toHaveLength(0);
      expect(full.decorativeOpacity.every(el => el.opacity === '1')).toBe(true);
      expect(cleared.row.top).toBeGreaterThanOrEqual(cleared.list.top);
      expect(cleared.row.bottom).toBeLessThanOrEqual(cleared.list.bottom - 20);
      expect(scrolled.row.bottom).toBeLessThanOrEqual(scrolled.list.bottom - 20);
      const boundary = (transit.from.bottom + transit.to.top) / 2;
      if (reduced) {
        expect(transit.frames.every(f => Math.abs(f.top-transit.from.top) < 0.5 || Math.abs(f.top-transit.to.top) < 0.5),
          'reduced motion uses endpoints only').toBe(true);
      } else {
        expect(transit.frames.some(f => f.top < boundary - 0.5 && f.bottom > boundary + 0.5),
          'the persistent highlight crosses the row boundary instead of snapping').toBe(true);
      }
      expect(transit.frames.every(f => f.filter === 'none' && f.rowTransform === 'none')).toBe(true);
    }
  });
}
