import {test, expect} from './fixtures';
import {newPage} from './seed';

const options = [{label: 'One'}, {label: 'Two'}, {label: 'Three'}];
const blocks = [
  {id: 'text', type: 'textfield', props: {label: 'Text', compact: true}},
  {id: 'radio', type: 'radio', props: {label: 'Radio', opts: options}},
  {id: 'checks', type: 'checklist', props: {label: 'Checks', opts: options}},
  {id: 'dropdown', type: 'dropdown', props: {label: 'Dropdown', opts: options}},
  {id: 'compact-dropdown', type: 'dropdown', props: {label: 'Compact dropdown', compact: true, opts: options}},
  {id: 'compact-radio', type: 'radio', props: {label: 'Compact radio', compact: true, opts: options}},
  {id: 'toggle', type: 'toggle', props: {label: 'Toggle'}},
  {id: 'location', type: 'location', props: {label: 'Location'}},
  {id: 'button', type: 'actionbutton', props: {label: 'Click me'}},
  {id: 'cards', type: 'choicecards', props: {label: 'Choices', opts: [{label: 'Blue', color: 'blue'}, {label: 'Plain'}]}},
  {id: 'longtext', type: 'longtext', props: {label: 'Long text'}},
  {id: 'rich', type: 'richtext', props: {label: 'Rich text'}},
  {id: 'search', type: 'searchselect', props: {label: 'Search', opts: options}},
  {id: 'number', type: 'number', props: {label: 'Quantity', description: 'How many seats', value: 3}},
  {id: 'slider', type: 'slider', props: {label: 'Budget', value: 3}},
  {id: 'tags', type: 'tagfield', props: {label: 'Tags'}},
  {id: 'formula', type: 'formula', props: {source: '1 + 1'}},
  {id: 'status', type: 'statuslight', props: {label: 'Status', source: 'true'}},
  {id: 'tooltip', type: 'tooltipcard', props: {term: 'Term', tip: 'Help'}},
  {id: 'link', type: 'linkcard', props: {title: 'Example', description: 'Description', url: 'https://example.com'}},
  {id: 'emptylink', type: 'linkcard', props: {title: 'Untitled'}},
  {id: 'progress', type: 'progressbar', props: {label: 'Progress', source: '50'}},
  {id: 'chart', type: 'kitchart', props: {title: 'Chart', source: '[1,2,3]'}},
];

