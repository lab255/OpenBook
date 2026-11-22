import React, {createContext, PropsWithChildren, useContext} from 'react';
import {HUD_STORAGE_KEY, HudDefault, HudProps, loadHudStorage, saveHudStorage} from '@/lib/hud';
import {useImmer} from 'use-immer';

export interface HudContext {
  hud: HudProps;
  setHud: React.Dispatch<HudProps | ((draft: HudProps) => HudProps)>;
}

export const HudContext = createContext<HudContext>({
  hud: HudDefault,
  setHud: () => false
});

export const useHud = () => useContext(HudContext);

export const HudProvider: React.FC<PropsWithChildren<unknown>> = ({children}) => {
  const [hud, setHudRaw] = useImmer<HudProps>(loadHudStorage);
  // Throwaway CI diagnostic only. The target test opts in before app boot.
  // Requests, updater evaluations (including StrictMode replay), and committed
  // state are distinct phases: an evaluation is not a second user command.
  const trace = React.useRef({instance: '', call: 0});
  const emit = React.useCallback((entry: Record<string, unknown>) => {
    if (typeof window === 'undefined' || !(window as Window & {__BUILD6_TRACE_SETTINGS__?: boolean}).__BUILD6_TRACE_SETTINGS__) return;
    try {
      trace.current.instance ||= `${Date.now()}:${performance.now()}`;
      console.info(`BUILD6_SETTINGS_TRACE ${JSON.stringify({instance: trace.current.instance, time: performance.now(), wallTime: Date.now(), ...entry})}`);
    } catch { /* diagnostics must not change application behavior */ }
  }, []);
  const setHud = React.useCallback<HudContext['setHud']>((update) => {
    if (typeof window === 'undefined' || !(window as Window & {__BUILD6_TRACE_SETTINGS__?: boolean}).__BUILD6_TRACE_SETTINGS__) {
      setHudRaw(update);
      return;
    }
    const call = ++trace.current.call;
    const stack = new Error('Settings HUD setter caller').stack;
    const event = window.event;
    emit({phase: 'request', call, stack, kind: typeof update, event: event?.type,
      key: event instanceof KeyboardEvent ? event.key : undefined,
      code: event instanceof KeyboardEvent ? event.code : undefined,
      active: document.activeElement?.getAttribute('aria-label') ?? document.activeElement?.tagName});
    if (typeof update !== 'function') {
      emit({phase: 'replacement', call, open: update.settings.open, stack});
      setHudRaw(update);
      return;
    }
    setHudRaw((draft) => {
      const before = draft.settings.open;
      const next = update(draft);
      emit({phase: 'evaluation', call, before, after: next.settings.open, paletteOpen: next.commandPalette.open, stack});
      return next;
    });
  }, [emit, setHudRaw]);
  React.useEffect(() => {
    emit({phase: 'commit', open: hud.settings.open, lastRequest: trace.current.call, stack: new Error('Committed Settings state').stack});
  }, [emit, hud.settings.open]);
  // Whether a HUD preference existed before this mount — captured at first
  // render, because the save effect below persists one immediately.
  const hadStoredHud = React.useRef(
    typeof window !== 'undefined' && localStorage.getItem(HUD_STORAGE_KEY) !== null,
  );

  React.useEffect(() => {
    saveHudStorage(hud);
  }, [hud]);

  // First visit on a narrow screen (phone): default the sidebar collapsed so
  // the document gets the width — a 256px rail leaves nothing at 375px.
  // Collapsed = undocked + closed (the same state the toggle produces); the
  // edge-hover/toggle still brings it back. Post-mount (not in the state
  // initializer) so SSR and hydration render the same tree; any stored
  // preference wins.
  React.useEffect(() => {
    if (!hadStoredHud.current && window.innerWidth < 768) {
      setHud((draft) => {
        draft.sideNav.open = false;
        draft.sideNav.docked = false;
        return draft;
      });
    }
  }, [setHud]);

  // Global keyboard shortcuts (incl. ⌘K for the palette) are owned by the
  // <GlobalShortcuts> behavior in the layout, which fires the shared command
  // registry — so a key and its command/menu entry never drift.

  const hudMouseListener = React.useCallback((e: MouseEvent) => {
    if (!hud.sideNav.docked) {
      if (e.clientX > 320 || e.clientX <= 1) {
        setHud(draft => {draft.sideNav.open = false; return draft;});
      } else if (e.clientX < 16) {
        setHud(draft => {draft.sideNav.open = true; return draft;});
      }
    }
  }, [hud, hud.sideNav, setHud]);

  React.useEffect(() => {
    document.addEventListener('mousemove', hudMouseListener);
    return () => document.removeEventListener('mousemove', hudMouseListener);
  }, [hudMouseListener]);

  const state = {
    hud: hud,
    setHud: setHud,
  };

  return <HudContext.Provider value={state}>
    {children}
  </HudContext.Provider>;
};
