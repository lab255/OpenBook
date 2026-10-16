import assets from '../fixtures/runtime-binaries-v1-assets.json';
import {pinIdentity} from './pinnedDownload';
import {describe, expect, it} from 'vitest';
import {RELEASE_TARGETS, RUNTIME_MANIFEST, WHISPER_MODEL_PIN, type ArtifactPin} from './runtimeManifest';

function checkPin(pin: ArtifactPin) {
  expect(new URL(pin.url).protocol).toBe('https:');
  expect(pin.url).not.toMatch(/latest|\/main\//i);
  expect(pin.version.length).toBeGreaterThan(0);
  expect(pin.url).toContain(pin.version.split('+')[0]);
  expect(pin.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(Number.isSafeInteger(pin.size) && pin.size > 0).toBe(true);
}

describe('pinned runtime manifest', () => {
  it('represents all four release targets and both tools with pins or typed reasons', () => {
    expect(Object.keys(RUNTIME_MANIFEST).sort()).toEqual([...RELEASE_TARGETS].sort());
    expect(RELEASE_TARGETS).toHaveLength(4);
    for (const target of RELEASE_TARGETS) {
      expect(Object.keys(RUNTIME_MANIFEST[target]).sort()).toEqual(['ffmpeg', 'whisper-cli']);
      for (const artifact of Object.values(RUNTIME_MANIFEST[target])) {
        if (artifact.status === 'unsupported') {
          expect(['no-upstream-cli', 'no-native-prebuilt']).toContain(artifact.reason);
          expect(artifact.detail.length).toBeGreaterThan(0);
        } else {
          expect(artifact.status).toBe('supported');
          checkPin(artifact);
          expect(['zip', 'tar.xz']).toContain(artifact.archive);
          expect(artifact.binaryPath).not.toMatch(/^\/|\\|(^|\/)\.\.(\/|$)/);
          expect(artifact.binaryPath).toMatch(/(?:ffmpeg|whisper-cli)(?:\.exe)?$/);
        }
      }
    }
  });

  it('uses the static Windows whisper executable without a companion DLL directory', () => {
    const artifact = RUNTIME_MANIFEST['x86_64-pc-windows-msvc']['whisper-cli'];
    expect(artifact.status).toBe('supported');
    if (artifact.status !== 'supported') throw new Error('Windows whisper must be supported');
    expect(artifact.extractDir).toBeUndefined();
    expect(artifact.binaryPath).toBe('whisper-cli.exe');
  });

  it('matches every shipped runtime pin to the published inventory', () => {
    const matched: string[] = [];
    for (const target of RELEASE_TARGETS) {
      for (const tool of ['whisper-cli', 'ffmpeg'] as const) {
        // These three existing FFmpeg providers are intentionally not in v1.
        if (tool === 'ffmpeg' && target !== 'aarch64-apple-darwin') continue;
        const pin = RUNTIME_MANIFEST[target][tool];
        expect(pin.status).toBe('supported');
        if (pin.status !== 'supported') throw new Error(`${target}/${tool} must be supported`);
        const version = tool === 'whisper-cli' ? '1.8.2' : '7.1.1';
        const name = `${tool}-${version}-${target}.zip`;
        const asset = assets.find((entry) => entry.name === name);
        expect(asset).toBeDefined();
        expect(pin).toMatchObject({
          version: `${version}+runtime-binaries-v1`,
          url: `https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/${name}`,
          sha256: asset!.sha256, size: asset!.size, archive: 'zip',
          binaryPath: `${tool}${target.includes('windows') ? '.exe' : ''}`,
        });
        expect(pin.extractDir).toBeUndefined();
        expect(pinIdentity(pin)).not.toBe(pinIdentity({...pin, version}));
        matched.push(name);
      }
    }
    expect(matched.sort()).toEqual(assets.filter((asset) => asset.name !== 'runtime-binaries-sources.zip').map((asset) => asset.name).sort());
  });

  it('pins the base model to an immutable repository revision', () => {
    checkPin(WHISPER_MODEL_PIN);
    expect(WHISPER_MODEL_PIN.fileName).toBe('ggml-base.bin');
    expect(WHISPER_MODEL_PIN.version).toMatch(/^[a-f0-9]{40}$/);
  });
});
