import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {unzipSync} from 'fflate';
import {setAssetBridge} from '@/lib/assetBridge';
import {downloadBlob} from '@/lib/download';
import {setLocale, t} from '@/i18n';
import {MeetingBlockView} from '../MeetingBlockView';
import {exportMeetingAudio} from '../meetingAudioExport';
import {createDoc, docToJSON, rootBlocks} from '../model';
import type {BlockEditorController} from '../useBlockEditor';
import type {MeetingAudio} from '../meetingRecorder';

vi.mock('@/lib/download', async (original) => ({...await original<typeof import('@/lib/download')>(), downloadBlob: vi.fn()}));
const getAsset = vi.fn(async (id: string) => ({bytes: new Uint8Array(id === 'a' ? [1, 2] : [3, 4]), mime: 'audio/webm;codecs=opus'}));
const chunks = [{assetId: 'a', startedAtMs: 0, durationMs: 45000}, {assetId: 'b', startedAtMs: 45000, durationMs: 20000}];
function harness(audioChunks: MeetingAudio[], readOnly = false, pageReadOnly = false) {
  const doc = createDoc([{type: 'meeting', props: {title: 'Team / sync', audioChunks}}]);
  const block = rootBlocks(doc).get(0);
  render(<MeetingBlockView block={block} editor={{doc, readOnly} as BlockEditorController} pageReadOnly={pageReadOnly} />);
  return doc;
}
beforeEach(() => {
  vi.clearAllMocks();
  getAsset.mockResolvedValue({bytes: new Uint8Array([1, 2]), mime: 'audio/webm;codecs=opus'});
  setAssetBridge({getAsset, putAsset: vi.fn()});
});
afterEach(() => { cleanup(); setAssetBridge(null); setLocale('en'); });

describe('MEET-7 audio export', () => {
  it('hides the affordance without chunks', () => {
    harness([]);
    expect(screen.queryByRole('button', {name: 'Export audio'})).toBeNull();
  });
  it.each([[false, false], [true, false], [false, true]])('downloads a single original file, including viewer modes (%s, %s)', async (readOnly, pageReadOnly) => {
    const doc = harness([chunks[0]], readOnly, pageReadOnly);
    const before = docToJSON(doc);
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Export audio'})));
    expect(downloadBlob).toHaveBeenCalledWith('Team - sync-00h00m00s.webm', expect.any(Blob));
    const blob = vi.mocked(downloadBlob).mock.calls[0][1];
    expect(new Uint8Array(await blob.arrayBuffer())).toEqual(new Uint8Array([1, 2]));
    expect(blob.type).toBe('audio/webm;codecs=opus');
    expect(docToJSON(doc)).toEqual(before);
  });
  it('zips chunks in timestamp order with exact names and original bytes', async () => {
    getAsset.mockImplementation(async (id) => ({bytes: new Uint8Array(id === 'a' ? [1, 2] : [3, 4]), mime: id === 'a' ? 'audio/webm' : 'audio/mp4'}));
    await exportMeetingAudio([...chunks].reverse(), 'Team');
    expect(downloadBlob).toHaveBeenCalledWith('Team-audio.zip', expect.any(Blob));
    const entries = unzipSync(new Uint8Array(await vi.mocked(downloadBlob).mock.calls[0][1].arrayBuffer()));
    expect(Object.keys(entries)).toEqual(['001-00h00m00s.webm', '002-00h00m45s.mp4']);
    expect(entries['001-00h00m00s.webm']).toEqual(new Uint8Array([1, 2]));
    expect(entries['002-00h00m45s.mp4']).toEqual(new Uint8Array([3, 4]));
  });
  it('renders zero-padded hours for long recordings', async () => {
    await exportMeetingAudio([{assetId: 'a', startedAtMs: 43245000, durationMs: 20000}], 'Team');
    expect(downloadBlob).toHaveBeenCalledWith('Team-12h00m45s.webm', expect.any(Blob));
  });
  it('derives missing timestamps from preceding durations without dropping repeated assets', async () => {
    await exportMeetingAudio([{assetId: 'a', durationMs: 45000}, {assetId: 'a', durationMs: 20000}], 'Team');
    const entries = unzipSync(new Uint8Array(await vi.mocked(downloadBlob).mock.calls[0][1].arrayBuffer()));
    expect(Object.keys(entries)).toEqual(['001-00h00m00s.webm', '002-00h00m45s.webm']);
  });
  it.each(['denied', 'missing'])('surfaces %s assets without partial downloads and permits retry', async (failure) => {
    harness(chunks, true);
    if (failure === 'denied') getAsset.mockRejectedValue(new Error('403 Forbidden'));
    else setAssetBridge({getAsset: async () => null, putAsset: vi.fn()});
    await act(async () => fireEvent.click(screen.getByRole('button', {name: 'Export audio'})));
    expect(screen.getByRole('alert').textContent).toBe(t('meetingBlock.exportAudioFailed'));
    expect(downloadBlob).not.toHaveBeenCalled();
    expect((screen.getByRole('button', {name: 'Export audio'}) as HTMLButtonElement).disabled).toBe(false);
  });
  it.each(['en', 'de', 'ja', 'zh'] as const)('has a translated accessible label and error in %s', (locale) => {
    setLocale(locale); harness(chunks, true);
    expect(screen.getByRole('button', {name: t('meetingBlock.exportAudio')})).toBeTruthy();
    expect(t('meetingBlock.exportAudioFailed')).not.toContain('meetingBlock.');
    if (locale !== 'en') expect(t('meetingBlock.exportAudio')).not.toBe('Export audio');
  });
});
