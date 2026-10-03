import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {API, FORWARDED_HEADER, LOCAL_OWNER_HEADER, HttpDataClient} from '@book.dev/sdk';
import {PgliteDb} from './db';
import {PageStore} from './store';
import {PageHub} from './hub';
import {createApp} from './app';
import {AiService} from './ai/service';
import {MockEngine, OpenAiCompatEngine} from './ai/providers';
import {AiUsageLog} from './ai/usage';
import {LocalDataClient} from './localClient';

let db: PgliteDb;
let store: PageStore;
let ai: AiService;
let dir: string;
let pageId: string;
let assetId: string;
const secret = 'transcription-owner';
const headers = {'content-type': 'application/json', 'X-OpenBook-Client': '1'};
const snapshot = () => ({editorjs: {blocks: []}, values: [], names: []});

beforeEach(async () => {
  dir = mkdtempSync(join(tmpdir(), 'meet2-'));
  db = await PgliteDb.create(dir);
  store = new PageStore(db);
  await store.migrate();
  ai = new AiService(db, join(dir, 'models'));
  pageId = (await store.upsertPage({name: 'Recording', data: snapshot()})).id;
  assetId = (await store.putAsset(new Uint8Array([1, 2, 3]), 'application/octet-stream')).id;
  await store.refAsset(assetId, pageId);
});
afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  await store.close();
  rmSync(dir, {recursive: true, force: true});
});
const appWith = (service = ai, usage?: AiUsageLog) => createApp(store, service, new PageHub(), {localOwnerSecret: secret, aiUsage: usage});
const post = (app = appWith(), body: unknown = {assetId, pageId}, guest = false) => app.request(API.aiTranscribe, {
  method: 'POST', headers: {...headers, ...(guest ? {[FORWARDED_HEADER]: '1'} : {[LOCAL_OWNER_HEADER]: secret})}, body: JSON.stringify(body),
});

