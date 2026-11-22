import {useCallback, useEffect, useRef} from 'react';
import {useRouter} from 'next/router';
import {isTabParam, normalizeTab, useHud, SETTINGS_ALIAS_SECTIONS, type HudProps} from '@book.dev/ui';

const SETTINGS_PARAM = 'settings';
const readParam = (url: string) => new URL(url, window.location.href).searchParams.get(SETTINGS_PARAM) ?? undefined;
type OwnedNavigation = {url: string; param: string | undefined; intent: number; started: boolean};

/**
 * Navigation ownership policy: a user's newer HUD intent supersedes the HUD's
 * own opening navigation. Exactly that stale completion is consumed without
 * applying its param, and the URL is replaced with the current intent.
 * All other URL observations retain authority, including mount and popstate.
 */
export default function SettingsDeepLink() {
  const router = useRouter();
  const {hud, setHud} = useHud();
  const {open, tab} = hud.settings;
  const renderedHud = useRef({open, tab});
  const routerRef = useRef(router);
  routerRef.current = router;
  const state = useRef({
    initialized: false, open, tab, intent: 0,
    owned: null as OwnedNavigation | null,
  });

  const applyUrl = useCallback((param: string | undefined) => {
    // Record the URL-derived HUD value before scheduling its render. Otherwise
    // the HUD effect can echo a pre-hydration snapshot back over a deep link.
    const next = state.current;
    next.open = param !== undefined;
    if (isTabParam(param)) next.tab = normalizeTab(param);
    setHud((draft: HudProps) => {
      draft.settings.open = param !== undefined;
      if (isTabParam(param)) {
        draft.settings.tab = normalizeTab(param);
        const section = param !== undefined ? SETTINGS_ALIAS_SECTIONS[param] : undefined;
        if (section) draft.settings.section = section;
      }
      return draft;
    });
  }, [setHud]);

  const writeUrl = useCallback((replace: boolean) => {
    const next = state.current;
    const param = next.open ? next.tab : undefined;
    const url = new URL(window.location.href);
    const current = readParam(url.href);
    if (param === current) return;
    if (param === undefined) url.searchParams.delete(SETTINGS_PARAM);
    else url.searchParams.set(SETTINGS_PARAM, param);
    const path = `${url.pathname}${url.search}${url.hash}`;
    next.owned = {url: path, param, intent: next.intent, started: false};
    const r = routerRef.current;
    const options = {shallow: true, scroll: false};
    // An ordinary opening gets a Back entry. Reconciliation and tab/close
    // changes replace it; a stale completion never creates another entry.
    void (replace || current !== undefined ? r.replace(path, undefined, options) : r.push(path, undefined, options));
  }, []);

  useEffect(() => {
    const start = (url: string) => {
      const own = state.current.owned;
      if (own && !own.started && url === own.url) own.started = true;
      else state.current.owned = null; // External navigation takes authority.
    };
    const complete = () => {
      // Back may already have changed the address after pushState but before
      // Next finishes rendering that push. The current browser URL wins.
      const param = readParam(window.location.href);
      const own = state.current.owned;
      state.current.owned = null; // One-shot: consumed on first observation.
      if (own?.started && own.param === param && own.intent !== state.current.intent) {
        writeUrl(true);
        return;
      }
      applyUrl(param);
    };
    const pop = () => {
      state.current.owned = null;
      // App page-history entries carry obIndex, not Next's __N marker. Next
      // ignores those popstates; the browser URL still has Settings authority.
      applyUrl(readParam(window.location.href));
    };
    router.events.on('routeChangeStart', start);
    router.events.on('routeChangeComplete', complete);
    window.addEventListener('popstate', pop);
    return () => {
      router.events.off('routeChangeStart', start);
      router.events.off('routeChangeComplete', complete);
      window.removeEventListener('popstate', pop);
    };
  }, [router.events, applyUrl, writeUrl]);

  useEffect(() => {
    if (!router.isReady || state.current.initialized) return;
    state.current.initialized = true;
    applyUrl(readParam(window.location.href));
  }, [router.isReady, applyUrl]);

  useEffect(() => {
    const previous = renderedHud.current;
    renderedHud.current = {open, tab};
    if (previous.open === open && previous.tab === tab) return;
    const next = state.current;
    if (!next.initialized) return;
    // The initial render (and each URL-driven update) is not a user intent.
    if (next.open === open && next.tab === tab) return;
    next.open = open;
    next.tab = tab;
    next.intent++;
    if (!next.owned) writeUrl(false);
  }, [open, tab, writeUrl]);

  return null;
}
