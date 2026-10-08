import {createHash} from 'node:crypto';
import {mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {Db} from '../db';
import {AiService} from './service';
import {WHISPER_MODEL_PIN} from './runtimeManifest';

vi.mock('./runtimeManifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./runtimeManifest')>();
  const {createHash} = await import('node:crypto');
  return {...actual, WHISPER_MODEL_PIN: {...actual.WHISPER_MODEL_PIN,
    sha256: createHash('sha256').update('model bytes').digest('hex'), size: 11,
  }};
});

let dir: string;
let service: AiService;
const fetchMock = vi.fn(async () => new Response('model bytes'));
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'service-download-'));
  const db = {query: vi.fn(async () => [])} as unknown as Db;
  service = new AiService(db, dir);
  await service.setConfig({provider: 'llama'});
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(async () => {
  await service.dispose();
  vi.unstubAllGlobals();
  await rm(dir, {recursive: true, force: true});
});

async function finish(url: string) {
  const state = await service.startDownload(url);
  await expect.poll(() => state.done || Boolean(state.error)).toBe(true);
  return state;
}

it('routes Whisper through verification, skips a matching receipt, and refreshes an old version', async () => {
  const pin = WHISPER_MODEL_PIN;
  expect(await finish(pin.url)).toMatchObject({done: true, received: 11, total: 11});
  expect(await finish(pin.url)).toMatchObject({done: true, received: 11, total: 11});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const receipt = path.join(dir, `${pin.fileName}.verified.json`);
  const stored = JSON.parse(await readFile(receipt, 'utf8'));
  await writeFile(receipt, JSON.stringify({...stored, version: 'previous-version'}));
  expect(await finish(pin.url)).toMatchObject({done: true});
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(await readFile(receipt, 'utf8')).version).toBe(pin.version);
  expect((await service.getConfig()).model).toBeUndefined();
});

it('reports corrupt Whisper bytes as an error and removes the partial', async () => {
  fetchMock.mockResolvedValueOnce(new Response('wrong bytes'));
  expect(await finish(WHISPER_MODEL_PIN.url)).toMatchObject({done: false, error: expect.stringContaining('SHA-256 mismatch')});
  expect(await readdir(dir)).toEqual([]);
});

it('maps the legacy mutable model URL to the current immutable pin', async () => {
  await finish('https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.bin');
  expect(fetchMock).toHaveBeenCalledWith(WHISPER_MODEL_PIN.url, {redirect: 'follow'});
});

it('keeps arbitrary llama downloads unverified, auto-selected, and skipped when present', async () => {
  const arbitrary = 'arbitrary GGUF content';
  expect(createHash('sha256').update(arbitrary).digest('hex')).not.toBe(WHISPER_MODEL_PIN.sha256);
  fetchMock.mockResolvedValueOnce(new Response(arbitrary));
  const url = 'https://example.test/custom.gguf';
  expect(await finish(url)).toMatchObject({done: true});
  await expect.poll(async () => (await service.getConfig()).model).toBe('custom.gguf');
  expect(await readFile(path.join(dir, 'custom.gguf'), 'utf8')).toBe(arbitrary);
  expect(await finish(url)).toMatchObject({done: true});
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(await readdir(dir)).toEqual(['custom.gguf']);
});
