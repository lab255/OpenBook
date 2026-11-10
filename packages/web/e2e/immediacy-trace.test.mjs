import {test} from 'node:test';
import assert from 'node:assert/strict';
import {presentedFrames, keydownForRun, summarize} from './immediacy-trace.mjs';

const begin = (state, id, ts, seq = 7) => ({name: 'PipelineReporter', ph: 'b', pid: 1, id2: {local: id}, ts,
  args: {frame_reporter: {state, frame_source: 9, frame_sequence: seq}}});
const end = (id, ts) => ({name: 'PipelineReporter', ph: 'e', pid: 1, id2: {local: id}, ts});
const shot = (seq = 7) => ({name: 'Screenshot', ts: 999, args: {source_id: 9, frame_sequence: seq, expected_display_time: 888, snapshot: 'pixels'}});

test('presentation uses paired compositor endpoints, retaining fork ambiguity', () => {
  const [frame] = presentedFrames([begin('STATE_PRESENTED_PARTIAL', 'a', 10), end('a', 20),
    begin('STATE_PRESENTED_ALL', 'b', 10), end('b', 35), shot()]);
  assert.equal(frame.earliestUs, 20);
  assert.equal(frame.latestUs, 35);
});
test('dropped, unmatched and foreign-source frames cannot fabricate presentation', () => {
  const frames = presentedFrames([begin('STATE_DROPPED', 'a', 10), end('a', 20), shot(), shot(8)]);
  assert.ok(frames.every(f => f.earliestUs === null && f.latestUs === null));
});
test('actual presented frame ID disambiguates original-work fork sequences', () => {
  const events = [begin('STATE_PRESENTED_PARTIAL', 'a', 10), end('a', 20),
    begin('STATE_PRESENTED_ALL', 'b', 10), end('b', 35), shot(),
    {name: 'AnimationFrame::Presentation', ts: 20, args: {begin_frame_id: {source_id: 9, sequence_number: 7}}}];
  assert.equal(presentedFrames(events)[0].latestUs, 20);
  events.at(-1).ts = 12;
  assert.throws(() => presentedFrames(events), /Uncorroborated/);
});
test('keydown is the event enclosing capture listener, excluding modifier and keyup', () => {
  const event = {name: 'EventTiming', ph: 'b', ts: 1000, args: {data: {type: 'keydown', timeStamp: 1, processingStart: 2, processingEnd: 3}}};
  assert.equal(keydownForRun([event, {name: 'ff-input-0', ts: 2500}], 0), 1000);
  assert.throws(() => keydownForRun([event, event, {name: 'ff-input-0', ts: 2500}], 0), /expected one/);
});
test('a median below target cannot hide samples above it', () => {
  assert.equal(summarize([20, 21, 22, 23, 24, 25, 26, 27, 49, 51]).gate, 'STRADDLES');
  assert.throws(() => summarize([20]), /at least 10/);
});
