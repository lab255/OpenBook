import type {APIRequestContext, Locator, Page, TestInfo} from '@playwright/test';
import {expect, test} from './fixtures';
import {newPage, SERVER} from './seed';

// Compare the paired gutter captures for all four pane geometries.
// The baseline removes the page reserve and forces the old reveal policy;
// its narrow inset includes an extra clearance to reproduce the prior clip.
test.use({freshWorkspace: true});

const snapshot = (text: string) => ({
  editorjs: {blocks: [{type: 'paragraph', data: {text}}]},
  values: [],
  names: [],
});

async function pageWithBlock(request: APIRequestContext, name: string, database = false): Promise<string> {
  const pageId = await newPage(request, name, snapshot(`${name} body`));
  if (database) {
    const response = await request.post(`${SERVER}/api/databases`, {
      data: {
        pageId,
        name: `${name} database`,
        schema: {properties: [], views: [{id: 'v_table', name: 'Table', type: 'table', filters: [], sorts: []}]},
      },
    });
    expect(response.ok()).toBeTruthy();
  }
  return pageId;
}

type GutterGeometry = {
  gutterLeft: number;
  gripLeft: number;
  gripRight: number;
  clipLeft: number;
  clipRight: number;
};

async function gutterGeometry(grip: Locator): Promise<GutterGeometry> {
  return grip.evaluate((element) => {
    const gripRect = element.getBoundingClientRect();
    const gutterRect = element.closest('.obe-gutter')!.getBoundingClientRect();
    let clipLeft = 0;
    let clipRight = document.documentElement.clientWidth;
    let ancestor = element.parentElement;
    while (ancestor) {
      const overflowX = getComputedStyle(ancestor).overflowX;
      if (overflowX === 'hidden' || overflowX === 'clip' || overflowX === 'auto' || overflowX === 'scroll') {
        const rect = ancestor.getBoundingClientRect();
        clipLeft = Math.max(clipLeft, rect.left);
        clipRight = Math.min(clipRight, rect.right);
      }
      ancestor = ancestor.parentElement;
    }
    return {gutterLeft: gutterRect.left, gripLeft: gripRect.left, gripRight: gripRect.right, clipLeft, clipRight};
  });
}

async function captureBeforeAfter(
  page: Page,
  testInfo: TestInfo,
  scope: Locator,
  name: string,
  options: {priorNarrowFallback?: boolean; expectPlus: boolean; expectPriorClip: boolean},
): Promise<void> {
  const root = scope.locator('.obe-root').first();
  const row = root.locator('.obe-row').first();
  const gutter = row.locator('.obe-gutter').first();
  const grip = gutter.getByRole('button', {name: 'Drag to move, click for actions'});
  const add = gutter.getByRole('button', {name: 'Add a block below'});
  await expect(row).toBeVisible();

  const priorGutter = options.priorNarrowFallback
    ? `
      .obe-gutter:not(.obe-gutter-nested) { left: calc(-1 * (var(--obe-handle-w) + 2 * var(--obe-gutter-clear))) !important; }
      .obe-gutter:not(.obe-gutter-nested) > button:first-child { display: none !important; }
    `
    : `
      .obe-gutter:not(.obe-gutter-nested) { left: calc(-1 * var(--obe-gutter-room)) !important; }
      .obe-gutter:not(.obe-gutter-nested) > button:first-child { display: grid !important; }
    `;
  const baseline = await page.addStyleTag({
    content: `
      .obe-editor-pane .max-w-none { padding-inline: 0 !important; }
      ${priorGutter}
    `,
  });

  await row.hover();
  await expect(grip).toBeVisible();
  const before = await gutterGeometry(grip);
  if (options.expectPriorClip) expect(before.gutterLeft).toBeLessThan(before.clipLeft);
  await page.screenshot({path: testInfo.outputPath(`${name}-before.png`), animations: 'disabled'});

  await baseline.evaluate((element) => element.parentNode?.removeChild(element));
  await row.hover();
  await expect(grip).toBeVisible();
  if (options.expectPlus) await expect(add).toBeVisible();
  else await expect(add).toBeHidden();

  const after = await gutterGeometry(grip);
  expect(after.gripLeft).toBeGreaterThanOrEqual(after.clipLeft - 0.5);
  expect(after.gripRight).toBeLessThanOrEqual(after.clipRight + 0.5);
  expect(await gutter.evaluate((element) => getComputedStyle(element).pointerEvents)).toBe('auto');
  expect(await grip.getAttribute('draggable')).toBe('true');
  await page.screenshot({path: testInfo.outputPath(`${name}-after.png`), animations: 'disabled'});
}

