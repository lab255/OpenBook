import {ConfirmProvider} from '@/providers/ConfirmProvider';
import {act, cleanup, fireEvent, render, screen, within} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {setAiBridge} from '@/lib/aiBridge';
import {setLocale, t} from '@/i18n';
import {AiBridgeHost} from '@/components/AiBridgeHost';
import {DataProvider} from '@/data';
import type {DataClient} from '@book.dev/sdk';
import {MeetingBlockView} from '../MeetingBlockView';
import {materializeMeetingSummary} from '../meetingSummaryBlocks';
import {MeetingSummary, meetingSummaryPrompt} from '../MeetingSummary';
import {blockProp, createDoc, docToJSON, rootBlocks} from '../model';
import type {BlockEditorController} from '../useBlockEditor';
import {blocksToHtml, blocksToMarkdown, projectBlocksForExport} from '../exportBlocks';

const generate = vi.fn<DataClient['aiGenerate']>();
const transcript = [{startMs: 0, endMs: 1000, text: 'Alex will ship on Friday.'}];
function harness(props = {}) {
  const doc = createDoc([{type: 'meeting', props: {status: 'done', transcript, ...props}, children: [{type: 'paragraph', text: 'Private manual notes'}]}]);
  const block = rootBlocks(doc).get(0);
  const editor = {doc, readOnly: false} as BlockEditorController;
  const view = render(<ConfirmProvider><MeetingBlockView block={block} editor={editor} pageReadOnly={false} /></ConfirmProvider>);
  fireEvent.click(screen.getByRole('tab', {name: t('meetingBlock.summary')}));
  return {doc, block, ...view};
}
function install(ready = true) {
  setAiBridge({ready: () => ready, generate, complete: vi.fn(), tasks: vi.fn(), applyProposals: vi.fn(), applySuggestion: vi.fn()});
}
beforeEach(() => { generate.mockReset(); install(); });
afterEach(() => { cleanup(); setAiBridge(null); setLocale('en'); });

