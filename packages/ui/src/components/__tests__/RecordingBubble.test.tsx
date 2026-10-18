import {act, cleanup, fireEvent, render, screen} from '@testing-library/react';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {setLocale, t} from '@/i18n';
import {RecordingBubble} from '../MeetingSessionHost';

const state = vi.hoisted(() => ({
  go: vi.fn(),
  sessions: [] as {pageId: string; blockId: string; visible: boolean; readOnly: boolean; mode: string; elapsedMs: number; pause: ReturnType<typeof vi.fn>; resume: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn>}[],
}));
vi.mock('@/providers', () => ({useNavigation: () => ({selectPageAtBlock: state.go})}));
vi.mock('@/blockeditor/meetingSessions', async (original) => ({
  ...await original<typeof import('@/blockeditor/meetingSessions')>(),
  activeSessions: () => state.sessions,
}));
afterEach(() => { cleanup(); state.sessions = []; state.go.mockClear(); setLocale('en'); vi.useRealTimers(); });
const session = (blockId = 'block') => ({pageId: 'page', blockId, visible: false, readOnly: false, mode: 'recording', elapsedMs: 2000, pause: vi.fn(), resume: vi.fn(), stop: vi.fn()});

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