test(
  'manager capture: centered standard page at 1024px',
  {tag: ['@editor', '@manager-verified']},
  async ({page, request}, testInfo) => {
    await page.setViewportSize({width: 1024, height: 800});
    await page.addInitScript(() => {
      // A docked sidebar stays in document flow even when `open` is false.
      // Undock it so this capture really exercises a 1024px document pane.
      localStorage.setItem('hud', JSON.stringify({sideNav: {open: false, docked: false}}));
    });
    const pageId = await pageWithBlock(request, 'BB-6 standard');
    await page.goto(`/?page=${pageId}`);
    await captureBeforeAfter(page, testInfo, page.locator('main'), 'bb6-standard-1024', {
      expectPlus: true,
      expectPriorClip: false,
    });
  },
);

test(
  'manager capture: full-width database page at 1440px',
  {tag: ['@editor', '@database', '@manager-verified']},
  async ({page, request}, testInfo) => {
    await page.setViewportSize({width: 1440, height: 800});
    await page.addInitScript(() => {
      localStorage.setItem('hud', JSON.stringify({sideNav: {open: false, docked: false}}));
    });
    const pageId = await pageWithBlock(request, 'BB-6 full database', true);
    await page.goto(`/?page=${pageId}`);
    await expect(page.locator('main .obe-root')).toHaveClass(/obe-full/);
    const margins = await page.locator('main .obe-root').evaluate((root) => {
      const pane = root.closest('.obe-editor-pane')!.getBoundingClientRect();
      const rect = root.getBoundingClientRect();
      return {left: rect.left - pane.left, right: pane.right - rect.right};
    });
    expect(margins).toEqual({left: 90, right: 90});
    await testInfo.attach('dsx7-full-width-margins.json', {body: JSON.stringify(margins), contentType: 'application/json'});
    await captureBeforeAfter(page, testInfo, page.locator('main'), 'bb6-full-database-1440', {
      expectPlus: true,
      expectPriorClip: true,
    });
  },
);

test(
  'manager capture: 420px split pane in a wide window',
  {tag: ['@editor', '@shell', '@manager-verified']},
  async ({page, request}, testInfo) => {
    await page.setViewportSize({width: 1400, height: 800});
    const primaryId = await pageWithBlock(request, 'BB-6 split primary');
    const splitId = await pageWithBlock(request, 'BB-6 split secondary');
    await page.goto(`/?page=${primaryId}&split=${splitId}`);

    const pane = page.locator('[data-split-pane]');
    await expect(pane).toBeVisible();
    const box = (await pane.boundingBox())!;
    const divider = pane.getByRole('separator');
    const dividerBox = (await divider.boundingBox())!;
    const startX = dividerBox.x + dividerBox.width / 2;
    const startY = dividerBox.y + dividerBox.height / 2;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    // Move from the actual pointer-down coordinate. Targeting from the pane's
    // left edge ignores the divider's half-width and leaves the pane ~3px wide.
    await page.mouse.move(startX + box.width - 420, startY, {steps: 5});
    await page.mouse.up();
    await expect.poll(async () => Math.round((await pane.boundingBox())!.width)).toBe(420);

    await captureBeforeAfter(page, testInfo, pane, 'bb6-split-pane-420', {
      expectPlus: false,
      expectPriorClip: true,
    });
  },
);

