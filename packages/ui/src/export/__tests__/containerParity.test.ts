import {describe, expect, it} from 'vitest';
// @ts-expect-error -- node:fs is available to Vitest, not the browser package.
import {readFileSync} from 'node:fs';
import type {PageSnapshot} from '@book.dev/sdk';
import {blocksToHtml, CONTAINER_EYEBROW_STYLE, CONTAINER_FRAME_STYLE, projectBlocksForExport} from '../../blockeditor/exportBlocks';
import {createDoc, docToJSON, normalizeColumnSpans, type NewBlock} from '../../blockeditor/model';
import {buildDocumentModel} from '../documentModel';
import {toHtml, toSlideDeck} from '../toHtml';
import {toMarkdown} from '../toMarkdown';

const css: string = readFileSync('src/index.css', 'utf8');
const exporter: string = readFileSync('src/export/toHtml.ts', 'utf8');
const root = css.slice(css.indexOf('  :root {'), css.indexOf('  .dark {'));
const dark = css.slice(css.indexOf('  .dark {'), css.indexOf('\n  html,'));
function token(name: string, source = root): string {
  const match = source.match(new RegExp(`--${name}: ([^;]+);`));
  expect(match, name).not.toBeNull();
  return match![1];
}
function exportsFor(blocks: NewBlock[]) {
  const json = docToJSON(createDoc(blocks));
  const projection = projectBlocksForExport(json);
  const snapshot = {editorjs: {blocks: projection.blocks}, values: projection.values, names: projection.names} as PageSnapshot;
  return {
    clipboard: new DOMParser().parseFromString(blocksToHtml(json), 'text/html'),
    standalone: new DOMParser().parseFromString(toHtml(snapshot, 'Containers', ''), 'text/html'),
    snapshot, projection,
  };
}
const para = (text: string): NewBlock => ({type: 'paragraph', text: [{t: text}]});

