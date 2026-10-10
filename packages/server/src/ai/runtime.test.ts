import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {chmod, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile} from 'node:fs/promises';
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
afterEach(async () => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); await rm(dir, {recursive: true, force: true}); });

async function fixture(archive: 'zip' | 'tar.xz', symlinkBinary = false): Promise<{pin: Extract<RuntimeArtifact, {status: 'supported'}>; bytes: Buffer}> {
  const source = path.join(dir, `source-${archive}`);
  await mkdir(path.join(source, 'Release'), {recursive: true});
  await writeFile(path.join(source, 'Release', 'whisper-cli.exe'), '#!/bin/sh\nexit 0\n');
  await writeFile(path.join(source, 'Release', 'companion.dll'), 'companion');
  await chmod(path.join(source, 'Release', 'companion.dll'), 0o444);
  if (symlinkBinary) {
    await rm(path.join(source, 'Release', 'whisper-cli.exe'));
    await symlink('companion.dll', path.join(source, 'Release', 'whisper-cli.exe'));
  }
  const file = path.join(dir, `fixture.${archive}`);
  if (archive === 'zip') execFileSync('zip', ['-qry', file, 'Release'], {cwd: source});
  else execFileSync('tar', ['-cJf', file, 'Release'], {cwd: source});
  const bytes = await readFile(file);
  return {bytes, pin: {status: 'supported', version: '1', url: 'https://fixture.test/runtime', archive,
    binaryPath: 'Release/whisper-cli.exe', extractDir: 'Release', size: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex')}};
}

it.each(['zip', 'tar.xz'] as const)('enables a fresh installation from %s, preserves DLLs, and re-provisions a pin bump', async (archive) => {
  const {pin, bytes} = await fixture(archive);
  const fetch = vi.fn(async (url: string | URL | Request) => new Response(String(url) === WHISPER_MODEL_PIN.url ? 'model' : new Uint8Array(bytes)));
  vi.stubGlobal('fetch', fetch);
  const ffmpegPin = {...pin, extractDir: undefined};
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': pin, ffmpeg: ffmpegPin});
  const local = new LocalWhisper(path.join(dir, 'models'), undefined, undefined, runtime);
  const service = new AiService({query: vi.fn(async () => [])} as unknown as Db, path.join(dir, 'models'), () => local.resolve(), local);
  try {
    expect((await local.status()).ready).toBe(false);
    await service.setConfig({provider: 'off', transcription: {provider: 'local'}});
    await expect.poll(async () => (await service.status()).download, {timeout: 10_000}).toMatchObject({done: true});
    expect(await local.status()).toMatchObject({ready: true, runtime: {tools: {'whisper-cli': {status: 'provisioned', version: '1'}, ffmpeg: {status: 'provisioned'}}}});
    const binary = (await runtime.binary('whisper-cli'))!;
    expect(await readFile(path.join(path.dirname(binary), 'companion.dll'), 'utf8')).toBe('companion');
    expect(await readdir(path.dirname((await runtime.binary('ffmpeg'))!))).toEqual(['whisper-cli.exe']);
    await runtime.provision();
    expect(fetch).toHaveBeenCalledTimes(3);
    const nextPin = {...pin, version: '1+runtime-binaries-v1'};
    const next = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': nextPin, ffmpeg: {...ffmpegPin, version: '1+runtime-binaries-v1'}});
    expect((await next.status()).tools['whisper-cli']).toMatchObject({status: 'missing', version: '1+runtime-binaries-v1', installedVersion: '1'});
    for (const tool of ['whisper-cli', 'ffmpeg']) {
      await mkdir(path.join(dir, 'bin', tool, '.extract-crashed'));
      await mkdir(path.join(dir, 'bin', tool, 'install-crashed'));
    }
    await next.provision();
    expect(fetch).toHaveBeenCalledTimes(5);
    expect((await local.status()).modelPresent).toBe(true);
    expect(await next.binary('whisper-cli')).not.toBe(binary);
    await expect(readFile(binary)).rejects.toMatchObject({code: 'ENOENT'});
    for (const tool of ['whisper-cli', 'ffmpeg'] as const) {
      expect(await readdir(path.join(dir, 'bin', tool))).toEqual(['current.json', path.basename(path.dirname((await next.binary(tool))!))]);
    }
    const override = new LocalWhisper(path.join(dir, 'models'), process.execPath, process.execPath, next);
    expect(await override.status()).toMatchObject({runtimeAvailable: true});
    const invalidOverride = new LocalWhisper(path.join(dir, 'models'), path.join(dir, 'absent'), process.execPath, next);
    expect(await invalidOverride.status()).toMatchObject({runtimeAvailable: false});
    vi.stubEnv('OPENBOOK_WHISPER_BIN', path.join(dir, 'absent'));
    expect((await new LocalWhisper(path.join(dir, 'models'), undefined, undefined, next).status()).runtimeAvailable).toBe(false);
    vi.stubEnv('OPENBOOK_WHISPER_BIN', process.execPath);
    expect((await new LocalWhisper(path.join(dir, 'models'), undefined, undefined, next).status()).runtimeAvailable).toBe(true);
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
  await expect(new ManagedRuntime(root, 'fixture', {'whisper-cli': nextPin, ffmpeg: nextPin}).provision()).rejects.toThrow(kind === 'invalid-archive' ? 'Command failed' : 'mismatch');
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
  for (const platform of ['linux', 'win32']) {
    const unknown = new ManagedRuntime(path.join(dir, 'bin'), runtimeTarget(platform, 'arm64'));
    await unknown.provision();
    expect((await unknown.status()).tools).toMatchObject({
      'whisper-cli': {status: 'unsupported'}, ffmpeg: {status: 'unsupported'},
    });
  }
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

it.each(['OPENBOOK_WHISPER_BIN', 'OPENBOOK_FFMPEG_BIN'] as const)('skips the archive for the %s override', async (env) => {
  const {pin, bytes} = await fixture('zip');
  const fetch = vi.fn(async () => new Response(new Uint8Array(bytes)));
  vi.stubGlobal('fetch', fetch);
  vi.stubEnv(env, process.execPath);
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {
    'whisper-cli': {...pin, url: 'https://fixture.test/whisper'}, ffmpeg: {...pin, url: 'https://fixture.test/ffmpeg'},
  });
  const local = new LocalWhisper(path.join(dir, 'models'), undefined, undefined, runtime);
  try {
    await local.provision();
    expect(fetch).toHaveBeenCalledOnce();
    expect(fetch).toHaveBeenCalledWith(env === 'OPENBOOK_WHISPER_BIN' ? 'https://fixture.test/ffmpeg' : 'https://fixture.test/whisper', expect.anything());
    expect(await runtime.binary(env === 'OPENBOOK_WHISPER_BIN' ? 'whisper-cli' : 'ffmpeg')).toBeNull();
  } finally { await local.dispose(); }
});

it.each([true, false])('rejects a symlink binary via lstat (extractDir: %s)', async (extractDir) => {
  const {pin, bytes} = await fixture('zip', true);
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes))));
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {
    'whisper-cli': {...pin, extractDir: extractDir ? pin.extractDir : undefined}, ffmpeg: pin,
  });
  await expect(runtime.provision()).rejects.toThrow('Runtime binary is not a regular file');
  expect(await runtime.binary('whisper-cli')).toBeNull();
  await expect(readFile(path.join(dir, 'bin', 'whisper-cli', 'current.json'))).rejects.toMatchObject({code: 'ENOENT'});
});

