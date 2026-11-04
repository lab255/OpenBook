import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import type {Page} from '@playwright/test';
import {test, expect} from './fixtures';

// Run against the same app before/after the font entry is enabled.
// This measures the font capability separately from production state motion.
test.skip(process.env.CARD8_EVIDENCE !== '1', 'Opt-in font evidence: CARD8_EVIDENCE=1');
// CARD8_SINGLE_PROCESS: sandboxed reviewer environments deny Chromium's
// multi-process Mach-port rendezvous; single-process mode survives there but
// only one test per invocation (drive each test via --grep).
if (process.env.CARD8_SINGLE_PROCESS) test.use({launchOptions: {args: ['--single-process', '--no-zygote']}});

type Shifts = {fontShifts: {value: number; hadRecentInput: boolean; t: number}[]};

const SELECTED_ROW = '[class*="before:bg-sidebar-selection"]';

async function observeShifts(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('theme', 'dark');
    (window as unknown as Shifts).fontShifts = [];
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const e = entry as PerformanceEntry & {value: number; hadRecentInput: boolean};
        (window as unknown as Shifts).fontShifts.push({value: e.value, hadRecentInput: e.hadRecentInput, t: e.startTime});
      }
    }).observe({type: 'layout-shift', buffered: true});
  });
}

// DefaultLayout dismisses the narrow drawer on first mount and again when the
// current page resolves; retry until it is open AND stays open (CARD-7 recipe).
async function ensureDrawer(page: Page) {
  const dialog = page.locator('[data-sidebar-drawer][role="dialog"]');
  await expect(async () => {
    if (!(await dialog.isVisible())) await page.locator('[data-sidebar-toggle]:visible').first().click();
    await expect(dialog).toBeVisible({timeout: 1_000});
    await page.waitForTimeout(700);
    await expect(dialog).toBeVisible({timeout: 250});
  }).toPass({timeout: 30_000});
}

// Computed type + box for a production element (first visible match).
async function probe(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((n) => {
    const s = getComputedStyle(n);
    const r = n.getBoundingClientRect();
    return {
      text: n.textContent?.trim().slice(0, 60),
      fontFamily: s.fontFamily, fontWeight: s.fontWeight, fontVariationSettings: s.fontVariationSettings,
      fontOpticalSizing: s.fontOpticalSizing, fontSize: s.fontSize,
      x: r.x, y: r.y, width: r.width, height: r.height,
    };
  });
}

