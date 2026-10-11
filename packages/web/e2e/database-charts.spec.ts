import {test, expect} from './fixtures';
import type {APIRequestContext} from '@playwright/test';
import {SERVER} from './seed';


const schema = {
  properties: [
    {id: 'p_status', name: 'Status', type: 'select', options: [
      {id: 's_todo', label: 'Todo', color: 'gray'},
      {id: 's_prog', label: 'In progress', color: 'blue'},
      {id: 's_done', label: 'Done', color: 'green'},
    ]},
    {id: 'p_team', name: 'Team', type: 'select', options: [
      {id: 't_eng', label: 'Eng', color: 'blue'},
      {id: 't_design', label: 'Design', color: 'pink'},
      {id: 't_ops', label: 'Ops', color: 'orange'},
    ]},
  ],
  views: [
    {id: 'v_pie', name: 'Pie', type: 'pie', filters: [], sorts: [], groupByPropertyId: 'p_status', breakdownPropertyId: 'p_team'},
  ],
};
const rows = [
  {name: 'A', properties: {p_status: 's_todo', p_team: 't_eng'}},
  {name: 'B', properties: {p_status: 's_todo', p_team: 't_design'}},
  {name: 'C', properties: {p_status: 's_prog', p_team: 't_eng'}},
  {name: 'D', properties: {p_status: 's_prog', p_team: 't_ops'}},
  {name: 'E', properties: {p_status: 's_done', p_team: 't_design'}},
  {name: 'F', properties: {p_status: 's_done', p_team: 't_eng'}},
  {name: 'G', properties: {p_status: 's_todo', p_team: 't_ops'}},
];

async function seed(request: APIRequestContext, bar = false): Promise<string> {
  const p = await request.post(`${SERVER}/api/pages`, {data: {name: `Pie ${Date.now()}`, data: {editorjs: {blocks: []}, values: [], names: []}}});
  const pageId = ((await p.json()) as {id: string}).id;
  const d = await request.post(`${SERVER}/api/databases`, {data: {pageId, name: 'Work', schema: bar ? {...schema, views: [{id: 'bar', name: 'Bar', type: 'bar', filters: [], sorts: [], groupByPropertyId: 'p_status'}]} : schema}});
  const dbId = ((await d.json()) as {id: string}).id;
  const tag = dbId.slice(0, 8); // page names are globally unique — keep row names distinct
  for (const r of rows) await request.post(`${SERVER}/api/databases/${dbId}/rows`, {data: {...r, name: `${r.name} ${tag}`}});
  return pageId;
}

// The pie/sunburst is interactive: a sunburst of SVG slices that highlight on
// hover (lighting the matching slice, dimming the rest) and drill on click.
test('pie chart: slices highlight on hover and drill on click', {tag: ['@database']}, async ({page, request}) => {
  const pageId = await seed(request);
  await page.goto(`/?page=${pageId}`);
  const total = page.getByText('Total 7').first();
  await total.waitFor();
  await total.scrollIntoViewIfNeeded();

  // The sunburst renders as individually addressable SVG slices.
  const svg = page.locator('svg[aria-label="Sunburst chart"]');
  await expect(svg).toBeVisible();
  expect(await svg.locator('path, circle').count()).toBeGreaterThan(3);

  // Hovering a legend row lights its slice and dims the others (bidirectional).
  await page.getByRole('button', {name: /In progress/}).hover();
  await expect.poll(async () =>
    page.evaluate(() => {
      const ops = [...document.querySelectorAll('svg[aria-label="Sunburst chart"] path, svg[aria-label="Sunburst chart"] circle')]
        .map((p) => Number(getComputedStyle(p).opacity));
      return ops.filter((o) => o < 0.5).length;
    }),
  ).toBeGreaterThan(0);

  // Clicking a slice/legend drills into its rows.
  await page.getByRole('button', {name: /Done/}).first().click();
  await expect(page.getByRole('button', {name: 'Close drill-down'})).toBeVisible();
});

// Pixel-sized database plots must keep readable captions across column widths.
test('bar plot height and caption size follow the density ledger', {tag: ['@database']}, async ({page, request}, testInfo) => {
  const pageId = await seed(request, true);
  await page.goto(`/?page=${pageId}`);
  const svg = page.locator('svg[aria-label="Bar chart"]');
  await expect(svg).toBeVisible();
  const measurements = [];
  for (const dark of [false, true]) {
    await page.evaluate((value) => localStorage.setItem('theme', value ? 'dark' : 'light'), dark);
    await page.reload();
    await expect(svg).toBeVisible();
    await expect(page.locator('html')).toHaveClass(new RegExp(dark ? 'dark' : 'light'));
    for (const width of [900, 1280, 1680]) {
      await page.setViewportSize({width, height: 900});
      await expect.poll(() => svg.evaluate((node) => Math.abs(node.getBoundingClientRect().width - (node as SVGSVGElement).viewBox.baseVal.width))).toBeLessThan(0.1);
      const measured = await svg.evaluate((node) => {
        const box = node.getBoundingClientRect();
        const text = node.querySelector('.obe-chart-xlabels text')!;
        return {width: box.width, height: box.height, caption: getComputedStyle(text).fontSize};
      });
      expect(measured.height).toBeCloseTo(Math.min(240, Math.round(measured.width * 240 / 640)), 0);
      expect(measured.caption).toBe('12px');
      measurements.push({viewport: width, dark, ...measured});
      await page.screenshot({path: testInfo.outputPath(`bar-${dark ? 'dark' : 'light'}-${width}.png`)});
    }
  }
  await testInfo.attach('density-ledger', {body: JSON.stringify(measurements, null, 2), contentType: 'application/json'});
  console.log('DSX chart ledger', JSON.stringify(measurements));
});
