import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {animate, motion, useMotionValue} from 'motion/react';
import {spring} from '@/lib/springs';
import {createPortal} from 'react-dom';
import {GripVertical, Plus} from 'lucide-react';
import './sharedGutter.css';

/** Owner-ruling prototype. Opt in with ?gutterHandle=shared; the default stays local.
 * App-only: this module is not reachable from the export viewer. No text hit areas
 * or selection paints move. Local controls retain DOM/tab order and all actions.
 */
export function SharedGutter({containerRef}: {
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [root, setRoot] = useState<HTMLElement | null>(null);
  const [enabled, setEnabled] = useState(false);
  const [target, setTarget] = useState<{row: HTMLElement; x: number; y: number; width: number; plus: boolean; hot: boolean} | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const preference = matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReduced(preference.matches);
    sync(); preference.addEventListener('change', sync);
    return () => preference.removeEventListener('change', sync);
  }, []);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const positioned = useRef(false);
  useLayoutEffect(() => {
    if (!target) { positioned.current = false; return; }
    if (!positioned.current || reduced) {
      x.jump(target.x); y.jump(target.y); positioned.current = true; return;
    }
    const controls = [animate(x, target.x, spring.moderate), animate(y, target.y, spring.moderate)];
    return () => controls.forEach((control) => control.stop());
  }, [target, reduced, x, y]);
  useEffect(() => {
    setEnabled(new URLSearchParams(location.search).get('gutterHandle') === 'shared');
    setRoot(containerRef.current?.querySelector<HTMLElement>('.obe-root') ?? null);
  }, [containerRef]);
  useLayoutEffect(() => {
    if (!enabled || !root) return;
    let pressed = false;
    let dragging = false;
    const clear = () => setTarget(null);
    const move = (event: PointerEvent) => {
      if (event.pointerType === 'touch' || matchMedia('(pointer: coarse)').matches) { clear(); return; }
      // Freeze action ownership during presses, menus and HTML5 drags.
      if (pressed || dragging || root.querySelector('.obe-gutter [aria-expanded="true"]')) return;
      if (root.querySelector('.obe-row > .obe-gutter:focus-within')) { clear(); return; }
      const under = document.elementFromPoint(event.clientX, event.clientY);
      if (!under || (!root.contains(under) && !root.closest('.obe-editor-pane')?.contains(under))) { clear(); return; }
      // Deepest row wins in nested columns; never capture a resize divider.
      if (under.closest('[role="separator"], .obe-col-resize')) { clear(); return; }
      const rows = [...root.querySelectorAll<HTMLElement>('.obe-row')].reverse();
      const row = rows.find((candidate) => {
        const r = candidate.getBoundingClientRect();
        const g = candidate.querySelector<HTMLElement>(':scope > .obe-gutter');
        if (!g || getComputedStyle(g).display === 'none') return false;
        const box = g.getBoundingClientRect();
        return event.clientX >= box.left && event.clientX < r.left && event.clientY >= r.top && event.clientY < r.bottom;
      });
      if (!row) { clear(); return; }
      const box = row.querySelector<HTMLElement>(':scope > .obe-gutter')!.getBoundingClientRect();
      const base = root.getBoundingClientRect();
      const add = row.querySelector<HTMLElement>(':scope > .obe-gutter > button:first-child');
      const next = {row, x: box.left - base.left, y: box.top - base.top, width: box.width,
        plus: !!add && !add.classList.contains('obe-handle') && getComputedStyle(add).display !== 'none',
        hot: event.clientY >= box.top && event.clientY <= box.bottom};
      setTarget((old) => old?.row === row && old.x === next.x && old.y === next.y && old.width === next.width && old.hot === next.hot && old.plus === next.plus ? old : next);
    };
    const focus = () => { if (root.querySelector('.obe-row > .obe-gutter:focus-within')) clear(); };
    const down = (event: PointerEvent) => { pressed = !!(event.target as Element).closest('.obe-gutter'); };
    const up = () => { pressed = false; };
    const dragStart = () => { dragging = true; clear(); };
    const dragEnd = () => { dragging = false; pressed = false; clear(); };
    document.addEventListener('pointermove', move);
    document.addEventListener('pointerdown', down);
    document.addEventListener('pointerup', up);
    document.addEventListener('dragstart', dragStart);
    document.addEventListener('dragend', dragEnd);
    document.addEventListener('focusin', focus);
    // Hide on scroll/resize rather than retaining stale row geometry.
    window.addEventListener('scroll', clear, true);
    window.addEventListener('resize', clear);
    window.addEventListener('blur', clear);
    return () => {
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('pointerup', up);
      document.removeEventListener('dragstart', dragStart);
      document.removeEventListener('dragend', dragEnd);
      document.removeEventListener('focusin', focus);
      window.removeEventListener('scroll', clear, true);
      window.removeEventListener('resize', clear);
      window.removeEventListener('blur', clear);
    };
  }, [enabled, root]);
  useLayoutEffect(() => {
    if (target) {
      root?.setAttribute('data-shared-gutter-active', '');
      target.row.setAttribute('data-shared-gutter-target', '');
    }
    return () => {
      root?.removeAttribute('data-shared-gutter-active');
      target?.row.removeAttribute('data-shared-gutter-target');
    };
  }, [target, root]);
  if (!enabled || !root) return null;
  // The shared object is paint only. Native row buttons retain hit testing,
  // drag events, menu anchors, focus and DOM order, even while paint travels.
  return createPortal(<motion.div ref={layerRef} className="obe-shared-gutter" data-shared-gutter aria-hidden
    data-owner={target?.row.dataset.blockRow} initial={false}
    style={{x, y, visibility: target ? 'visible' : 'hidden', width: target?.width}}>
    {target?.plus && <span className="obe-gutter-btn"><Plus className="obe-gutter-icon" /></span>}
    <span className={`obe-gutter-btn obe-shared-handle${target?.hot ? ' obe-shared-hot' : ''}`}><GripVertical className="obe-gutter-icon" /></span>
  </motion.div>, root);
}
