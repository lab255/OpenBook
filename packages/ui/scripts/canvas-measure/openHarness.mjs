import assert from 'node:assert/strict';
import {sourceStamp} from './sourceStamp.mjs';
export async function openHarness(page){
 await page.goto('http://127.0.0.1:5184/scripts/canvas-measure/index.html');
 const expected=sourceStamp();
 await page.waitForFunction(()=>window.canvasEvidence?.sourceStamp);
 const served=await page.evaluate(()=>window.canvasEvidence.sourceStamp);
 assert.equal(served,expected,'Stale canvas measurement source: restart the server');
 return served;
}
