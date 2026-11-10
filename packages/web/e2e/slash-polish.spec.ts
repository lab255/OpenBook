import {test, expect} from '@playwright/test';
import {mkdirSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

// Web-vitals session windows: <1s between shifts, <=5s per window.
function cls(shifts: {t: number; value: number; recent: boolean}[]): number {
  let maximum = 0, sum = 0, start = 0, previous = -Infinity;
  for (const shift of shifts.filter(s => !s.recent)) {
    if (shift.t - previous > 1000 || shift.t - start > 5000) { sum = 0; start = shift.t; }
    sum += shift.value; previous = shift.t; maximum = Math.max(maximum, sum);
  }
  return maximum;
}

// Standalone editor-lab: no shared :4400 data server or worker teardown.
// Proxy end = the rAF AFTER a visible row is observed (one paint opportunity).
// This is deliberately not a compositor presentation timestamp.
for (const width of [1280, 390]) {
  test(`slash polish at ${width}`, async ({page, browser}) => {
    const phase = process.env.SLASH_POLISH_PHASE ?? 'after';
    const windows: {kind: string; start: number; end: number}[] = [];
    const now = () => page.evaluate(() => performance.now());
    const out = resolve('../../_captures/card-10', phase, String(width));
    mkdirSync(out, {recursive: true});
    await page.setViewportSize({width, height: 800});
    await page.addInitScript(() => {
      localStorage.setItem('obe-lab-doc', JSON.stringify({blocks: [{id: 'polish', type: 'paragraph'}]}));
      localStorage.setItem('theme', 'light');
    });
    await page.goto('/editor-lab');
    const input = page.locator('.obe-text').first();
    await expect(input).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    await input.click();
    const reset = async () => {
      await page.keyboard.press('Escape');
      await input.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(180);
    };
    const menu = page.getByRole('listbox', {name: 'Insert a block'});
    for (let i = 0; i < 3; i++) {
      await page.keyboard.press('/'); await expect(menu).toBeVisible();
      await page.waitForTimeout(300); await reset();
    }
    await page.evaluate(() => {
      const state = {samples: [] as number[], shifts: [] as {t: number; value: number; recent: boolean}[]};
      Object.assign(window, {__slashPolish: state});
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const e = entry as PerformanceEntry & {value: number; hadRecentInput: boolean};
          state.shifts.push({t: e.startTime, value: e.value, recent: e.hadRecentInput});
        }
      }).observe({type: 'layout-shift', buffered: false});
      document.addEventListener('keydown', event => {
        if (event.key !== '/') return;
        const start = event.timeStamp;
        const visible = () => {
          const row = document.querySelector<HTMLElement>('.obe-slash-item');
          const menu = row?.closest<HTMLElement>('.obe-slash');
          if (!row || !menu || getComputedStyle(menu).visibility === 'hidden'
              || Number(getComputedStyle(menu).opacity) <= 0.01 || !row.getBoundingClientRect().height) {
            requestAnimationFrame(visible); return;
          }
          requestAnimationFrame(() => state.samples.push(performance.now() - start));
        };
        requestAnimationFrame(visible);
      }, true);
    });
    for (let i = 0; i < 12; i++) {
      const start = await now();
      await page.keyboard.press('/'); await expect(menu).toBeVisible();
      await page.waitForTimeout(300);
      windows.push({kind: 'open', start, end: await now()});
      await reset();
    }
    await page.keyboard.press('/'); await expect(menu).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({path: `${out}/open.png`});
    const geometry = await menu.evaluate(el => ({
      menu: el.getBoundingClientRect().toJSON(),
      rows: [...el.querySelectorAll<HTMLElement>('.obe-slash-item')].map(row => ({
        label: row.textContent, rect: row.getBoundingClientRect().toJSON(),
        weight: getComputedStyle(row.querySelector('.obe-slash-label')!).fontWeight,
      })),
      headings: [...el.querySelectorAll('.obe-slash-group')].map(el => el.textContent),
    }));
    // Record a real keyboard transition at ordinary speed, not a frozen clock.
    const trace = await page.evaluate(async () => {
      const menu = document.querySelector<HTMLElement>('.obe-slash')!;
      const rows = [...menu.querySelectorAll<HTMLElement>('.obe-slash-item')];
      const glide = menu.querySelector<HTMLElement>('[data-fluid-hover]');
      const from = rows[0].getBoundingClientRect().toJSON();
      const to = rows[1].getBoundingClientRect().toJSON();
      const frames: unknown[] = [];
      const record = () => frames.push({t: performance.now(),
        rect: glide?.getBoundingClientRect().toJSON(),
        count: menu.querySelectorAll('[data-fluid-hover]').length,
        opacity: glide && getComputedStyle(glide).opacity,
        same: !!glide && menu.querySelector('[data-fluid-hover]') === glide,
        textTransform: getComputedStyle(rows[1].querySelector('.obe-slash-label')!).transform,
      });
      record();
      document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
      await new Promise<void>(resolve => {
        const start = performance.now();
        const frame = () => {record(); if (performance.now() - start < 400) requestAnimationFrame(frame); else resolve();};
        requestAnimationFrame(frame);
      });
      return {from, to, frames};
    });
    await page.screenshot({path: `${out}/selected.png`});
    for (let i = 0; i < 24; i++) await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(400);
    const scrolled = await menu.evaluate(el => {
      const row = el.querySelector('[aria-selected="true"]')!;
      const r = row.getBoundingClientRect(), m = el.getBoundingClientRect();
      return {scrollTop: el.scrollTop, row: r.toJSON(), menu: m.toJSON(),
        visible: r.top >= m.top && r.bottom <= m.bottom,
        glide: el.querySelector('[data-fluid-hover]')?.getBoundingClientRect().toJSON()};
    });
    await page.screenshot({path: `${out}/keyboard-scroll.png`});
    await reset(); await page.keyboard.press('/'); await expect(menu).toBeVisible();
    await page.waitForTimeout(300);
    const queryStart = await now();
    await page.keyboard.type('form');
    await page.waitForTimeout(400);
    windows.push({kind: 'query', start: queryStart, end: await now()});
    await page.screenshot({path: `${out}/form-query.png`});
    const query = await menu.innerText();
    // Long-label fixture: preserve the real row/icon/font and replace only text.
    const long = await menu.locator('.obe-slash-item').first().evaluate(el => {
      const label = el.querySelector<HTMLElement>('.obe-slash-label')!;
      const previous = label.textContent;
      label.textContent = 'A very long custom form block name that must remain legible on a narrow screen';
      const result = {row: el.getBoundingClientRect().toJSON(), label: label.getBoundingClientRect().toJSON(),
        whiteSpace: getComputedStyle(label).whiteSpace, overflow: getComputedStyle(label).overflow,
        fontSize: getComputedStyle(label).fontSize};
      return {...result, previous};
    });
    await page.waitForTimeout(400);
    const wrappedGlide = await menu.evaluate(el => el.querySelector('[data-fluid-hover]')?.getBoundingClientRect().toJSON());
    await page.screenshot({path: `${out}/long-label.png`});
    // Escape while the highlight is travelling, then reopen on a clean query.
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Escape');
    await expect(menu).toHaveCount(0);
    await reset(); await page.keyboard.press('/'); await expect(menu).toBeVisible();
    await page.waitForTimeout(300);
    const jump = await page.evaluate(async () => {
      const menu = document.querySelector<HTMLElement>('.obe-slash')!;
      const frames: {row: DOMRect; glide?: DOMRect; count: number; visible: boolean}[] = [];
      for (const key of ['ArrowUp', 'ArrowDown']) {
        document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', {key, bubbles: true}));
        await new Promise<void>(resolve => {
          const start = performance.now();
          const frame = () => {
            const row = menu.querySelector('[aria-selected="true"]')!.getBoundingClientRect();
            const glide = menu.querySelector('[data-fluid-hover]')?.getBoundingClientRect();
            const bounds = menu.getBoundingClientRect();
            frames.push({row: row.toJSON(), glide: glide?.toJSON(),
              count: menu.querySelectorAll('[data-fluid-hover]').length,
              visible: row.top >= bounds.top && row.bottom <= bounds.bottom});
            if (performance.now() - start < 300) requestAnimationFrame(frame); else resolve();
          };
          requestAnimationFrame(frame);
        });
      }
      return frames;
    });
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.keyboard.press('ArrowDown'); await page.waitForTimeout(300);
    const reduced = await menu.evaluate(el => ({
      row: el.querySelector('[aria-selected="true"]')?.getBoundingClientRect().toJSON(),
      glide: el.querySelector('[data-fluid-hover]')?.getBoundingClientRect().toJSON(),
      animation: getComputedStyle(el).animationName,
    }));
    const timing = await page.evaluate(() => (window as unknown as {__slashPolish: {
      samples: number[]; shifts: {t: number; value: number; recent: boolean}[];
    }}).__slashPolish);
    const samples = timing.samples.slice(0, 12);
    const sorted = [...samples].sort((a, b) => a - b);
    expect(samples).toHaveLength(12);
    const result = {phase, width, browser: browser.version(), route: '/editor-lab',
      method: 'warm Next dev route; native keydown event.timeStamp to rAF after visible row; paint-opportunity proxy, not compositor',
      samples, median: (sorted[5] + sorted[6]) / 2, min: sorted[0], max: sorted.at(-1),
      shifts: timing.shifts, cls: cls(timing.shifts),
      rawShiftSum: timing.shifts.reduce((sum, s) => sum + s.value, 0),
      geometry, trace, scrolled, query, long, wrappedGlide, reduced, jump,
      shiftWindows: windows.map(w => {
        const shifts = timing.shifts.filter(s => s.t >= w.start && s.t <= w.end);
        return {...w, cls: cls(shifts),
          raw: shifts.reduce((sum, s) => sum + s.value, 0)};
      })};
    writeFileSync(`${out}/measurements.json`, JSON.stringify(result, null, 2));
    console.log(`CARD10 ${phase} ${width}: median=${result.median} min=${result.min} max=${result.max} CLS=${result.cls} raw=${result.rawShiftSum}`);
    if (phase === 'after') {
      expect(geometry.rows.every(row => row.rect.height === 28)).toBe(true);
      expect(scrolled.visible).toBe(true);
      expect(scrolled.scrollTop).toBeGreaterThan(0);
      expect(result.cls).toBeLessThan(0.1);
      const frames = trace.frames as {rect: DOMRect; count: number; same: boolean; opacity: string; textTransform: string}[];
      expect(frames.every(f => f.count === 1 && f.same && f.opacity === '1')).toBe(true);
      expect(frames.some(f => f.rect.top > trace.from.top + 0.5 && f.rect.top < trace.to.top - 0.5)).toBe(true);
      expect(frames.every(f => f.textTransform === 'none')).toBe(true);
      for (const key of ['top', 'left', 'width', 'height'] as const) {
        expect(Math.abs(frames.at(-1)!.rect[key] - trace.to[key])).toBeLessThan(0.5);
        expect(Math.abs(scrolled.glide![key] - scrolled.row[key])).toBeLessThan(0.5);
        expect(Math.abs(reduced.glide![key] - reduced.row![key])).toBeLessThan(0.5);
      }
      expect(reduced.animation).toBe('none');
      expect(long.row.height).toBeGreaterThan(28);
      expect(long.whiteSpace).toBe('normal');
      expect(Math.abs(wrappedGlide!.height - long.row.height)).toBeLessThan(0.5);
      expect(jump.every(f => f.count === 1 && f.visible)).toBe(true);
      for (const frame of jump) {
        expect(Math.abs(frame.glide!.top - frame.row.top)).toBeLessThan(0.5);
        expect(Math.abs(frame.glide!.height - frame.row.height)).toBeLessThan(0.5);
      }
    }
    await page.close();
    await page.video()?.saveAs(`${out}/interaction.webm`);
  });
}
