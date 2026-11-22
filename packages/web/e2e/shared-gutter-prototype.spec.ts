import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {APIRequestContext, Page} from '@playwright/test';
import {expect, test as base} from './fixtures';

// Optional dedicated server for evidence runs alongside other workers.
// Preserve the inherited automatic-worker fixture at runtime.
const workerOptions = {scope: 'worker' as const, auto: true};
const test = process.env.GUTTER_EVIDENCE_SERVER ? base.extend({
  // eslint-disable-next-line no-empty-pattern -- Playwright requires a destructured fixture argument.
  dataServer: [async ({}, use) => { await use(process.env.GUTTER_EVIDENCE_SERVER!); }, workerOptions],
}) : base;
async function newPage(request: APIRequestContext, server: string, name: string, data: Record<string, unknown>) {
  const response = await request.post(`${server}/api/pages`, {data: {name, data}});
  expect(response.ok()).toBeTruthy();
  return (await response.json()).id as string;
}

test.use({freshWorkspace: true});
const output = process.env.GUTTER_EVIDENCE_DIR;
const content = [
  {id: 'alpha', type: 'paragraph', text: 'Alpha paragraph — local editing controls.'},
  {id: 'beta', type: 'paragraph', text: 'Beta paragraph — the next editable block.'},
  {id: 'heading', type: 'heading', props: {level: 2}, text: 'Heading boundary'},
  {id: 'long', type: 'paragraph', text: 'Long block. '.repeat(70)},
  {id: 'last', type: 'paragraph', text: 'Last paragraph — controls for this row.'},
];
const snapshot = (blocks: unknown[]) => ({editor: 'blocks', blockdoc: {blocks}, editorjs: {blocks: []}, values: [], names: []});
async function state(page: Page) {
  return page.evaluate(() => ({
    rows: [...document.querySelectorAll<HTMLElement>('main .obe-root .obe-row')].map(row => {
      const g = row.querySelector<HTMLElement>(':scope > .obe-gutter');
      return {id: row.dataset.blockRow, hover: row.matches(':hover:not(:has(.obe-row:hover))'),
        opacity: g ? +getComputedStyle(g).opacity : 0,
        selected: row.classList.contains('obe-row-selected'), fill: getComputedStyle(row).backgroundColor,
        before: getComputedStyle(row, '::before').content};
    }),
    shared: [...document.querySelectorAll<HTMLElement>('[data-shared-gutter]')].map(el => ({
      owner: el.dataset.owner, visible: getComputedStyle(el).visibility, rect: el.getBoundingClientRect().toJSON(), transform: getComputedStyle(el).transform,
    })),
    focus: (document.activeElement as HTMLElement)?.outerHTML.slice(0, 220),
  }));
}
async function geometry(page: Page) {
  return page.locator('main .obe-root > .obe-row').evaluateAll(rows => rows.map(row => {
    const r = row.getBoundingClientRect(), h = row.querySelector('.obe-handle')!.getBoundingClientRect();
    return {id: (row as HTMLElement).dataset.blockRow!, left: r.left, top: r.top, bottom: r.bottom, x: h.x + h.width / 2, y: h.y + h.height / 2};
  }));
}
async function startTravelTrace(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as {travelFrames: unknown[]; traceUntil: number};
    w.travelFrames = []; w.traceUntil = performance.now() + 350;
    const frame = () => {
      const layer = document.querySelector<HTMLElement>('[data-shared-gutter]');
      w.travelFrames.push({t: performance.now(), owner: layer?.dataset.owner,
        visible: layer && getComputedStyle(layer).visibility, y: layer?.getBoundingClientRect().y});
      if (performance.now() < w.traceUntil) requestAnimationFrame(frame);
    }; requestAnimationFrame(frame);
  });
}
async function readTravelTrace(page: Page) {
  return page.evaluate(() => (window as unknown as {travelFrames: {t: number; owner?: string; visible: string; y: number}[]}).travelFrames);
}
for (const width of [1280, 390]) test(`shared gutter ruling evidence ${width}`, async ({page, request, dataServer}, testInfo) => {
  test.setTimeout(180_000);
  const out = output ? join(output, String(width)) : testInfo.outputPath('evidence');
  mkdirSync(out, {recursive: true});
  const evidence: Record<string, unknown> = {viewport: {width, height: 900}, method: 'first rAF observing visible feedback after capture-phase pointermove; paint opportunity proxy, NOT compositor timestamp'};
  const save = () => writeFileSync(join(out, 'raw.json'), JSON.stringify(evidence, null, 2));
  await page.setViewportSize({width, height: 900});
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    localStorage.setItem('hud', JSON.stringify({sideNav: {open: false, docked: false}}));
  });
  const id = await newPage(request, dataServer, 'Gutter targeting prototype', snapshot(content));
  for (const mode of ['local', 'shared']) {
    await page.goto(`/?page=${id}${mode === 'shared' ? '&gutterHandle=shared' : ''}`);
    const rows = page.locator('main .obe-root > .obe-row');
    await expect(rows).toHaveCount(5);
    await page.waitForTimeout(2500);
    await page.evaluate(() => {
      const w = window as unknown as {gutterShifts: {value: number; hadRecentInput: boolean}[]}; w.gutterShifts = [];
      new PerformanceObserver(list => {
        for (const entry of list.getEntries()) {
          const shift = entry as PerformanceEntry & {value: number; hadRecentInput: boolean};
          w.gutterShifts.push({value: shift.value, hadRecentInput: shift.hadRecentInput});
        }
      }).observe({type: 'layout-shift'});
    });
    const bounds = await geometry(page);
    if (mode === 'shared') expect(bounds).toEqual((evidence.local as {bounds: unknown}).bounds);
    const data: Record<string, unknown> = {bounds}; evidence[mode] = data;
    await page.mouse.move(bounds[0].left + 40, bounds[0].y);
    await page.waitForTimeout(200);
    await page.screenshot({path: join(out, `${mode}-body.png`)});
    await page.mouse.move(bounds[0].x, bounds[0].y);
    await page.waitForTimeout(250);
    await page.screenshot({path: join(out, `${mode}-gutter-row0.png`)});
    // Identical vertical dead-band path: body -> row0 grip -> row1 grip.
    await page.mouse.move(bounds[0].x, bounds[1].y, {steps: 8});
    await page.waitForTimeout(250);
    await expect(rows).toHaveCount(5);
    await page.screenshot({path: join(out, `${mode}-dead-band-row1.png`)});
    data.deadBand = await state(page); save();
    if (mode === 'shared') await expect(page.locator('[data-shared-gutter]')).toHaveAttribute('data-owner', 'beta');
    else expect((await state(page)).rows.every(r => r.opacity === 0)).toBeTruthy();
    const column = [];
    for (const row of bounds) {
      if (row.y >= 890) continue;
      await page.mouse.move(row.x, row.y, {steps: 8}); await page.waitForTimeout(220);
      column.push(await state(page));
    }
    data.column = column;
    const fresh = [];
    for (const row of bounds.filter(r => r.y < 890)) {
      await page.mouse.move(0, 0); await page.waitForTimeout(120);
      await page.mouse.move(row.x, row.y); await page.waitForTimeout(220);
      fresh.push(await state(page));
    }
    data.fresh = fresh; save();
    // Ten trials per mode: genuine outside->gutter pointer entry. Baseline
    // failure is censored at 150ms, never mislabeled as a fast feedback time.
    const timings = [];
    for (let run = 0; run < 10; run++) {
      await page.mouse.move(0, 0); await page.waitForTimeout(120);
      await page.evaluate(() => {
        const w = window as unknown as {gutterTiming: number | null | string}; w.gutterTiming = 'pending';
        document.addEventListener('pointermove', () => {
          const start = performance.now();
          const frame = () => {
            const shared = document.querySelector<HTMLElement>('[data-shared-gutter][data-owner]');
            const local = [...document.querySelectorAll<HTMLElement>('.obe-row > .obe-gutter')].some(g => +getComputedStyle(g).opacity > 0);
            if (local || (shared && getComputedStyle(shared).visibility === 'visible')) w.gutterTiming = performance.now() - start;
            else if (performance.now() - start >= 150) w.gutterTiming = null;
            else requestAnimationFrame(frame);
          }; requestAnimationFrame(frame);
        }, {once: true, capture: true});
      });
      await page.mouse.move(bounds[1].x, bounds[1].y);
      await page.waitForTimeout(180);
      timings.push(await page.evaluate(() => (window as unknown as {gutterTiming: number | null}).gutterTiming));
    }
    data.timings = timings; save();
    // Real Tab enters the first gutter from the preceding native trigger.
    // Text Tab is an editor command (indent), not sequential navigation: record
    // that limitation without repeatedly mutating the comparison document.
    await page.mouse.move(0, 0);
    await rows.first().locator('.obe-handle').focus();
    await page.keyboard.press('Shift+Tab');
    data.beforeTabEntry = await state(page);
    await page.keyboard.press('Tab');
    data.tabEntry = await state(page); save();
    await expect(rows.first().locator('.obe-handle')).toBeFocused();
    await page.keyboard.press('Tab');
    data.tabToText = await state(page);
    await rows.nth(1).locator('.obe-handle').focus();
    await page.mouse.move(bounds[0].x, bounds[0].y); await page.waitForTimeout(220);
    data.focusCompetition = await state(page);
    await page.mouse.move(bounds[0].left + 60, bounds[0].y); await page.waitForTimeout(180);
    data.focusBodyCompetition = await state(page);
    await page.screenshot({path: join(out, `${mode}-keyboard-competition.png`)});
    await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    await rows.first().scrollIntoViewIfNeeded();
    if (width === 1280) {
      // Body sweep is sampled continuously, not only after transitions settle.
      await page.mouse.move(0, 0); await page.waitForTimeout(200);
      await page.evaluate(() => {
        const w = window as unknown as {sweep: unknown[]; sweeping: boolean}; w.sweep = []; w.sweeping = true;
        const frame = () => { if (!w.sweeping) return;
          const rows = [...document.querySelectorAll<HTMLElement>('main .obe-root > .obe-row')];
          w.sweep.push({hover: rows.findIndex(r => r.matches(':hover')), visible: rows.filter(r => +getComputedStyle(r.querySelector('.obe-gutter')!).opacity > 0).length}); requestAnimationFrame(frame);
        }; requestAnimationFrame(frame);
      });
      for (let y = bounds[0].top + 2; y < bounds[4].bottom - 2; y += 6) { await page.mouse.move(bounds[0].left + 100, y); await page.waitForTimeout(6); }
      const sweep = await page.evaluate(() => { const w = window as unknown as {sweep: {hover: number; visible: number}[]; sweeping: boolean}; w.sweeping = false; return w.sweep; });
      data.sweep = sweep;
      expect(Math.max(...sweep.map(frame => frame.visible))).toBeLessThanOrEqual(2);
      expect([...new Set(sweep.map(frame => frame.hover).filter(index => index >= 0))]).toEqual([0, 1, 2, 3, 4]);
      await page.mouse.move(bounds[3].x, bounds[3].bottom - 4); await page.waitForTimeout(250);
      data.long = {pointerY: bounds[3].bottom - 4, leadY: bounds[3].y, state: await state(page)};
      await page.screenshot({path: join(out, `${mode}-long-block.png`)});
    }
    if (mode === 'shared') {
      await page.mouse.move(0, 0); await page.waitForTimeout(200);
      await page.mouse.move(bounds[0].x, bounds[0].y); await page.waitForTimeout(220);
      await page.evaluate(() => { (window as unknown as {sharedNode: Element | null}).sharedNode = document.querySelector('[data-shared-gutter]'); });
      await startTravelTrace(page);
      await page.mouse.move(bounds[1].x, bounds[1].y);
      await page.waitForTimeout(30);
      data.travel = await state(page);
      await page.screenshot({path: join(out, 'shared-travel.png')});
      data.travelFrames = await readTravelTrace(page);
      // Reverse before settling: persistent object, current position retargeted.
      await page.mouse.move(bounds[0].x, bounds[0].y); await page.waitForTimeout(250);
      data.reversal = await state(page);
      data.persistent = await page.evaluate(() => (window as unknown as {sharedNode: Element | null}).sharedNode === document.querySelector('[data-shared-gutter]'));
      await page.emulateMedia({reducedMotion: 'reduce'});
      await page.waitForTimeout(80);
      await startTravelTrace(page);
      await page.mouse.move(bounds[1].x, bounds[1].y); await page.waitForTimeout(200);
      data.reduced = await state(page);
      const reducedFrames = await readTravelTrace(page); data.reducedFrames = reducedFrames;
      const lead0 = bounds[0].y - 12, lead1 = bounds[1].y - 12;
      expect(reducedFrames.every(frame => Math.abs(frame.y - lead0) < 0.1 || Math.abs(frame.y - lead1) < 0.1)).toBeTruthy();
      save();
      const shared = page.locator('[data-shared-gutter]');
      const target = await rows.nth(1).locator(':scope > .obe-gutter').boundingBox();
      expect((await shared.boundingBox())!.y).toBeCloseTo(target!.y, 1);
      await page.screenshot({path: join(out, 'shared-reduced-jump.png')});
      await page.emulateMedia({reducedMotion: 'no-preference'});
      // Shared control activates the owning row's real action menu.
      await page.mouse.click(bounds[1].x, bounds[1].y);
      await expect(page.getByRole('menu').last()).toBeVisible();
      data.action = await state(page);
      expect((await state(page)).rows.filter(r => r.selected).map(r => r.id)).toEqual(['beta']);
      await page.keyboard.press('Escape');
    }
    if (width === 390) {
      await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
      await rows.last().scrollIntoViewIfNeeded();
      await page.mouse.move(0, 0); await page.waitForTimeout(220);
      const lastHandle = (await rows.last().locator('.obe-handle').boundingBox())!;
      await page.mouse.move(lastHandle.x + lastHandle.width / 2, lastHandle.y + lastHandle.height / 2);
      await page.waitForTimeout(220);
      data.lastRowAfterScroll = await state(page);
      if (mode === 'shared') await expect(page.locator('[data-shared-gutter]')).toHaveAttribute('data-owner', 'last');
      await page.screenshot({path: join(out, `${mode}-last-row-scrolled.png`)});
    }
    data.layoutShifts = await page.evaluate(() => (window as unknown as {gutterShifts: unknown[]}).gutterShifts);
    await expect(rows).toHaveCount(5); save();
  }
});