describe('G2 container export equality', () => {
  it.each([[3, 9], [undefined, undefined], [2, undefined, 4], [0, 99]])('mirrors editor column spans for %j', (...spans) => {
    const result = exportsFor([{type: 'columns', children: spans.map((span, i) => ({type: 'column', props: {span}, children: [para(`Column ${i}`)]}))}]);
    const expected = normalizeColumnSpans(spans);
    for (const [doc, selector] of [[result.clipboard, '.obe-x-columns > div'], [result.standalone, '.cols > .col']] as const) {
      expect([...doc.querySelectorAll<HTMLElement>(selector)].map((col) => col.style.flex)).toEqual(expected.map((span) => `${span} 1 0px`));
    }
    expect(result.clipboard.querySelector<HTMLElement>('.obe-x-columns')!.style.gap).toBe(token('obe-columns-gap'));
    expect(exporter).toContain(`.cols { display: flex; gap: ${token('obe-columns-gap')};`);
    expect(result.projection.blocks[0].data.spans).toEqual(expected);
  });

  it('mirrors the editor frame, inset, radius and light/dark border values', () => {
    const result = exportsFor([{type: 'group', props: {name: 'Section'}, children: [para('Framed body')]}]);
    for (const doc of [result.clipboard, result.standalone]) {
      expect(doc.querySelector('section.obe-x-group > p.obe-x-group-name')?.textContent).toBe('Section');
      expect(doc.querySelector('section.obe-x-group')?.textContent).toContain('Framed body');
      expect(doc.querySelector('h3')).toBeNull();
    }
    const border = `var(--obe-x-border, hsl(${token('border')}))`;
    expect(CONTAINER_FRAME_STYLE).toContain(`border:1px solid ${border.replace(', ', ',')}`);
    expect(exporter).toContain(`border: 1px solid ${border}; border-radius: ${parseFloat(token('radius')) * 16}px; padding: ${token('obe-block-pad-y')} ${token('obe-gutter-btn')};`);
    expect(css).toContain(`.obe-x-group { border: 1px solid ${border};`);
    for (const source of [css, exporter]) expect(source).toContain(`--obe-x-border: hsl(${token('border', dark)})`);
  });

  it('flattens every tab with token-sized, tracked, muted eyebrow labels', () => {
    const result = exportsFor([{type: 'tabs', props: {active: 1}, children: [
      {type: 'tab', props: {label: 'First'}, children: [para('A')]},
      {type: 'tab', props: {label: '<Second>'}, children: [para('B')]},
    ]}]);
    for (const doc of [result.clipboard, result.standalone]) {
      expect([...doc.querySelectorAll('.obe-x-group-name')].map((el) => el.textContent)).toEqual(['First', '<Second>']);
      expect(doc.querySelector('h3')).toBeNull();
      expect(doc.body.textContent).toContain('A');
      expect(doc.body.textContent).toContain('B');
    }
    const ratio = Number(token('obe-caption-size').match(/\* ([\d.]+)/)![1]);
    const size = `${parseFloat(token('obe-font-size')) * ratio}px`;
    expect(CONTAINER_EYEBROW_STYLE).toContain(`font-size:${size};line-height:${token('obe-caption-leading')};letter-spacing:0.04em;`);
    expect(exporter).toContain(`font-size: ${size}; line-height: ${token('obe-caption-leading')}; letter-spacing: 0.04em;`);
    expect(CONTAINER_EYEBROW_STYLE).toContain(`hsl(${token('muted-foreground')})`);
    expect(exporter).toContain(`--obe-x-muted: hsl(${token('muted-foreground', dark)})`);
  });

  it.each([
    [{}, true], [{collapsed: true}, false], [{collapsed: false}, true],
    [{expanded: false}, false], [{expanded: true}, true], [{collapsed: true, expanded: true}, false],
  ] as const)('exports native details with authored disclosure state %j', (props, open) => {
    const result = exportsFor([{type: 'accordion', children: [{type: 'accordionsection', props: {label: '<Item>', ...props}, children: [para('Disclosure body')]}]}]);
    for (const doc of [result.clipboard, result.standalone]) {
      const details = doc.querySelector('details')!;
      expect(details.hasAttribute('open')).toBe(open);
      expect(details.querySelector('summary')?.textContent).toBe('<Item>');
      expect(details.querySelector('p')?.textContent).toBe('Disclosure body');
    }
  });

  it('nests frames without swallowing siblings and preserves reactive and linear exports', () => {
    const blocks: NewBlock[] = [{type: 'group', props: {name: 'Outer'}, children: [
      {type: 'accordion', children: [{type: 'accordionsection', props: {label: 'Inner'}, children: [
        {id: 'quantity', type: 'number', props: {name: 'quantity', value: 3}},
        {type: 'group', props: {name: 'Empty'}, children: []},
        {type: 'divider'}, para('After divider'),
      ]}]},
    ]}, para('Outside')];
    const result = exportsFor(blocks);
    const frame = result.standalone.querySelector('main > section.obe-x-group')!;
    expect(frame.querySelector('details .obe-x-group')?.textContent?.trim()).toBe('Empty');
    expect(frame.querySelector('details input')).toBeTruthy();
    expect(frame.textContent).toContain('After divider');
    expect(frame.textContent).not.toContain('Outside');
    expect(result.projection.blocks.find((block) => block.id === 'quantity')).toBeTruthy();
    expect(result.projection.values).toContainEqual(['quantity', 3]);
    const model = buildDocumentModel({title: '', icon: '', snapshot: result.snapshot});
    expect(model.blocks.some((block) => block.type === 'unknown')).toBe(false);
    expect(toMarkdown(model)).toContain('After divider');
    const deck = new DOMParser().parseFromString(toSlideDeck(result.snapshot, '', ''), 'text/html');
    expect(deck.querySelectorAll('.slide')).toHaveLength(1);
    expect(deck.querySelector('.obe-x-group details')?.textContent).toContain('After divider');
  });
});
