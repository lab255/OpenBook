import React from 'react';
import {ui} from './ui';
import {api, formatAmount, LedgerError} from '@book.dev/plugin-sdk';
import {
  buildConfirmPatchFor,
  buildDraftInput,
  describeImport,
  describePreviewLimit,
  detectProfile,
  emptyKnownImports,
  importableRows,
  knownFromTransactions,
  learnRule,
  normalizeDescription,
  IMPORT_LIMITS,
  prepareImport,
  previewRows,
  readImportCsv,
  reconcileSavedProfile,
  sanitizeText,
  sourceIdForHeader,
  strandedDrafts,
  validateStoredProfile,
  type DateFormat,
  type DetectionNote,
  type Denomination,
  type KnownImports,
  type ImportRowStatus,
  type PreparedImport,
  type PreparedRow,
  type SignConvention,
  type SourceProfile,
} from './importModel';

/**
 * The bank-statement import block (LGR-10) — the second write surface, and the
 * one that decides whether the books survive past month two.
 *
 * Shape of the flow: upload a CSV → the block shows WHAT IT DETECTED (columns,
 * date format, sign convention, and above all the money scale) and lets every
 * decision be overridden → each importable row becomes a DRAFT with the bank
 * side pre-filled and the category side prompted → confirming a row balances it
 * and teaches the payee→account rule for next month.
 *
 * The block itself holds no logic worth testing: detection, parsing, dedup and
 * the payloads all live in the pure `importModel.ts`, which the host suite
 * drives through the real plugin loader. What lives here is IO and rendering.
 *
 * NON-NEGOTIABLES
 *  - Amounts are parsed ONLY by the money core, with an EXPLICIT `bareDigits`
 *    chosen by detection. An unestablished scale blocks the import instead of
 *    guessing (a 100x error balances perfectly and looks plausible).
 *  - Re-importing the same file creates ZERO drafts. Dedup is recomputed from
 *    the LEDGER, so it survives a cleared cache or a new machine — WITHIN the
 *    bounded window the ledger API serves (see {@link DEDUP_WINDOW}). That
 *    window is reachable by ordinary use, so when it is full the block says so
 *    rather than implying a guarantee it cannot keep.
 *  - The file is untrusted: sizes are capped before parsing, every cell is
 *    sanitized, and nothing is ever rendered as HTML.
 */

interface BlockLike {
  get(k: string): unknown;
}

interface EditorLike {
  doc: {transact(fn: () => void, origin: string): void};
  readOnly: boolean;
}

interface AccountOption {
  id: string;
  name: string;
  type: string;
}

/** A draft this block created, still awaiting its category leg. */
interface PendingDraft {
  draftId: string;
  /**
   * The account THIS draft's bank leg is on — captured when the draft is
   * created or read back, never taken from the live profile. The account
   * dropdown is UI state and can change under a listed draft; confirming
   * against the current profile would rewrite the leg to a different account,
   * deleting the original posting and moving two balances. See
   * `buildConfirmPatchFor`.
   */
  bankAccountId: string;
  row: PreparedRow;
  categoryAccountId: string;
  confirmed: boolean;
  error: string | null;
}

const STORAGE_PROFILES = 'importProfiles';
const STORAGE_RULES = 'importRules';

/**
 * How far back dedup can see. This is the ledger API's own page size, not a
 * choice — and a year of ordinary bank activity EXCEEDS it, so the block cannot
 * quietly promise that "re-importing the same file never doubles anything up".
 * When the read comes back full, say so (see `data-import-dedup-window`): a
 * stated limit the user can work around beats a silent one they discover as
 * duplicate entries. A paged read belongs with the reporting task.
 */
const DEDUP_WINDOW = 1000;

// ── Plugin-scoped storage (per browser profile; the LEDGER stays the truth) ──

const readProfiles = (): Record<string, SourceProfile> => {
  const raw = api.storage.get<Record<string, SourceProfile>>(STORAGE_PROFILES);
  return raw && typeof raw === 'object' ? raw : {};
};

/**
 * The remembered payee→account rules for one source, VALIDATED on read.
 *
 * Same class as the stored profile: this is `localStorage`, and every value
 * here becomes a row's `suggestedAccountId`, then the pre-filled
 * `categoryAccountId`, then the `accountId` of a real posting in the books. A
 * rule naming an account that no longer exists — or never did — must not reach
 * that path, so anything not naming a currently-open account is dropped.
 */
const readRules = (sourceId: string, accountIds: readonly string[]): Record<string, string> => {
  const all = api.storage.get<Record<string, Record<string, string>>>(STORAGE_RULES);
  const forSource = all && typeof all === 'object' ? all[sourceId] : undefined;
  if (!forSource || typeof forSource !== 'object') return {};
  const out: Record<string, string> = {};
  for (const [payee, accountId] of Object.entries(forSource)) {
    if (typeof accountId === 'string' && accountIds.includes(accountId)) out[payee] = accountId;
  }
  return out;
};

