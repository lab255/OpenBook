import {test, expect} from '@playwright/test';
import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

/** Real HTML, streamed without modifying a byte. Delay only the existing boot
 * script to expose the first-paint/PDF surface before hydration. */
test('FF-6 single entrance and state spring in the same exported file', async ({page}) => {
  const html = readFileSync(resolve('e2e-viewer/generated/motion.html'), 'utf8');
  const split = html.lastIndexOf('<script>');
  const server = createServer((_req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.write(html.slice(0, split));
    setTimeout(() => res.end(html.slice(split)), 650);
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('No fixture server');
  const errors: string[] = [];
  page.on('pageerror', error => { errors.push(error.message); console.log('PAGE ERROR', error.message); });
  page.on('console', message => { if (message.type() === 'error') console.log('BROWSER', message.text()); });
  try {
    await page.addInitScript(() => {
      type Sample = {t: number; phase: string; x: number; y: number; opacity: number; transform: string};
      const trace: Sample[] = [];
      const entrances: string[] = [];
      const violations: string[] = [];
      Object.assign(window, {ff6Trace: trace, ff6Entrances: entrances, ff6Violations: violations});
      document.addEventListener('securitypolicyviolation', event => violations.push(event.violatedDirective));
      document.addEventListener('animationstart', event => {
        if ((event.target as Element).matches(':is(.ob-plugin-block, button)[data-block-type="ff6/fixture"]')) entrances.push(event.animationName);
      });
      let previous: {node: Element; sample: Sample} | undefined;
      function frame(t: number) {
        const node = document.querySelector(':is(.ob-plugin-block, button)[data-block-type="ff6/fixture"]');
        if (node) {
          const rect = node.getBoundingClientRect();
          const style = getComputedStyle(node);
          const sample = {t: Math.round(t * 10) / 10, phase: document.documentElement.hasAttribute('data-ob-hydrated') ? 'hydrated' : 'static', x: rect.x, y: rect.y, opacity: Number(style.opacity), transform: style.transform};
          // Fail loudly on the Tailwind translate-property hazard. Never infer
          // stationary geometry from transform:none; use the rect samples.
          if (previous?.node === node && previous.sample.phase === sample.phase && (Math.abs(previous.sample.x - sample.x) > .1 || Math.abs(previous.sample.y - sample.y) > .1) && ['none', 'matrix(1, 0, 0, 1, 0, 0)'].includes(style.transform)) {
            violations.push('rect moved while transform is none/identity');
          }
          trace.push(sample);
          previous = {node, sample};
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });
    await page.goto(`http://127.0.0.1:${address.port}`);
    const button = page.getByRole('button', {name: 'Move fixture'});
    await expect(button).toBeVisible();
    await page.waitForTimeout(100);
    const before = await button.boundingBox();
    await button.click();
    await page.waitForTimeout(350);
    const after = await button.boundingBox();
    const evidence = await page.evaluate(() => {
      const win = window as unknown as {ff6Trace: {t: number; phase: string; x: number; y: number; opacity: number; transform: string}[]; ff6Entrances: string[]; ff6Violations: string[]};
      return {trace: win.ff6Trace, entrances: win.ff6Entrances, violations: win.ff6Violations};
    });
    console.log('METHOD: per-rAF getBoundingClientRect + computed opacity/transform; identity-transform/rect-motion self-check enabled.\n' + JSON.stringify(evidence));
    expect(errors).toEqual([]);
    expect(evidence.violations).toEqual([]);
    expect(evidence.entrances).toEqual(['ob-entrance']);
    expect(after!.x - before!.x).toBeCloseTo(40, 0);
    const first = evidence.trace.filter(s => s.phase === 'static');
    expect(first.length).toBeGreaterThan(2);
    expect(first.some(s => s.opacity > 0 && s.opacity < 1)).toBe(true);
    expect(Math.max(...first.map(s => s.y)) - Math.min(...first.map(s => s.y))).toBeGreaterThan(1);
    const spring = evidence.trace.filter(s => s.phase === 'hydrated');
    expect(spring.every(s => s.opacity === 1)).toBe(true);
    expect(spring.some(s => s.x > before!.x + 1 && s.x < after!.x - 1)).toBe(true);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

for (const surface of ['Seam select', 'Standalone select']) for (const reduced of [false, true]) {
  test(`FF-4 chrome glide survives the hydrated export seam; ${surface}; reduced=${reduced}`, async ({page}) => {
    const html = readFileSync(resolve('e2e-viewer/generated/motion.html'), 'utf8');
    const server = createServer((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(html); });
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    const address = server.address();
    if (!address || typeof address === 'string') throw new Error('No fixture server');
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.emulateMedia({reducedMotion: reduced ? 'reduce' : 'no-preference'});
      await page.goto(`http://127.0.0.1:${address.port}`);
      await page.getByRole('combobox', {name: surface}).click();
      await page.getByRole('option', {name: 'First option'}).hover();
      await page.waitForTimeout(350);
      const trace = await page.evaluate(async () => {
        const overlay = document.querySelector<HTMLElement>('[data-fluid-hover="select"]')!;
        const rows = [...document.querySelectorAll<HTMLElement>('[role="option"]')];
        const from = rows[0].getBoundingClientRect().y;
        const to = rows[1].getBoundingClientRect().y;
        const samples: {t: number; y: number; transform: string}[] = [];
        const record = () => samples.push({t: performance.now(), y: overlay.getBoundingClientRect().y, transform: getComputedStyle(overlay).transform});
        await new Promise<void>(resolve => requestAnimationFrame(() => { record(); resolve(); }));
        rows[1].dispatchEvent(new PointerEvent('pointermove', {bubbles: true, pointerType: 'mouse'}));
        const start = performance.now();
        await new Promise<void>(resolve => {
          const frame = () => { record(); if (performance.now() - start < 350) requestAnimationFrame(frame); else resolve(); };
          requestAnimationFrame(frame);
        });
        return {from, to, samples};
      });
      console.log(`FF46 ${surface} reduced=${reduced} per-rAF rect/transform ${JSON.stringify(trace)}`);
      expect(errors).toEqual([]);
      expect(trace.samples[0].y).toBeCloseTo(trace.from, 0);
      expect(trace.samples.at(-1)!.y).toBeCloseTo(trace.to, 0);
      const intermediate = trace.samples.filter(sample => sample.y > trace.from + .5 && sample.y < trace.to - .5);
      if (reduced) expect(intermediate).toHaveLength(0);
      else expect(intermediate.length).toBeGreaterThan(0);
      for (const sample of trace.samples.filter(sample => Math.abs(sample.y - trace.from) > .5)) {
        expect(sample.transform, 'rect-motion/identity-transform hazard').not.toMatch(/^(none|matrix\(1, 0, 0, 1, 0, 0\))$/);
      }
    } finally {
      await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    }
  });
}
