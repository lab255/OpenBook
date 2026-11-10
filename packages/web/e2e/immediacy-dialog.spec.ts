import {writeFileSync} from 'node:fs';
import {test, expect} from './fixtures';
import {keydownForRun, presentedFrames, summarize} from './immediacy-trace.mjs';
type PresentedFrame = {index: number; key: string; snapshot: string; earliestUs: number | null; latestUs: number | null};

// This audit is run only through playwright.immediacy.config.ts (next start).
for (const width of [1280, 390]) {
  test(`production command dialog presentation at ${width}`, async ({page, context, browser}, testInfo) => {
    test.skip(testInfo.config.metadata.productionImmediacy !== true, 'Use playwright.immediacy.config.ts');
    await page.setViewportSize({width, height: 800});
    await page.emulateMedia({reducedMotion: 'no-preference', colorScheme: 'light'});
    await page.addInitScript(() => {
      Object.assign(window, {ffRun: -1});
      document.addEventListener('keydown', e => {
        if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
          performance.mark(`ff-input-${(window as unknown as {ffRun: number}).ffRun}`);
        }
      }, true);
    });
    await page.goto('/');
    const buildId = await page.evaluate(() => JSON.parse(document.getElementById('__NEXT_DATA__')!.textContent!).buildId);
    expect(buildId, 'Must use a production build').not.toBe('development');
    await expect(page.getByRole('button', {name: 'Page actions'})).toBeVisible();
    await page.evaluate(() => document.fonts.ready);
    const cdp = await context.newCDPSession(page);
    const version = await cdp.send('Browser.getVersion');
    // Startup primes the screenshot trace category in single-process Chromium.
    // One trace keeps the capture pipeline warm for every measured opening.
    await browser.startTracing(page, {screenshots: true,
      categories: ['-*', 'devtools.timeline', 'latency', 'cc', 'viz', 'blink.user_timing']});
    for (let warmup = 0; warmup < 3; warmup++) {
      await page.keyboard.press('ControlOrMeta+k');
      await expect(page.locator('[cmdk-item]').first()).toBeVisible();
      await page.waitForTimeout(400);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    await page.screenshot({path: testInfo.outputPath('closed.png')});
    let labelRect = {x: 0, y: 0, width: 0, height: 0};
    for (let run = 0; run < 12; run++) {
      await page.evaluate(run => { (window as unknown as {ffRun: number}).ffRun = run; }, run);
      await page.keyboard.press('ControlOrMeta+k');
      await page.waitForTimeout(400);
      if (run === 0) {
        const label = page.locator('[cmdk-item]').first().locator('span.truncate').first();
        await expect(label).toHaveText('Untitled');
        labelRect = (await label.boundingBox())!;
        await page.screenshot({path: testInfo.outputPath('open.png')});
      }
      await page.keyboard.press('Escape');
      await page.waitForTimeout(300);
    }
    const trace = await browser.stopTracing();
    writeFileSync(testInfo.outputPath('trace.json'), trace);
    const events = JSON.parse(trace.toString()).traceEvents;
    const frames: PresentedFrame[] = presentedFrames(events);
    expect(frames.length, 'Screenshot tracing must be armed at browser startup').toBeGreaterThan(0);
    const samples = [];
    const filmstrip: string[] = [];
    for (let run = 0; run < 12; run++) {
      const keyUs = keydownForRun(events, run);
      const candidates = frames.filter(f => f.latestUs !== null && f.earliestUs !== null
        && f.latestUs >= keyUs && f.earliestUs < keyUs + 180_000);
      const baseline = frames.filter(f => f.latestUs !== null && f.latestUs < keyUs).at(-1);
      if (!baseline) throw new Error(`Run ${run}: missing closed baseline frame`);
      const scored = [];
      for (const frame of candidates) {
        // Pixel inspection happens AFTER recording; it cannot delay the input.
        const ink = await page.evaluate(async ({snapshot, baseline, rect, viewportWidth}) => {
          const image = new Image();
          image.src = `data:image/jpeg;base64,${snapshot}`;
          await image.decode();
          const canvas = document.createElement('canvas');
          canvas.width = image.width; canvas.height = image.height;
          const ctx = canvas.getContext('2d')!;
          ctx.drawImage(image, 0, 0);
          const pixels = ctx.getImageData(0, 0, image.width, image.height).data;
          const before = new Image();
          before.src = `data:image/jpeg;base64,${baseline}`;
          await before.decode();
          ctx.drawImage(before, 0, 0);
          const oldPixels = ctx.getImageData(0, 0, image.width, image.height).data;
          const scale = image.width / viewportWidth;
          // Include the 0.98 -> 1 entry transform's displacement. The seeded
          // empty document is subtracted to exclude its placeholder text.
          const x0 = Math.max(2, Math.floor((rect.x - 6) * scale));
          const x1 = Math.min(image.width - 3, Math.ceil((rect.x + rect.width + 6) * scale));
          const y0 = Math.max(0, Math.floor((rect.y - 6) * scale));
          const y1 = Math.min(image.height - 1, Math.ceil((rect.y + rect.height + 6) * scale));
          const light = (data: Uint8ClampedArray, x: number, y: number) => {
            const i = (y * image.width + x) * 4;
            return (data[i] + data[i + 1] + data[i + 2]) / 3;
          };
          const contrast = (data: Uint8ClampedArray, x: number, y: number) =>
            (light(data, x - 2, y) + light(data, x + 2, y)) / 2 - light(data, x, y);
          let count = 0;
          for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
            if (contrast(pixels, x, y) - contrast(oldPixels, x, y) >= 5) count++;
          }
          return count;
        }, {snapshot: frame.snapshot, baseline: baseline.snapshot, rect: labelRect, viewportWidth: width});
        scored.push({...frame, ink});
      }
      const first = scored.find(f => f.ink >= 3);
      if (!first || first.earliestUs === null || first.latestUs === null) throw new Error(`Run ${run}: no presented row ink`);
      const lowMs = (first.earliestUs - keyUs) / 1000;
      const highMs = (first.latestUs - keyUs) / 1000;
      samples.push({run, keyUs, frame: first.key, lowMs, highMs, ink: first.ink,
        candidates: scored.map(f => ({index: f.index, key: f.key, earliestUs: f.earliestUs, latestUs: f.latestUs, ink: f.ink}))});
      filmstrip.push(`<h2>Run ${run}: ${lowMs.toFixed(3)}–${highMs.toFixed(3)} ms</h2><div class="frames">`);
      for (const frame of scored.slice(0, 5)) {
        const filename = `run-${run}-frame-${frame.index}.jpg`;
        writeFileSync(testInfo.outputPath(filename), Buffer.from(frame.snapshot, 'base64'));
        filmstrip.push(`<figure><img src="${filename}"><figcaption>${frame.key}<br>${((frame.earliestUs! - keyUs) / 1000).toFixed(3)}–${((frame.latestUs! - keyUs) / 1000).toFixed(3)} ms; ink=${frame.ink}</figcaption></figure>`);
      }
      filmstrip.push('</div>');
    }
    const summary = {surface: 'command dialog', width, buildId, version, labelRect, samples,
      lower: summarize(samples.map(s => s.lowMs)), upper: summarize(samples.map(s => s.highMs))};
    writeFileSync(testInfo.outputPath('summary.json'), JSON.stringify(summary, null, 2));
    writeFileSync(testInfo.outputPath('filmstrip.html'), `<!doctype html><meta charset="utf-8"><title>Command dialog ${width}</title><style>body{font:16px system-ui}.frames{display:flex;gap:8px}figure{margin:0}img{width:250px;image-rendering:auto}figcaption{font-size:12px}</style><h1>Command dialog ${width} — review the first visible row in every run</h1><p>JPEG ink detection is provisional until these pairs are visually reviewed. Times come from matching compositor presentation records, never screenshot capture timestamps.</p>${filmstrip.join('')}`);
    console.log(JSON.stringify({width, lower: summary.lower, upper: summary.upper}));
    // Functional motion checks AFTER timing ends; these rAF samples are never
    // used to calculate the presentation gate.
    const motion = [];
    for (const reduced of [false, true]) {
      await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
      await page.evaluate(() => {
        const samples: {opacity: string; transform: string; duration: string}[] = [];
        Object.assign(window, {ffMotion: samples});
        document.addEventListener('keydown', function start(e) {
          if (e.key.toLowerCase() !== 'k') return;
          document.removeEventListener('keydown', start, true);
          const until = performance.now() + 300;
          function sample() {
            const dialog = document.querySelector('[role="dialog"]');
            if (dialog) {
              const style = getComputedStyle(dialog);
              samples.push({opacity: style.opacity, transform: style.transform, duration: style.animationDuration});
            }
            if (performance.now() < until) requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        }, true);
      });
      await page.keyboard.press('ControlOrMeta+k');
      await page.waitForTimeout(350);
      const samples = await page.evaluate(() => (window as unknown as {
        ffMotion: {opacity: string; transform: string; duration: string}[];
      }).ffMotion);
      motion.push({reduced, samples});
      expect(samples.length).toBeGreaterThan(2);
      expect(samples.every(s => s.opacity === '1'), 'Entry exposes row content throughout').toBe(true);
      if (reduced) expect(samples.every(s => parseFloat(s.duration) <= 0.00006)).toBe(true);
      else expect(new Set(samples.map(s => s.transform)).size, 'Visible scale entry remains').toBeGreaterThan(2);
      await page.keyboard.press('Escape');
      await expect(page.locator('[cmdk-input]')).toHaveCount(0);
      await page.waitForTimeout(150);
    }
    writeFileSync(testInfo.outputPath('entry-motion.json'), JSON.stringify(motion, null, 2));
    expect(summary.upper.gate, 'Every sample must be <=50ms; filmstrip review is additionally required').toBe('PASS');
  });
}
