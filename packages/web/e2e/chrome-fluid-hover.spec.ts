import {expect, test} from './fixtures';
import {SERVER} from './seed';
import {SIDEBAR_HOVER} from '../../ui/src/lib/sidebarStyles';
import type {Page} from '@playwright/test';

test.use({freshWorkspace: true});

type HoverRect = Pick<DOMRect, 'left' | 'right' | 'top' | 'bottom'>;

// Sampled continuity, not overlap duration: a spring may straddle for one frame.
function assertContinuity(surface: string, from: HoverRect, to: HoverRect, samples: {rect: HoverRect}[]) {
  const within = (rect: HoverRect, row: HoverRect) => rect.left >= row.left - 0.5
    && rect.right <= row.right + 0.5 && rect.top >= row.top - 0.5 && rect.bottom <= row.bottom + 0.5;
  const firstTo = samples.findIndex(({rect}) => within(rect, to));
  expect(firstTo, `${surface}: continuity reaches the incoming row`).toBeGreaterThan(0);
  const lastFrom = samples.slice(0, firstTo).findLastIndex(({rect}) => within(rect, from));
  expect(lastFrom, `${surface}: continuity starts within the outgoing row`).toBeGreaterThanOrEqual(0);
  const horizontal = Math.abs(to.left - from.left) > Math.abs(to.top - from.top);
  const low = horizontal ? 'left' : 'top';
  const high = horizontal ? 'right' : 'bottom';
  const center = (rect: HoverRect) => (rect[low] + rect[high]) / 2;
  const direction = Math.sign(center(to) - center(from));
  const boundary = direction > 0 ? (from[high] + to[low]) / 2 : (from[low] + to[high]) / 2;
  const crossing = samples.slice(lastFrom, firstTo + 1);
  expect(crossing.slice(1, -1).some(({rect}) => rect[low] < boundary - 0.5 && rect[high] > boundary + 0.5),
    `${surface}: continuity requires an intermediate boundary-spanning frame`).toBe(true);
  for (let i = 1; i < crossing.length; i++) {
    expect(direction * (center(crossing[i].rect) - center(crossing[i - 1].rect)),
      `${surface}: continuity progresses monotonically along the travel axis`).toBeGreaterThanOrEqual(-0.5);
  }
}

test('continuity guard rejects discontinuous and reversing synthetic traces', () => {
  const rect = (top: number): HoverRect => ({left: 0, right: 100, top, bottom: top + 32});
  const from = rect(0), to = rect(40);
  const samples = (...positions: number[]) => positions.map((top) => ({rect: rect(top)}));
  expect(() => assertContinuity('synthetic snap', from, to, samples(0, 40)))
    .toThrow('synthetic snap: continuity requires an intermediate boundary-spanning frame');
  // An earlier overlap cannot excuse a later snap after returning to `from`.
  expect(() => assertContinuity('synthetic stray overlap', from, to, samples(0, 20, 0, 40)))
    .toThrow('synthetic stray overlap: continuity requires an intermediate boundary-spanning frame');
  expect(() => assertContinuity('synthetic reversal', from, to, samples(0, 24, 12, 40)))
    .toThrow('synthetic reversal: continuity progresses monotonically along the travel axis');
  assertContinuity('synthetic glide', from, to, samples(0, 12, 24, 40));
});

