import {useId, useState, type ReactNode} from 'react';
import {t} from '@/i18n';

const tabs = ['summary', 'notes', 'transcript'] as const;
type MeetingTab = typeof tabs[number];

/** Keep every pane mounted: hiding Notes must preserve its CRDT editor state. */
export function MeetingTabs({status, hasSummary, summary, notes, transcript}: {
  status: string; hasSummary: boolean; summary: ReactNode; notes: ReactNode; transcript: ReactNode;
}) {
  const id = useId();
  const [selected, select] = useState<MeetingTab | null>(null);
  const active = selected ?? (['requesting', 'recording', 'paused', 'processing'].includes(status)
    ? 'transcript' : hasSummary ? 'summary' : 'notes');
  const panes = {summary, notes, transcript};
  return <div className="obe-meeting-tabs">
    <div className="obe-meeting-tabs-strip" role="tablist" aria-label={t('meetingBlock.tabs')}>
      {tabs.map((tab, index) => <button key={tab} type="button" role="tab"
        className={`obe-tab${active === tab ? ' obe-tab-on' : ''}`}
        id={`${id}-${tab}-tab`} aria-controls={`${id}-${tab}-panel`}
        aria-selected={active === tab} tabIndex={active === tab ? 0 : -1}
        onClick={() => select(tab)} onKeyDown={(event) => {
          const next = event.key === 'ArrowRight' ? (index + 1) % tabs.length
            : event.key === 'ArrowLeft' ? (index + tabs.length - 1) % tabs.length
              : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : null;
          if (next === null) return;
          event.preventDefault();
          select(tabs[next]);
          document.getElementById(`${id}-${tabs[next]}-tab`)?.focus();
        }}>{t(`meetingBlock.${tab}`)}</button>)}
    </div>
    {tabs.map((tab) => <div key={tab} role="tabpanel" id={`${id}-${tab}-panel`}
      aria-labelledby={`${id}-${tab}-tab`} hidden={active !== tab} tabIndex={0}>
      {panes[tab]}
    </div>)}
  </div>;
}
