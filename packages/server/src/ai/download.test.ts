import {createHash} from 'node:crypto';
import {existsSync, readFileSync} from 'node:fs';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {downloadFile, downloadVerified} from './download';

const bytes = Buffer.from('verified model');
const pin = {sha256: createHash('sha256').update(bytes).digest('hex'), size: bytes.length};
let dir: string;
let dest: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'verified-download-'));
  dest = path.join(dir, 'model');
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, {recursive: true, force: true});
});

function respond(body: Uint8Array) {
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(body))));
}

describe('downloadVerified', () => {
  it('verifies before atomic replacement and reports progress without content-length', async () => {
    await writeFile(dest, 'old');
    respond(bytes);
    const progress = vi.fn();
    await downloadVerified('https://example.test/model', dest, pin, (state) => {
      expect(readFileSync(dest, 'utf8')).toBe('old');
      progress(state);
    });
    expect(await readFile(dest)).toEqual(bytes);
    expect(progress).toHaveBeenLastCalledWith({received: bytes.length, total: bytes.length});
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it.each(['corrupt', 'truncated', 'oversized'] as const)('rejects %s content and cleans partial, preserving the old file', async (kind) => {
    await writeFile(dest, 'old');
    respond(kind === 'corrupt' ? Buffer.alloc(bytes.length) : kind === 'truncated' ? bytes.subarray(0, 3) : Buffer.concat([bytes, bytes]));
    await expect(downloadVerified('https://example.test/model', dest, pin)).rejects.toThrow(kind === 'corrupt' ? 'SHA-256 mismatch' : 'size mismatch');
    expect(await readFile(dest, 'utf8')).toBe('old');
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it('cleans partial files after a transport failure', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(bytes.subarray(0, 3)); },
      pull(controller) { controller.error(new Error('connection terminated')); },
    }))));
    await expect(downloadVerified('https://example.test/model', dest, pin)).rejects.toThrow('connection terminated');
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it('handles HTTP and filesystem errors without publishing a destination', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', {status: 404})));
    await expect(downloadVerified('https://example.test/model', dest, pin)).rejects.toThrow('HTTP 404');
    respond(bytes);
    await expect(downloadVerified('https://example.test/model', path.join(dir, 'missing', 'model'), pin)).rejects.toThrow();
    expect(existsSync(dest)).toBe(false);
    expect(existsSync(`${dest}.part`)).toBe(false);
  });

  it('retains unverified arbitrary llama bytes and progress', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(bytes, {headers: {'content-length': String(bytes.length)}})));
    const progress = vi.fn();
    await downloadFile('https://example.test/custom.gguf', dest, progress);
    expect(await readFile(dest)).toEqual(bytes);
    expect(progress).toHaveBeenLastCalledWith({received: bytes.length, total: bytes.length});
  });
});