for (const dark of [false, true]) {
  test(`kit chrome geometry and keyboard focus (${dark ? 'dark' : 'light'})`, async ({page, request}, testInfo) => {
    await page.setViewportSize({width: 1280, height: 1000});
    const id = await newPage(request, `Kit chrome ${dark}`, {editor: 'blocks', blockdoc: {blocks}, editorjs: {blocks: []}, values: [], names: []});
    if (dark) await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.goto(`/?page=${id}`);
    await expect(page.locator('.obe-kit-chart')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(dark);
    for (const [input, frame] of [
      ['.obe-kit-stepper input', '.obe-kit-stepper'],
      ['.obe-kit-tag-input', '.obe-kit-tags'],
      ['.obe-formula-src', '.obe-formula'],
    ]) {
      const surface = page.locator(frame);
      const before = await surface.evaluate((el) => getComputedStyle(el).borderColor);
      await page.locator(input).focus();
      const ring = await surface.evaluate((el) => {
        const probe = document.createElement('span');
        probe.style.color = 'hsl(var(--ring))'; el.append(probe);
        const color = getComputedStyle(probe).color; probe.remove(); return color;
      });
      await expect(surface).toHaveCSS('border-color', ring);
      expect(ring).not.toBe(before);
    }
    await page.locator('.obe-kit-term').focus();
    await expect(page.locator('.obe-kit-term')).toHaveCSS('outline-style', 'solid');
    await expect(page.locator('.obe-kit-term')).toHaveCSS('outline-width', '2px');
    await expect(page.locator('.obe-kit-term')).toHaveCSS('outline-offset', '2px');
    await expect(page.locator('.obe-kit-tip')).toHaveCSS('opacity', '1');
    for (const [selector, height] of [
      ['.obe-kit-textinput', '32px'], ['.obe-kit-num', '32px'], ['.obe-kit-mini', '32px'],
      ['.obe-kit-wide .obe-kit-dropdown-select', '32px'], ['.obe-kit-searchtrigger', '32px'],
      ['.obe-kit:not(.obe-kit-wide) .obe-kit-dropdown-select', '28px'],
      ['.obe-kit:not(.obe-kit-wide) .obe-kit-pill', '28px'], ['.obe-kit-stepper', '28px'], ['.obe-kit-action', '32px'],
      ['.obe-kit-richtext-btn', '24px'], ['.obe-kit-switch', '20px'],
      ['.obe-kit-wide .obe-kit-pill', '36px'], ['.obe-kit-wide .obe-kit-check', '36px'],
    ]) {
      expect(await page.locator(selector).count()).toBeGreaterThan(0);
      for (const control of await page.locator(selector).all()) await expect(control).toHaveCSS('height', height);
    }
    for (const selector of ['.obe-kit-wide .obe-kit-dropdown-select', '.obe-kit-searchtrigger']) {
      const widths = await page.locator(selector).evaluate((el) => ({
        control: el.getBoundingClientRect().width,
        frame: el.closest('.obe-kit')!.getBoundingClientRect().width,
      }));
      expect(Math.abs(widths.control - widths.frame)).toBeLessThan(1);
    }
    for (const [selector, token] of [
      ['.obe-kit-card-cover.obe-bg-blue', 'var(--obe-bg-blue)'],
      ['.obe-kit-card-cover-empty', 'hsl(var(--muted))'],
    ]) {
      const cover = page.locator(selector);
      const expected = await cover.evaluate((el, color) => {
        const probe = document.createElement('span');
        probe.style.backgroundColor = color; el.append(probe);
        const value = getComputedStyle(probe).backgroundColor; probe.remove(); return value;
      }, token);
      await expect(cover).toHaveCSS('background-color', expected);
    }
    const compactChoice = page.locator('.obe-kit:not(.obe-kit-wide) .obe-kit-pill').first();
    const choiceBorder = await compactChoice.evaluate((el) => getComputedStyle(el).borderColor);
    await compactChoice.hover();
    await expect(compactChoice).toHaveCSS('border-color', choiceBorder);
    const hoverFill = await compactChoice.evaluate((el) => {
      const probe = document.createElement('span'); probe.style.backgroundColor = 'var(--obe-chrome-hover)';
      el.append(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color;
    });
    await expect(compactChoice).toHaveCSS('background-color', hoverFill);
    await compactChoice.click();
    const selectedBorder = await compactChoice.evaluate((el) => {
      const probe = document.createElement('span'); probe.style.color = 'hsl(var(--primary))';
      el.append(probe); const color = getComputedStyle(probe).color; probe.remove(); return color;
    });
    await expect(compactChoice).toHaveCSS('border-color', selectedBorder);
    for (const selector of ['.obe-kit-card', '.obe-kit-searchtrigger', '.obe-kit-action']) {
      const control = page.locator(selector).first();
      await control.evaluate((el) => el.setAttribute('disabled', ''));
      await expect(control).toHaveCSS('opacity', '0.5');
      await expect(control).toHaveCSS('cursor', 'default');
      await control.evaluate((el) => el.removeAttribute('disabled'));
    }
    const label = page.locator('.obe-kit-number .obe-kit-label');
    await expect(label).toHaveCSS('font-weight', '600');
    await expect(label).toHaveCSS('border-width', '0px');
    await expect(label).toHaveCSS('color', await page.locator('.obe-kit-number').evaluate((el) => getComputedStyle(el).color));
    await label.focus();
    await expect(label).toHaveCSS('outline-style', 'none');
    await expect(label).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    const gear = page.locator('.obe-kit-number .obe-kit-gear');
    await expect(gear).toHaveCSS('width', '24px');
    await expect(gear).toHaveCSS('height', '24px');
    await expect(gear).toHaveCSS('border-width', '0px');
    await expect(page.locator('.obe-kit-linkcard[aria-disabled="true"]')).toHaveCSS('border-style', 'dashed');
    await expect(page.locator('.obe-kit-linkcard[aria-disabled="true"]')).toHaveAttribute('tabindex', '-1');
    await page.locator('.obe-kit-linkcard[href]').hover();
    await expect(page.locator('.obe-kit-linkcard[href]')).toHaveCSS('box-shadow', 'none');
    await expect(page.locator('figure.obe-kit-chart > figcaption.obe-kit-head')).toBeVisible();
    await expect(page.locator('.obe-kit-chart .obe-kit-desc')).toHaveCount(0);
    const measurements = await page.locator('[data-block-row]').evaluateAll((rows) => rows.map((row) => ({
      id: row.getAttribute('data-block-row'), type: row.getAttribute('data-block-type'), height: row.getBoundingClientRect().height,
      padding: row.querySelector('.obe-kit') ? getComputedStyle(row.querySelector('.obe-kit')!).padding : null,
    })));
    for (const row of measurements.filter((r) => r.padding !== null)) expect(row.padding).toBe('0px');
    const caps: Record<string, number> = {textfield: 51.6, radio: 170.5, checklist: 170.5, dropdown: 84.3, toggle: 37.6, location: 51.6, actionbutton: 47.1, choicecards: 158.7, longtext: 128, richtext: 122.8, searchselect: 80.3, number: 56, slider: 65.6, tagfield: 79.2, formula: 50, statuslight: 39.1, tooltipcard: 40.6, linkcard: 101.5, progressbar: 51.2, kitchart: 330.7};
    for (const row of measurements) if (row.type && caps[row.type]) expect(row.height, row.type).toBeLessThanOrEqual(caps[row.type]);
    console.log(`Kit heights ${dark ? 'dark' : 'light'} ${JSON.stringify(measurements)}`);
    await testInfo.attach('kit-heights', {body: JSON.stringify(measurements, null, 2), contentType: 'application/json'});
  });

  test(`read-only meeting todo stays undimmed (${dark ? 'dark' : 'light'})`, async ({page, request}) => {
    const id = await newPage(request, `Read-only meeting ${dark}`, {
      editor: 'blocks',
      blockdoc: {blocks: [{id: 'meeting', type: 'meeting', children: [
        {id: 'todo', type: 'todo', text: [{t: 'Follow up'}]},
      ]}]},
      editorjs: {blocks: []}, values: [], names: [],
    });
    if (dark) await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
    await page.route('**/api/instance', async (route) => {
      if (route.request().method() !== 'GET') return route.continue();
      const real = await route.fetch();
      const info = await real.json();
      await route.fulfill({json: {...info, guestAccess: 'read'}});
    });
    await page.goto(`/?page=${id}`);
    await expect(page.locator('.obe-root')).toHaveClass(/obe-readonly/);
    const todo = page.locator('.obe-kit-meeting [data-block-row="todo"] .obe-todo-box');
    await expect(todo).toBeDisabled();
    await expect(todo).toHaveCSS('opacity', '1');
    await page.unrouteAll({behavior: 'wait'});
  });
}
