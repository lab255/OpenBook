import {mkdtemp, rm} from 'node:fs/promises';
import {homedir, tmpdir} from 'node:os';
import {join} from 'node:path';
import {expect, it, vi} from 'vitest';
import {API, LOCAL_OWNER_HEADER} from '@book.dev/sdk';
import {createApp} from './app';
import {PgliteDb} from './db';
import {PageHub} from './hub';
import {PageStore} from './store';
import {ManagedRuntime} from './ai/runtime';
import {AiService} from './ai/service';
import {LocalWhisper} from './ai/whisper';

// Keep native inference outside transcription.test.ts: that suite mocks the
// model pin to eleven bytes. Here both cases use real pins and real receipts.
for (const mode of ['ordinary resolver', 'provisioned runtime'] as const) {
  it.skipIf(process.env.OPENBOOK_TEST_WHISPER !== '1')(
    `native whisper: POST transcribes synthesized WAV via ${mode}`, async (context) => {
      const dataDir = process.env.OPENBOOK_TEST_DATA_DIR || join(homedir(), '.openbook');
      const models = process.env.OPENBOOK_MODELS_DIR || join(dataDir, 'models');
      const runtime = new ManagedRuntime(join(dataDir, 'bin'));
      let local: LocalWhisper | undefined;
      let store: PageStore | undefined;
      let service: AiService | undefined;
      let dir: string | undefined;
      try {
        if (mode === 'provisioned runtime') {
          vi.stubEnv('PATH', '');
          vi.stubEnv('OPENBOOK_WHISPER_BIN', '');
          vi.stubEnv('OPENBOOK_FFMPEG_BIN', '');
        }
        local = new LocalWhisper(models, undefined, undefined, runtime);
        const status = await local.status();
        if (!status.ready) context.skip(`${mode}: current verified model and usable runtime unavailable in ${dataDir}`);
        if (mode === 'provisioned runtime') {
          for (const tool of ['whisper-cli', 'ffmpeg'] as const) {
            expect(status.runtime?.tools[tool]).toMatchObject({status: 'provisioned', available: true});
            expect(status.runtime?.tools[tool].override).toBeUndefined();
            expect(await runtime.binary(tool)).toContain(join(dataDir, 'bin', tool, 'install-'));
          }
        }
        // The supplied installation is read-only; database/audio fixtures are temporary.
        dir = await mkdtemp(join(tmpdir(), 'transcription-native-'));
        const db = await PgliteDb.create(dir);
        store = new PageStore(db);
        await store.migrate();
        const page = await store.upsertPage({name: 'Native recording', data: {editorjs: {blocks: []}, values: [], names: []}});
        const wav = Buffer.alloc(44 + 16000 * 2);
        wav.write('RIFF'); wav.writeUInt32LE(wav.length - 8, 4); wav.write('WAVEfmt ', 8);
        wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22);
        wav.writeUInt32LE(16000, 24); wav.writeUInt32LE(32000, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34);
        wav.write('data', 36); wav.writeUInt32LE(wav.length - 44, 40);
        const asset = await store.putAsset(wav, 'audio/wav');
        await store.refAsset(asset.id, page.id);
        const whisper = local;
        service = new AiService(db, models, () => whisper.resolve(), whisper);
        const secret = 'native-transcription-owner';
        const app = createApp(store, service, new PageHub(), {localOwnerSecret: secret});
        const response = await app.request(API.aiTranscribe, {
          method: 'POST', headers: {'content-type': 'application/json', 'X-OpenBook-Client': '1', [LOCAL_OWNER_HEADER]: secret},
          body: JSON.stringify({assetId: asset.id, pageId: page.id}),
        });
        expect(response.status).toBe(200);
        expect(await response.json()).toMatchObject({text: expect.any(String), segments: expect.any(Array), durationMs: expect.any(Number)});
      } finally {
        await service?.dispose();
        await local?.dispose();
        await store?.close();
        vi.unstubAllEnvs();
        if (dir) await rm(dir, {recursive: true, force: true});
      }
    }, 120_000,
  );
}
