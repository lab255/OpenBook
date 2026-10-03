import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it} from 'vitest';
import {LocalWhisper, parseWhisperOutput, runWhisperProcess, WHISPER_MODEL} from './whisper';

let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'meet3-test-')); });
afterEach(async () => { await rm(dir, {recursive: true, force: true}); });

async function script(name: string, source: string): Promise<string> {
  const file = path.join(dir, name);
  await writeFile(file, `#!${process.execPath}\n${source}`, {mode: 0o700});
  return file;
}

describe('optional local whisper runtime', () => {
  it('returns null for missing model or executables, and discovers a model without restart', async () => {
    const local = new LocalWhisper(dir, process.execPath, process.execPath);
    expect(await local.resolve()).toBeNull();
    expect(await local.status()).toMatchObject({modelPresent: false, runtimeAvailable: true, ready: false});
    await writeFile(path.join(dir, WHISPER_MODEL), 'test model');
    expect(await local.resolve()).toBe(local);
    const missing = new LocalWhisper(dir, path.join(dir, 'missing'), process.execPath);
    expect(await missing.resolve()).toBeNull();
    expect(await missing.status()).toMatchObject({modelPresent: true, runtimeAvailable: false, detail: expect.stringContaining('Settings → AI')});
    await local.dispose();
    expect(await local.resolve()).toBeNull();
  });

  it('decodes exact input bytes, converts millisecond offsets, and cleans scratch files', async () => {
    const marker = path.join(dir, 'scratch');
    const ffmpeg = await script('ffmpeg', 'const fs = require(\'node:fs\'); const args = process.argv.slice(2); const input = args[args.indexOf(\'-i\') + 1]; if (fs.readFileSync(input).toString() !== \'recording\') process.exit(2); fs.writeFileSync(args.at(-1), \'wav\');');
    const whisper = await script('whisper', `const fs = require('node:fs'); const args = process.argv.slice(2); const output = args[args.indexOf('-of') + 1]; fs.writeFileSync(${JSON.stringify(marker)}, require('node:path').dirname(output)); fs.writeFileSync(output + '.json', JSON.stringify({transcription: [{offsets: {from: 250, to: 1500}, text: ' Hello world.'}]}));`);
    const local = new LocalWhisper(dir, whisper, ffmpeg);
    expect(await local.transcribe(new TextEncoder().encode('recording'), {filename: '../../escape.webm', mime: 'audio/webm'}))
      .toEqual({text: 'Hello world.', segments: [{start: 0.25, end: 1.5, text: 'Hello world.'}], durationMs: 1500});
    await expect(readdir(await readFile(marker, 'utf8'))).rejects.toThrow();
  });

  it.each(['abort', 'dispose'] as const)('%s kills in-flight inference and removes scratch files', async (action) => {
    const marker = path.join(dir, 'started');
    const ffmpeg = await script('ffmpeg', 'process.exit(0);');
    const whisper = await script('whisper', `const fs = require('node:fs'); const args = process.argv.slice(2); fs.writeFileSync(${JSON.stringify(marker)}, JSON.stringify({pid: process.pid, dir: require('node:path').dirname(args[args.indexOf('-of') + 1])})); setInterval(() => {}, 1000);`);
    const local = new LocalWhisper(dir, whisper, ffmpeg);
    const controller = new AbortController();
    const promise = local.transcribe(new Uint8Array([1]), {signal: controller.signal});
    const rejected = expect(promise).rejects.toMatchObject({name: 'AbortError'});
    await expect.poll(async () => readFile(marker, 'utf8').catch(() => '')).not.toBe('');
    const started = JSON.parse(await readFile(marker, 'utf8')) as {pid: number; dir: string};
    if (action === 'abort') controller.abort();
    else await local.dispose();
    await rejected;
    expect(() => process.kill(started.pid, 0)).toThrow();
    await expect(readdir(started.dir)).rejects.toThrow();
  });

  it('rejects pre-aborted work, spawn failures, failed processes and malformed output', async () => {
    const controller = new AbortController();
    controller.abort();
    await expect(new LocalWhisper(dir).transcribe(new Uint8Array(), {signal: controller.signal})).rejects.toMatchObject({name: 'AbortError'});
    const signal = new AbortController().signal;
    await expect(runWhisperProcess(path.join(dir, 'missing'), [], signal)).rejects.toThrow();
    await expect(runWhisperProcess(process.execPath, ['-e', 'process.exit(1)'], signal)).rejects.toThrow('Local audio processing failed');
    for (const value of [null, {}, {transcription: [{text: 'bad', offsets: {from: -1, to: 100}}]}]) {
      expect(() => parseWhisperOutput(value)).toThrow();
    }
    expect(parseWhisperOutput({transcription: []})).toEqual({text: '', segments: [], durationMs: 0});
  });
});
