import {afterEach, describe, expect, it} from 'vitest';
import {cleanup, render, waitFor} from '@testing-library/react';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readdirSync, readFileSync} from 'node:fs';
import {createDoc, rootBlocks} from '../../model';
import type {BlockEditorController} from '../../useBlockEditor';
import {CARD_BLOCKS} from '../cards';
import {PROGRESS_BLOCKS} from '../progress';
import {CHART_BLOCKS} from '../charts';
import {ReactiveEvalCache} from '../evalCache';
import {KitPageLockContext} from '../lock';

afterEach(cleanup);
const definitions = [...CARD_BLOCKS, ...PROGRESS_BLOCKS, ...CHART_BLOCKS];
function adopted(type: string, props = {}, readOnly = false, pageLocked = false) {
  const doc = createDoc([{id: 'test', type, props}]);
  const editor = {doc, version: 0, readOnly, evalCache: new ReactiveEvalCache(doc)} as unknown as BlockEditorController;
  const Component = definitions.find((d) => d.type === type)!.render;
  return render(<KitPageLockContext.Provider value={pageLocked}>
    <Component block={rootBlocks(doc).get(0)} editor={editor} pageReadOnly={pageLocked} />
  </KitPageLockContext.Provider>);
}

describe('display blocks share KitFrame', () => {
  it.each([
    ['statuslight', '.obe-kit-status[data-status]'],
    ['tooltipcard', '.obe-kit-tooltip'],
    ['linkcard', '.obe-kit-linkcard-wrap'],
    ['progressbar', '.obe-kit-progress[data-progress="0"]'],
    ['kitchart', 'figure.obe-kit-chart[data-chart-kind="line"]'],
  ])('%s preserves its root and settings', (type, selector) => {
    const {container} = adopted(type);
    const root = container.querySelector(selector);
    expect(root).toBeTruthy();
    expect(root!.querySelectorAll('.obe-kit-gear')).toHaveLength(1);
    expect(root!.hasAttribute('data-kit-name')).toBe(true);
    if (type === 'kitchart') {
      expect(root!.querySelector(':scope > figcaption.obe-kit-head')).toBeTruthy();
      expect(root!.querySelector('.obe-kit-desc')).toBeNull();
    } else expect(root!.querySelector('.obe-kit-head')).toBeNull();
  });
  it.each([[true, false], [false, true]])('hides an empty chart header under either lock (%s, %s)', (readOnly, pageLocked) => {
    const {container} = adopted('kitchart', {}, readOnly, pageLocked);
    expect(container.querySelector('figcaption')).toBeNull();
  });
  it('keeps a populated locked chart header and accessible plot name', () => {
    const {container} = adopted('kitchart', {title: 'Revenue', description: 'Quarterly', source: '[1,2]'}, true);
    expect(container.querySelector('figcaption')?.textContent).toBe('RevenueQuarterly');
    expect(container.querySelector('svg')?.getAttribute('aria-label')).toBe('Revenue');
    expect(container.querySelector('input.obe-kit-inline')).toBeNull();
  });
  it('makes an empty link explicitly unfocusable', () => {
    const {container} = adopted('linkcard');
    const link = container.querySelector('a')!;
    expect(link.getAttribute('aria-disabled')).toBe('true');
    expect(link.getAttribute('tabindex')).toBe('-1');
    expect(link.hasAttribute('href')).toBe(false);
  });
  it('only the shared frame owns settings within the kit family', () => {
    const dir = 'src/blockeditor/kit/';
    const owners = readdirSync(dir).filter((file: string) => file.endsWith('.tsx') && readFileSync(dir + file, 'utf8').includes('KitSettings'));
    expect(owners.sort()).toEqual(['KitFrame.tsx', 'KitSettings.tsx']);
  });
});

it.each(['statuslight', 'progressbar'])('%s flags evaluation errors on the value readout', async (type) => {
  const {container} = adopted(type, {source: 'missingValue + 1'});
  await waitFor(() => expect(container.querySelector('[data-error]')?.textContent).toContain('⚠'));
});
