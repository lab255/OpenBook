import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir, mkdtemp, readFile, readdir, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {afterEach, beforeEach, expect, it, vi} from 'vitest';
import type {Db} from '../db';
import {ManagedRuntime, runtimeTarget} from './runtime';
import {type RuntimeArtifact, WHISPER_MODEL_PIN} from './runtimeManifest';
import {AiService} from './service';
import {executable, LocalWhisper} from './whisper';

vi.mock('./runtimeManifest', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./runtimeManifest')>();
  const {createHash} = await import('node:crypto');
  return {...actual, WHISPER_MODEL_PIN: {...actual.WHISPER_MODEL_PIN,
    sha256: createHash('sha256').update('model').digest('hex'), size: 5,
  }};
});
let dir: string;
beforeEach(async () => { dir = await mkdtemp(path.join(tmpdir(), 'runtime-test-')); });
afterEach(async () => { vi.unstubAllGlobals(); await rm(dir, {recursive: true, force: true}); });

async function fixture(archive: 'zip' | 'tar.xz'): Promise<{pin: RuntimeArtifact; bytes: Buffer}> {
  const source = path.join(dir, `source-${archive}`);
  await mkdir(path.join(source, 'Release'), {recursive: true});
  await writeFile(path.join(source, 'Release', 'whisper-cli.exe'), '#!/bin/sh\nexit 0\n');
  await writeFile(path.join(source, 'Release', 'companion.dll'), 'companion');
  const file = path.join(dir, `fixture.${archive}`);
  if (archive === 'zip') execFileSync('zip', ['-qr', file, 'Release'], {cwd: source});
  else execFileSync('tar', ['-cJf', file, 'Release'], {cwd: source});
  const bytes = await readFile(file);
  return {bytes, pin: {status: 'supported', version: '1', url: 'https://fixture.test/runtime', archive,
    binaryPath: 'Release/whisper-cli.exe', extractDir: 'Release', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}};
}

it.each(['zip', 'tar.xz'] as const)('enables a fresh installation from %s, preserves DLLs, and re-provisions a pin bump', async (archive) => {
  const {pin, bytes} = await fixture(archive);
  const fetch = vi.fn(async (url: string | URL | Request) => new Response(String(url) === WHISPER_MODEL_PIN.url ? 'model' : new Uint8Array(bytes)));
  vi.stubGlobal('fetch', fetch);
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': pin, ffmpeg: pin});
  const local = new LocalWhisper(path.join(dir, 'models'), undefined, undefined, runtime);
  const service = new AiService({query: vi.fn(async () => [])} as unknown as Db, path.join(dir, 'models'), () => local.resolve(), local);
  try {
    expect((await local.status()).ready).toBe(false);
    await service.setConfig({provider: 'off', transcription: {provider: 'local'}});
    await expect.poll(async () => (await service.status()).download, {timeout: 10_000}).toMatchObject({done: true});
    expect(await local.status()).toMatchObject({ready: true, runtime: {tools: {'whisper-cli': {status: 'provisioned', version: '1'}, ffmpeg: {status: 'provisioned'}}}});
    const binary = (await runtime.binary('whisper-cli'))!;
    expect(await readFile(path.join(path.dirname(binary), 'companion.dll'), 'utf8')).toBe('companion');
    await runtime.provision();
    expect(fetch).toHaveBeenCalledTimes(3);
    const nextPin = {...pin, version: '2'};
    const next = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': nextPin, ffmpeg: nextPin});
    expect((await next.status()).tools['whisper-cli']).toMatchObject({status: 'missing', version: '2', installedVersion: '1'});
    await next.provision();
    expect(fetch).toHaveBeenCalledTimes(5);
    expect(await next.binary('whisper-cli')).not.toBe(binary);
    expect(await readFile(binary, 'utf8')).toContain('exit 0');
    const override = new LocalWhisper(path.join(dir, 'models'), process.execPath, process.execPath, next);
    expect(await override.status()).toMatchObject({runtimeAvailable: true});
    const invalidOverride = new LocalWhisper(path.join(dir, 'models'), path.join(dir, 'absent'), process.execPath, next);
    expect(await invalidOverride.status()).toMatchObject({runtimeAvailable: false});
  } finally { await service.dispose(); }
});

it.each(['corrupt', 'truncated', 'invalid-archive'])('keeps old installation intact after %s upgrade', async (kind) => {
  const {pin, bytes} = await fixture('zip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes))));
  const root = path.join(dir, 'bin');
  const old = new ManagedRuntime(root, 'fixture', {'whisper-cli': pin, ffmpeg: pin});
  await old.provision();
  const before = await readFile(path.join(root, 'whisper-cli', 'current.json'), 'utf8');
  const bad = kind === 'truncated' ? bytes.subarray(0, 5) : Buffer.alloc(bytes.length, 1);
  const nextPin = {...pin, version: '2', ...(kind === 'invalid-archive' ? {sha256: createHash('sha256').update(bad).digest('hex')} : {})};
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bad))));
  await expect(new ManagedRuntime(root, 'fixture', {'whisper-cli': nextPin, ffmpeg: nextPin}).provision()).rejects.toThrow(kind === 'invalid-archive' ? 'Failed to install' : 'mismatch');
  expect(await readFile(path.join(root, 'whisper-cli', 'current.json'), 'utf8')).toBe(before);
  expect(await old.binary('whisper-cli')).not.toBeNull();
  expect((await readdir(path.join(root, 'whisper-cli'))).filter((file) => file.startsWith('.extract-') || file.endsWith('.part'))).toEqual([]);
});

it('reports unsupported tools without throwing and provisions the supported tool', async () => {
  const {pin, bytes} = await fixture('zip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes))));
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {
    'whisper-cli': {status: 'unsupported', reason: 'no-upstream-cli', detail: 'No CLI'}, ffmpeg: pin,
  });
  await runtime.provision();
  expect((await runtime.status()).tools).toMatchObject({'whisper-cli': {status: 'unsupported', reason: 'no-upstream-cli'}, ffmpeg: {status: 'provisioned'}});
  const unknown = new ManagedRuntime(path.join(dir, 'bin'), runtimeTarget('linux', 'arm64'));
  await unknown.provision();
  expect((await unknown.status()).tools.ffmpeg.status).toBe('unsupported');
});

it('resolves Windows PATHEXT and PATH fallback', async () => {
  const file = path.join(dir, 'whisper-cli.exe');
  await writeFile(file, 'binary', {mode: 0o755});
  expect(await executable('whisper-cli', 'win32', {PATH: dir, PATHEXT: '.EXE;.CMD'})).toBe(file);
  expect(await executable('ffmpeg', 'win32', {PATH: dir})).toBeNull();
  expect(runtimeTarget('darwin', 'arm64')).toBe('aarch64-apple-darwin');
  expect(runtimeTarget('win32', 'x64')).toBe('x86_64-pc-windows-msvc');
});

it('disposal cancels an in-flight runtime download without publishing an install', async () => {
  const {pin} = await fixture('zip');
  let started = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    started = true;
    return new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {once: true});
    });
  }));
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': pin, ffmpeg: pin});
  const local = new LocalWhisper(path.join(dir, 'models'), undefined, undefined, runtime);
  const provisioning = local.provision();
  const rejected = expect(provisioning).rejects.toMatchObject({name: 'AbortError'});
  await expect.poll(() => started).toBe(true);
  await local.dispose();
  await rejected;
  expect((await runtime.status()).tools['whisper-cli'].status).toBe('missing');
  expect(await readdir(path.join(dir, 'bin', 'whisper-cli'))).toEqual([]);
});
