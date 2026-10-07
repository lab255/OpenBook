import {describe, expect, it} from 'vitest';
import {RELEASE_TARGETS, RUNTIME_MANIFEST, WHISPER_MODEL_PIN, type ArtifactPin} from './runtimeManifest';

function checkPin(pin: ArtifactPin) {
  expect(new URL(pin.url).protocol).toBe('https:');
  expect(pin.url).not.toMatch(/latest|\/main\//i);
  expect(pin.version.length).toBeGreaterThan(0);
  expect(pin.url).toContain(pin.version);
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

  it('includes the Windows whisper companion DLL directory', () => {
    const artifact = RUNTIME_MANIFEST['x86_64-pc-windows-msvc']['whisper-cli'];
    expect(artifact.status).toBe('supported');
    if (artifact.status !== 'supported') throw new Error('Windows whisper must be supported');
    expect(artifact.extractDir).toBe('Release');
    expect(artifact.binaryPath.startsWith(`${artifact.extractDir}/`)).toBe(true);
  });

  it('pins the base model to an immutable repository revision', () => {
    checkPin(WHISPER_MODEL_PIN);
    expect(WHISPER_MODEL_PIN.fileName).toBe('ggml-base.bin');
    expect(WHISPER_MODEL_PIN.version).toMatch(/^[a-f0-9]{40}$/);
  });
});
