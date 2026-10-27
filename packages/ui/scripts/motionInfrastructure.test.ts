import baseline from './viewerMotionBaseline.json';
import {describe, expect, it} from 'vitest';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {toHtml} from '../src/export/toHtml';
import {inlineScriptHash, pageCsp} from '../src/export/exportCsp';
import {motionDispositions, validateDisposition} from '../src/viewer/motionDisposition';
import {fixtureDispositions} from '../src/viewer/__fixtures__/motionFixture';

export const motionSnapshot = {editor: 'blocks' as const, blockdoc: {v: 1 as const, blocks: [{id: 'ff6', type: 'ff6/fixture', text: [{t: 'FF6 fixture'}]}]}};
export function executableScripts(html: string): string[] {
  return [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(match => !/type=["']application\//.test(match[1])).map(match => {
    expect(match[1], 'no external executable script').not.toMatch(/\bsrc\s*=/i);
    return match[2];
  });
}
const evidence = (...values: unknown[]) => process.stdout.write(values.map(value => typeof value === 'string' ? value : JSON.stringify(value)).join(' ') + '\n');
const html = toHtml(motionSnapshot, 'FF6 fixture', '');
const scripts = executableScripts(html);
function assertScripts(documentHtml: string) {
  const sources = executableScripts(documentHtml);
  expect(sources, 'CSP script roles: interpreter, scheme, viewer, boot only').toHaveLength(4);
  expect(sources[0]).toContain('__OB_SAFE_EXPRESSION__');
  expect(sources[1]).toContain('__OB_DATA_SCHEME');
  expect(sources[2]).toContain('OpenBookViewer');
  expect(sources[3]).toContain('OpenBookViewer.mount');
  expect(documentHtml).toContain(pageCsp(sources.map(inlineScriptHash)));
}

describe('FF-6 infrastructure', () => {
  it('bounds raw viewer delta against aea2f52c baseline at 80,000 bytes', () => {
    const bytes = readFileSync('src/export/vendor/openbook-viewer.js').byteLength;
    const assertSize = (size: number) => expect(size - baseline.rawBytes, 'viewer raw delta <= 80KB').toBeLessThanOrEqual(baseline.maxDeltaBytes);
    expect(() => assertSize(baseline.rawBytes + 80001)).toThrow('viewer raw delta');
    assertSize(bytes);
    evidence(`SIZE baseline=${baseline.rawBytes} after=${bytes} delta=${bytes - baseline.rawBytes} bound=${baseline.maxDeltaBytes}; hypothetical +80001 RED, actual GREEN`);
  });
  it('preserves four script roles and exactly authorizes emitted bytes', () => {
    expect(() => assertScripts(html + '<script>hypotheticalExtraScript()</script>')).toThrow('CSP script roles');
    assertScripts(html);
    expect(() => assertScripts(html + '<script src="extra.js"></script>')).toThrow('no external executable script');
    expect(scripts.slice(0, 2).map(inlineScriptHash)).toEqual(baseline.scriptHashes.slice(0, 2));
    evidence('CSP before', baseline.scriptHashes);
    evidence('CSP extra script RED; four exact hashes GREEN', scripts.map(inlineScriptHash));
  });
  it('sets the hydration gate before mount is called or returns; rolls back on failure', () => {
    const boot = scripts[3];
    const exercise = (source: string, fail = false) => {
      document.documentElement.removeAttribute('data-ob-hydrated');
      document.body.innerHTML = '<main>static</main><script type="application/openbook+json">{"data":{"blockdoc":{}}}</script>';
      let called = false;
      runInNewContext(source, {document, window: {OpenBookViewer: {mount() {
        expect(document.documentElement.hasAttribute('data-ob-hydrated'), 'gate before mount').toBe(true);
        called = true;
        if (fail) throw new Error('mount failure');
      }}}});
      expect(called, 'mount observed hydration gate').toBe(true);
      expect(document.documentElement.hasAttribute('data-ob-hydrated')).toBe(!fail);
      if (fail) expect(document.querySelector('main')?.textContent).toBe('static');
    };
    const late = boot.replace('document.documentElement.setAttribute(\'data-ob-hydrated\', \'\');', '');
    expect(() => exercise(late)).toThrow('mount observed hydration gate');
    exercise(boot); exercise(boot, true);
    document.documentElement.removeAttribute('data-ob-hydrated');
    evidence('BOOT removed gate RED; attribute before mount + rollback GREEN');
  });
  it('validates every disposition, including the test-only fixture', () => {
    for (const entry of [...motionDispositions, ...fixtureDispositions]) validateDisposition(entry);
    expect(() => validateDisposition({...fixtureDispositions[0], exportedObservable: ''})).toThrow('exportedObservable');
    expect(() => validateDisposition({...fixtureDispositions[0], exportSafe: false})).toThrow('app surface');
    evidence('REGISTRY missing observable/app surface RED; recorded entries GREEN');
  });
  it('covers all CSS disposition token dependencies with emitted/live parity', () => {
    const css = readFileSync('src/index.css', 'utf8');
    const root = css.slice(css.indexOf('  :root {'), css.indexOf('  .dark {'));
    for (const name of new Set([...motionDispositions, ...fixtureDispositions].filter(e => e.exportSafe === 'css').flatMap(e => [...e.tokens]))) {
      const value = root.match(new RegExp(`--${name}: ([^;]+);`))![1];
      const assertMirror = (emitted: string) => expect(emitted.match(new RegExp(`--${name}: ([^;]+);`))?.[1], `mirror --${name}`).toBe(value);
      expect(() => assertMirror(html.replace(`--${name}: ${value};`, `--${name}: broken;`))).toThrow(`mirror --${name}`);
      assertMirror(html);
      evidence(`PARITY --${name}: flipped mirror literal RED; restored ${value} GREEN`);
    }
  });
  it('keeps the fixture absent from the shipped viewer', () => {
    expect(readFileSync('src/export/vendor/openbook-viewer.js', 'utf8')).not.toContain('Move fixture');
    expect(html).toContain('data-block-type="ff6/fixture"');
    expect(html).toContain('FF6 fixture');
  });
});
