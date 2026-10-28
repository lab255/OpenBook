import * as React from 'react';
import {animate, motion, useMotionValue, useReducedMotion} from 'motion/react';
import {spring} from '@/lib/springs-lane';

/** One persistent object per surface; native focus/cmdk remain navigation owners. */
export function FluidHover({surface, selector, selected}: {
  surface: string; selector: string; selected?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const reduced = useReducedMotion();
  const [rect, setRect] = React.useState<{x: number; y: number; width: number; height: number} | null>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const width = useMotionValue(0);
  const height = useMotionValue(0);
  const positioned = React.useRef(false);
  React.useLayoutEffect(() => {
    if (!rect) return;
    const values = {x, y, width, height};
    const controls = Object.entries(values).map(([key, value]) => {
      const next = rect[key as keyof typeof rect];
      if (!positioned.current || reduced) { value.jump(next); return; }
      return animate(value, next, spring.moderate);
    });
    positioned.current = true;
    return () => controls.forEach((control) => control?.stop());
  }, [rect, reduced, x, y, width, height]);
  React.useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    let target: HTMLElement | null = null;
    const measure = () => {
      if (!target?.isConnected || !parent.contains(target)) { setRect(null); return; }
      const r = target.getBoundingClientRect();
      const p = parent.getBoundingClientRect();
      // Popup entry scales an ancestor. Convert viewport rects back into
      // local coordinates so the first keyboard highlight isn't undersized.
      const scaleX = parent.offsetWidth ? p.width / parent.offsetWidth : 1;
      const scaleY = parent.offsetHeight ? p.height / parent.offsetHeight : 1;
      const next = {x: (r.left - p.left) / scaleX + parent.scrollLeft - parent.clientLeft,
        y: (r.top - p.top) / scaleY + parent.scrollTop - parent.clientTop,
        width: r.width / scaleX, height: r.height / scaleY};
      setRect((previous) => previous && Object.entries(next).every(([key, value]) => previous[key as keyof typeof next] === value) ? previous : next);
    };
    const move = (event: Event) => {
      const row = (event.target as Element).closest<HTMLElement>(selector);
      if (!row || !parent.contains(row) || row.matches(':disabled,[aria-disabled="true"],[data-disabled="true"]') || row.hasAttribute('data-disabled') && row.dataset.disabled !== 'false') return;
      target = row; measure();
    };
    const sync = () => {
      if (selected) {
        const next = parent.querySelector<HTMLElement>(selected);
        // cmdk may clear selection before assigning the next row. Preserve the
        // traveling object through that intermediate mutation batch.
        if (!next && parent.querySelector(selector)) return;
        target = next; measure();
      }
      else if (target && !target.isConnected) { target = null; setRect(null); }
    };
    const leave = () => {
      target = selected ? parent.querySelector<HTMLElement>(selected) : parent.contains(document.activeElement) ? (document.activeElement as HTMLElement).closest(selector) : null;
      if (target) measure(); else setRect(null);
    };
    parent.addEventListener('pointermove', move);
    parent.addEventListener('focusin', move);
    parent.addEventListener('pointerleave', leave);
    parent.addEventListener('focusout', leave);
    parent.addEventListener('scroll', measure);
    const observer = new MutationObserver(sync);
    observer.observe(parent, {subtree: true, childList: true, attributes: true, attributeFilter: ['aria-selected', 'hidden']});
    const resize = new ResizeObserver(measure);
    resize.observe(parent);
    sync();
    if (!selected && parent.contains(document.activeElement)) {
      target = (document.activeElement as HTMLElement).closest(selector); measure();
    }
    return () => {
      observer.disconnect(); resize.disconnect();
      parent.removeEventListener('pointermove', move);
      parent.removeEventListener('focusin', move);
      parent.removeEventListener('pointerleave', leave);
      parent.removeEventListener('focusout', leave);
      parent.removeEventListener('scroll', measure);
    };
  }, [selector, selected]);
  return <motion.div ref={ref} aria-hidden data-fluid-hover={surface}
    className="pointer-events-none absolute left-0 top-0 rounded-sm bg-hover"
    style={{zIndex: -1, x, y, width, height, opacity: rect ? 1 : 0}}
    initial={false} />;
}