describe('MEET-6 meeting summary', () => {
  it('opens Summary and shows the stream when regenerating from Notes via the menu', async () => {
    let finish!: (text: string) => void;
    generate.mockImplementation((_prompt, token) => { token('Menu partial'); return new Promise((resolve) => { finish = resolve; }); });
    harness({summary: 'Old summary'});
    fireEvent.click(screen.getByRole('tab', {name: 'Notes'}));
    fireEvent.keyDown(screen.getByRole('button', {name: 'Meeting actions'}), {key: 'ArrowDown'});
    await act(async () => fireEvent.click(screen.getByRole('menuitem', {name: 'Regenerate summary'})));
    expect(screen.getByRole('tab', {name: 'Summary'}).getAttribute('aria-selected')).toBe('true');
    expect(within(screen.getByRole('tabpanel')).getByText('Menu partial')).toBeTruthy();
    await act(async () => finish('Menu final'));
  });
  it('offers a single-click generation on done without starting a paid call automatically', () => {
    harness();
    expect(screen.getByText(t('meetingBlock.summaryOffer'))).toBeTruthy();
    expect(screen.getByRole('button', {name: 'Generate summary'})).toBeTruthy();
    expect(generate).not.toHaveBeenCalled();
  });
  it.each([{segments: []}, {segments: [{startMs: 0, endMs: 1, text: '  '}]}])('does not offer an empty transcript', ({segments}) => {
    harness({transcript: segments});
    expect(screen.queryByRole('button', {name: 'Generate summary'})).toBeNull();
    expect(screen.queryByText(t('meetingBlock.summaryOffer'))).toBeNull();
  });
  it('offers explicit generation before done', () => {
    harness({status: 'idle'});
    expect(screen.getByRole('button', {name: 'Generate summary'})).toBeTruthy();
    expect(screen.queryByText(t('meetingBlock.summaryOffer'))).toBeNull();
  });
  it('streams ephemerally and materialises summary blocks in one transaction, including exports', async () => {
    let finish!: (text: string) => void;
    generate.mockImplementation((_prompt, token) => { token('New partial'); return new Promise((resolve) => { finish = resolve; }); });
    const {doc, block} = harness({summary: 'Old summary'});
    const before = docToJSON(doc);
    const update = vi.fn(); doc.on('update', update);
    fireEvent.click(screen.getByRole('button', {name: 'Regenerate summary'}));
    expect(screen.getByText('New partial')).toBeTruthy();
    expect(screen.getByText('Generating summary…').getAttribute('aria-live')).toBe('polite');
    expect(blockProp(block, 'summary')).toBe('Old summary'); expect(update).not.toHaveBeenCalled();
    await act(async () => finish('New final summary'));
    expect(update).toHaveBeenCalledTimes(1);
    expect(blockProp(block, 'summary')).toBe('');
    expect(docToJSON(doc)[0].children?.slice(1)).toEqual(before[0].children);
    expect(docToJSON(doc)[0].children?.[0]).toMatchObject({id: `${before[0].id}:summary`, type: 'meetingsummary', children: [{type: 'paragraph', text: [{t: 'New final summary'}]}]});
    for (const output of [blocksToHtml(docToJSON(doc)), blocksToMarkdown(docToJSON(doc)), JSON.stringify(projectBlocksForExport(docToJSON(doc)))]) {
      expect(output).toContain('New final summary'); expect(output).toContain('Private manual notes');
    }
  });
  it.each([false, null])('disables generation without a ready AI bridge (%s)', (ready) => {
    if (ready === null) setAiBridge(null); else install(ready);
    harness();
    expect((screen.getByRole('button', {name: 'Generate summary'}) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText(t('meetingBlock.summaryUnavailable'))).toBeTruthy();
  });
  it.each([new Error('403 Forbidden'), Object.assign(new Error('Denied'), {status: 403}), new Error('Stream disconnected'), new Error('OpenBook request failed (400 Bad Request): AI is not configured')])('preserves prior summary on errors: %s', async (error) => {
    generate.mockImplementation(async (_prompt, token) => { token('Incomplete'); throw error; });
    const {doc} = harness({summary: 'Old summary'}); const before = docToJSON(doc);
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Regenerate summary'})));
    expect(docToJSON(doc)).toEqual(before); expect(screen.getByText('Old summary')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toBe(t(error.message.includes('403') || 'status' in error ? 'meetingBlock.summaryForbidden' : 'meetingBlock.summaryFailed'));
  });
  it('keeps the button enabled and focused during streaming and cancels without replacing the summary', async () => {
    let finish!: (text: string) => void;
    let token!: (text: string) => void;
    let signal!: AbortSignal;
    generate.mockImplementation((_prompt, onToken, opts) => {
      token = onToken; signal = opts!.signal!;
      return new Promise((resolve) => { finish = resolve; });
    });
    const {doc} = harness({summary: 'Old summary'});
    const before = docToJSON(doc);
    const button = screen.getByRole('button', {name: 'Regenerate summary'}) as HTMLButtonElement;
    button.focus();
    fireEvent.click(button);
    act(() => token('Partial summary'));
    expect(screen.getByRole('button', {name: t('meetingBlock.cancelSummary')})).toBe(button);
    expect(button.disabled).toBe(false);
    expect(button.tabIndex).toBe(0);
    expect(document.activeElement).toBe(button);
    fireEvent.click(button);
    expect(signal.aborted).toBe(true);
    await act(async () => { token('Late token'); finish('Late result'); });
    expect(docToJSON(doc)).toEqual(before);
    expect(screen.getByText('Old summary')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', {name: 'Regenerate summary'})).toBe(button);
    expect(button.disabled).toBe(false);
    expect(document.activeElement).toBe(button);
  });
  it('seeds legacy summary lines as paragraphs, decisions and action items', () => {
    const {doc} = harness({summary: 'Meeting recap.\n\nDecision: ship Friday.\nAction: Alex will ship.\n'});
    materializeMeetingSummary(doc, doc.getArray('blocks').get(0) as import('../model').BlockMap);
    const blocks = docToJSON(doc);
    const html = document.createElement('div');
    html.innerHTML = blocksToHtml(blocks);
    const paragraphs = Array.from(html.querySelectorAll('p'), (paragraph) => paragraph.textContent);
    expect(paragraphs).toContain('Meeting recap.');
    expect(paragraphs).toContain('Private manual notes');
    expect(html.querySelector('h3')?.textContent).toBe('Decisions');
    expect(paragraphs).not.toContain('');
    expect(blocksToMarkdown(blocks)).toContain('ship Friday.');
    expect(blocksToMarkdown(blocks)).toContain('Alex will ship.');
  });
  it('aborts on unmount and ignores even late tokens and completion', async () => {
    let finish!: (text: string) => void;
    let token!: (text: string) => void;
    let signal!: AbortSignal;
    generate.mockImplementation((_prompt, onToken, opts) => { token = onToken; signal = opts!.signal!; return new Promise((resolve) => { finish = resolve; }); });
    const {unmount, block} = harness({summary: 'Old summary'});
    fireEvent.click(screen.getByRole('button', {name: 'Regenerate summary'})); unmount();
    expect(signal.aborted).toBe(true);
    await act(async () => { token('Late'); finish('Late result'); });
    expect(blockProp(block, 'summary')).toBe('Old summary');
  });
  it('publishes async readiness and forwards generation and cancellation through the host', async () => {
    const client = {aiStatus: vi.fn(async () => ({ready: true})), aiGenerate: generate} as unknown as DataClient;
    generate.mockResolvedValue('Host summary');
    render(<DataProvider client={client}><AiBridgeHost /></DataProvider>);
    const {block} = harness();
    await act(async () => {});
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Generate summary'})));
    expect(generate).toHaveBeenCalledWith(expect.stringContaining(transcript[0].text), expect.any(Function), {signal: expect.any(AbortSignal)});
    expect(blockProp(block, 'summary')).toBe('');
    expect(blocksToMarkdown(docToJSON(block.doc!))).toContain('Host summary');
  });
  it('disables generation for a local client whose AI status is unavailable', async () => {
    const client = {aiStatus: vi.fn(async () => ({ready: false, config: {provider: 'off'}})), aiGenerate: generate} as unknown as DataClient;
    render(<DataProvider client={client}><AiBridgeHost /></DataProvider>);
    harness();
    await act(async () => {});
    expect((screen.getByRole('button', {name: 'Generate summary'}) as HTMLButtonElement).disabled).toBe(true);
    expect(generate).not.toHaveBeenCalled();
  });
  it.each(['en', 'de', 'ja', 'zh'] as const)('provides translated controls and errors in %s', async (locale) => {
    setLocale(locale); generate.mockRejectedValue(new Error('offline')); harness();
    await act(async () => fireEvent.click(screen.getByRole('button', {name: t('meetingBlock.generateSummary')})));
    expect(screen.getByRole('alert').textContent).toBe(t('meetingBlock.summaryFailed'));
    expect(screen.getByRole('region', {name: t('meetingBlock.summary')})).toBeTruthy();
  });
  it('preserves a collaborator summary created during generation and requires fresh confirmation to replace it', async () => {
    let finish!: (text: string) => void;
    generate.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    const {doc, block} = harness();
    fireEvent.click(screen.getByRole('button', {name: 'Generate summary'}));
    act(() => materializeMeetingSummary(doc, block, [{type: 'paragraph', text: 'Collaborator edits'}]));
    const before = docToJSON(doc);
    await act(async () => finish('Generated draft'));
    expect(docToJSON(doc)).toEqual(before);
    expect(screen.getByText('Generated draft')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', {name: 'Replace summary'}));
    expect(screen.getByRole('dialog')).toBeTruthy();
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Cancel'})));
    expect(docToJSON(doc)).toEqual(before);
    fireEvent.click(screen.getByRole('button', {name: 'Replace summary'}));
    await act(async () => fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', {name: 'Replace summary'})));
    expect(blocksToMarkdown(docToJSON(doc))).toContain('Generated draft');
    expect(blocksToMarkdown(docToJSON(doc))).not.toContain('Collaborator edits');
    expect(generate).toHaveBeenCalledTimes(1);
  });
  it('offers Add summary for an editable empty meeting and a muted read-only empty state', () => {
    const {unmount} = harness({transcript: []});
    expect(screen.getByRole('button', {name: 'Add summary'})).toBeTruthy();
    unmount();
    const doc = createDoc([{type: 'meeting'}]);
    render(<ConfirmProvider><MeetingSummary block={rootBlocks(doc).get(0)} editor={{doc} as BlockEditorController} readOnly status="idle" transcript={[]} /></ConfirmProvider>);
    expect(screen.getByText('No summary yet.').className).toBe('obe-meeting-summary-empty');
  });
  it('generates without confirmation into an empty summary container', async () => {
    generate.mockResolvedValue('New summary');
    const {doc, block} = harness();
    act(() => materializeMeetingSummary(doc, block));
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Generate summary'})));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(blocksToMarkdown(docToJSON(doc))).toContain('New summary');
  });
  it('bounds long input using the existing completion budget and discloses the excerpt', () => {
    const prompt = meetingSummaryPrompt([{startMs: 0, endMs: 1, text: 'x'.repeat(10000)}]);
    expect(prompt).toContain('excerpt'); expect(prompt).toContain('x'.repeat(4000)); expect(prompt).not.toContain('x'.repeat(4001));
    expect(prompt).toContain('literally in English on their own lines'); expect(prompt).toContain('content in the transcript\'s language');
    expect(prompt).toContain('2–3 sentence'); expect(prompt).toContain('owners only if named');
  });
});
