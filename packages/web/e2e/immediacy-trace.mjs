// Chromium trace timestamps are microseconds on one monotonic clock.
// Never use Screenshot.ts or expected_display_time as presentation time.
export function presentedFrames(events) {
  const pending = new Map();
  const presentations = new Map();
  for (const e of [...events].sort((a, b) => a.ts - b.ts)) {
    if (e.name !== 'PipelineReporter') continue;
    const track = `${e.pid}:${e.id2?.local}`;
    if (e.ph === 'b') pending.set(track, e);
    if (e.ph !== 'e') continue;
    const begin = pending.get(track);
    pending.delete(track);
    const reporter = begin?.args?.frame_reporter;
    if (!reporter || !['STATE_PRESENTED_ALL', 'STATE_PRESENTED_PARTIAL'].includes(reporter.state)) continue;
    const key = `${reporter.frame_source}:${reporter.frame_sequence}`;
    const times = presentations.get(key) ?? [];
    times.push(e.ts);
    presentations.set(key, times);
  }
  return events.filter(e => e.name === 'Screenshot').map((e, index) => {
    const key = `${e.args.source_id}:${e.args.frame_sequence}`;
    let times = presentations.get(key) ?? [];
    // AnimationFrame::Presentation carries the ACTUAL presented begin-frame
    // ID, unlike a forked reporter's original work sequence. When present,
    // require its timestamp to corroborate a presented pipeline endpoint.
    const direct = [...new Set(events.filter(p => p.name === 'AnimationFrame::Presentation'
      && p.args?.begin_frame_id?.source_id === e.args.source_id
      && p.args?.begin_frame_id?.sequence_number === e.args.frame_sequence).map(p => p.ts))];
    if (direct.length === 1) {
      if (!times.includes(direct[0])) throw new Error(`Uncorroborated presentation for ${key}`);
      times = direct;
    }
    return {index, key, snapshot: e.args.snapshot,
      // Ambiguous forked frames retain their entire interval; never choose the
      // favorable endpoint or silently use an estimated/callback timestamp.
      earliestUs: times.length ? Math.min(...times) : null,
      latestUs: times.length ? Math.max(...times) : null};
  });
}

export function keydownForRun(events, run) {
  const marker = events.find(e => e.name === `ff-input-${run}`);
  if (!marker) throw new Error(`Missing keydown marker for run ${run}`);
  const candidates = events.filter(e => {
    const d = e.args?.data;
    if (e.name !== 'EventTiming' || e.ph !== 'b' || d?.type !== 'keydown') return false;
    const origin = e.ts - d.timeStamp * 1000;
    return origin + d.processingStart * 1000 <= marker.ts && marker.ts <= origin + d.processingEnd * 1000;
  });
  if (candidates.length !== 1) throw new Error(`Run ${run}: expected one keydown, got ${candidates.length}`);
  return candidates[0].ts;
}

export function summarize(values) {
  if (values.length < 10 || values.some(v => !Number.isFinite(v))) throw new Error('Need at least 10 finite samples');
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return {n: values.length, median: sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2,
    min: sorted[0], max: sorted.at(-1), samples: values,
    gate: sorted.at(-1) <= 50 ? 'PASS' : sorted[0] <= 50 ? 'STRADDLES' : 'MISS'};
}
