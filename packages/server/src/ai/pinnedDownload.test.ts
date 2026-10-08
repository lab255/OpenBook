import {createHash} from 'node:crypto';
import {existsSync} from 'node:fs';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import {downloadPinned} from './pinnedDownload';

const bytes = 'model bytes';
const pin = {version: 'v1', url: 'https://example.test/model.bin', sha256: createHash('sha256').update(bytes).digest('hex'), size: Buffer.byteLength(bytes)};
let dir: string;
let dest: string;
const fetchMock = vi.fn(async () => new Response(bytes));
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'pinned-download-'));
  dest = path.join(dir, 'model.bin');
  fetchMock.mockClear();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(dir, {recursive: true, force: true});
});

it('skips the same file and version, then downloads on a version-only pin bump', async () => {
  await downloadPinned(pin, dest);
  const progress = vi.fn();
  await downloadPinned(pin, dest, progress);
  expect(fetchMock).toHaveBeenCalledTimes(1);
  expect(progress).toHaveBeenLastCalledWith({received: pin.size, total: pin.size});
  await downloadPinned({...pin, version: 'v2'}, dest);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(JSON.parse(await readFile(`${dest}.verified.json`, 'utf8')).version).toBe('v2');
});

it.each(['missing', 'legacy', 'truncated', 'bad-receipt'])('downloads %s installations', async (kind) => {
  await downloadPinned(pin, dest);
  if (kind === 'missing') await rm(dest);
  if (kind === 'legacy') await rm(`${dest}.verified.json`);
  if (kind === 'truncated') await writeFile(dest, 'short');
  if (kind === 'bad-receipt') await writeFile(`${dest}.verified.json`, '{');
  await downloadPinned(pin, dest);
  expect(fetchMock).toHaveBeenCalledTimes(2);
  expect(await readFile(dest, 'utf8')).toBe(bytes);
});

it('does not leave a valid receipt or partial after a failed upgrade, and allows retry', async () => {
  await downloadPinned(pin, dest);
  const next = {...pin, version: 'v2'};
  fetchMock.mockResolvedValueOnce(new Response('corrupt'));
  await expect(downloadPinned(next, dest)).rejects.toThrow('size mismatch');
  expect(await readFile(dest, 'utf8')).toBe(bytes);
  for (const suffix of ['.part', '.verified.json', '.verified.json.part']) expect(existsSync(`${dest}${suffix}`)).toBe(false);
  await downloadPinned(next, dest);
  expect(fetchMock).toHaveBeenCalledTimes(3);
});
