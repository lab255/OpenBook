import {test, expect} from './fixtures';
import type {APIRequestContext} from '@playwright/test';
import {SERVER} from './seed';

const schema = {
  properties: [{id: 'p_status', name: 'Status', type: 'select', options: [
    {id: 's_todo', label: 'Todo', color: 'orange'}, {id: 's_done', label: 'Done', color: 'green'},
  ]}],
  views: [{id: 'v_gal', name: 'Gallery', type: 'gallery', filters: [], sorts: [], groupByPropertyId: 'p_status'}],
};
async function seed(request: APIRequestContext): Promise<string> {
  const p = await request.post(`${SERVER}/api/pages`, {data: {name: `Gal ${Date.now()}`, data: {editorjs: {blocks: []}, values: [], names: []}}});
  const pageId = ((await p.json()) as {id: string}).id;
  const d = await request.post(`${SERVER}/api/databases`, {data: {pageId, name: 'T', schema}});
  const dbId = ((await d.json()) as {id: string}).id;
  const tag = dbId.slice(0, 8);
  for (const r of [
    {name: 'Apple', properties: {p_status: 's_done'}}, {name: 'Banana', properties: {p_status: 's_todo'}}, {name: 'Cherry', properties: {p_status: 's_done'}},
  ]) await request.post(`${SERVER}/api/databases/${dbId}/rows`, {data: {...r, name: `${r.name} ${tag}`}});
  return pageId;
}

// A grouped gallery splits cards into titled sections by the group property.
test('gallery grouping: cards split into sections by a property', {tag: ['@database']}, async ({page, request}) => {
  const pageId = await seed(request);
  await page.goto(`/?page=${pageId}`);
  await page.getByRole('button', {name: 'New row'}).waitFor();
  // Two group sections (Todo, Done) — one card under Todo, two under Done.
  // Each section also renders a group-header toggle button, so count the cards
  // inside the card grid (not every button) and let the assertions retry until
  // the rows have streamed in and the grid is fully rendered.
  await expect(page.locator('[data-group]')).toHaveCount(2);
  await expect(page.locator('[data-group="s_done"] .grid button')).toHaveCount(2);
  await expect(page.locator('[data-group="s_todo"] .grid button')).toHaveCount(1);
  const card = page.locator('[data-group="s_todo"] .grid button');
  await expect(card.locator('.h-16, img')).toHaveCount(0);
  await expect(card).toHaveCSS('border-radius', '8px');
  await expect(card.locator(':scope > div')).toHaveCSS('padding-top', '12px');
  // Reconstruct the old empty cover treatment to measure the exact density delta.
  const reduction = await card.evaluate((element) => {
    const before = element.getBoundingClientRect().height;
    const body = element.firstElementChild as HTMLElement;
    body.style.paddingTop = '0px';
    const band = document.createElement('div');
    band.style.cssText = 'height:64px;flex-shrink:0';
    element.prepend(band);
    const oldHeight = element.getBoundingClientRect().height;
    band.remove();
    body.style.paddingTop = '';
    return oldHeight - before;
  });
  expect(reduction).toBe(60);
});
