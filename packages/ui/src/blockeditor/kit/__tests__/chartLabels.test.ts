import {describe, expect, it} from 'vitest';
import {ellipsizeMeasured} from '../chartLabels';

describe('measured matrix bar labels', () => {
  // Equal character counts can have very different rendered widths.
  const measure = (text: string): number => [...text].reduce((width, c) => width + (c === 'W' ? 12 : c === '…' ? 10 : 3), 0);

  it('fits the measured label including its ellipsis into the column minus the gap', () => {
    const width = 48 - 4;
    expect(ellipsizeMeasured('iiiiii', width, measure)).toBe('iiiiii');
    const wide = ellipsizeMeasured('WWWWWW', width, measure);
    expect(wide).toBe('WW…');
    expect(measure(wide)).toBeLessThanOrEqual(width);
    expect(measure('WWW…')).toBeGreaterThan(width);
  });

  it('uses new font metrics when the same label is measured again', () => {
    expect(ellipsizeMeasured('WWWWWW', 60, measure)).toBe('WWWW…');
    expect(ellipsizeMeasured('WWWWWW', 60, (text) => measure(text) * 1.5)).toBe('WW…');
  });

  it('preserves short labels, the three-character minimum and trimmed ellipses', () => {
    expect(ellipsizeMeasured('', 0, measure)).toBe('');
    expect(ellipsizeMeasured('WWW', 1, measure)).toBe('WWW');
    expect(ellipsizeMeasured('WWWWWW', 1, measure)).toBe('WW…');
    expect(ellipsizeMeasured('ii WWW', 16, measure)).toBe('ii…');
  });
});