test(
  'manager capture: standard page in a 600px window',
  {tag: ['@editor', '@manager-verified']},
  async ({page, request}, testInfo) => {
    await page.setViewportSize({width: 600, height: 800});
    const pageId = await pageWithBlock(request, 'BB-6 narrow window');
    await page.goto(`/?page=${pageId}`);
    await captureBeforeAfter(page, testInfo, page.locator('main'), 'bb6-window-600', {
      priorNarrowFallback: true,
      expectPlus: false,
      expectPriorClip: true,
    });
  },
);

test('DSX-7: block chrome resolves audit geometry without selection layout shifts', {tag: ['@editor']}, async ({page, request}, testInfo) => {
  const pageId = await newPage(request, 'DSX-7 geometry', {
    editorjs: {blocks: [
      {type: 'paragraph', data: {text: 'First line'}},
      {type: 'paragraph', data: {text: 'Second line'}},
      ...[1, 2, 3].map((level) => ({type: 'header', data: {text: `Heading ${level}`, level}})),
      {type: 'callout', data: {text: 'Callout'}},
      {type: 'list', data: {items: ['List item']}},
      {type: 'checklist', data: {items: [{text: 'Todo item', checked: false}]}},
    ]},
    values: [], names: [],
  });
  await page.goto(`/?page=${pageId}`);
  const rows = page.locator('main .obe-root > .obe-row');
  await expect(rows).toHaveCount(8);
  const geometry = await rows.evaluateAll((elements) => elements.map((row) => {
    const rect = row.getBoundingClientRect();
    const gutter = row.querySelector('.obe-gutter')!;
    const handle = row.querySelector('.obe-handle')!.getBoundingClientRect();
    const text = row.querySelector('.obe-text')!.getBoundingClientRect();
    row.classList.add('obe-row-selected');
    const selected = row.getBoundingClientRect();
    const overlay = getComputedStyle(row, '::before');
    const result = {
      type: row.getAttribute('data-block-type'),
      top: parseFloat(getComputedStyle(gutter).top),
      height: rect.height,
      handleWidth: handle.width, handleHeight: handle.height,
      textStart: text.left - rect.left,
      shift: selected.height - rect.height,
      overlayLeft: parseFloat(overlay.left),
      overlayTop: parseFloat(overlay.top),
      pointerEvents: overlay.pointerEvents,
      shadow: getComputedStyle(row).boxShadow,
    };
    row.classList.remove('obe-row-selected');
    return result;
  }));
  await testInfo.attach('dsx7-geometry.json', {body: JSON.stringify(geometry, null, 2), contentType: 'application/json'});
  // Callout gutter target moved 16 → 20 with the DSX-2 callout top padding (0.75rem → 1rem); still centred on the first line.
  for (const [index, target] of [4, 4, 43.5, 31.6, 21, 20, 4, 4].entries()) {
    expect(geometry[index].top).toBeCloseTo(target, 1);
    expect(geometry[index].handleWidth).toBe(18);
    expect(geometry[index].handleHeight).toBe(24);
    expect(geometry[index].shift).toBe(0);
    expect(geometry[index].overlayLeft).toBe(-4);
    expect(geometry[index].pointerEvents).toBe('none');
    expect(geometry[index].shadow).toBe('none');
  }
  expect(geometry[0].height).toBe(32);
  expect(geometry[1].height).toBe(32);
  expect(geometry.slice(2, 5).map((row) => row.overlayTop)).toEqual([32, 24, 16]);
  expect(geometry[6].textStart).toBe(24);
  expect(geometry[7].textStart).toBe(24);

  // Editing focus alone must not reveal chrome; keyboard gutter focus must.
  await rows.first().locator('.obe-text').focus();
  await page.mouse.move(0, 0);
  await expect(rows.first().locator('.obe-gutter')).toHaveCSS('opacity', '0');
  await rows.first().locator('.obe-handle').focus();
  await expect(rows.first().locator('.obe-gutter')).toHaveCSS('opacity', '1');
  await expect(rows.first().locator('.obe-handle')).toHaveCSS('outline-offset', '2px');
});
