import React from 'react';
import {ui} from './ui';
import {api, LEDGER_MAX_TRANSACTION_LIMIT} from '@book.dev/plugin-sdk';
import {formatWithSide, type ReportAccount, type ReportTransaction} from './reports';
import type {ReconcileStatement} from './reconcile';
import type {ReportPeriod} from './periods';
import {setUpBooks} from './setup';

/**
 * Shared chrome for the read-only ledger report blocks (LGR-8): the live data
 * hook both of them read from, the block-prop helpers they persist their
 * controls through, and the style tokens that keep them looking like one
 * report family.
 *
 * THEMING: every colour comes from the public `.obe-ui-*` classes, which read
 * host tokens. Controls remain native elements for keyboard access; the public
 * surface supplies hover, focus and disabled states.
 */

// ── Block props (CRDT) ────────────────────────────────────────────────────────

export interface PropsMap {
  get(k: string): unknown;
  set(k: string, v: unknown): void;
  delete(k: string): void;
}

export interface BlockLike {
  get(k: string): unknown;
}

export interface EditorLike {
  doc: {transact(fn: () => void, origin: string): void};
  readOnly: boolean;
}

export function readProps(block: BlockLike): PropsMap | undefined {
  return block.get('props') as PropsMap | undefined;
}

export function readString(props: PropsMap | undefined, key: string, fallback = ''): string {
  const value = props?.get(key);
  return typeof value === 'string' ? value : fallback;
}