// Measurement method: per-requestAnimationFrame getBoundingClientRect().
// The transform is ONLY a diagnostic self-check, never the position source.
async function transit(page: Page, surface: string, rowSelector: string, reduced: boolean, keyboard = false, targetIndex = 1) {
  const rows = page.locator(rowSelector);
  await rows.first().evaluate(el => (el as HTMLElement).focus({preventScroll: true}));
  await rows.first().hover();
  await page.waitForTimeout(500);
  const trace = await page.evaluate(async ({surface, rowSelector, keyboard, targetIndex, reduced}) => {
    const overlay = document.querySelector<HTMLElement>(`[data-fluid-hover="${surface}"]`)!;
    const rows = [...document.querySelectorAll<HTMLElement>(rowSelector)];
    const from = rows[0].getBoundingClientRect().toJSON();
    const to = rows[targetIndex].getBoundingClientRect().toJSON();
    const samples: {t: number; rect: DOMRect; transform: string; count: number; same: boolean}[] = [];
    const start = performance.now();
    const record = () => samples.push({t: performance.now() - start, rect: overlay.getBoundingClientRect().toJSON(),
      transform: getComputedStyle(overlay).transform,
      count: document.querySelectorAll(`[data-fluid-hover="${surface}"]`).length,
      same: document.querySelector(`[data-fluid-hover="${surface}"]`) === overlay});
    // Capture the outgoing endpoint on rAF before triggering travel, even if
    // the first post-input frame already contains spring movement.
    await new Promise<void>((resolve) => requestAnimationFrame(() => { record(); resolve(); }));
    if (keyboard) document.querySelector('[cmdk-input]')!.dispatchEvent(new KeyboardEvent('keydown', {key: 'ArrowDown', bubbles: true}));
    else {
      if (!reduced) rows[targetIndex].dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse'}));
      rows[targetIndex].focus({preventScroll: true});
    }
    await new Promise<void>((resolve) => {
      const sample = () => {
        record();
        if (performance.now() - start < 450) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return {from, to, samples};
  }, {surface, rowSelector, keyboard, targetIndex, reduced});
  console.log(`FF4B ${surface} reduced=${reduced} method=per-rAF getBoundingClientRect() ${JSON.stringify({from: trace.from, to: trace.to, samples: trace.samples.map(({t, rect}) => ({t, rect}))})}`);
  const intersects = (a: typeof trace.from, b: typeof trace.from) => a.left < b.right - 0.5 && a.right > b.left + 0.5 && a.top < b.bottom - 0.5 && a.bottom > b.top + 0.5;
  const overlap = trace.samples.filter(({rect}) => intersects(rect, trace.from) && intersects(rect, trace.to));
  expect(trace.samples.every((s) => s.same && s.count === 1), `${surface}: one persistent object`).toBe(true);
  const last = trace.samples.at(-1)!.rect;
  expect(Math.abs(last.top - trace.to.top)).toBeLessThan(1);
  expect(Math.abs(last.left - trace.to.left)).toBeLessThan(1);
  expect(Math.abs(last.width - trace.to.width)).toBeLessThan(1);
  expect(Math.abs(last.height - trace.to.height)).toBeLessThan(1);
  for (const s of trace.samples) {
    if (Math.abs(s.rect.top - trace.from.top) > 1 || Math.abs(s.rect.left - trace.from.left) > 1) {
      expect(s.transform, `${surface}: sampler self-check: rect moved with absent transform`).not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
    }
  }
  if (reduced) {
    expect(overlap, `${surface}: reduced motion has no overlap`).toHaveLength(0);
    const at = (rect: typeof trace.from, endpoint: typeof trace.from) =>
      ['left', 'top', 'width', 'height'].every((key) => Math.abs(rect[key] - endpoint[key]) < 0.5);
    expect(trace.samples.every(({rect}) => at(rect, trace.from) || at(rect, trace.to)),
      `${surface}: reduced motion endpoint-only`).toBe(true);
  }
  else {
    expect(overlap.length, `${surface}: moving rectangle overlaps both rows`).toBeGreaterThan(0);
    assertContinuity(surface, trace.from, trace.to, trace.samples);
    console.log(`FF4B ${surface}: continuity + overlap PASS; method=per-rAF getBoundingClientRect()`);
  }
  // Capture-only driver: advance the browser clock 16 ms per 160 ms wall
  // time. This slows rAF/JS springs tenfold without changing a motion token.
  if (process.env.FF4B_CAPTURE) {
    await page.clock.pauseAt(new Date());
    for (let i = 0; i < 4; i++) {
      const box = (await rows.nth(i % 2).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (let frame = 0; frame < 24; frame++) {
        await page.clock.runFor(16);
        await new Promise((resolve) => setTimeout(resolve, 160));
      }
    }
    await page.clock.resume();
  }
}


// Browser composition includes the negative-z glide, which ancestor-only
// contrast samplers miss. Canvas normalizes CSS colours, then alpha-composites.
async function paintedFill(page: Page, selector: string, surface: string) {
  return page.evaluate(({selector, surface}) => {
    const row = document.querySelector<HTMLElement>(selector)!;
    const glide = document.querySelector<HTMLElement>(`[data-fluid-hover="${surface}"]`)!;
    const ctx = document.createElement('canvas').getContext('2d')!;
    const paint = (color: string) => { ctx.fillStyle = color; ctx.fillRect(0, 0, 1, 1); };
    const ancestors: HTMLElement[] = [];
    for (let el = row.parentElement; el; el = el.parentElement) ancestors.unshift(el);
    paint('white');
    ancestors.forEach(el => paint(getComputedStyle(el).backgroundColor));
    paint(getComputedStyle(glide).backgroundColor);
    paint(getComputedStyle(row).backgroundColor);
    return {rgb: [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3),
      row: getComputedStyle(row).backgroundColor, glide: getComputedStyle(glide).backgroundColor,
      z: getComputedStyle(glide).zIndex, radius: getComputedStyle(row).borderRadius,
      glideRadius: getComputedStyle(glide).borderRadius};
  }, {selector, surface});
}

for (const mode of ['tinted', 'accent']) {
  for (const dark of [false, true]) {
    test(`chrome sidebar pairwise and transit ${mode} dark=${dark}`, async ({page, request, context}) => {
      if (process.env.FF4B_CAPTURE) { test.setTimeout(180_000); await page.clock.install(); }
      const ids: string[] = [];
      for (let i = 0; i < 3; i++) {
        const response = await request.post(`${SERVER}/api/pages`, {data: {name: `FF4b ${i}`, data: {editorjs: {blocks: []}, values: [], names: []}}});
        expect(response.ok()).toBe(true); ids.push((await response.json()).id);
      }
      await context.addInitScript(({ids, mode, dark}) => {
        localStorage.setItem('openbook.favorites', JSON.stringify(ids));
        localStorage.setItem('theme', dark ? 'dark' : 'light');
        localStorage.setItem('openbook.appearance', JSON.stringify({themeId: 'default', sidebar: mode}));
      }, {ids, mode, dark});
      await page.goto(`/?page=${ids[1]}`);
      const selector = '[data-sidebar-rows="favorites"] [data-sidebar-page-row]';
      const rows = page.locator(selector);
      await expect(rows).toHaveCount(3);
      await expect(rows.nth(1)).toHaveAttribute('data-selected', 'true');
      await rows.first().hover(); await page.waitForTimeout(500);
      const hover = await paintedFill(page, `${selector}:nth-child(1)`, 'sidebar-favorites');
      // Exercise SIDEBAR_ACTIVE independently on a real row; selected-row is
      // the production navigation state below. This is an explicit state fixture.
      const original = await rows.nth(1).getAttribute('class');
      await rows.nth(1).evaluate((el, fallback) => {
        el.setAttribute('class', el.getAttribute('class')!.split(' ').filter(c => !c.startsWith('hover:bg-') && !c.startsWith('before:')).join(' ') + ' ' + fallback);
        el.removeAttribute('data-selected');
      }, SIDEBAR_HOVER);
      const activeBase = await rows.nth(1).evaluate(el => getComputedStyle(el).backgroundColor);
      expect(await rows.nth(1).getAttribute('class'), 'active fixture must actually change production classes').not.toBe(original);
      await transit(page, 'sidebar-favorites', selector, false);
      await rows.nth(1).hover(); await page.waitForTimeout(500);
      const active = await paintedFill(page, `${selector}:nth-child(2)`, 'sidebar-favorites');
      const assertActive = (fill: string) => expect(fill, 'active fill survives SIDEBAR_HOVER').toBe(activeBase);
      assertActive(active.row);
      const broken = await page.addStyleTag({content: '[data-sidebar-page-row].bg-sidebar-selection-wash:not([data-selected]):hover { background-color: transparent !important; }'});
      await page.waitForTimeout(500);
      const erased = await rows.nth(1).evaluate(el => getComputedStyle(el).backgroundColor);
      expect(() => assertActive(erased)).toThrow('active fill survives SIDEBAR_HOVER');
      await broken.evaluate(el => el.parentNode!.removeChild(el));
      await page.waitForTimeout(500);
      assertActive(await rows.nth(1).evaluate(el => getComputedStyle(el).backgroundColor));
      console.log(`FF4B ACTIVE ${mode} dark=${dark}: erased active fill RED; restored production fill GREEN`);
      await rows.nth(1).evaluate((el, cls) => { el.setAttribute('class', cls!); el.setAttribute('data-selected', 'true'); }, original);
      expect(await rows.nth(1).getAttribute('class'), 'selected fixture restored exactly').toBe(original);
      await transit(page, 'sidebar-favorites', selector, false);
      await rows.nth(1).hover(); await page.waitForTimeout(500);
      const selected = await paintedFill(page, `${selector}:nth-child(2)`, 'sidebar-favorites');
      console.log(`FF4B PAIR ${mode} dark=${dark} method=canvas alpha composition of computed row+glide+ancestor fills ${JSON.stringify({hover, active, selected})}`);
      expect(new Set([hover, active, selected].map(v => v.rgb.join(','))).size, 'hover/active/selected composed fills').toBe(3);
      for (const fill of [hover, active, selected]) { expect(fill.z).toBe('-1'); expect(fill.radius).toBe(fill.glideRadius); }
      // Real fallback proof: removing the glide restores the retained CSS wash.
      await page.locator('[data-fluid-hover="sidebar-favorites"]').evaluate(el => el.remove());
      await rows.first().hover(); await page.waitForTimeout(500);
      expect(await rows.first().evaluate(el => getComputedStyle(el).backgroundColor)).not.toBe('rgba(0, 0, 0, 0)');
    });
  }
}

for (const reduced of [false, true]) {
  test(`chrome settings rail transit reduced=${reduced}`, async ({page}) => {
    if (process.env.FF4B_CAPTURE) { test.setTimeout(180_000); await page.clock.install(); }
    await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
    await page.goto('/');
    await page.getByRole('button', {name: 'Settings', exact: true}).first().click();
    const selector = '[data-settings-tab]';
    const rows = page.locator(selector);
    await rows.nth(1).click();
    await transit(page, 'settings', selector, reduced);
    await rows.first().hover(); await page.waitForTimeout(500);
    const hover = await paintedFill(page, '[data-settings-tab="general"]', 'settings');
    await rows.nth(1).hover(); await page.waitForTimeout(500);
    const active = await paintedFill(page, '[data-settings-tab][data-active]', 'settings');
    expect(hover.rgb).not.toEqual(active.rgb);
    console.log(`FF4B SETTINGS PAIR method=canvas alpha composition ${JSON.stringify({hover, active})}`);
  });
}

test('chrome sidebar 30-row keyboard reduced motion jumps without traversal', async ({page, request, context}) => {
  await page.emulateMedia({reducedMotion: 'reduce'});
  const ids: string[] = [];
  for (let i = 0; i < 30; i++) {
    const res = await request.post(`${SERVER}/api/pages`, {data: {name: `Long sidebar ${i}`, data: {editorjs: {blocks: []}, values: [], names: []}}});
    expect(res.ok()).toBe(true); ids.push((await res.json()).id);
  }
  await context.addInitScript(ids => localStorage.setItem('openbook.favorites', JSON.stringify(ids)), ids);
  await page.setViewportSize({width: 1280, height: 1600});
  await page.goto(`/?page=${ids[0]}`);
  const selector = '[data-sidebar-rows="favorites"] [data-sidebar-page-row]';
  await expect(page.locator(selector)).toHaveCount(30);
  // Focusable row fixture models a keyboard jump over a long section; input
  // is focusin only (no synthetic pointermove in the reduced-motion sampler).
  await page.locator(selector).evaluateAll(rows => rows.forEach(row => row.setAttribute('tabindex', '0')));
  await transit(page, 'sidebar-favorites', selector, true, false, 29);
});
