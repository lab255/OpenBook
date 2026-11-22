import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {expect, it, vi} from 'vitest';
import type {Db} from '../db';
import {AiService} from './service';
import {LocalWhisper} from './whisper';

// Real pinned downloads into a fresh data directory. No preinstalled model needed.
it.skipIf(process.env.OPENBOOK_TEST_RUNTIME !== '1')('native provisioning: enable reaches ready or typed partial support', async () => {
  const dir = await mkdtemp(path.join(tmpdir(), 'runtime-native-'));
  const models = path.join(dir, 'models');
  const local = new LocalWhisper(models);
  const service = new AiService({query: vi.fn(async () => [])} as unknown as Db, models, () => local.resolve(), local);
  try {
    await service.setConfig({provider: 'off', transcription: {provider: 'local'}});
    await expect.poll(async () => (await service.status()).download, {timeout: 240_000, interval: 500}).toMatchObject({done: true});
    const status = await local.status();
    expect(status.modelPresent).toBe(true);
    const tools = Object.values(status.runtime!.tools);
    if (tools.some((tool) => tool.status === 'unsupported')) {
      expect(tools.every((tool) => tool.status === 'unsupported' || tool.status === 'provisioned')).toBe(true);
      for (const tool of tools.filter((tool) => tool.status === 'unsupported')) expect(tool.reason).toBeTruthy();
      if (process.platform === 'darwin' && process.arch === 'arm64') {
        expect(status.runtime?.tools['whisper-cli']).toMatchObject({status: 'unsupported', reason: 'no-upstream-cli'});
        expect(status.runtime?.tools.ffmpeg).toMatchObject({status: 'unsupported', reason: 'no-native-prebuilt'});
      }
    } else expect(status.ready).toBe(true);
  } finally { await service.dispose(); await rm(dir, {recursive: true, force: true}); }
}, 300_000);