export function readBool(props: PropsMap | undefined, key: string, fallback = false): boolean {
  const value = props?.get(key);
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * Persist one report control into the block's props map. Read-only PAGES write
 * nothing (a viewer may re-filter a report on screen; it must not edit the
 * document doing so).
 *
 * The gate is `pageLocked` — the DOCUMENT's lock, which each block derives once
 * from the host-supplied `pageReadOnly` — because the editor handed to an
 * interactive widget on a locked page deliberately reports `readOnly: false`
 * (LGR-6). The `editor.readOnly` arm exists only as the harness fallback for a
 * caller with no host to ask; every in-tree caller passes `pageLocked`.
 */
export function writeProp(block: BlockLike, editor: EditorLike, key: string, value: string | boolean, pageLocked?: boolean): void {
  const props = readProps(block);
  if (!props || (pageLocked ?? editor.readOnly)) return;
  editor.doc.transact(() => props.set(key, value), 'local');
}

// ── Live ledger data ──────────────────────────────────────────────────────────

/**
 * How many transactions a report reads: the server's own exported cap, NOT a
 * literal. A full page means "there may be more", so the blocks say the figures
 * are partial ({@link LedgerReportData.truncated}) rather than quietly totalling
 * a subset. Reading the shared constant is what keeps that inference sound — a
 * cap that dropped under a hard-coded request would clamp the read, leave
 * `truncated` permanently false, and render a partial total as a complete one.
 * Paged/streamed reporting for very large books is a later task.
 */
export const REPORT_TX_LIMIT = LEDGER_MAX_TRANSACTION_LIMIT;

export interface LedgerReportData {
  state: 'loading' | 'uninitialized' | 'ready' | 'error';
  accounts: ReportAccount[];
  transactions: ReportTransaction[];
  /**
   * Every statement reconciliation the book holds (LGR-11). Read alongside the
   * accounts and transactions, and subscribed to, because a `reconciled`
   * posting is only legible if the report can name the statement that froze it
   * — an id in a cell explains nothing.
   */
  reconciliations: ReconcileStatement[];
  /**
   * Every period record (LGR-12) — closed and reopened history. Read alongside
   * the rest so the reports can render the display-only closed-period marker
   * and the period-close block can list and act on them. Enforcement is the
   * store's; this list only informs.
   */
  periods: ReportPeriod[];
  /** The server returned a full page — older entries are NOT in these figures. */
  truncated: boolean;
  error: string | null;
  /** Re-run the whole boot (used by the "set up books" and retry paths). */
  reload: () => void;
}

/**
 * Read the ledger's accounts + transactions and keep them LIVE: the three
 * seeded ledger databases are subscribed through `api.databases.subscribeRows`,
 * so a posted entry, a renamed account or a cleared-state flip refreshes the
 * open report with no reload.
 *
 * CONCURRENCY (the rule this hook is arranged around): loads OVERLAP by design —
 * posting one entry mutates the transactions AND the postings database, so two
 * subscription callbacks fire for a single user action. Without a request token
 * the last response to SETTLE wins regardless of the order they were issued in,
 * and the report can silently come to rest on an OLDER book while still captioned
 * "In balance ✓". So every load carries a token and only the newest one may
 * write; anything else is dropped. A wrong number rendered confidently is the
 * worst outcome a ledger report has, worse than a spinner.
 *
 * LIFETIME: `cancelled` is a per-effect-run closure variable, NOT a shared ref.
 * A ref is a single cell across effect generations — cleanup sets it false and
 * the next run sets it true again, which resurrects an orphaned in-flight load
 * from the previous generation and lets it write. Subscriptions are registered
 * through {@link subscribe}, which stops one immediately if the effect was torn
 * down while the initial load was still in flight (otherwise the continuation
 * subscribes into an already-emptied cleanup list and leaks a live stream that
 * re-reads the whole book on every ledger mutation for the rest of the session).
 */
export function useLedgerReport(): LedgerReportData {
  const [state, setState] = React.useState<LedgerReportData['state']>('loading');
  const [accounts, setAccounts] = React.useState<ReportAccount[]>([]);
  const [transactions, setTransactions] = React.useState<ReportTransaction[]>([]);
  const [reconciliations, setReconciliations] = React.useState<ReconcileStatement[]>([]);
  const [periods, setPeriods] = React.useState<ReportPeriod[]>([]);
  const [truncated, setTruncated] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [generation, setGeneration] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let issued = 0;
    const stops: Array<() => void> = [];

    const load = async (): Promise<void> => {
      const token = (issued += 1);
      try {
        const [accountList, txList, reconciliationList, periodList] = await Promise.all([
          api.ledger.listAccounts(),
          api.ledger.listTransactions({limit: REPORT_TX_LIMIT}),
          api.ledger.listReconciliations(),
          // LGR-12: a close/reopen also posts a real transaction, so the
          // transactions subscription refreshes this list on the same tick.
          // (A close of an EMPTY range writes no rows and stays stale until
          // the next mutation or reload — the period block reloads itself
          // after its own actions, which is the only place that matters.)
          api.ledger.listPeriods(),
        ]);
        // Torn down, or a newer load was issued while this one was in flight:
        // this answer is stale and must never reach the screen.
        if (cancelled || token !== issued) return;
        setAccounts(accountList as unknown as ReportAccount[]);
        setTransactions(txList as unknown as ReportTransaction[]);
        setReconciliations(reconciliationList as unknown as ReconcileStatement[]);
        setPeriods(periodList as unknown as ReportPeriod[]);
        setTruncated(txList.length >= REPORT_TX_LIMIT);
        setError(null);
        setState('ready');
      } catch (err) {
        // A REJECTION is an answer too, and the token rule applies to it
        // identically: a superseded load failing late would otherwise paint the
        // red "could not be loaded" box over a correct, freshly rendered report
        // and leave it there until the next successful load. Only the newest
        // load may write — whether it writes figures or a failure.
        if (cancelled || token !== issued) return;
        setError(err instanceof Error ? err.message : String(err));
        setState('error');
      }
    };

    /**
     * The boot failure — `api.ledger.info()` never reaching an answer. It
     * carries no token because it is not a load: nothing can supersede it.
     */
    const fail = (err: unknown): void => {
      if (cancelled) return;
      setError(err instanceof Error ? err.message : String(err));
      setState('error');
    };

    const subscribe = (databaseId: string): void => {
      const stop = api.databases.subscribeRows(databaseId, () => {
        void load();
      });
      // Registered after teardown (the initial load outlived the effect): stop
      // it now — `stops` has already been drained and will never be read again.
      if (cancelled) stop();
      else stops.push(stop);
    };

    void (async () => {
      try {
        const info = await api.ledger.info();
        if (cancelled) return;
        if (!info.exists || !info.databases) {
          setState('uninitialized');
          return;
        }
        await load();
        if (cancelled) return;
        for (const databaseId of [
          info.databases.accounts,
          info.databases.transactions,
          info.databases.postings,
          // LGR-11: finishing or reopening a statement changes what the register
          // shows about a posting without touching the posting rows in a way the
          // other three subscriptions would report on their own.
          info.databases.reconciliations,
        ]) {
          subscribe(databaseId);
        }
      } catch (err) {
        fail(err);
      }
    })();

    return () => {
      cancelled = true;
      for (const stop of stops) stop();
      stops.length = 0;
    };
  }, [generation]);

  return {
    state,
    accounts,
    transactions,
    reconciliations,
    periods,
    truncated,
    error,
    reload: React.useCallback(() => setGeneration((n) => n + 1), []),
  };
}

