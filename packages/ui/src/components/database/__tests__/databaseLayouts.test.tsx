import {afterEach, describe, expect, it, vi} from 'vitest';
import {renderToStaticMarkup} from 'react-dom/server';
import {cleanup, fireEvent, render, screen} from '@testing-library/react';
import type {DatabaseProperty, DatabaseRow, DatabaseView} from '@book.dev/sdk';
import {BoardView, CalendarView, GalleryView, RowChips} from '../databaseLayouts';
import type {UseDatabase} from '../useDatabase';

vi.mock('@/providers', () => ({useNavigation: () => ({setPageHint: vi.fn()})}));
vi.mock('@/data', () => ({useData: () => ({})}));
vi.mock('@/lib/useCopyPageLink', () => ({useCopyPageLink: () => vi.fn()}));
afterEach(cleanup);

const properties: DatabaseProperty[] = [
  {id: 'status', name: 'Status', type: 'status', options: [{id: 'todo', label: 'Todo', color: 'blue'}]},
  {id: 'select', name: 'Priority', type: 'select', options: [{id: 'high', label: 'High', color: 'red'}]},
  {id: 'multi', name: 'Tags', type: 'multi_select', options: [{id: 'tag', label: 'Tag', color: 'green'}]},
  {id: 'check', name: 'Reviewed', type: 'checkbox'},
  {id: 'cost', name: 'Cost', type: 'number'},
  {id: 'date', name: 'Due', type: 'date'},
  {id: 'cover', name: 'Cover', type: 'url'},
];
const today = new Date();
const date = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-15`;
const row = {id: 'row', name: 'Card title', properties: {status: 'todo', select: 'high', multi: ['tag'], check: true, cost: 300, date}} as unknown as DatabaseRow;
const view = {id: 'view', name: 'View', type: 'board', filters: [], sorts: [], groupByPropertyId: 'status', collapseEmptyGroups: false} as DatabaseView;
const makeDb = (rows = [row, {...row, id: 'empty', name: 'Unassigned', properties: {}}]): UseDatabase => ({
  database: {id: 'db', schema: {properties, views: [view]}},
  visibleRows: rows, rollupRows: rows, rollupProperties: properties,
  openRow: vi.fn(), updateView: vi.fn(), setRowProperty: vi.fn(),
}) as unknown as UseDatabase;

describe('card layout design system', () => {
  it('uses status pills and select tags, with scalar property tooltips and checkbox names', () => {
    render(<RowChips row={row} properties={properties} />);
    expect(screen.getByText('Todo').classList.contains('rounded-full')).toBe(true);
    for (const label of ['High', 'Tag']) expect(screen.getByText(label).classList.contains('rounded-sm')).toBe(true);
    expect(screen.getByTitle('Reviewed').textContent).toBe('✓ Reviewed');
    expect(screen.getByTitle('Cost').textContent).toBe('300');
    expect(screen.getByTitle('Due')).toBeTruthy();
  });

  it('preserves labelled list chips', () => {
    render(<RowChips row={row} properties={properties} labelled />);
    expect(screen.getByTitle('Reviewed').textContent).toBe('Reviewed: ✓');
    expect(screen.getByTitle('Cost').textContent).toBe('Cost: 300');
  });

  it('omits unconfigured gallery covers and keeps configured missing-image fallbacks', () => {
    const {container, rerender} = render(<GalleryView db={makeDb()} view={view} properties={[]} />);
    expect(container.querySelector('.h-16, img')).toBeNull();
    rerender(<GalleryView db={makeDb()} view={{...view, coverPropertyId: 'cover'}} properties={[]} />);
    expect(container.querySelector('.h-16.bg-muted')).toBeTruthy();
    const covered = {...row, properties: {...row.properties, cover: 'https://example.com/cover.png'}};
    rerender(<GalleryView db={makeDb([covered])} view={{...view, coverPropertyId: 'cover'}} properties={[]} />);
    const image = container.querySelector('img')!;
    expect(image.getAttribute('src')).toBe('https://example.com/cover.png');
    fireEvent.error(image);
    expect(container.querySelector('.h-16.bg-muted')).toBeTruthy();
  });

  it('tints option columns but preserves plain No value columns and drag highlights', () => {
    const {container} = render(<BoardView db={makeDb()} view={view} properties={properties} cardProperties={[]} />);
    const header = container.querySelector('[data-col-key="todo"]')!;
    expect(header.querySelector('.rounded-full')?.textContent).toBe('Todo');
    const column = header.parentElement!;
    // The DOM emulator drops color-mix()/var() declarations; SSR preserves the authored style.
    expect(renderToStaticMarkup(<BoardView db={makeDb()} view={view} properties={properties} cardProperties={[]} />)).toContain('background-color:color-mix(');
    const none = container.querySelector('[data-col-key="__none__"]')!;
    expect(none.textContent).toContain('No value');
    expect(none.querySelector('.rounded-full, .rounded-sm')).toBeNull();
    expect(none.parentElement!.style.backgroundColor).toBe('');
    fireEvent.dragStart(header);
    fireEvent.dragOver(column);
    expect(column.style.backgroundColor).toBe('');
    expect(column.classList.contains('bg-accent/50')).toBe(true);
    fireEvent.dragEnd(header);
    expect(column.classList.contains('bg-accent/50')).toBe(false);
    fireEvent.click(screen.getByLabelText('Collapse Todo column'));
    expect(container.querySelector('[data-col-key="todo"]')!.parentElement!.classList.contains('bg-muted/30')).toBe(false);
  });

  it('uses card surfaces and an accent rail for calendar tiles without changing drag semantics', () => {
    render(<CalendarView db={makeDb()} view={{...view, datePropertyId: 'date', cardColorPropertyId: 'status'}} properties={properties} />);
    const tile = screen.getByTitle('Card title');
    expect(tile.classList.contains('bg-card')).toBe(true);
    expect(tile.classList.contains('ring-1')).toBe(true);
    expect(tile.classList.contains('bg-brand/10')).toBe(false);
    expect(tile.style.backgroundColor).toBe('');
    expect(renderToStaticMarkup(<CalendarView db={makeDb()} view={{...view, datePropertyId: 'date', cardColorPropertyId: 'status'}} properties={properties} />)).toContain('border-left:3px solid');
    expect(tile.getAttribute('draggable')).toBe('true');
    expect(tile.hasAttribute('role')).toBe(false);
    fireEvent.dragStart(tile);
    expect(tile.classList.contains('opacity-40')).toBe(true);
  });
});
