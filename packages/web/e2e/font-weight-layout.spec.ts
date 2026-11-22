import {expect, test} from './fixtures';
import {newPage} from './seed';
import type {Locator, Page} from '@playwright/test';

test.use({freshWorkspace: true});

async function requiredBox(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  return box!;
}

async function boxes(locator: Locator) {
  return Promise.all((await locator.all()).map(requiredBox));
}

async function size(locator: Locator) {
  const {x, width, height} = await requiredBox(locator);
  return {x, width, height};
}

async function settlePopoverAnimations(locator: Locator) {
  await locator.evaluate(async (element) => {
    const root = element.closest('[data-radix-popper-content-wrapper]') ?? element;
    await Promise.allSettled(root.getAnimations({subtree: true}).map((animation) => animation.finished));
  });
}

async function sidebarMetrics(row: Locator) {
  const label = row.locator('span.grow.truncate');
  return {
    // Selecting a page updates the independent Suggested shelf above the tree,
    // so absolute y can move even though the row and its text stay metric-stable.
    row: await size(row),
    label: await size(label),
    text: await label.evaluate((element) => ({
      clientWidth: element.clientWidth,
      scrollWidth: element.scrollWidth,
    })),
  };
}

async function sidebarSelectionRail(row: Locator) {
  return row.evaluate((element) => {
    const style = getComputedStyle(element, '::before');
    return {background: style.backgroundColor, width: style.width};
  });
}

async function settledSidebarBackground(row: Locator) {
  let background = '';
  await expect
    .poll(async () => {
      const sample = await row.evaluate(async (element) => {
        const active = () => element.getAnimations().some((animation) => animation.playState !== 'finished' && animation.playState !== 'idle');
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const before = getComputedStyle(element).backgroundColor;
        const wasActive = active();
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
        const after = getComputedStyle(element).backgroundColor;
        // Identical colors alone can be two samples of a stalled transition
        // under worker contention. Require the transition to finish as well.
        return {background: after, settled: !wasActive && !active() && before === after};
      });
      background = sample.background;
      return sample.settled;
    })
    .toBe(true);
  return background;
}

// The tinted selection treatment (APPFIT-3.9) is painted through the
// `--color-sidebar-selection*` tokens, which resolve to the primary wash / ink /
// rail on the default sidebar and to the sheet's veil + flipped foreground on
// the opt-in accent sheet (where primary ink is invisible — see
// sidebar-accent-contrast.spec).
async function expectPersistentSidebarSelection(row: Locator) {
  await expect(row).toHaveClass(/\bbg-sidebar-selection-wash(?!-)/);
  await expect(row).toHaveClass(/\bbefore:bg-sidebar-selection\b/);
  // Clicking selects and hovers the row; explicitly leave it before taking
  // the resting baseline, including after changing the color mode.
  await row.page().mouse.move(0, 0);
  const restingBackground = await settledSidebarBackground(row);
  const expectedBackground = await row.evaluate((element) => {
    // Resolve the sheet-relative tokens through CSS so the browser serializes
    // them in the same color space as the row's computed background.
    const probe = document.createElement('span');
    probe.hidden = true;
    element.append(probe);
    try {
      probe.style.backgroundColor = 'var(--color-sidebar-selection-wash)';
      const resting = getComputedStyle(probe).backgroundColor;
      probe.style.backgroundColor = 'var(--color-sidebar-selection-wash-strong)';
      return {resting, hovered: getComputedStyle(probe).backgroundColor};
    } finally {
      probe.remove();
    }
  });
  expect(restingBackground).toBe(expectedBackground.resting);

  const rail = await sidebarSelectionRail(row);
  expect(rail.width).toBe('2px');
  expect(rail.background).not.toBe(restingBackground);

  await row.hover();
  // The selected row deliberately deepens its wash on hover. Comparing that
  // state to a baseline captured with an incidental pointer position races
  // both hover and the 180ms transition, especially after the theme menu closes.
  expect(await settledSidebarBackground(row)).toBe(expectedBackground.hovered);
  await row.page().mouse.move(0, 0);
  expect(await settledSidebarBackground(row)).toBe(restingBackground);
}

