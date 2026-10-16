import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, cleanup, render} from '@testing-library/react';
import type {DatabaseProperty, DatabaseRow, DatabaseView} from '@book.dev/sdk';
import {BarChartView} from '../databaseCharts';
import type {UseDatabase} from '../useDatabase';

vi.mock('@/providers', () => ({useNavigation: () => ({setPageHint: vi.fn()})}));
vi.mock('@/data', () => ({useData: () => ({})}));
vi.mock('@/lib/useCopyPageLink', () => ({useCopyPageLink: () => vi.fn()}));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('database bar sizing', () => {
  it('uses pixel coordinates, caps height, and follows subsequent resizes', () => {
    let resize: (entries: Array<{contentRect: {width: number}}>) => void = () => {};
    const disconnect = vi.fn();
    vi.stubGlobal('ResizeObserver', class {
      constructor(callback: typeof resize) { resize = callback; }
      observe = vi.fn();
      disconnect = disconnect;
    });
    const properties: DatabaseProperty[] = [{id: 'status', name: 'Status', type: 'select'}];
    const view = {id: 'bar', name: 'Bar', type: 'bar', filters: [], sorts: [], groupByPropertyId: 'status'} as DatabaseView;
    const db = {visibleRows: [{id: 'row', name: 'Row', properties: {}} as DatabaseRow]} as UseDatabase;
    const {container, unmount} = render(<BarChartView db={db} view={view} properties={properties} />);
    const svg = container.querySelector('svg[aria-label="Bar chart"]')!;
    expect(svg.getAttribute('viewBox')).toBe('0 0 640 240');
    for (const [width, height] of [[1200, 240], [400, 150]]) {
      act(() => resize([{contentRect: {width}}]));
      expect(svg.getAttribute('viewBox')).toBe(`0 0 ${width} ${height}`);
      expect(svg.querySelector('.obe-chart-grid line')?.getAttribute('x1')).toBe('40');
      expect(svg.querySelector('.obe-chart-grid line')?.getAttribute('x2')).toBe(String(width - 28));
      expect(svg.querySelector('.obe-chart-xlabels text')?.getAttribute('y')).toBe(String(height - 8));
    }
    unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
