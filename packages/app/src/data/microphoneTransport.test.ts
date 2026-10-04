import {afterEach, expect, it, vi} from 'vitest';
import {HttpDataClient, DEFAULT_MAX_ASSET_BYTES} from '@book.dev/sdk';
import {invoke} from '@tauri-apps/api/core';
import {tauriFetch} from './ipc';

vi.mock('@tauri-apps/api/core', () => ({invoke: vi.fn(), Channel: vi.fn()}));
vi.mock('@tauri-apps/api/event', () => ({listen: vi.fn()}));

afterEach(() => vi.resetAllMocks());

it.each(['audio/webm', 'audio/mp4'])('round-trips two meeting-sized %s chunks through the desktop JSON transport', async (mime) => {
  const stored = new Map<string, {data: string; mime: string}>();
  vi.mocked(invoke).mockImplementation(async (command, args) => {
    expect(command).toBe('api_request');
    const request = args as {method: string; path: string; body: string};
    if (request.method === 'POST') {
      expect(request.path).toContain('/api/assets?pageId=meeting');
      const body = JSON.parse(request.body) as {data: string; mime: string};
      expect(body.mime).toBe(mime);
      expect(body.data.length).toBe(480000);
      expect(new TextEncoder().encode(request.body).length).toBeLessThan(Math.ceil(DEFAULT_MAX_ASSET_BYTES * 4 / 3) + 64 * 1024);
      const id = `chunk-${stored.size}`;
      stored.set(id, body);
      return {status: 201, headers: [], body: JSON.stringify({id})};
    }
    const url = new URL(request.path, 'http://localhost');
    expect(url.searchParams.get('encoding')).toBe('base64');
    return {status: 200, headers: [], body: JSON.stringify(stored.get(url.pathname.split('/').pop()!))};
  });
  const client = new HttpDataClient('', undefined, {fetchImpl: tauriFetch});
  for (let chunk = 0; chunk < 2; chunk++) {
    // 45 seconds at the recorder's 64 kbit/s target. Include every byte value
    // so UTF-8 coercion or binary-body corruption cannot pass this check.
    const bytes = Uint8Array.from({length: 360000}, (_, i) => (i + chunk) % 256);
    const {id} = await client.putAsset(bytes, mime, 'meeting');
    const playback = await client.getAsset(id);
    if (!playback) throw new Error('Uploaded audio was not returned for playback');
    expect(playback.mime).toBe(mime);
    expect(playback.bytes.length).toBe(bytes.length);
    expect(playback.bytes.every((byte, i) => byte === bytes[i])).toBe(true);
  }
  expect(stored.size).toBe(2);
});
