import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {renderToStaticMarkup} from 'react-dom/server';
import {expect, it} from 'vitest';
import {Button} from '../src/components/ui/button';
import {Input} from '../src/components/ui/input';

// Opt-in artifact producer: run against both revisions with the same content.
// FF7C_CAPTURE_PHASE=before|after pnpm exec vitest run scripts/controlPolishFixture.test.tsx
it.skipIf(!process.env.FF7C_CAPTURE_PHASE)('emits real control markup with the built stylesheet', () => {
  const phase = process.env.FF7C_CAPTURE_PHASE!;
  expect(['before', 'after']).toContain(phase);
  const bundle = readFileSync('src/export/vendor/openbook-viewer.js', 'utf8');
  const css: string = JSON.parse(bundle.match(/s\.textContent=("(?:\\.|[^"\\])*");/)![1]);
  const markup = renderToStaticMarkup(<main>
    <h1>Control ladder</h1>
    <section id="button"><h2>Buttons</h2>
      <div className="sample"><span>Default</span><Button>Save changes</Button></div>
      <div className="sample"><span>Small</span><Button size="sm">Save changes</Button></div>
      <div className="sample"><span>Large</span><Button size="lg">Save changes</Button></div>
      <div className="sample"><span>Public kit</span><button className="obe-ui-btn">Save changes</button></div>
      <div className="sample"><span>Block kit</span><button className="obe-kit-action">Save changes</button></div>
    </section>
    <section id="field"><h2>Fields</h2>
      <div className="sample"><span>Default</span><Input aria-label="Default" defaultValue="Project notes" /></div>
      <div className="sample"><span>Small</span><Input inputSize="sm" aria-label="Small" defaultValue="Project notes" /></div>
      <div className="sample"><span>Public kit</span><input className="obe-ui-field" aria-label="Public kit" defaultValue="Project notes" /></div>
      <div className="sample"><span>Block kit</span><input className="obe-kit-textinput" aria-label="Block kit" defaultValue="Project notes" /></div>
    </section>
  </main>);
  const folder = resolve('../../_captures/ff7c');
  mkdirSync(folder, {recursive: true});
  writeFileSync(`${folder}/${phase}.html`, `<!doctype html><html class="dark"><meta charset="utf-8"><style>${css}</style><style>body{margin:0;padding:24px;background:hsl(var(--background));color:hsl(var(--foreground));font-family:system-ui}main{max-width:600px}h1{font-size:24px;margin-bottom:20px}h2{font-size:18px;margin-bottom:12px}section{margin-bottom:24px}.sample{display:flex;align-items:center;gap:16px;margin-bottom:12px}.sample>span{width:80px;flex-shrink:0;font-size:13px}.sample>input{width:200px;flex:none}</style>${markup}</html>`);
});