describe('transcription contract', () => {
  it('round-trips and redacts keys, preserves blank/omitted keys, replaces and clears explicitly', async () => {
    const app = appWith();
    const save = async (transcription?: unknown) => {
      const res = await app.request(API.aiConfig, {method: 'PUT', headers: {...headers, [LOCAL_OWNER_HEADER]: secret}, body: JSON.stringify({provider: 'off', transcription})});
      expect(res.status).toBe(200);
      const value = await res.json();
      expect(JSON.stringify(value)).not.toContain('secret-key');
      expect(value.transcription.apiKey).toBeUndefined();
      return value;
    };
    expect((await save({provider: 'openai-compat', baseUrl: 'https://example.test/v1', model: 'whisper', apiKey: ' secret-key ', apiKeySet: true})).transcription.apiKeySet).toBe(true);
    expect((await new AiService(db, dir).getConfig()).transcription).toEqual({provider: 'openai-compat', baseUrl: 'https://example.test/v1', model: 'whisper', apiKey: 'secret-key'});
    for (const apiKey of ['', '   ', undefined]) {
      await save({provider: 'openai-compat', apiKey});
      expect((await ai.getConfig()).transcription?.apiKey).toBe('secret-key');
    }
    await save();
    expect((await ai.getConfig()).transcription?.apiKey).toBe('secret-key');
    await save({provider: 'local', apiKey: 'replacement-secret-key'});
    expect((await ai.getConfig()).transcription?.apiKey).toBe('replacement-secret-key');
    const status = await app.request(API.aiStatus, {headers: {...headers, [LOCAL_OWNER_HEADER]: secret}});
    expect((await status.json()).config.transcription).toEqual({provider: 'local', apiKeySet: true});
    expect((await save({provider: 'local', apiKey: null, apiKeySet: true})).transcription.apiKeySet).toBeUndefined();
    expect((await new AiService(db, dir).getConfig()).transcription?.apiKey).toBeUndefined();
  });

  it('returns the deterministic mock result and logs one attributed usage row', async () => {
    await ai.setConfig({provider: 'mock'});
    const usage = new AiUsageLog(store);
    const res = await post(appWith(ai, usage));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(await new MockEngine().transcribe(new Uint8Array([1, 2, 3])));
    const report = await usage.report();
    expect(report.rows).toHaveLength(1);
    expect(report.rows?.[0]).toMatchObject({provider: 'mock', kind: 'transcribe', inputTokens: 0, outputTokens: 0, cost: 0});
  });

  it('denies cloud to claimed-instance guests before sending bytes, even when chat is mock', async () => {
    await store.updateInstanceConfig({ownerSubject: 'test#owner', guestAccess: 'write'});
    await store.setPageVisibility(pageId, 'public');
    await ai.setConfig({provider: 'mock', transcription: {provider: 'openai-compat'}});
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect((await post(appWith(), undefined, true)).status).toBe(403);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('allows authenticated cloud transcription, attributes unknown cost, and sanitizes failures', async () => {
    await ai.setConfig({provider: 'off', transcription: {provider: 'openai-compat', model: 'whisper-1', apiKey: 'secret'}});
    const usage = new AiUsageLog(store);
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({text: 'Cloud', duration: 2})))
      .mockRejectedValueOnce(new Error('secret'));
    vi.stubGlobal('fetch', fetchMock);
    const app = appWith(ai, usage);
    const res = await post(app);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({text: 'Cloud', durationMs: 2000});
    expect((await usage.report()).rows?.[0]).toMatchObject({provider: 'openai-compat', model: 'whisper-1', kind: 'transcribe', cost: null});
    const failed = await post(app);
    expect(failed.status).toBe(502);
    expect(await failed.text()).not.toContain('secret');
    expect((await usage.report()).rows).toHaveLength(1);
  });

  it('defaults to local, leaves it ungated, and gives explicit cloud configuration precedence', async () => {
    const local = vi.fn(async () => new MockEngine());
    const service = new AiService(db, dir, local);
    await store.updateInstanceConfig({ownerSubject: 'test#owner', guestAccess: 'write'});
    await store.setPageVisibility(pageId, 'public');
    expect((await post(appWith(service), undefined, true)).status).toBe(200);
    expect(local).toHaveBeenCalledOnce();
    await service.setConfig({provider: 'off', transcription: {provider: 'openai-compat'}});
    expect((await service.transcriptionBackend()).provider).toBe('openai-compat');
    expect(local).toHaveBeenCalledOnce();
  });

  it('returns identical 404s for missing, unreadable, unreferenced, and unrelated assets/pages', async () => {
    await ai.setConfig({provider: 'mock'});
    await store.updateInstanceConfig({ownerSubject: 'test#owner', guestAccess: 'read'});
    await store.setPageVisibility(pageId, 'restricted');
    const app = appWith();
    const unreadable = await post(app, undefined, true);
    expect(unreadable.status).toBe(404);
    expect(await unreadable.json()).toEqual({error: 'asset not found'});
    const other = (await store.upsertPage({name: 'Other', data: snapshot()})).id;
    for (const body of [{assetId: 'missing', pageId}, {assetId: '0'.repeat(64), pageId}, {assetId, pageId: 'missing'}, {assetId, pageId: '00000000-0000-0000-0000-000000000000'}, {assetId, pageId: other}]) {
      expect((await post(app, body)).status).toBe(404);
    }
    await store.unrefAsset(assetId, pageId);
    expect((await post(app)).status).toBe(404);
  });

  it('gives actionable 400s for off/unconfigured/local unavailable and rejects malformed bodies', async () => {
    for (const provider of [undefined, 'off', 'local'] as const) {
      await ai.setConfig({provider: 'off', ...(provider ? {transcription: {provider}} : {})});
      const res = await post();
      expect(res.status).toBe(400);
      expect((await res.json()).error).toContain('Settings → AI');
    }
    for (const body of [null, {}, {assetId: 42, pageId}, {assetId, pageId: ''}]) expect((await post(appWith(), body)).status).toBe(400);
  });

  it('uses multipart verbose JSON, auth, normalized URLs, exact bytes, and audio timing', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({text: 'Hello', duration: 1.25, segments: [{start: 0, end: 1.25, text: 'Hello', id: 0}]})));
    vi.stubGlobal('fetch', fetchMock);
    const engine = new OpenAiCompatEngine('https://audio.test/v1/', 'whisper', 'openai', 'private-key');
    const result = await engine.transcribe(new Uint8Array([0, 255, 3]), {mime: 'audio/webm'});
    expect(result).toEqual({text: 'Hello', durationMs: 1250, segments: [{start: 0, end: 1.25, text: 'Hello'}]});
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://audio.test/v1/audio/transcriptions');
    expect(init.headers).toEqual({Authorization: 'Bearer private-key'});
    const form = init.body as FormData;
    expect(form.get('model')).toBe('whisper');
    expect(form.get('response_format')).toBe('verbose_json');
    expect(form.get('timestamp_granularities[]')).toBe('segment');
    expect(new Uint8Array(await (form.get('file') as Blob).arrayBuffer())).toEqual(new Uint8Array([0, 255, 3]));
  });

  it('accepts text-only JSON and derives duration from valid segments; upstream failures are safe', async () => {
    const engine = new OpenAiCompatEngine('https://audio.test', 'whisper');
    const fetchMock = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({text: 'Hi'})))
      .mockResolvedValueOnce(new Response(JSON.stringify({text: 'Hi', segments: [{start: 0, end: 2, text: 'Hi'}, {start: -1, end: 3, text: 'Bad'}]})))
      .mockResolvedValueOnce(new Response('secret', {status: 401}))
      .mockResolvedValueOnce(new Response(JSON.stringify({text: 42})));
    vi.stubGlobal('fetch', fetchMock);
    expect(await engine.transcribe(new Uint8Array())).toEqual({text: 'Hi', durationMs: 0});
    expect((await engine.transcribe(new Uint8Array())).durationMs).toBe(2000);
    await expect(engine.transcribe(new Uint8Array())).rejects.toThrow('HTTP 401');
    await expect(engine.transcribe(new Uint8Array())).rejects.toThrow('Invalid transcription');
  });

  it('HTTP client posts the contract and LocalDataClient rejects transcription', async () => {
    const result = {text: 'Hello', durationMs: 1000};
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(result), {headers: {'content-type': 'application/json'}}));
    vi.stubGlobal('fetch', fetchMock);
    expect(await new HttpDataClient('http://test').transcribeAsset(assetId, pageId)).toEqual(result);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(`http://test${API.aiTranscribe}`);
    expect(JSON.parse(init.body as string)).toEqual({assetId, pageId});
    await expect(LocalDataClient.prototype.transcribeAsset.call({aiUnavailable: () => new Error('AI unavailable')} as never)).rejects.toThrow('AI unavailable');
  });
});