test('shared gutter nested and drag evidence', async ({page, request, dataServer}, testInfo) => {
  test.setTimeout(120_000);
  const out = output ? join(output, 'nested-drag') : testInfo.outputPath('evidence'); mkdirSync(out, {recursive: true});
  const evidence: Record<string, unknown> = {};
  const save = () => writeFileSync(join(out, 'raw.json'), JSON.stringify(evidence, null, 2));
  await page.setViewportSize({width: 1280, height: 900});
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark'); localStorage.setItem('hud', JSON.stringify({sideNav: {open: false, docked: false}}));
  });
  const nested = [
    {id: 'alpha', type: 'paragraph', text: 'Drag this paragraph using its gutter.'},
    {id: 'group', type: 'group', props: {name: 'Nested group'}, children: [
      {id: 'ga', type: 'paragraph', text: 'Nested row A'}, {id: 'gb', type: 'paragraph', text: 'Nested row B'},
    ]},
    {id: 'columns', type: 'columns', children: [
      {id: 'col1', type: 'column', children: [{id: 'ca', type: 'paragraph', text: 'Left column A'}, {id: 'cb', type: 'paragraph', text: 'Left column B'}]},
      {id: 'col2', type: 'column', children: [{id: 'cc', type: 'paragraph', text: 'Right column A'}, {id: 'cd', type: 'paragraph', text: 'Right column B'}]},
    ]},
    {id: 'omega', type: 'paragraph', text: 'Drop after this paragraph.'},
  ];
  for (const mode of ['local', 'shared']) {
    const id = await newPage(request, dataServer, `Nested targeting ${mode}`, snapshot(nested));
    await page.goto(`/?page=${id}${mode === 'shared' ? '&gutterHandle=shared' : ''}`);
    await expect(page.locator('main .obe-root .obe-row')).toHaveCount(10); await page.waitForTimeout(400);
    const data: Record<string, unknown> = {}; evidence[mode] = data;
    const probes = [];
    for (const rowId of ['ga', 'gb', 'ca', 'cb', 'cc', 'cd']) {
      const row = page.locator(`main .obe-row[data-block-row="${rowId}"]`);
      await expect(row.locator(':scope > .obe-gutter')).toHaveClass(/obe-gutter-nested/);
      const box = (await row.boundingBox())!;
      const h = (await row.locator('.obe-handle').boundingBox())!;
      await page.mouse.move(box.x + 65, box.y + 12); await page.waitForTimeout(220);
      const body = await state(page);
      expect(body.rows.filter(r => r.opacity > 0).map(r => r.id)).toEqual([rowId]);
      await page.mouse.move(h.x + h.width / 2, h.y + h.height / 2); await page.waitForTimeout(250);
      probes.push({rowId, body, gutter: await state(page)});
      await page.screenshot({path: join(out, `${mode}-${rowId}.png`)});
    }
    data.probes = probes;
    const nestedColumn = [];
    for (const [firstId, secondId] of [['ga', 'gb'], ['ca', 'cb'], ['cc', 'cd']]) {
      const first = page.locator(`main .obe-row[data-block-row="${firstId}"]`);
      const second = page.locator(`main .obe-row[data-block-row="${secondId}"]`);
      const b = (await first.boundingBox())!, h0 = (await first.locator('.obe-handle').boundingBox())!, h1 = (await second.locator('.obe-handle').boundingBox())!;
      await page.mouse.move(b.x + 60, b.y + 12); await page.waitForTimeout(160);
      await page.mouse.move(h0.x + h0.width / 2, h0.y + h0.height / 2); await page.waitForTimeout(220);
      await page.mouse.move(h1.x + h1.width / 2, h1.y + h1.height / 2, {steps: 8}); await page.waitForTimeout(220);
      const hit = await page.evaluate(({x, y}) => {
        const element = document.elementFromPoint(x, y);
        return {role: element?.getAttribute('role'), className: element?.className};
      }, {x: h1.x + h1.width / 2, y: h1.y + h1.height / 2});
      nestedColumn.push({firstId, secondId, hit, state: await state(page)});
      data.nestedColumn = nestedColumn; save();
      if (mode === 'shared' && secondId !== 'cd') await expect(page.locator('[data-shared-gutter]')).toHaveAttribute('data-owner', secondId);
      if (mode === 'shared' && secondId === 'cd') {
        // Observed falsifier, deliberately NOT an adoption assertion: preserving
        // divider priority leaves a right-column vertical gutter dead band.
        expect(hit.role).toBe('separator');
        expect((await state(page)).shared[0].owner).toBeUndefined();
        data.knownLimitation = 'Right-column vertical gutter traversal hits the resize divider and has no shared handle; owner must resolve this before adoption.';
      }
      await page.screenshot({path: join(out, `${mode}-vertical-${firstId}-${secondId}.png`)});
    }
    data.nestedColumn = nestedColumn; save();
    // Actual divider remains the native pointer target; the moving paint yields.
    const divider = page.getByRole('separator', {name: 'Resize columns 1 and 2'});
    const dividerBox = (await divider.boundingBox())!;
    await page.mouse.move(dividerBox.x + dividerBox.width / 2, dividerBox.y + dividerBox.height - 2);
    await page.waitForTimeout(200);
    data.divider = await state(page);
    data.dividerHit = await page.evaluate(({x, y}) => document.elementFromPoint(x, y)?.getAttribute('role'), {x: dividerBox.x + dividerBox.width / 2, y: dividerBox.y + dividerBox.height - 2});
    expect(data.dividerHit).toBe('separator');
    // Native HTML5 drag from the actual handle, including an in-flight indicator.
    await page.mouse.move(0, 0); await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
    const first = page.locator('main .obe-row[data-block-row="alpha"]');
    const last = page.locator('main .obe-row[data-block-row="omega"]');
    const grip = (await first.locator('.obe-handle').boundingBox())!;
    const from = (await first.boundingBox())!; const to = (await last.boundingBox())!;
    await page.mouse.move(from.x + 50, from.y + 12); await page.waitForTimeout(120);
    await page.mouse.move(grip.x + grip.width / 2, grip.y + grip.height / 2); await page.waitForTimeout(220);
    await page.evaluate(() => {
      const w = window as unknown as {dragTrace: unknown[]}; w.dragTrace = [];
      for (const type of ['dragstart', 'drop', 'dragend']) document.addEventListener(type, event => {
        const e = event as DragEvent; w.dragTrace.push({type, id: (e.target as HTMLElement).closest('[data-block-row]')?.getAttribute('data-block-row'), payload: e.dataTransfer?.getData('text/plain')});
      }, {capture: true, once: true});
    });
    await page.mouse.down();
    await page.mouse.move(grip.x + 12, grip.y + 15, {steps: 4});
    await page.mouse.move(to.x + 100, to.y + to.height - 3, {steps: 12});
    await page.mouse.move(to.x + 101, to.y + to.height - 3); await page.waitForTimeout(150);
    data.dragIndicator = await last.getAttribute('class');
    data.dragRect = {before: to, during: await last.boundingBox()};
    await page.screenshot({path: join(out, `${mode}-drag-indicator.png`)});
    await page.mouse.up(); await page.waitForTimeout(250);
    data.dragTrace = await page.evaluate(() => (window as unknown as {dragTrace: unknown[]}).dragTrace);
    data.order = await page.locator('main .obe-root > .obe-row').evaluateAll(rows => rows.map(row => row.getAttribute('data-block-row')));
    save();
    expect(data.dragIndicator).toContain('obe-drop-below');
    expect(data.order).toEqual(['group', 'columns', 'omega', 'alpha']);
    await expect(page.locator('main .obe-root .obe-row')).toHaveCount(10);
    // Observe the existing Tab editing command on this disposable document,
    // after all matched captures and drag checks have completed.
    const moved = page.locator('main .obe-row[data-block-row="alpha"]');
    await page.mouse.move(0, 0); await moved.locator('.obe-handle').focus();
    await page.keyboard.press('Tab');
    data.nativeTabToText = await state(page);
    await page.keyboard.press('Tab');
    data.nativeTextTab = {state: await state(page), className: await moved.getAttribute('class')};
    expect(await moved.getAttribute('class')).toContain('obe-indent-1');
    save();
  }
});