for (const width of [1280, 390]) {
  test(`app font evidence at ${width}px`, async ({page}, testInfo) => {
    test.setTimeout(120_000);
    const baseline = process.env.CARD8_BASELINE === '1';
    const dir = process.env.CARD8_ARTIFACT_DIR ?? testInfo.outputPath('font-evidence');
    mkdirSync(dir, {recursive: true});
    await page.setViewportSize({width, height: 900});
    await observeShifts(page);
    await page.goto('/');
    if (width < 768) {
      await page.waitForTimeout(1_500);
      await page.mouse.move(0, 0);
      await ensureDrawer(page);
    }
    await expect(page.getByRole('button', {name: 'Settings', exact: true}).first()).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const font = await page.evaluate(() => ({
      family: getComputedStyle(document.body).fontFamily,
      faces: [...document.fonts].map((face) => ({family: face.family, weight: face.weight, status: face.status})),
      check: document.fonts.check('16px InterVariable'),
    }));
    if (!baseline) {
      expect(font.family).toMatch(/^InterVariable/);
      expect(font.faces).toContainEqual({family: 'InterVariable', weight: '100 900', status: 'loaded'});
      expect(font.check).toBe(true);
    }
    const prefix = `${baseline ? 'before' : 'after'}-${width}`;
    const states: Record<string, unknown> = {};
    states.sidebarActive = await probe(page, SELECTED_ROW).catch((e) => ({missing: String(e).slice(0, 120)}));
    states.settingsButton = await probe(page, 'button:has-text("Settings")');
    await page.screenshot({path: join(dir, `${prefix}-sidebar.png`)});
    await page.locator('[data-profile-menu]:visible').first().click();
    await page.getByRole('menuitem', {name: 'Color mode'}).click();
    const dark = page.getByRole('menuitemradio', {name: 'Dark', exact: true});
    await expect(dark).toBeVisible();
    await expect(dark).toHaveAttribute('aria-checked', 'true');
    states.menuSelected = await probe(page, '[role="menuitemradio"][aria-checked="true"]');
    states.menuUnselected = await probe(page, '[role="menuitemradio"][aria-checked="false"]');
    await page.waitForTimeout(400); // let the submenu's entry animation settle before capture
    await page.screenshot({path: join(dir, `${prefix}-menu.png`)});
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    if (width < 768) await ensureDrawer(page);
    await page.getByRole('button', {name: 'Settings', exact: true}).first().click();
    const heading = page.locator('h4').filter({hasText: /^Settings$/});
    await expect(heading).toBeVisible();
    states.settingsHeading = await probe(page, 'h4:has-text("Settings")');
    await page.waitForTimeout(400); // let the dialog's --motion-slow entry settle before capture
    await page.screenshot({path: join(dir, `${prefix}-settings.png`)});
    const sample = await page.evaluate(() => {
      const label = document.createElement('span');
      label.textContent = 'Variable weight measurement';
      label.style.cssText = 'position:fixed;left:0;top:0;font-size:16px;font-family:InterVariable,sans-serif';
      document.body.append(label);
      const samples = [400, 475, 550].map((weight) => {
        label.style.fontVariationSettings = `"wght" ${weight}, "opsz" 14`;
        return {weight, width: label.getBoundingClientRect().width, axes: getComputedStyle(label).fontVariationSettings};
      });
      label.remove();
      return {samples, shifts: (window as unknown as Shifts).fontShifts};
    });
    if (!baseline) expect(new Set(sample.samples.map((s) => s.width)).size).toBe(3);
    writeFileSync(join(dir, `${prefix}.json`), JSON.stringify({font, states, probe: sample}, null, 2));
  });

  // Controlled delayed swap: hold the woff2 response so first paint uses the
  // fallback stack, then release it and measure what moves. CLS = sum of
  // layout-shift values without recent input from navigation to settle.
  test(`delayed swap at ${width}px`, async ({page}, testInfo) => {
    test.skip(process.env.CARD8_BASELINE === '1', 'The baseline loads no web font; nothing swaps.');
    test.setTimeout(120_000);
    const dir = process.env.CARD8_ARTIFACT_DIR ?? testInfo.outputPath('font-evidence');
    mkdirSync(dir, {recursive: true});
    const holdMs = 3_000;
    await page.setViewportSize({width, height: 900});
    await observeShifts(page);
    let held = 0;
    await page.route(/InterVariable.*\.woff2/, async (route) => {
      held++;
      await new Promise((r) => setTimeout(r, holdMs));
      await route.continue();
    });
    await page.goto('/');
    const settings = page.getByRole('button', {name: 'Settings', exact: true}).first();
    await expect(settings).toBeAttached();
    const boxes = async () => ({
      faceStatus: await page.evaluate(() => [...document.fonts].filter((f) => f.family === 'InterVariable').map((f) => f.status)),
      settingsButton: await probe(page, 'button:has-text("Settings")'),
      sidebarActive: await probe(page, SELECTED_ROW).catch(() => null),
    });
    const beforeSwap = await boxes();
    await page.screenshot({path: join(dir, `swap-${width}-fallback.png`)});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => [...document.fonts].some((f) => f.family === 'InterVariable' && f.status === 'loaded'), null, {timeout: holdMs + 15_000});
    await page.waitForTimeout(500);
    const afterSwap = await boxes();
    await page.screenshot({path: join(dir, `swap-${width}-swapped.png`)});
    const shifts = await page.evaluate(() => (window as unknown as Shifts).fontShifts);
    const cls = shifts.filter((s) => !s.hadRecentInput).reduce((a, s) => a + s.value, 0);
    writeFileSync(join(dir, `swap-${width}.json`), JSON.stringify({holdMs, held, beforeSwap, afterSwap, shifts, cls}, null, 2));
    expect(held).toBeGreaterThan(0);
  });
}