const writeRules = (sourceId: string, rules: Record<string, string>): void => {
  const all = api.storage.get<Record<string, Record<string, string>>>(STORAGE_RULES);
  api.storage.set(STORAGE_RULES, {...(all && typeof all === 'object' ? all : {}), [sourceId]: rules});
};

const money = (minor: number): string => formatAmount(minor);

/** What each per-row verdict is CALLED, in the preview's status column. */
const ROW_STATUS_LABEL: Record<ImportRowStatus, string> = {
  new: 'New',
  duplicate: 'Already imported',
  // NOT "already imported": an unfinished draft is not in the register, not in
  // the trial balance, and is still the user's to finish.
  'duplicate-draft': 'Draft already created',
  'near-duplicate': 'Possible duplicate',
  error: 'Unreadable',
};

export const BankImportBlock = ({block, editor, pageReadOnly}: {block: BlockLike; editor: EditorLike; pageReadOnly?: boolean}) => {
  void block;
  // MAY THIS READER WRITE? Not "is this widget frozen?". A custom block on a
  // read-only page is deliberately handed an editor with `readOnly: false` so it
  // stays operable for the reader, so `editor.readOnly` is FALSE on exactly the
  // page where the import surface must be inert — the host passes the document's
  // real lock separately. (Optional, and defaulted, so the block still renders
  // correctly when driven directly by a test harness.)
  const pageLocked = pageReadOnly ?? editor.readOnly;
  const [accounts, setAccounts] = React.useState<AccountOption[]>([]);
  const [ledgerReady, setLedgerReady] = React.useState<boolean | null>(null);
  const [fileName, setFileName] = React.useState<string>('');
  const [header, setHeader] = React.useState<string[]>([]);
  const [matrix, setMatrix] = React.useState<string[][]>([]);
  const [profile, setProfile] = React.useState<SourceProfile | null>(null);
  const [notes, setNotes] = React.useState<DetectionNote[]>([]);
  const [reusedMapping, setReusedMapping] = React.useState(false);
  const [known, setKnown] = React.useState<KnownImports>(() => emptyKnownImports());
  const [rules, setRules] = React.useState<Record<string, string>>({});
  const [drafts, setDrafts] = React.useState<PendingDraft[]>([]);
  /**
   * Drafts this importer left behind on the selected account and never
   * finished — read back from the LEDGER, not from block props or React state,
   * which is the only reason they are reachable at all after a reload.
   */
  const [stranded, setStranded] = React.useState<PendingDraft[]>([]);
  const [dedupSaturated, setDedupSaturated] = React.useState(false);
  /** The last dedup refresh failed — what is already on the books is UNKNOWN. */
  const [dedupStale, setDedupStale] = React.useState(false);
  /** The account whose unfinished drafts to show when NO statement is open. */
  const [draftsAccountId, setDraftsAccountId] = React.useState('');
  /** Draft-creation progress, so a 300-row import is not a frozen button. */
  const [progress, setProgress] = React.useState<{done: number; total: number} | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const mountedRef = React.useRef(true);

  const locked = pageLocked || busy;
  // Per instance: two import blocks on one page must not hand their disabled
  // controls the same `aria-describedby` target.
  const lockedWhyId = React.useId();

  React.useEffect(() => {
    mountedRef.current = true;
    void (async () => {
      try {
        const info = await api.ledger.info();
        if (!mountedRef.current) return;
        if (!info.exists) {
          setLedgerReady(false);
          return;
        }
        const list = await api.ledger.listAccounts();
        if (!mountedRef.current) return;
        setAccounts(
          list
            .filter((a) => a.status === 'open')
            .map((a) => ({id: a.id, name: a.name, type: a.type}))
            .sort((a, b) => a.name.localeCompare(b.name)),
        );
        setLedgerReady(true);
      } catch {
        if (mountedRef.current) setLedgerReady(false);
      }
    })();
    return () => {
      mountedRef.current = false;
    };
  }, []);

  /**
   * Read the LEDGER for this source+account: the dedup set AND the unfinished
   * drafts this importer left behind. Local storage is a convenience; the books
   * are the truth, so a cleared cache or a different machine must neither
   * resurrect an already-imported month nor lose a half-categorised one.
   *
   * ONE unfiltered read serves both while the window is not full:
   * `listTransactions` without a `state` filter already returns drafts (which is
   * exactly why they counted for dedup), so a second round trip would only add a
   * window in which the two answers disagree.
   *
   * ONCE IT IS FULL, that stops being true, and in the direction that loses
   * data. The server applies `state` BEFORE the limit slice, so the unfiltered
   * read returns the newest 1000 transactions of any kind while
   * `{state:'draft'}` returns up to 1000 DRAFTS from the whole book. On a book
   * with more than 1000 transactions newer than a stranded draft, that draft
   * falls out of the unfiltered page entirely and becomes unlistable — the exact
   * permanent loss this panel exists to prevent. So when the page comes back
   * full, the stranded list is re-read with the filter. The
   * two-answers-disagree objection does not apply to that list: `createdIds`
   * already de-duplicates it against this session's drafts, and two-legged
   * drafts are excluded either way.
   */
  const readLedger = React.useCallback(
    async (
      source: {sourceId: string; accountId: string},
      knownRules: Readonly<Record<string, string>>,
    ): Promise<{known: KnownImports; stranded: PendingDraft[]}> => {
      if (source.accountId === '') {
        setDedupSaturated(false);
        return {known: emptyKnownImports(), stranded: []};
      }
      // Bounded read — see DEDUP_WINDOW. A FULL page means older entries are
      // outside what dedup can see, which is reached by ordinary use (a year of
      // bank activity), so it is reported rather than assumed away.
      const transactions = await api.ledger.listTransactions({limit: DEDUP_WINDOW});
      const saturated = transactions.length >= DEDUP_WINDOW;
      setDedupSaturated(saturated);
      const draftSource = saturated ? await api.ledger.listTransactions({state: 'draft', limit: DEDUP_WINDOW}) : transactions;
      return {
        known: knownFromTransactions(transactions, source),
        stranded: strandedDrafts(draftSource, source, knownRules).map((d) => ({
          draftId: d.draftId,
          bankAccountId: d.bankAccountId,
          row: d.row,
          categoryAccountId: d.row.suggestedAccountId ?? '',
          confirmed: false,
          error: null,
        })),
      };
    },
    [],
  );

  /** Apply a ledger read to both pieces of state it feeds. */
  const applyLedger = React.useCallback((read: {known: KnownImports; stranded: PendingDraft[]}): void => {
    setKnown(read.known);
    setStranded(read.stranded);
  }, []);

  /**
   * Refresh the dedup set WITHOUT throwing, and report whether it worked.
   *
   * The refresh after an import shares its failure mode with the import itself:
   * one outage takes out `createDraft` AND `listTransactions`. When the refresh
   * threw, it escaped through `run()`'s own catch (and out of the component as
   * an unhandled rejection), `known` kept the pre-import value, `finally` still
   * cleared `busy` — and the button re-armed reading "Create 3 drafts" with not
   * one duplicate row, so a single press wrote every landed row again.
   *
   * The failure is not "nothing is on the books", it is "we do not know what is
   * on the books". `applyLedger` simply never runs, so the previous answer is
   * kept rather than replaced with an empty one, and `dedupStale` DISARMS the
   * button. Refusing to import over an unknown dedup set is the only safe
   * direction: the alternative writes duplicate rows into a ledger.
   */
  const refreshLedger = React.useCallback(
    async (source: {sourceId: string; accountId: string}, knownRules: Readonly<Record<string, string>>): Promise<boolean> => {
      try {
        const read = await readLedger(source, knownRules);
        if (!mountedRef.current) return true;
        applyLedger(read);
        setDedupStale(false);
        return true;
      } catch {
        if (mountedRef.current) setDedupStale(true);
        return false;
      }
    },
    [applyLedger, readLedger],
  );

  /**
   * Forget the statement on screen. EVERY failure path runs this: a refusal
   * that leaves the previous month's preview up and the button armed reads as
   * "that upload didn't take", and the next press imports the wrong file.
   */
  const resetFile = (): void => {
    setMatrix([]);
    setProfile(null);
    setHeader([]);
    setFileName('');
    setNotes([]);
    setReusedMapping(false);
    setDrafts([]);
    // The stranded list belongs to an ACCOUNT, and this clears the profile that
    // named it. Leaving it up would show live Save buttons over drafts nothing
    // on screen still describes.
    setStranded([]);
  };

  const onFile = async (file: File | null): Promise<void> => {
    if (!file) return;
    setError(null);
    setDrafts([]);
    setBusy(true);
    try {
      // Cap BEFORE reading the bytes into a string: `file.text()` on a 2 GB
      // upload is the whole problem, and `size` is free. Deliberately the SAME
      // number as the parser's cap, in a stricter unit — `size` is UTF-8 BYTES
      // and `maxLength` is UTF-16 code units, and bytes ≥ code units for every
      // string, so nothing that clears this gate can trip the parser's. The
      // parser keeps its own cap for the callers that do not come through here.
      if (file.size > IMPORT_LIMITS.maxLength) {
        setError(`That file is larger than ${IMPORT_LIMITS.maxLength / 1_000_000} MB. Split the statement and import it in parts.`);
        resetFile();
        return;
      }
      // Malformed UTF-8 decodes to replacement characters here rather than
      // throwing; `sanitizeText` then removes anything unprintable.
      const text = await file.text();
      const read = readImportCsv(text);
      if (!read.ok) {
        setError(read.problem);
        resetFile();
        return;
      }
      const head = read.matrix[0].map((h) => sanitizeText(h));
      const sourceId = sourceIdForHeader(read.matrix[0]);
      // A stored profile is untrusted input like any other (see
      // `validateStoredProfile`): a bad one falls back to fresh detection.
      const saved = validateStoredProfile(readProfiles()[sourceId], {
        sourceId,
        accountIds: accounts.map((a) => a.id),
        columnCount: read.matrix[0].length,
      });
      // Detection ALWAYS runs and is ALWAYS narrated. It used to be computed
      // and then discarded on the saved path, which is how a bank changing its
      // money scale under an unchanged header went unmentioned.
      const detected = detectProfile(read.matrix);
      const merged = saved
        ? reconcileSavedProfile(saved, detected, accounts.find((a) => a.id === saved.accountId)?.name ?? '')
        : {
          profile: {
            sourceId,
            label: sanitizeText(file.name),
            accountId: '',
            mapping: detected.mapping,
            dateFormat: detected.dateFormat,
            sign: detected.sign,
            denomination: detected.denomination,
          },
          notes: detected.notes,
        };
      const next: SourceProfile = merged.profile;
      setFileName(sanitizeText(file.name));
      setHeader(head);
      setMatrix(read.matrix);
      setReusedMapping(saved !== null);
      setNotes(merged.notes);
      setProfile(next);
      const nextRules = readRules(sourceId, accounts.map((a) => a.id));
      setRules(nextRules);
      applyLedger(await readLedger({sourceId, accountId: next.accountId}, nextRules));
      // This is the THIRD call site, and the only one that bypasses
      // `refreshLedger` — so it must disarm the flag itself. A read that just
      // SUCCEEDED is a fresh dedup answer; leaving `dedupStale` set from an
      // earlier failure (one bad list from the drafts-account picker is enough)
      // left the button dead behind "reload the page" for the rest of the
      // session, on an upload whose own read worked perfectly.
      setDedupStale(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      resetFile();
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  const patchProfile = (patch: Partial<SourceProfile>): void => {
    setProfile((current) => (current ? {...current, ...patch} : current));
    setDrafts([]);
  };

  /**
   * Changing the bank account changes what "already imported" means — AND which
   * unfinished drafts belong to this statement, so both come from the same read.
   */
  const setSourceAccount = (accountId: string): void => {
    if (!profile) return;
    const next = {...profile, accountId};
    setProfile(next);
    setDrafts([]);
    // BOTH lists, synchronously. `setProfile` lands this tick while the re-read
    // is a round trip away, so anything left listed is listed against an
    // account it no longer belongs to — with a live Save if its category was
    // pre-filled from a remembered rule.
    setStranded([]);
    void refreshLedger(next, rules);
  };

  /**
   * Show one account's unfinished drafts with no file open at all. Everything
   * a stranded draft needs to be finished — its date, amount, description and
   * its OWN bank account — comes back off the ledger; the statement was only
   * ever needed to create them.
   */
  const setDraftsAccount = (accountId: string): void => {
    setDraftsAccountId(accountId);
    setStranded([]);
    // No source, so no remembered rules to pre-fill with: the category is
    // chosen explicitly, which is the right default when nothing names the file
    // these rows came from.
    void refreshLedger({sourceId: 'unknown', accountId}, {});
  };

  const prepared: PreparedImport | null = React.useMemo(
    () => (profile && matrix.length > 1 ? prepareImport(matrix, profile, known, rules) : null),
    [matrix, profile, known, rules],
  );

  /**
   * The capped, worst-first preview. MEMOIZED: `previewRows` copies and sorts
   * the whole row set, and the render body runs once per `setProgress` tick —
   * i.e. once per created draft — so unmemoized this was another O(n²) walk
   * over a file the block advertises can hold 50 000 rows.
   */
  const PREVIEW_LIMIT = 200;
  const previewed = React.useMemo(() => (prepared === null ? [] : previewRows(prepared, PREVIEW_LIMIT)), [prepared]);

  const run = async (): Promise<void> => {
    if (!profile || !prepared || profile.accountId === '' || locked) return;
    setBusy(true);
    setError(null);
    // HOISTED out of the try on purpose. `createDraft` is called once per row,
    // so a reject at row k leaves rows 1..k-1 ON THE SERVER. Scoped inside, the
    // catch could not see them: the confirm panel stayed empty, `known` stayed
    // stale, the button re-armed — and a second press created every one of them
    // AGAIN. Whatever was created must survive the failure and be shown.
    const created: PendingDraft[] = [];
    try {
      // The mapping is saved BEFORE the drafts are created: if creation fails
      // halfway, the user's mapping work is not also lost.
      api.storage.set(STORAGE_PROFILES, {...readProfiles(), [profile.sourceId]: profile});
      // Hoisted: `importableRows` is an O(n) filter, and calling it per
      // iteration to label the progress made the loop O(n²) — at the 50 000
      // rows this block advertises, a locked tab.
      const targets = importableRows(prepared);
      for (const row of targets) {
        const draft = await api.ledger.createDraft(buildDraftInput(row, profile));
        created.push({
          draftId: draft.id,
          bankAccountId: profile.accountId,
          row,
          categoryAccountId: row.suggestedAccountId ?? '',
          confirmed: false,
          error: null,
        });
        if (mountedRef.current) setProgress({done: created.length, total: targets.length});
      }
      if (!mountedRef.current) return;
      setDrafts(created);
      // Fold the just-imported rows into the dedup set immediately, so a second
      // press of the button (or a re-upload of the same file) creates nothing.
      // NON-THROWING: a refresh that fails after a SUCCESSFUL import must not be
      // reported as an import failure, and must not leave the button armed over
      // a dedup set it can no longer vouch for.
      if (!(await refreshLedger(profile, rules))) {
        setError('The import finished, but the duplicate check could not be refreshed. Reload the page before importing again.');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof LedgerError ? `${err.message} (${err.code})` : err instanceof Error ? err.message : String(err));
      // The partial import is REAL. Show it, and re-read the ledger so the rows
      // already written are recognised as duplicates instead of being created a
      // second time by the next press. When THAT read fails too — the ordinary
      // correlated case, one outage taking out both calls — `dedupStale` keeps
      // the button disarmed rather than re-arming it over a stale answer.
      setDrafts(created);
      await refreshLedger(profile, rules);
    } finally {
      if (mountedRef.current) {
        setBusy(false);
        setProgress(null);
      }
    }
  };

  /** Patch one pending draft wherever it lives (just-created or rehydrated). */
  const markDraft = (draftId: string, patch: Partial<PendingDraft>): void => {
    const apply = (current: PendingDraft[]): PendingDraft[] =>
      current.map((d) => (d.draftId === draftId ? {...d, ...patch} : d));
    setDrafts(apply);
    setStranded(apply);
  };

  const confirm = async (draftId: string): Promise<void> => {
    const pending = [...drafts, ...stranded].find((d) => d.draftId === draftId);
    if (!pending || pending.categoryAccountId === '' || locked) return;
    setBusy(true);
    try {
      // The DRAFT's own bank account, never the live profile's — see
      // `PendingDraft.bankAccountId`.
      await api.ledger.updateDraft(draftId, buildConfirmPatchFor(pending.row, pending.bankAccountId, pending.categoryAccountId));
      const nextRules = learnRule(rules, pending.row.normalizedDescription, pending.categoryAccountId);
      // A rule belongs to a SOURCE; with no statement open there is no source
      // to attach one to, so the categorisation simply is not remembered.
      if (profile) writeRules(profile.sourceId, nextRules);
      if (!mountedRef.current) return;
      if (profile) setRules(nextRules);
      // The draft may be one just created OR one rehydrated from the books;
      // both render in the same panel, so both lists take the patch.
      markDraft(draftId, {confirmed: true, error: null});
    } catch (err) {
      const message = err instanceof LedgerError ? `${err.message} (${err.code})` : err instanceof Error ? err.message : String(err);
      if (mountedRef.current) markDraft(draftId, {error: message});
    } finally {
      if (mountedRef.current) setBusy(false);
    }
  };

  if (ledgerReady === null) {
    return (
      <div data-ledger-import data-import-loading role="status" aria-live="polite" contentEditable={false} className={ui.frame}>
        Loading ledger…
      </div>
    );
  }

  if (ledgerReady === false) {
    return (
      <div data-ledger-import data-import-setup contentEditable={false} className={ui.frame}>
        🏦 The books are not set up yet — run “Ledger: set up books” first.
      </div>
    );
  }

  const columnOptions = header.map((name, i) => (
    <option key={i} value={i}>
      {i + 1}. {name || '(unnamed)'}
    </option>
  ));

  // `dedupStale` disarms: importing over a dedup set we could not refresh is
  // how the same rows get written twice.
  const canRun = !locked && !dedupStale && prepared !== null && prepared.importable && profile !== null && profile.accountId !== '';

  // A draft created THIS press is already in `drafts`; the ledger read that
  // follows returns it too. Show it once, under the heading that explains it.
  const createdIds = new Set(drafts.map((d) => d.draftId));
  const strandedShown = stranded.filter((d) => !createdIds.has(d.draftId));

  // "this account" is DEICTIC, and with no statement open the control it points
  // at sits BELOW this panel rather than above it. On that path, name the
  // account instead of pointing at it.
  const strandedAccountName = accounts.find((a) => a.id === draftsAccountId)?.name ?? '';
  const strandedAccountLabel = profile === null && strandedAccountName !== '' ? strandedAccountName : 'this account';

  /** One pending draft: date, description, amount, category picker, Save. */
  const pendingRow = (pending: PendingDraft, handle: string): React.ReactElement => (
    <div
      key={pending.draftId}
      data-import-draft={handle}
      data-import-draft-confirmed={pending.confirmed ? 'true' : 'false'}
      style={{display: 'grid', gridTemplateColumns: 'minmax(5rem, auto) minmax(8rem, 2fr) minmax(6rem, 1fr) minmax(10rem, 2fr) auto', gap: '0.35rem', alignItems: 'center'}}
    >
      {/* The DATE, which is not decoration here. With a statement open it is
          also in the preview above; with NO statement open — the path this
          panel exists to serve — a months-old draft otherwise offers a payee
          and an amount and nothing to reconcile against. */}
      <span data-import-draft-date className={ui.muted} style={{fontVariantNumeric: 'tabular-nums'}}>
        <span className={ui.srOnly}>Date </span>
        {pending.row.date ?? '—'}
      </span>
      <span>{pending.row.description}</span>
      <span className={ui.num}>
        <span className={ui.srOnly}>Amount </span>
        {money(pending.row.amountMinor ?? 0)}
      </span>
      <select
        data-import-category={handle}
        data-size="sm"
        aria-label={`Category for ${pending.row.description}`}
        className={ui.field}
        value={pending.categoryAccountId}
        disabled={locked || pending.confirmed}
        onChange={(e) => markDraft(pending.draftId, {categoryAccountId: e.target.value})}
      >
        <option value="">What was this for?…</option>
        {accounts
          .filter((a) => a.id !== pending.bankAccountId)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
      </select>
      <button
        type="button"
        data-import-confirm={handle}
        className={ui.btn} data-size="sm"
        disabled={locked || pending.confirmed || pending.categoryAccountId === ''}
        aria-describedby={pageLocked ? lockedWhyId : undefined}
        onClick={() => void confirm(pending.draftId)}
      >
        {pending.confirmed ? 'Saved ✓' : 'Save'}
      </button>
      {pending.error !== null && (
        <div data-import-draft-error role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'} style={{gridColumn: '1 / -1'}}>
          {pending.error}
        </div>
      )}
    </div>
  );

  return (
    <div
      data-ledger-import
      contentEditable={false}
      className={ui.frame}
    >
      <div className={ui.header}>
        <span>🏦</span>
        <h3 className={ui.title}>Import a bank statement</h3>
        <input
          data-import-file
          type="file"
          accept=".csv,text/csv"
          aria-label="Bank statement CSV"
          disabled={locked}
          aria-describedby={pageLocked ? lockedWhyId : undefined}
          className={ui.file}
          onChange={(e) => void onFile(e.target.files?.[0] ?? null)}
        />
        {fileName !== '' && <span className={ui.muted}>{fileName}</span>}
      </div>

      {/* The DOCUMENT's lock, stated once (LGR-23) — every disabled control in
          the block points here by `aria-describedby`. Without it the upload
          control and the Save buttons simply sat grey with no stated cause on
          exactly the page where nothing can explain itself by being pressed. */}
      {pageLocked && (
        <div id={lockedWhyId} data-import-why="read-only" className={ui.muted}>
          This page is read-only, so nothing can be imported from it.
        </div>
      )}

      {error && (
        <div data-import-error role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
          {error}
        </div>
      )}

      {profile && (
        <>
          {/* What was detected, in words. `role="status"` + polite: this text
              changes as the user overrides things, and an assertive live region
              on frequently-changing text is unusable with a screen reader.
              LIVE-REGION BUDGET: live status is spent only where a
              screen-reader user genuinely needs the announcement — nine in
              all: this detection block, the error, the three banners that
              explain a dead button (scale blocked, account blocked, dedup
              stale), the summary, the two panel headings that appear as a
              RESULT of pressing the button (created, stranded), and the
              per-row confirm error. The informational notices below (dedup
              window, already-imported, already-drafted) are plain text: they
              change in lockstep with the summary, and a pile of regions firing
              on one commit is noise, not information. */}
          <div data-import-detected role="status" aria-live="polite" className={ui.notice} data-tone={'quiet'}>
            {reusedMapping && <strong data-import-saved-mapping>Saved mapping reused. </strong>}
            {notes.map((note, i) =>
              note.severity === 'ask' ? (
                // A coin flip must not look like a certainty. Loud surface, and
                // a ⚠ lead-in so colour is not carrying the severity alone.
                <div key={i} data-import-note-ask className={ui.notice} data-tone={'alarm'} style={{marginTop: '0.3rem'}}>
                  ⚠ {note.text}
                </div>
              ) : (
                <div key={i}>{note.text}</div>
              ),
            )}
          </div>

          <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(11rem, 1fr))', gap: '0.5rem'}}>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>This statement is</span>
              <select data-import-source-account className={ui.field} value={profile.accountId} disabled={locked} onChange={(e) => setSourceAccount(e.target.value)}>
                <option value="">Select the bank account…</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Date column</span>
              <select data-import-map-date className={ui.field} value={profile.mapping.date} disabled={locked} onChange={(e) => patchProfile({mapping: {...profile.mapping, date: Number(e.target.value)}})}>
                <option value={-1}>Not mapped</option>
                {columnOptions}
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Amount column</span>
              <select data-import-map-amount className={ui.field} value={profile.mapping.amount} disabled={locked} onChange={(e) => patchProfile({mapping: {...profile.mapping, amount: Number(e.target.value)}})}>
                <option value={-1}>Not mapped</option>
                {columnOptions}
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Description column</span>
              <select data-import-map-description className={ui.field} value={profile.mapping.description} disabled={locked} onChange={(e) => patchProfile({mapping: {...profile.mapping, description: Number(e.target.value)}})}>
                <option value={-1}>Not mapped</option>
                {columnOptions}
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Date format</span>
              <select data-import-dateformat className={ui.field} value={profile.dateFormat} disabled={locked} onChange={(e) => patchProfile({dateFormat: e.target.value as DateFormat})}>
                <option value="iso">YYYY-MM-DD</option>
                <option value="mdy">MM/DD/YYYY</option>
                <option value="dmy">DD/MM/YYYY</option>
                <option value="dmy-dot">DD.MM.YYYY</option>
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Amounts are in</span>
              <select
                data-import-denomination
                className={ui.field}
                value={profile.denomination ?? ''}
                disabled={locked}
                onChange={(e) => patchProfile({denomination: e.target.value === '' ? null : (e.target.value as Denomination)})}
              >
                <option value="">Choose — dollars or cents?</option>
                <option value="major">Dollars (1234 = 1,234.00)</option>
                <option value="minor">Cents (1234 = 12.34)</option>
              </select>
            </label>
            <label className={ui.labelled}>
              <span className={ui.eyebrow}>Money out is</span>
              <select data-import-sign className={ui.field} value={profile.sign} disabled={locked} onChange={(e) => patchProfile({sign: e.target.value as SignConvention})}>
                <option value="outflow-negative">Negative in this file</option>
                <option value="outflow-positive">Positive in this file</option>
              </select>
            </label>
          </div>

          {profile.denomination === null && (
            <div data-import-scale-blocked role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
              Choose whether the amount column is in dollars or cents. Nothing is imported until you do — guessing wrong is
              a hundredfold error that still balances.
            </div>
          )}
        </>
      )}

      {prepared && profile && (
        <>
          <div style={{display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap'}}>
            {/* Once drafts exist, a bare "0 new · 4 already drafted" sits
                directly above four drafts this block just made and reads as a
                contradiction. Say WHEN it is true of. */}
            <span data-import-summary role="status" aria-live="polite" style={{fontVariantNumeric: 'tabular-nums'}}>
              {drafts.length > 0 ? `After this import: ${describeImport(prepared)}` : describeImport(prepared)}
            </span>
            <button
              type="button"
              data-import-run
              className={ui.btn}
              data-variant="primary"
              style={{marginLeft: 'auto'}}
              disabled={!canRun}
              aria-describedby={pageLocked ? lockedWhyId : undefined}
              onClick={() => void run()}
            >
              {/* Drafts are created one row at a time, up to 50 000 of them,
                  with no batching and no abort — so at minimum the button must
                  stop looking frozen and say how far it has got. */}
              {busy
                ? progress === null
                  ? 'Importing…'
                  : `Importing… ${progress.done} of ${progress.total}`
                : `Create ${prepared.counts.new + prepared.counts['near-duplicate']} draft${prepared.counts.new + prepared.counts['near-duplicate'] === 1 ? '' : 's'}`}
            </button>
          </div>

          {/* A disabled button with no stated reason is six seconds of the user
              pressing it. The scale block already does this; the account is the
              other thing only they know. */}
          {profile.accountId === '' && (
            <div data-import-account-blocked role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
              Choose which bank account this statement is, above. Nothing can be imported until you do — the account is
              what every row’s bank side posts to.
            </div>
          )}

          {dedupStale && (
            <div data-import-dedup-stale role="status" aria-live="polite" className={ui.notice} data-tone={'alarm'}>
              The duplicate check could not be refreshed, so what is already on the books is unknown. Importing now could
              write the same rows twice — reload the page and try again.
            </div>
          )}

          {dedupSaturated && (
            <div data-import-dedup-window className={ui.notice} data-tone={'quiet'}>
              This account already has {DEDUP_WINDOW} or more entries, which is as far back as the duplicate check can see.
              Anything older than that will not be recognised as already imported — check the oldest rows by hand. Unfinished
              drafts are read separately, so they are still listed here.
            </div>
          )}

          {prepared.counts.duplicate > 0 && drafts.length === 0 && (
            <div data-import-dedup-warning className={ui.notice} data-tone={'quiet'}>
              {prepared.counts.duplicate} row{prepared.counts.duplicate === 1 ? ' is' : 's are'} already on the books and will be skipped.
            </div>
          )}

          {prepared.counts['duplicate-draft'] > 0 && drafts.length === 0 && (
            <div data-import-draft-warning className={ui.notice} data-tone={'quiet'}>
              {prepared.counts['duplicate-draft']} row{prepared.counts['duplicate-draft'] === 1 ? '' : 's'} already ha
              {prepared.counts['duplicate-draft'] === 1 ? 's an' : 've'} unfinished draft
              {prepared.counts['duplicate-draft'] === 1 ? '' : 's'} — finish or delete them before re-importing.
            </div>
          )}

          {/* Focusable: this scroller is where every per-row error is
              reported, and an unreachable scroll container hides them from
              anyone not using a mouse. */}
          <div
            data-import-preview
            tabIndex={0}
            role="region"
            aria-label="Statement preview"
            className={ui.tableWrap} style={{maxHeight: '18rem', overflowY: 'auto'}}
          >
            <table className={ui.table} data-density="tight">
              <caption className={ui.srOnly}>
                Every row of the statement, with what will happen to it. Rows needing attention are listed first.
              </caption>
              <thead>
                <tr>
                  <th scope="col">Date</th>
                  <th scope="col">Description</th>
                  <th scope="col" className={ui.num}>In the file</th>
                  <th scope="col" className={ui.num}>Amount</th>
                  <th scope="col">Status</th>
                </tr>
              </thead>
              <tbody>
                {previewed.map((row) => (
                  <tr key={row.line} data-import-row={row.line} data-import-status={row.status}>
                    <td style={{fontVariantNumeric: 'tabular-nums'}}>{row.date ?? '—'}</td>
                    <td>{row.description}</td>
                    {/* The RAW cell beside the parsed value: `450` next to
                        `$4.50` is the cheapest possible check on the money
                        scale, and a 100x error is invisible without it. */}
                    <td data-import-row-raw className={`${ui.num} ${ui.muted}`}>
                      {row.rawAmount === '' ? '—' : row.rawAmount}
                    </td>
                    <td className={ui.num}>
                      {row.amountMinor === null ? '—' : money(row.amountMinor)}
                    </td>
                    {/* Full-contrast whatever the verdict: this cell carries the
                        entire dedup answer. */}
                    <td>
                      {ROW_STATUS_LABEL[row.status]}
                      {row.problem !== null && row.status !== 'duplicate' && (
                        <span data-import-row-problem={row.status}> — {row.problem}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {prepared.rows.length > previewed.length && (
              <div data-import-preview-limit className={ui.muted} style={{padding: '0.25rem'}}>
                {describePreviewLimit(prepared, previewed.length)}
              </div>
            )}
          </div>
        </>
      )}

      {drafts.length > 0 && profile && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem'}}>
          <div data-import-created={drafts.length} role="status" aria-live="polite" className={ui.notice} data-tone={'quiet'}>
            {drafts.length} draft{drafts.length === 1 ? '' : 's'} created with the bank side filled in. Choose what each one was for —
            the choice is remembered for next month.
          </div>
          {drafts.map((pending) => pendingRow(pending, String(pending.row.line)))}
        </div>
      )}

      {/* Drafts THIS importer left on the account and nobody ever finished.
          Read back from the books (see `strandedDrafts`), because they are
          reachable from no other surface: excluded from the register and the
          trial balance, and unadoptable by the journal block. Without this
          panel, closing the tab after categorising 12 of 300 rows lost the
          other 288 for good — and re-uploading the file reported them as
          already handled. */}
      {strandedShown.length > 0 && (
        <div style={{display: 'flex', flexDirection: 'column', gap: '0.4rem'}}>
          <div data-import-stranded={strandedShown.length} role="status" aria-live="polite" className={ui.notice} data-tone={'quiet'}>
            {strandedShown.length} earlier draft{strandedShown.length === 1 ? '' : 's'} on {strandedAccountLabel} {strandedShown.length === 1 ? 'is' : 'are'} still
            waiting for a category. {strandedShown.length === 1 ? 'It is' : 'They are'} not in the register or the trial balance until
            {strandedShown.length === 1 ? ' it' : ' they'} balance{strandedShown.length === 1 ? 's' : ''}.
          </div>
          {strandedShown.map((pending) => pendingRow(pending, pending.draftId))}
        </div>
      )}

      {profile === null && (
        <>
          {/* The first-run hint is an INSTRUCTION ("Upload the CSV…"), so on a
              read-only page it is dropped — the lock notice above already
              states the reason, without telling the reader to press anything. */}
          {error === null && !pageLocked && (
            <div data-import-hint className={ui.muted}>
              Upload the CSV your bank exports. Nothing is written until you have seen what was detected and pressed the button,
              and re-importing the same file creates nothing — for as far back as the duplicate check can see, which is this
              account’s last {DEDUP_WINDOW} entries.
            </div>
          )}
          {/* Reachable WITHOUT the statement. The panel above used to require an
              open file, so a user who had deleted last month's export was back
              in the original condition — drafts on the books that no surface
              would show them. Picking the account is enough. */}
          <label className={ui.labelled} style={{maxWidth: '18rem'}}>
            <span className={ui.eyebrow}>Unfinished drafts on</span>
            <select
              data-import-drafts-account
              className={ui.field}
              value={draftsAccountId}
              disabled={locked}
              onChange={(e) => setDraftsAccount(e.target.value)}
            >
              {/* SHORT on purpose: the native disclosure arrow is drawn over
                  the end of the label, and the longer wording lost its final
                  glyphs behind it. The header above already says what the
                  choice is FOR. */}
              <option value="">Pick an account…</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </label>
        </>
      )}
    </div>
  );
};

/** Re-exported for the host suite (loaded through the real plugin loader). */
export {normalizeDescription};