it('rejects an archive containing parent traversal without writing outside staging', async () => {
  const {pin, bytes} = await fixture('zip');
  // Replace equal-length names in both ZIP headers, retaining valid content CRCs.
  const traversal = Buffer.from(bytes);
  for (let offset = traversal.indexOf('Release'); offset !== -1; offset = traversal.indexOf('Release', offset + 7)) {
    traversal.write('../oops', offset);
  }
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(traversal))));
  const badPin = {...pin, sha256: createHash('sha256').update(traversal).digest('hex')};
  const root = path.join(dir, 'bin');
  const runtime = new ManagedRuntime(root, 'fixture', {'whisper-cli': badPin, ffmpeg: pin});
  await expect(runtime.provision()).rejects.toThrow(/whisper-cli: (?:Command failed|ENOENT)/);
  expect(await runtime.binary('whisper-cli')).toBeNull();
  expect(await readdir(path.join(root, 'whisper-cli'))).toEqual(['archive.zip', 'archive.zip.verified.json']);
  await expect(readFile(path.join(root, 'whisper-cli', 'oops', 'whisper-cli.exe'))).rejects.toMatchObject({code: 'ENOENT'});
});

it('reports the active tool and download failures, and clears failure on retry', async () => {
  const {pin, bytes} = await fixture('zip');
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  vi.stubGlobal('fetch', vi.fn(async () => { await gate; throw new Error('offline'); }));
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': pin, ffmpeg: pin});
  const pending = runtime.provision();
  const rejection = expect(pending).rejects.toThrow('whisper-cli');
  await expect.poll(async () => (await runtime.status()).tools['whisper-cli'].status).toBe('provisioning');
  release();
  await rejection;
  expect((await runtime.status()).tools['whisper-cli']).toMatchObject({status: 'failed', detail: expect.stringContaining('offline')});
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes))));
  await runtime.provision();
  expect((await runtime.status()).tools['whisper-cli'].status).toBe('provisioned');
});

