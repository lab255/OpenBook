import {test, expect} from '@playwright/test';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';

// Generate _captures/ff7c/{before,after}.html with controlPolishFixture.test.tsx.
// One --grep invocation per viewport when SINGLE_PROCESS=1.
for (const width of [1280, 390]) {
  test(`control ladder polish ${width}`, async ({page}) => {
    const phase = process.env.FF7C_CAPTURE_PHASE ?? 'after';
    test.skip(!process.env.FF7C_CAPTURE_PHASE, 'Opt-in before/after polish artifact run');
    const folder = resolve('../../_captures/ff7c');
    await page.setViewportSize({width, height: 900});
    await page.goto(pathToFileURL(`${folder}/${phase}.html`).href);
    const heights: Record<string, number[]> = {};
    for (const surface of ['button', 'field']) {
      const section = page.locator(`#${surface}`);
      heights[surface] = await section.locator('button,input').evaluateAll(elements => elements.map(el => el.getBoundingClientRect().height));
      await section.screenshot({path: `${folder}/${phase}-${surface}-${width}.png`});
    }
    expect(heights).toEqual(phase === 'before'
      ? {button: [36, 32, 40, 32, 32], field: [32, 28, 32, 32]}
      : {button: [36, 28, 36, 36, 36], field: [36, 28, 36, 36]});
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    writeFileSync(`${folder}/${phase}-${width}.json`, JSON.stringify({phase, width, heights}, null, 2));
  });
}

test('exported kit control heights', async ({page}) => {
  test.skip(process.env.FF7C_CAPTURE_PHASE !== 'after', 'Opt-in generated export fixture');
  await page.goto(pathToFileURL(resolve('../../_captures/ff7c/export-after.html')).href);
  for (const [selector, height] of [
    ['.kit-btn', 36], ['.kitinput input[type=text]', 36], ['.kitinput select', 28],
    ['.kitinput:not(.kit-wide) .kit-pill', 28], ['.kit-wide .kit-pill', 36],
  ] as const) {
    const elements = page.locator(selector);
    expect(await elements.count()).toBeGreaterThan(0);
    for (const element of await elements.all()) expect(await element.evaluate(el => el.getBoundingClientRect().height)).toBe(height);
  }
});
