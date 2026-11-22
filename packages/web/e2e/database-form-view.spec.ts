import {expect, test, chooseValue} from './fixtures';

test.use({freshWorkspace: true});

async function newDatabase(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.locator('[data-home-screen]')).toBeVisible();
  await page.keyboard.press('ControlOrMeta+k');
  await page.getByPlaceholder(/Search pages or run a command/).fill('New database');
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', {name: 'Add column'})).toBeVisible();
}

test(
  'database form view: build, fill, and inspect the created row',
  {tag: ['@database', '@manager-verified']},
  async ({page}) => {
    await newDatabase(page);

    await page.getByRole('button', {name: 'Add view'}).click();
    await page.getByRole('menuitem', {name: 'Form'}).click();
    await expect(page.locator('[data-database-form-builder]')).toBeVisible();

    await page.getByRole('button', {name: 'Add field'}).click();
    await page.getByRole('menuitem', {name: 'New field'}).click();
    await page.getByPlaceholder('Question or field name').fill('Contact email');
    await chooseValue(page, page.getByLabel('Field type'), 'email');
    await page.getByRole('button', {name: 'Create field'}).click();
    await expect(page.locator('[data-form-new-field-dialog]')).toHaveCount(0);
    await expect(page.locator('[data-form-field-id]').filter({hasText: 'Contact email'})).toBeVisible();

    await page.getByRole('button', {name: 'Fill', exact: true}).click();
    const email = page.getByRole('textbox', {name: 'Contact email', exact: true});
    await email.fill('reader@example.com');
    await email.blur();
    await page.getByRole('button', {name: 'Submit', exact: true}).click();
    await expect(page.locator('[data-database-form-confirmation]')).toContainText('Thanks');

    await page.getByRole('button', {name: 'Table', exact: true}).click();
    await expect(page.getByRole('table').getByLabel('Contact email')).toHaveValue('reader@example.com');
  },
);

test('form fill exposes empty choices and dates without hover', {tag: ['@database']}, async ({page, request}) => {
  const {SERVER} = await import('./seed');
  const hostResponse = await request.post(`${SERVER}/api/pages`, {data: {name: `Form hints ${Date.now()}`, data: {editorjs: {blocks: []}, values: [], names: []}}});
  const {id: pageId} = await hostResponse.json();
  const properties = [
    {id: 'status', name: 'Status', type: 'status'},
    {id: 'team', name: 'Team', type: 'select'},
    {id: 'tags', name: 'Tags', type: 'multi_select'},
    {id: 'date', name: 'Start', type: 'date'},
  ];
  const response = await request.post(`${SERVER}/api/databases`, {data: {pageId, name: 'Hints', schema: {
    properties,
    views: [{id: 'form', name: 'Form', type: 'form', filters: [], sorts: [], visiblePropertyIds: properties.map((p) => p.id), formFields: {}, formConfig: {acceptingResponses: true}}],
  }}});
  expect(response.ok()).toBe(true);
  await page.goto(`/?page=${pageId}`);
  const input = page.locator('[data-form-field-id] input').first();
  await expect(input).toBeVisible();
  expect(await input.evaluate((node) => node.getBoundingClientRect().height)).toBe(28);
  await page.getByRole('button', {name: 'Fill', exact: true}).click();
  await page.mouse.move(0, 0);
  for (const dark of [false, true]) {
    await page.evaluate((value) => localStorage.setItem('theme', value ? 'dark' : 'light'), dark);
    await page.reload();
    await page.getByRole('button', {name: 'Fill', exact: true}).click();
    await expect(page.locator('html')).toHaveClass(new RegExp(dark ? 'dark' : 'light'));
    const hints = page.locator('[data-form-input] [data-empty-hint]');
    await expect(hints).toHaveCount(3);
    for (const hint of await hints.all()) {
      await expect(hint).toHaveText('Select…');
      await expect(hint).toHaveCSS('opacity', '1');
    }
    const date = page.getByLabel('Start', {exact: true});
    const colors = await date.evaluate((node) => {
      const probe = document.createElement('span');
      probe.style.color = 'hsl(var(--placeholder-foreground))';
      node.parentElement!.appendChild(probe);
      const result = {date: getComputedStyle(node).color, placeholder: getComputedStyle(probe).color,
        indicator: getComputedStyle(node, '::-webkit-calendar-picker-indicator').opacity};
      probe.remove();
      return result;
    });
    expect(colors.date).toBe(colors.placeholder);
    expect(colors.indicator).toBe('1');
  }
});