async function newDatabase(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-home-screen]')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByPlaceholder(/Search pages or run a command/).fill('New database');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: 'Add column'})).toBeVisible();
}

test('selecting a truncated sidebar row preserves row and text metrics', {tag: ['@shell', '@manager-verified']}, async ({page, request}) => {
  const firstName = 'First sidebar page with a deliberately long truncated label for metric verification';
  const secondName = 'Second sidebar page with another deliberately long truncated label for verification';
  const firstId = await newPage(request, firstName);
  await newPage(request, secondName);
  await page.addInitScript(() => localStorage.setItem('theme', 'light'));
  await page.goto(`/?page=${firstId}`);

  const first = page.getByRole('treeitem').filter({hasText: firstName});
  const second = page.getByRole('treeitem').filter({hasText: secondName});
  await expect(first).toHaveClass(/\bbg-sidebar-selection-wash(?!-)/);
  await expect(first).toHaveClass(/\bbefore:bg-sidebar-selection\b/);
  await expect(second).not.toHaveClass(/\bbg-sidebar-selection-wash(?!-)/);
  await expect(second).not.toHaveClass(/\bbefore:bg-sidebar-selection\b/);

  await page.evaluate(() => document.fonts.ready.then(() => undefined));
  const before = await Promise.all([sidebarMetrics(first), sidebarMetrics(second)]);
  expect(before[0].text.scrollWidth).toBeGreaterThan(before[0].text.clientWidth);
  expect(before[1].text.scrollWidth).toBeGreaterThan(before[1].text.clientWidth);

  await second.click();
  await expect(second).toHaveClass(/\bbg-sidebar-selection-wash(?!-)/);
  await expect(second).toHaveClass(/\bbefore:bg-sidebar-selection\b/);
  await expect(first).not.toHaveClass(/\bbg-sidebar-selection-wash(?!-)/);
  await expect(first).not.toHaveClass(/\bbefore:bg-sidebar-selection\b/);

  expect(await Promise.all([sidebarMetrics(first), sidebarMetrics(second)])).toEqual(before);

  await expectPersistentSidebarSelection(second);

  await page.locator('[data-profile-menu]').click();
  await page.getByRole('menuitem', {name: 'Color mode'}).click();
  await page.getByRole('menuitemradio', {name: 'Dark'}).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(true);
  await page.keyboard.press('Escape');
  await expectPersistentSidebarSelection(second);
});

test('switching database views shifts the tab strip and sibling tabs by 0px', {tag: ['@database', '@manager-verified']}, async ({page}) => {
  await newDatabase(page);
  const tabs = page.locator('[data-view-tab]');
  await expect(tabs).toHaveCount(3);
  const strip = tabs.first().locator('..');
  const table = page.getByRole('button', {name: 'Table', exact: true});
  const board = page.getByRole('button', {name: 'Board', exact: true});
  await expect(table).toHaveClass(/\bbg-accent\b/);

  const before = {strip: await requiredBox(strip), tabs: await boxes(tabs)};
  await board.click();
  await expect(board).toHaveClass(/\bbg-accent\b/);
  await expect(table).not.toHaveClass(/\bbg-accent\b/);

  expect({strip: await requiredBox(strip), tabs: await boxes(tabs)}).toEqual(before);
});

test('toggling AND/OR shifts the sibling segment by 0px', {tag: ['@database', '@manager-verified']}, async ({page}) => {
  await newDatabase(page);
  await page.getByRole('button', {name: 'Filter', exact: true}).click();
  const all = page.getByRole('button', {name: 'All', exact: true});
  const any = page.getByRole('button', {name: 'Any', exact: true});
  await expect(all).toHaveClass(/\bbg-accent\b/);

  // Popovers zoom in on mount; take the baseline only after that transform has
  // settled so the comparison isolates the active-state change.
  await settlePopoverAnimations(all);
  const before = await Promise.all([requiredBox(all), requiredBox(any)]);
  await any.click();
  await expect(any).toHaveClass(/\bbg-accent\b/);
  await expect(all).not.toHaveClass(/\bbg-accent\b/);

  expect(await Promise.all([requiredBox(all), requiredBox(any)])).toEqual(before);
});
