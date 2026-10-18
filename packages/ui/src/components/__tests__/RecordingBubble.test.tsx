import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {setLocale, t} from '@/i18n';
import PresentMode from '../PresentMode';
import {createDoc} from '@/blockeditor/model';
import {registerOpenDoc} from '@/lib/openDocs';
import {MeetingSessionHost, RecordingBubble} from '../MeetingSessionHost';

const state = vi.hoisted(() => ({
  go: vi.fn(),
  client: {},
  setClient: vi.fn(),
  sessions: [] as {pageId: string; blockId: string; unsaved?: boolean; error?: string; active?: boolean; discard?: ReturnType<typeof vi.fn>; visible: boolean; readOnly: boolean; mode: string; elapsedMs: number; pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>}[],
}));
vi.mock('@/data', () => ({useData: () => state.client}));
vi.mock('@/lib/useCanWrite', () => ({useCanWrite: () => true}));
vi.mock('../appearance/PageCustomiseBody', () => ({usePageThemeStyle: () => undefined}));
vi.mock('@/blockeditor/PresentBlocks', () => ({PresentBlocks: () => <p>Slide without a meeting</p>}));
vi.mock('@/providers/ConfirmProvider', () => ({useConfirm: () => async () => true}));
vi.mock('@/providers', () => ({useNavigation: () => ({selectPageAtBlock: state.go, pageLabel: () => 'Slides'}), useHud: () => ({hud: {present: {open: true, mode: 'fullscreen', pageId: 'slides'}}, setHud: vi.fn()})}));
vi.mock('@/blockeditor/meetingSessions', async (original) => ({
  ...await original<typeof import('@/blockeditor/meetingSessions')>(),
  setMeetingSessionClient: state.setClient,
  activeSessions: () => state.sessions,
  meetingSessions: () => state.sessions,
}));
afterEach(() => { cleanup(); state.sessions = []; state.go.mockClear(); setLocale('en'); vi.useRealTimers(); });
const session = (blockId = 'block') => ({pageId: 'page', blockId, visible: false, readOnly: false, active: true, mode: 'recording', elapsedMs: 2000, pause: vi.fn(), resume: vi.fn(), stop: vi.fn()});

describe('recording bubble', () => {
  it('controls off-page capture, updates elapsed without announcing ticks, and navigates to the block anchor', () => {
    vi.useFakeTimers();
    const current = session(); state.sessions = [current];
    const view = render(<RecordingBubble canWrite />);
    expect(screen.getByRole('complementary', {name: 'Recording sessions'})).toBeTruthy();
    expect(screen.getByRole('status').textContent).toBe('Recording');
    current.elapsedMs = 3000;
    act(() => { vi.advanceTimersByTime(1000); });
    expect(screen.getByLabelText('Elapsed recording time').textContent).toBe('0:03');
    expect(screen.getByRole('status').textContent).toBe('Recording');
    fireEvent.click(screen.getByRole('button', {name: 'Pause'})); expect(current.pause).toHaveBeenCalledOnce();
    current.mode = 'paused'; view.rerender(<RecordingBubble canWrite />);
    fireEvent.click(screen.getByRole('button', {name: 'Resume'})); expect(current.resume).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole('button', {name: 'Go to meeting'})); expect(state.go).toHaveBeenCalledWith('page', 'block');
    fireEvent.click(screen.getByRole('button', {name: 'Stop'})); expect(current.stop).toHaveBeenCalledOnce();
  });

  it('stacks sessions and hides controls for visible blocks, viewers, read-only and idle sessions', () => {
    const first = session(); const second = session('second'); state.sessions = [first, second];
    const view = render(<RecordingBubble canWrite />);
    expect(screen.getAllByRole('button', {name: 'Stop'})).toHaveLength(2);
    first.visible = true; view.rerender(<RecordingBubble canWrite />);
    expect(screen.getAllByRole('button', {name: 'Stop'})).toHaveLength(1);
    view.rerender(<RecordingBubble canWrite={false} />); expect(screen.queryByRole('button')).toBeNull();
    second.readOnly = true; view.rerender(<RecordingBubble canWrite />); expect(screen.queryByRole('button')).toBeNull();
    second.readOnly = false; second.mode = 'done'; view.rerender(<RecordingBubble canWrite />); expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['en', 'de', 'ja', 'zh'] as const)('labels the region and navigation in %s', (locale) => {
    setLocale(locale); state.sessions = [session()];
    render(<RecordingBubble canWrite />);
    expect(screen.getByRole('complementary', {name: t('meetingBlock.recordingSessions')})).toBeTruthy();
    expect(screen.getByRole('button', {name: t('meetingBlock.goToMeeting')})).toBeTruthy();
  });
});


it('shows detached failed recordings and confirms discard', async () => {
  const current = {...session(), active: false, mode: 'done', unsaved: true, error: '403: upload failed', discard: vi.fn()};
  state.sessions = [current]; render(<RecordingBubble canWrite />);
  expect(screen.getByRole('status').textContent).toContain('403');
  expect(screen.getByRole('button', {name: 'Go to meeting'})).toBeTruthy();
  await act(async () => { fireEvent.click(screen.getByRole('button', {name: 'Discard'})); });
  expect(current.discard).toHaveBeenCalledOnce();
});

it('keeps attached recording controls operable in present mode without a meeting block', () => {
  const current = {...session(), visible: true}; state.sessions = [current];
  render(<RecordingBubble canWrite presenting />);
  fireEvent.click(screen.getByRole('button', {name: 'Pause'})); expect(current.pause).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole('button', {name: 'Stop'})); expect(current.stop).toHaveBeenCalledOnce();
});


it('portals operable recording controls into the present dialog above a slide without a meeting', () => {
  const current = {...session(), visible: true}; state.sessions = [current];
  const unregister = registerOpenDoc('slides', createDoc([{type: 'paragraph', text: 'A slide'}]));
  const view = render(<PresentMode />);
  const dialog = screen.getByRole('dialog', {name: 'Present'});
  const bubble = screen.getByRole('complementary', {name: 'Recording sessions'});
  expect(dialog.contains(bubble)).toBe(true);
  expect(view.container.contains(bubble)).toBe(false);
  const stop = screen.getByRole('button', {name: 'Stop'});
  stop.focus(); expect(document.activeElement).toBe(stop);
  fireEvent.click(stop); expect(current.stop).toHaveBeenCalledOnce();
  view.unmount(); unregister();
});


it('stops sessions before clearing or replacing the client on host cleanup', () => {
  const current = session(); state.sessions = [current]; state.setClient.mockClear();
  const view = render(<MeetingSessionHost />);
  state.client = {}; view.rerender(<MeetingSessionHost />);
  expect(current.stop).toHaveBeenCalledOnce();
  expect(state.setClient.mock.calls.map(([value]) => value)).toEqual([expect.any(Object), null, state.client]);
  expect(current.stop.mock.invocationCallOrder[0]).toBeLessThan(state.setClient.mock.invocationCallOrder[1]);
  view.unmount();
});
