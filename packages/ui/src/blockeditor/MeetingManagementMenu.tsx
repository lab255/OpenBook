import {useRef} from 'react';
import {Copy, Download, MoreHorizontal, RefreshCw, Sparkles, Trash2} from 'lucide-react';
import {t} from '@/i18n';
import {copyText} from '@/lib/pageActions';
import {showToast} from '@/components/ui/toast';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {MENU_DESTRUCTIVE_CLASS, MENU_WIDTH_LG} from '@/components/ui/menu-components';
import {useConfirm} from '@/providers/ConfirmProvider';
import type {MeetingTab} from './MeetingTabs';
import type {BlockMap} from './model';
import type {BlockEditorController} from './useBlockEditor';
import type {MeetingAudio, MeetingRecorder, MeetingSegment} from './meetingSessions';
import {deleteMeetingTranscript, failedTranscriptionChunks, meetingManagementVisible, meetingTranscriptLines, retryFailedTranscriptions} from './meetingManagement';

export function MeetingManagementMenu({block, editor, session, readOnly, saved, transcript, canTranscribe, summary, exporting, onExport, showTab}: {
  block: BlockMap; editor: BlockEditorController; session: MeetingRecorder; readOnly: boolean;
  saved: MeetingAudio[]; transcript: MeetingSegment[]; canTranscribe: boolean;
  showTab: (tab: MeetingTab) => void;
  summary: {label: string; generate: () => Promise<void>; canGenerate: boolean}; exporting: boolean; onExport: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const currentReadOnly = useRef(readOnly);
  currentReadOnly.current = readOnly;
  if (!meetingManagementVisible(readOnly, saved, transcript)) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" className="obe-meeting-manage" aria-label={t('meetingBlock.manage')} title={t('meetingBlock.manage')}><MoreHorizontal className="h-4 w-4" /></button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={`${MENU_WIDTH_LG} whitespace-nowrap`}>
      {!readOnly && <>
        {failedTranscriptionChunks(session).length > 0 && <DropdownMenuItem disabled={!canTranscribe} onSelect={() => { showTab('transcript'); retryFailedTranscriptions(session); }}><RefreshCw className="mr-2 h-3.5 w-3.5" />{t('meetingBlock.retryAll')}</DropdownMenuItem>}
        <DropdownMenuItem disabled={!summary.canGenerate} onSelect={() => { showTab('summary'); void summary.generate(); }}><Sparkles className="mr-2 h-3.5 w-3.5" />{summary.label}</DropdownMenuItem>
        <DropdownMenuSeparator />
      </>}
      <DropdownMenuItem disabled={!saved.length || exporting} onSelect={() => void onExport()}><Download className="mr-2 h-3.5 w-3.5" />{t('meetingBlock.exportAudio')}</DropdownMenuItem>
      <DropdownMenuItem disabled={!transcript.length} onSelect={async () => {
        const copied = await copyText(meetingTranscriptLines(transcript).join('\n'));
        showToast({message: t(copied ? 'meetingBlock.transcriptCopied' : 'meetingBlock.transcriptCopyFailed')});
      }}><Copy className="mr-2 h-3.5 w-3.5" />{t('meetingBlock.copyTranscript')}</DropdownMenuItem>
      {!readOnly && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_DESTRUCTIVE_CLASS} disabled={!transcript.length} onSelect={async () => {
          if (await confirm({title: t('meetingBlock.deleteTranscriptTitle'), description: t('meetingBlock.deleteTranscriptBody') + (session.chunks.some((chunk) => chunk.busy || chunk.phase === 'uploading' || chunk.phase === 'transcribing') ? ' ' + t('meetingBlock.deleteTranscriptPending') : ''), confirmText: t('meetingBlock.deleteTranscript'), destructive: true}) && !currentReadOnly.current) {
            deleteMeetingTranscript(editor.doc, block);
          }
        }}><Trash2 className="mr-2 h-3.5 w-3.5" />{t('meetingBlock.deleteTranscript')}</DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
