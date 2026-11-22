import {StrictMode, createElement, type ReactNode} from 'react';
import {act, renderHook} from '@testing-library/react';
import {afterEach, expect, test, vi} from 'vitest';
import * as Y from 'yjs';
import {createDoc, rootBlocks} from '../model';
import {useBlockEditor} from '../useBlockEditor';
import {registerHistoryExtension, historyExtension} from '../historyExtension';
import {CanvasHistory} from './history';
import {createCanvasProps, createShape} from './schema';
import {registerReactiveBlocks} from '../reactiveBlocks';

vi.mock('../reactiveCore', () => ({registerReactiveBlocks: vi.fn()}));
let unregister: (() => void) | undefined;
afterEach(() => { unregister?.(); unregister = undefined; });
const wrapper = ({children}: {children: ReactNode}) => createElement(StrictMode, null, children);
function canvasDoc() {
  const doc = createDoc([]);
  const block = new Y.Map<unknown>();
  block.set('id', 'canvas'); block.set('type', 'canvas');
  const props = createCanvasProps(); block.set('props', props); rootBlocks(doc).push([block]);
  (props.get('shapes') as Y.Map<unknown>).set('s', createShape({id: 's'}));
  return {doc, props};
}

test('Registration seam: unregistered viewer path retains raw root UndoManager behavior', () => {
  expect(historyExtension).toBeUndefined();
  const {doc} = canvasDoc();
  const hook = renderHook(() => useBlockEditor(doc), {wrapper});
  expect(hook.result.current.history?.()).toBeInstanceOf(Y.UndoManager);
  const block = rootBlocks(doc).get(0);
  act(() => doc.transact(() => block.set('name', 'Page'), 'local'));
  act(() => hook.result.current.undo.undo());
  expect(block.get('name')).toBeUndefined();
  act(() => hook.result.current.undo.redo());
  expect(block.get('name')).toBe('Page');
  hook.unmount();
});

test('Registration seam: app wrapper installs synchronously; StrictMode cleanup, permission changes and document replacement use one live journal', () => {
  registerReactiveBlocks();
  const installed = historyExtension!;
  // Acquire the unregister closure for precisely the app-installed factory.
  unregister = registerHistoryExtension(installed);
  const {doc, props} = canvasDoc();
  const hook = renderHook(({document, readOnly}) => useBlockEditor(document, readOnly), {
    wrapper, initialProps: {document: doc, readOnly: false},
  });
  const history = hook.result.current.history?.() as CanvasHistory;
  expect(history).toBeInstanceOf(CanvasHistory);
  expect(history.writable).toBe(true);
  act(() => { history.commitCanvasCommand('Move', [{blockId:'canvas', shapeId:'s', values:{x:20}}]); });
  expect(hook.result.current.undo.availability?.undo).toBe('Move');
  act(() => hook.result.current.undo.undo());
  expect((props.get('shapes') as Y.Map<Y.Map<unknown>>).get('s')!.get('x')).toBe(0);
  hook.rerender({document: doc, readOnly: true});
  expect(history.writable).toBe(false);
  act(() => hook.result.current.undo.redo());
  expect((props.get('shapes') as Y.Map<Y.Map<unknown>>).get('s')!.get('x')).toBe(0);
  const next = canvasDoc();
  hook.rerender({document: next.doc, readOnly: false});
  expect(history.writable).toBe(false);
  expect(hook.result.current.history?.()).not.toBe(history);
  expect(hook.result.current.undo.availability).toEqual({undo:null, redo:null});
  const current = hook.result.current.history?.() as CanvasHistory;
  hook.unmount();
  expect(current.writable).toBe(false);
});
