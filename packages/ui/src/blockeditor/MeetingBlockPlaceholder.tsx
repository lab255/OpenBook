import {blockChildren, blockProp} from './model';
import type {CustomBlockDef, CustomBlockProps} from './registry';

/** MEET-5 replaces this shell. The container model already preserves notes;
 * this placeholder deliberately offers no recording controls or slash entry. */
const MeetingBlockPlaceholder = ({block}: CustomBlockProps) => (
  <section aria-label="Meeting">
    <strong>{blockProp<string>(block, 'title') || 'Meeting'}</strong>
    <p>{blockProp<string>(block, 'status') || 'idle'} — Meeting view coming soon.</p>
    <p>{blockChildren(block)?.length ?? 0} note blocks saved.</p>
  </section>
);

export const MEETING_BLOCK: CustomBlockDef = {type: 'meeting', render: MeetingBlockPlaceholder};