/** Long colon-delimited account names must be allowed to break, or they set an unshrinkable min-width. */
export const wrapStyle: React.CSSProperties = {
  overflowWrap: 'break-word',
};

/** Visually hidden text carrying a mark's meaning to assistive technology. */
export const SrOnly = ({children}: {children: React.ReactNode}) => <span className={ui.srOnly}>{children}</span>;

/**
 * An amount in the reports' one notation: the magnitude, and the SIDE it is
 * actually on. Zero is the exception — it sits on neither side, so it renders
 * bare, which is the honest thing to print and the thing that breaks the column.
 *
 * In a right-aligned column of `1,250.00 Dr`, a bare `0.00` is pushed right by
 * exactly the suffix it lacks: measured, its decimal point lands ~18px outside
 * the column every other row shares — and this is the EVERYDAY state, the
 * balanced totals row and the register's opening balance, not an edge case. So
 * zero carries the mirror of {@link AbnormalMark}'s leading box: an aria-hidden,
 * empty inline-block the width of ` Dr`, holding the place the suffix would have
 * taken. The rendered text is still a bare zero — nothing is announced, nothing
 * is copied, and the decimals stay in the column.
 */
export const SideAmount = ({minor}: {minor: number}) => (
  <>
    {formatWithSide(minor)}
    {minor === 0 ? <span aria-hidden="true" style={{display: 'inline-block', width: '1.33em'}} /> : null}
  </>
);

// ── Shared pieces ─────────────────────────────────────────────────────────────

/**
 * The "books are not set up" state, with the same one-click seeding the journal
 * block offers — an empty report should hand you the next step, not a blank
 * grid.
 *
 * `readOnly` is the PAGE's lock (callers pass their derived `pageLocked`, never
 * `editor.readOnly` — LGR-23): on a read-only page the button is off in the
 * register's off vocabulary — dashed, out of the tab order, with the reason
 * rendered beside it and wired by `aria-describedby` — instead of a live-looking
 * control whose refusal the reader discovers from the server.
 */
