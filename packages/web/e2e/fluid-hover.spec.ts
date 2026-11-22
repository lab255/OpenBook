import {expect, test} from './fixtures';
import {SERVER} from './seed';
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
async function transit(page: Page, surface: string, rowSelector: string, reduced: boolean, keyboard = false) {
  const rows = page.locator(rowSelector);
  await rows.first().hover();
  await page.waitForTimeout(500);
  const trace = await page.evaluate(async ({surface, rowSelector, keyboard}) => {
    const overlay = document.querySelector<HTMLElement>(`[data-fluid-hover="${surface}"]`)!;
    const rows = [...document.querySelectorAll<HTMLElement>(rowSelector)];
    const from = rows[0].getBoundingClientRect().toJSON();
    const to = rows[1].getBoundingClientRect().toJSON();
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
      rows[1].dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse'}));
      rows[1].focus();
    }
    await new Promise<void>((resolve) => {
      const sample = () => {
        record();
        if (performance.now() - start < 450) requestAnimationFrame(sample); else resolve();
      };
      requestAnimationFrame(sample);
    });
    return {from, to, samples};
  }, {surface, rowSelector, keyboard});
  console.log(`FF4 ${surface} reduced=${reduced} method=per-rAF getBoundingClientRect() ${JSON.stringify({from: trace.from, to: trace.to, samples: trace.samples.map(({t, rect}) => ({t, rect}))})}`);
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
    console.log(`FF4 ${surface}: continuity + overlap PASS; method=per-rAF getBoundingClientRect()`);
  }
  // Capture-only driver: advance the browser clock 16 ms per 160 ms wall
  // time. This slows rAF/JS springs tenfold without changing a motion token.
  if (process.env.FF4_CAPTURE) {
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

for (const reduced of [false, true]) {
  test(`four fluid chrome surfaces; reduced=${reduced}`, async ({page, request}) => {
    if (process.env.FF4_CAPTURE) { test.setTimeout(180_000); await page.clock.install(); }
    await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
    const schema = {formId: 'ff4', fields: [], confirmation: {message: 'Thanks'}, submissionKey: 'abcdefghijklmnopqrstuv', enabled: true};
    const response = await request.post(`${SERVER}/api/pages`, {data: {name: 'FF4 hover', data: {
      editor: 'blocks', blockdoc: {blocks: [{id: 'form', type: 'form', props: {...schema, schema}}]}, editorjs: {blocks: []}, values: [], names: [],
    }}});
    expect(response.ok()).toBe(true);
    const {id} = await response.json();
    await page.goto(`/?page=${id}`);
    await expect(page.locator('[data-form-builder]')).toBeVisible();
    await transit(page, 'form', '[data-form-palette-kind]', reduced);
    await page.getByRole('button', {name: 'Page actions', exact: true}).click();
    await transit(page, 'dropdown', '[role="menuitem"]', reduced);
    await page.keyboard.press('Escape');
    await page.keyboard.press('ControlOrMeta+k');
    await expect(page.locator('[cmdk-input]')).toBeVisible();
    await page.locator('[cmdk-input]').fill('New');
    await transit(page, 'command', '[cmdk-item]:not([data-disabled="true"])', reduced, true);
    await page.keyboard.press('Escape');
    await page.locator('.obe-kit-form').hover();
    await page.getByRole('button', {name: 'Block settings'}).click();
    await page.getByRole('combobox').last().click();
    await transit(page, 'select', '[role="option"]', reduced);
  });
}
