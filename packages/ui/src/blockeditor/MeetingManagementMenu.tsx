import {useRef} from 'react';
import {Ellipsis} from 'lucide-react';
import {t} from '@/i18n';
import {copyText} from '@/lib/pageActions';
import {showToast} from '@/components/ui/toast';
import {DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import {MENU_DESTRUCTIVE_CLASS, MENU_WIDTH_LG} from '@/components/ui/menu-components';
import {useConfirm} from '@/providers/ConfirmProvider';
import type {BlockMap} from './model';
import type {BlockEditorController} from './useBlockEditor';
import type {MeetingAudio, MeetingRecorder, MeetingSegment} from './meetingSessions';
import {deleteMeetingTranscript, failedTranscriptionChunks, meetingTranscriptLines, retryFailedTranscriptions} from './meetingManagement';

export function MeetingManagementMenu({block, editor, session, readOnly, saved, transcript, canTranscribe, summary, exporting, onExport}: {
  block: BlockMap; editor: BlockEditorController; session: MeetingRecorder; readOnly: boolean;
  saved: MeetingAudio[]; transcript: MeetingSegment[]; canTranscribe: boolean;
  summary: {generate: () => Promise<void>; canGenerate: boolean}; exporting: boolean; onExport: () => Promise<void>;
}) {
  const confirm = useConfirm();
  const currentReadOnly = useRef(readOnly);
  currentReadOnly.current = readOnly;
  if (readOnly && !saved.length && !transcript.length) return null;
  return <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <button type="button" aria-label={t('meetingBlock.manage')} title={t('meetingBlock.manage')}><Ellipsis className="h-4 w-4" /></button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" className={MENU_WIDTH_LG}>
      {!readOnly && <>
        <DropdownMenuItem disabled={!canTranscribe || !failedTranscriptionChunks(session).length} onSelect={() => retryFailedTranscriptions(session)}>{t('meetingBlock.retryAll')}</DropdownMenuItem>
        <DropdownMenuItem disabled={!summary.canGenerate} onSelect={() => void summary.generate()}>{t('meetingBlock.regenerateSummary')}</DropdownMenuItem>
        <DropdownMenuSeparator />
      </>}
      <DropdownMenuItem disabled={!saved.length || exporting} onSelect={() => void onExport()}>{t('meetingBlock.exportAudio')}</DropdownMenuItem>
      <DropdownMenuItem disabled={!transcript.length} onSelect={async () => {
        const copied = await copyText(meetingTranscriptLines(transcript).join('\n'));
        showToast({message: t(copied ? 'meetingBlock.transcriptCopied' : 'meetingBlock.transcriptCopyFailed')});
      }}>{t('meetingBlock.copyTranscript')}</DropdownMenuItem>
      {!readOnly && <>
        <DropdownMenuSeparator />
        <DropdownMenuItem className={MENU_DESTRUCTIVE_CLASS} disabled={!transcript.length} onSelect={async () => {
          if (await confirm({title: t('meetingBlock.deleteTranscript'), description: t('meetingBlock.deleteTranscriptBody'), confirmText: t('meetingBlock.deleteTranscript'), destructive: true}) && !currentReadOnly.current) {
            deleteMeetingTranscript(editor.doc, block);
          }
        }}>{t('meetingBlock.deleteTranscript')}</DropdownMenuItem>
      </>}
    </DropdownMenuContent>
  </DropdownMenu>;
}