export const SetupPrompt = ({label, readOnly, onDone}: {label: string; readOnly: boolean; onDone: () => void}) => {
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  // Per instance: two set-up prompts on one page must not hand their disabled
  // buttons the same `aria-describedby` target.
  const whyId = React.useId();
  return (
    <div className={ui.stack}>
      <div className={ui.row}>
        <span>📒 The books are not set up yet — there is nothing to report on.</span>
        <button
          type="button"
          data-ledger-setup-button
          className={ui.btn}
          disabled={readOnly || busy}
          aria-describedby={readOnly ? whyId : undefined}
          onClick={() => {
            if (busy) return;
            setBusy(true);
            setError(null);
            void setUpBooks(api.ledger)
              .then(() => onDone())
              .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? 'Setting up…' : label}
        </button>
        {readOnly && (
          <span id={whyId} data-ledger-setup-why="read-only" className={ui.muted}>
            This page is read-only, so the books cannot be set up from it.
          </span>
        )}
      </div>
      {error !== null && (
        <div data-ledger-error role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
          {error}
        </div>
      )}
    </div>
  );
};

/**
 * A hierarchical account name with a break opportunity after every colon, so a
 * narrow column wraps at the hierarchy boundary (`Equity:` / `OpeningBalances`)
 * rather than mid-word. `<wbr>` is a break OPPORTUNITY, not a character: the
 * rendered text, the accessible name and anything copied out are still exactly
 * the account's name.
 */
export const AccountName = ({name}: {name: string}) => (
  <>
    {name.split(':').map((segment, i) => (
      <React.Fragment key={i}>
        {i > 0 ? ':' : ''}
        {i > 0 ? <wbr /> : null}
        {segment}
      </React.Fragment>
    ))}
  </>
);

/**
 * An empty-state sentence: what is missing, and what to do about it. Inherits
 * `--foreground` — when this is the ONLY content on screen it must not also be
 * the least legible thing on it.
 */
export const EmptyState = ({children}: {children: React.ReactNode}) => (
  <div data-ledger-empty role="status" aria-live="polite" className={ui.notice} data-tone={'quiet'}>
    {children}
  </div>
);

/**
 * The truncation caveat — shown ONLY when the read actually hit the cap.
 *
 * `info`, not `alarm`: on a book past the cap this is permanently on screen, and
 * a standing red box would train the reader to ignore the colour the imbalance
 * assertion needs. `detail` lets each report say what truncation costs IT — a
 * missing total is not the same failure as a running balance computed from an
 * incomplete opening figure.
 */
export const TruncationNotice = ({shown, detail}: {shown: boolean; detail: string}) =>
  shown ? (
    <div data-ledger-truncated role="status" aria-live="polite" className={ui.notice} data-tone={'info'}>
      Partial read — only the {REPORT_TX_LIMIT} most recently ENTERED transactions were loaded (newest first by entry time, not by date). {detail}
    </div>
  ) : null;

/**
 * A report-level failure, in a human sentence with the raw cause demoted.
 *
 * The two failures are not the same and must not offer the same affordance: a
 * host/transport error is worth retrying, whereas a fold error means a stored
 * amount cannot be totalled at all — retrying re-reads the same damaged entry,
 * so offering a Retry there is a dead end dressed as a way out.
 */
export const ReportError = ({kind, detail, onRetry}: {kind: 'host' | 'fold'; detail: string; onRetry: () => void}) => (
  <div data-ledger-error={kind} role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
    <div>
      {kind === 'host'
        ? 'This report could not be loaded.'
        : 'This report could not be computed — an entry stores an amount outside the range the ledger can total. The book has a damaged entry.'}
      {kind === 'host' && (
        <button type="button" data-ledger-retry className={ui.btn} data-size="sm" style={{marginLeft: '0.5rem'}} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
    <div className={ui.noticeDetail + ' ' + ui.muted}>{detail}</div>
  </div>
);

/**
 * The scroll container every report table sits in.
 *
 * `tabIndex={0}` is not optional (WCAG 2.1.1): a scrollable div that cannot take
 * focus cannot be scrolled by keyboard in Safari at all — and the column that
 * scrolls out of view is the running balance. Focusable + labelled also gives
 * each table a navigable landmark, which the blocks otherwise lack.
 *
 * `regionRef` (optional) exposes the region element to a caller that needs its
 * MEASURED width — the register's Balance-pin guard is the first: a pinned
 * column has to know when the region is too narrow to afford it.
 */
export const TableRegion = ({label, children, regionRef}: {label: string; children: React.ReactNode; regionRef?: React.Ref<HTMLDivElement>}) => (
  <div ref={regionRef} tabIndex={0} role="region" aria-label={label} className={ui.tableWrap}>
    {children}
  </div>
);
