import type {Awareness} from 'y-protocols/awareness';

export interface CanvasFacet {
  v: 1;
  blockId: string;
  cursor: {x: number; y: number} | null;
  tool: 'select'|'pen'|'rect'|'ellipse'|'arrow'|'text'|'erase'|'pan';
  selectedShapeIds: string[];
  selectionTruncated: boolean;
}
export const CANVAS_POSITION_MS = 100;
export const CANVAS_FACET_BYTES = 12 * 1024;
export const facetBytes = (value: unknown): number => new TextEncoder().encode(JSON.stringify(value)).length;
const toolNames = new Set(['select','pen','rect','ellipse','arrow','text','erase','pan']);

/** Bounds apply to UTF-8 bytes as well as character/id counts. Never cut an id. */
export function canvasFacet(blockId: string, cursor: CanvasFacet['cursor'], tool: CanvasFacet['tool'], ids: Iterable<string>): CanvasFacet | null {
  const value: CanvasFacet = {v:1,blockId,cursor:cursor && Number.isFinite(cursor.x) && Number.isFinite(cursor.y) ? cursor : null,tool,selectedShapeIds:[],selectionTruncated:false};
  for (const id of ids) {
    if (value.selectedShapeIds.length === 64 || id.length > 128) {value.selectionTruncated = true; continue;}
    value.selectedShapeIds.push(id);
    if (facetBytes(value) > CANVAS_FACET_BYTES) {value.selectedShapeIds.pop(); value.selectionTruncated = true;}
  }
  return facetBytes(value) <= CANVAS_FACET_BYTES ? value : null;
}

/** Peer fields are assertions, not authorization. Invalid facets paint nothing. */
export function readCanvasFacet(raw: unknown): CanvasFacet | null {
  if (!raw || typeof raw !== 'object') return null;
  const value = raw as CanvasFacet;
  if (value.v !== 1 || typeof value.blockId !== 'string' || !toolNames.has(value.tool) ||
    typeof value.selectionTruncated !== 'boolean' || !Array.isArray(value.selectedShapeIds) || value.selectedShapeIds.length > 64 ||
    value.selectedShapeIds.some(id => typeof id !== 'string' || id.length > 128) ||
    value.cursor !== null && (!value.cursor || !Number.isFinite(value.cursor.x) || !Number.isFinite(value.cursor.y))) return null;
  return facetBytes(value) <= CANVAS_FACET_BYTES ? value : null;
}

/**
 * Policy: only position changes coalesce (newest per 100ms slot). State transitions
 * emit immediately at this producer boundary; clear cancels pending positions.
 * The inherited network sender may collapse intermediate states: presence is
 * current state, NOT an event stream. Its timers, TTL and reconnect stay unchanged.
 * No rAF: hidden-tab clears must reach Awareness without waiting for a paint.
 */
export function canvasProducer(awareness: Awareness) {
  let current: CanvasFacet | null = null;
  let pending: CanvasFacet | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let lastPosition = -Infinity;
  const cancel = () => {if (timer !== undefined) clearTimeout(timer); timer = undefined; pending = null;};
  const emit = (value: CanvasFacet | null) => {current = value; awareness.setLocalStateField('canvas',value);};
  const flush = () => {timer = undefined; if (pending && awareness.getLocalState()?.canvas?.blockId === pending.blockId) {const value = pending; pending = null; lastPosition = Date.now(); emit(value);}};
  return {
    state(value: CanvasFacet | null) {cancel(); emit(value);},
    position(cursor: CanvasFacet['cursor']) {
      if (!current) return;
      pending = {...current,cursor};
      if (Date.now() - lastPosition >= CANVAS_POSITION_MS) flush();
      else if (timer === undefined) timer = setTimeout(flush,CANVAS_POSITION_MS - (Date.now() - lastPosition));
    },
    clear() {cancel(); emit(null);},
    dispose() {cancel(); if(current && awareness.getLocalState()?.canvas?.blockId===current.blockId)emit(null); current=null;},
  };
}
