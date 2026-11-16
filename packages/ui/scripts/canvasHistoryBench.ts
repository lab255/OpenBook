/** Reproducible headless select all benchmark. No rendering/network or observers.
 * Run: pnpm --filter @book.dev/ui exec tsx scripts/canvasHistoryBench.ts */
import * as Y from 'yjs';
import {performance} from 'node:perf_hooks';
import {writeFileSync} from 'node:fs';
import {rootBlocks} from '../src/blockeditor/model';
import {createCanvasProps, createShape} from '../src/blockeditor/canvas/schema';
import {CanvasHistory} from '../src/blockeditor/canvas/history';

for (const selectedCount of process.argv.includes('--single-only') ? [1] : [1, 500]) for (const pairs of [50, 1000]) {
  const samples: {commit: number; undo: number; redo: number}[] = [];
  for (let trial = 0; trial < 5; trial++) {
    const doc = new Y.Doc(); doc.clientID = 10;
    const props = createCanvasProps(), block = new Y.Map<unknown>();
    block.set('id', 'canvas'); block.set('type', 'canvas'); block.set('props', props);
    rootBlocks(doc).push([block]);
    const shapes = props.get('shapes') as Y.Map<Y.Map<unknown>>;
    const points = Array.from({length: pairs * 2}, (_, i) => i / 10);
    doc.transact(() => {
      for (let i = 0; i < 500; i++) shapes.set(String(i), createShape({id:String(i),kind:'stroke',points}));
    });
    const history = new CanvasHistory(doc);
    const changes = [...shapes.keys()].slice(0,selectedCount).map(shapeId => ({blockId:'canvas',shapeId,values:{x:20,y:30}}));
    const started = performance.now();
    history.commitCanvasCommand('Select-all move', changes);
    const committed = performance.now();
    history.undo();
    const undone = performance.now();
    if ([...shapes.values()].some(s => s.get('x') !== 0 || s.get('y') !== 0)) {
      writeFileSync('/tmp/build3-benchmark-anomaly.json', JSON.stringify({pairs,trial,state:shapes.toJSON()}));
      throw new Error('Unexpected benchmark undo: stop and inspect /tmp/build3-benchmark-anomaly.json');
    }
    history.redo();
    const redone = performance.now();
    if ([...shapes.values()].some((s,i) => s.get('x') !== (i < selectedCount ? 20 : 0) || s.get('y') !== (i < selectedCount ? 30 : 0))) {
      writeFileSync('/tmp/build3-benchmark-anomaly.json', JSON.stringify({pairs,trial,state:shapes.toJSON()}));
      throw new Error('Unexpected benchmark redo: stop and inspect /tmp/build3-benchmark-anomaly.json');
    }
    samples.push({commit:committed-started,undo:undone-committed,redo:redone-undone});
    history.destroy(); doc.destroy();
  }
  const summary = Object.fromEntries((['commit','undo','redo'] as const).map(key => {
    const values = samples.map(s=>s[key]).sort((a,b)=>a-b);
    return [key, {medianMs:values[2],worstMs:values[4]}];
  }));
  process.stdout.write(JSON.stringify({shapes:500,selectedCount,pairsPerShape:pairs,trials:5,samples,summary})+'\n');
}
