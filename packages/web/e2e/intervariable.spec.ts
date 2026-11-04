import {mkdirSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {test, expect} from './fixtures';

// Run against the same built app before/after the font entry is enabled.
// This measures the font capability separately from production state motion.
test.skip(process.env.CARD8_EVIDENCE !== '1', 'Opt-in font evidence: CARD8_EVIDENCE=1');

for (const width of [1280, 390]) {
  test(`app font evidence at ${width}px`, async ({page}, testInfo) => {
    const baseline = process.env.CARD8_BASELINE === '1';
    const dir = process.env.CARD8_ARTIFACT_DIR ?? testInfo.outputPath('font-evidence');
    mkdirSync(dir, {recursive: true});
    await page.setViewportSize({width, height: 900});
    await page.addInitScript(() => {
      localStorage.setItem('theme', 'dark');
      (window as unknown as {fontShifts: number[]}).fontShifts = [];
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          (window as unknown as {fontShifts: number[]}).fontShifts.push(
            (entry as PerformanceEntry & {value: number}).value,
          );
        }
      }).observe({type: 'layout-shift', buffered: true});
    });
    await page.goto('/');
    if (width < 768) await page.locator('[data-sidebar-toggle]:visible').first().click();
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
    await page.screenshot({path: join(dir, `${prefix}-sidebar.png`)});
    await page.locator('[data-profile-menu]').click();
    await page.getByRole('menuitem', {name: 'Color mode'}).click();
    await expect(page.getByRole('menuitemradio', {name: 'Dark', exact: true})).toBeVisible();
    await page.screenshot({path: join(dir, `${prefix}-menu.png`)});
    await page.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    await page.getByRole('button', {name: 'Settings', exact: true}).first().click();
    await expect(page.locator('h4').filter({hasText: /^Settings$/})).toBeVisible();
    await page.screenshot({path: join(dir, `${prefix}-settings.png`)});
    const probe = await page.evaluate(() => {
      const label = document.createElement('span');
      label.textContent = 'Variable weight measurement';
      label.style.cssText = 'position:fixed;left:0;top:0;font-size:16px;font-family:InterVariable,sans-serif';
      document.body.append(label);
      const samples = [400, 475, 550].map((weight) => {
        label.style.fontVariationSettings = `"wght" ${weight}, "opsz" 14`;
        return {weight, width: label.getBoundingClientRect().width, axes: getComputedStyle(label).fontVariationSettings};
      });
      label.remove();
      return {samples, shifts: (window as unknown as {fontShifts: number[]}).fontShifts};
    });
    if (!baseline) expect(new Set(probe.samples.map((sample) => sample.width)).size).toBe(3);
    writeFileSync(join(dir, `${prefix}.json`), JSON.stringify({font, probe}, null, 2));
  });
}