it('exposes stale model files and override names without exposing executable paths', async () => {
  const models = path.join(dir, 'models');
  await mkdir(models);
  await writeFile(path.join(models, 'ggml-base.bin'), 'legacy');
  const local = new LocalWhisper(models, process.execPath, path.join(dir, 'missing'));
  expect(await local.status()).toMatchObject({modelPresent: false, modelUpdateAvailable: true, runtime: {tools: {
    'whisper-cli': {override: 'OPENBOOK_WHISPER_BIN', available: true},
    ffmpeg: {override: 'OPENBOOK_FFMPEG_BIN', available: false},
  }}});
  await local.dispose();
});

it('abort clears the stage without marking failed', async () => {
  const {pin} = await fixture('zip');
  const controller = new AbortController();
  let started = false;
  vi.stubGlobal('fetch', vi.fn(async (_url: string, options: RequestInit) => {
    started = true;
    return new Promise<Response>((_resolve, reject) => {
      options.signal!.addEventListener('abort', () => reject(options.signal!.reason), {once: true});
    });
  }));
  const runtime = new ManagedRuntime(path.join(dir, 'bin'), 'fixture', {'whisper-cli': pin, ffmpeg: pin});
  const pending = runtime.provision(controller.signal);
  const rejection = expect(pending).rejects.toMatchObject({name: 'AbortError'});
  await expect.poll(() => started).toBe(true);
  expect((await runtime.status()).tools['whisper-cli'].status).toBe('provisioning');
  controller.abort();
  await rejection;
  const status = (await runtime.status()).tools['whisper-cli'];
  expect(status.status).toBe('missing');
  expect(status.detail).toBeUndefined();
});

// Desktop passes --data-dir independently of OPENBOOK_MODELS_DIR. Reopening
// its managed bin directory must work even with Finder's restricted PATH.
it('reopens managed tools under dataDir with an empty PATH and relocated models', async () => {
  const {pin, bytes} = await fixture('zip');
  vi.stubGlobal('fetch', vi.fn(async () => new Response(new Uint8Array(bytes))));
  const binDir = path.join(dir, 'desktop-app-data', 'bin');
  const pins = {'whisper-cli': pin, ffmpeg: pin};
  await new ManagedRuntime(binDir, 'fixture', pins).provision();
  vi.stubEnv('PATH', '');
  vi.stubEnv('OPENBOOK_WHISPER_BIN', '');
  vi.stubEnv('OPENBOOK_FFMPEG_BIN', '');
  const models = path.join(dir, 'relocated-models');
  const reopened = new ManagedRuntime(binDir, 'fixture', pins);
  const local = new LocalWhisper(models, undefined, undefined, reopened);
  const wrongDir = new LocalWhisper(models);
  const override = new LocalWhisper(models, path.join(dir, 'missing-override'), undefined, reopened);
  try {
    expect(await local.status()).toMatchObject({runtimeAvailable: true, runtime: {tools: {
      'whisper-cli': {status: 'provisioned', available: true},
      ffmpeg: {status: 'provisioned', available: true},
    }}});
    expect((await wrongDir.status()).runtimeAvailable).toBe(false);
    expect((await override.status()).runtimeAvailable).toBe(false);
  } finally { await Promise.all([local.dispose(), wrongDir.dispose(), override.dispose()]); }
});
