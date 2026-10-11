import {test, expect} from './fixtures';

// The database MAP view (T8), exercised through the `field-map` template — a
// database with a `location` property and a clustered, region-coloured map view,
// plus a row that has only an address (the unplaced / geocode case).

async function openFieldMap(page: import('@playwright/test').Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByRole('button', {name: 'Page actions'})).toBeVisible();
  await page.getByRole('button', {name: 'Templates'}).click();
  await expect(page.getByText('Start with a template')).toBeVisible();
  await page.locator('[data-template="field-map"]').click();
  await expect(page.getByLabel('Page title')).toHaveValue(/^Field map/);
}

test('field-map template: lands on a map view with the Map and Table tabs', {tag: ['@database']}, async ({page}) => {
  await openFieldMap(page);
  await expect(page.getByRole('button', {name: 'Map', exact: true})).toBeVisible();
  await expect(page.getByRole('button', {name: 'Table', exact: true})).toBeVisible();
});

test('map renders Leaflet tiles, group-coloured markers, and a legend', {tag: ['@database']}, async ({page}) => {
  await openFieldMap(page);

  // The Leaflet map mounts (lazy chunk) with the OSM tile layer + attribution.
  await expect(page.locator('.leaflet-container')).toBeVisible();
  expect(await page.locator('.ob-leaflet').evaluate((node) => node.getBoundingClientRect().height)).toBe(480);
  for (const dark of [false, true]) {
    await page.evaluate((value) => localStorage.setItem('theme', value ? 'dark' : 'light'), dark);
    await page.reload();
    await expect(page.locator('.leaflet-bar a').first()).toBeVisible();
    await expect(page.locator('html')).toHaveClass(new RegExp(dark ? 'dark' : 'light'));
    const colors = await page.locator('.leaflet-bar a').first().evaluate((node) => {
      const style = getComputedStyle(node);
      const probe = document.createElement('span');
      probe.style.backgroundColor = 'hsl(var(--card))';
      probe.style.color = 'hsl(var(--foreground))';
      node.appendChild(probe);
      const expected = getComputedStyle(probe);
      const result = {bg: style.backgroundColor, fg: style.color, expectedBg: expected.backgroundColor, expectedFg: expected.color};
      probe.remove();
      return result;
    });
    expect(colors.bg).toBe(colors.expectedBg);
    expect(colors.fg).toBe(colors.expectedFg);
  }
  await expect(page.getByRole('link', {name: 'OpenStreetMap'})).toBeVisible();

  // Placed rows render as tinted pins and/or cluster bubbles (both are our
  // divIcons). At the fitted world view dense regions collapse into clusters.
  await expect(page.locator('.ob-map-pin, .ob-map-cluster').first()).toBeVisible();

  // The legend lists the grouping property's options (markers coloured by Region).
  for (const region of ['Americas', 'EMEA', 'APAC']) {
    await expect(page.getByText(region, {exact: true}).first()).toBeVisible();
  }
});

test('the address-only row surfaces in the Unplaced affordance with a geocode action', {tag: ['@database']}, async ({page}) => {
  await openFieldMap(page);
  // One seeded row (Lisbon partner) has an address but no coordinates.
  await expect(page.getByRole('button', {name: /Unplaced \(\d+\)/})).toBeVisible();
  await expect(page.getByRole('button', {name: /Geocode/})).toBeVisible();
});

test('switching to the Table view shows the location column and rows', {tag: ['@database']}, async ({page}) => {
  await openFieldMap(page);
  await page.getByRole('button', {name: 'Table', exact: true}).click();
  await expect(page.getByRole('columnheader', {name: /Region/})).toBeVisible();
  // The seeded places are listed as rows.
  await expect(page.getByText('San Francisco HQ', {exact: true})).toBeVisible();
});