test('shared gutter rapid activation and return evidence', async ({page, request, dataServer}, testInfo) => {
  const out = output ? join(output, 'rapid') : testInfo.outputPath('evidence'); mkdirSync(out, {recursive: true});
  await page.setViewportSize({width: 1280, height: 900});
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark'); localStorage.setItem('hud', JSON.stringify({sideNav: {open: false, docked: false}}));
  });
  const id = await newPage(request, dataServer, 'Rapid gutter targeting', snapshot(content));
  await page.goto(`/?page=${id}&gutterHandle=shared`);
  const rows = page.locator('main .obe-root > .obe-row'); await expect(rows).toHaveCount(5); await page.waitForTimeout(500);
  const bounds = await geometry(page);
  await page.mouse.move(bounds[0].x, bounds[0].y); await page.waitForTimeout(220);
  await page.evaluate(() => {
    const w = window as unknown as {events: unknown[]}; w.events = [];
    for (const type of ['pointermove', 'pointerdown', 'click']) document.addEventListener(type, event => {
      w.events.push({type, t: performance.now(), row: (event.target as Element).closest('[data-block-row]')?.getAttribute('data-block-row')});
    }, {capture: true});
  });
  // No settle wait: native hit testing must already belong to the destination.
  await page.mouse.move(bounds[1].x, bounds[1].y);
  await page.mouse.down(); await page.mouse.up();
  await expect(page.getByRole('menu').last()).toBeVisible();
  const activation = await state(page);
  expect(activation.rows.filter(row => row.selected).map(row => row.id)).toEqual(['beta']);
  await page.screenshot({path: join(out, 'rapid-beta-menu.png')});
  const events = await page.evaluate(() => (window as unknown as {events: unknown[]}).events);
  await page.keyboard.press('Escape'); await page.mouse.move(0, 0);
  await page.mouse.move(bounds[2].x, bounds[2].y); await page.waitForTimeout(220);
  const returnDuringMenuExit = await state(page);
  await page.screenshot({path: join(out, 'return-during-menu-exit.png')});
  await page.mouse.move(0, 0); await page.mouse.move(bounds[2].x, bounds[2].y); await page.waitForTimeout(220);
  const returnAfterExit = await state(page);
  await expect(page.locator('[data-shared-gutter]')).toHaveAttribute('data-owner', 'heading');
  await expect(rows).toHaveCount(5);
  writeFileSync(join(out, 'raw.json'), JSON.stringify({events, activation, returnDuringMenuExit, returnAfterExit}, null, 2));
});
