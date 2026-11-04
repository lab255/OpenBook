/** First-paint tween only. Hydration must gate this BEFORE mounting React. */
export function entranceCss(selector = '[data-ob-entrance]'): string {
  return `html:not([data-ob-hydrated]) ${selector} { animation: ob-entrance var(--motion-base) var(--ease-out-soft) both; }
@keyframes ob-entrance { from { transform: translateY(12px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
@media (prefers-reduced-motion: reduce) { html:not([data-ob-hydrated]) ${selector} { animation: none; } }`;
}
