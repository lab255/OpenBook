/** Own runtime pins activated from published runtime-binaries-v1 (2026-10-10).
 * Unsupported is per tool: consumers must require BOTH tools for a ready runtime.
 * Release build metadata in version advances WSP-2 receipt identity; model pins stay independent.
 * Extraction/provisioning belongs to WSP-2. */
export const RELEASE_TARGETS = [
  'aarch64-apple-darwin',
  'x86_64-apple-darwin',
  'x86_64-unknown-linux-gnu',
  'x86_64-pc-windows-msvc',
] as const;
export type ReleaseTarget = typeof RELEASE_TARGETS[number];
export type RuntimeTool = 'whisper-cli' | 'ffmpeg';

export interface ArtifactPin {
  version: string;
  url: string;
  sha256: string;
  size: number;
}
export type RuntimeArtifact = (ArtifactPin & {
  status: 'supported';
  archive: 'zip' | 'tar.xz';
  binaryPath: string;
  extractDir?: string;
}) | {
  status: 'unsupported';
  reason: 'no-upstream-cli' | 'no-native-prebuilt';
  detail: string;
};

export const RUNTIME_MANIFEST: Record<ReleaseTarget, Record<RuntimeTool, RuntimeArtifact>> = {
  'aarch64-apple-darwin': {
    'whisper-cli': {
      status: 'supported', version: '1.8.2+runtime-binaries-v1',
      url: 'https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/whisper-cli-1.8.2-aarch64-apple-darwin.zip',
      sha256: '9f62b22d4ffdc7340b42eef80a35293635cf06e499dba445677aa44bf49a8148',
      size: 1047307, archive: 'zip', binaryPath: 'whisper-cli',
    },
    ffmpeg: {
      status: 'supported', version: '7.1.1+runtime-binaries-v1',
      url: 'https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/ffmpeg-7.1.1-aarch64-apple-darwin.zip',
      sha256: '541e623ed21d80e6ae6976faee8511924fe0e98445c7d7888f07d5bafe0bda65',
      size: 1040200, archive: 'zip', binaryPath: 'ffmpeg',
    },
  },
  'x86_64-apple-darwin': {
    'whisper-cli': {
      status: 'supported', version: '1.8.2+runtime-binaries-v1',
      url: 'https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/whisper-cli-1.8.2-x86_64-apple-darwin.zip',
      sha256: 'f9518153a34a2619ae9446e0266cfad4af585e906b11feb3120329db3e3e91f3',
      size: 1204029, archive: 'zip', binaryPath: 'whisper-cli',
    },
    ffmpeg: {
      status: 'supported', version: '7.1.1',
      url: 'https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip',
      sha256: '8d7917c1cebd7a29e68c0a0a6cc4ecc3fe05c7fffed958636c7018b319afdda4',
      size: 25458015, archive: 'zip', binaryPath: 'ffmpeg',
    },
  },
  'x86_64-unknown-linux-gnu': {
    'whisper-cli': {
      status: 'supported', version: '1.8.2+runtime-binaries-v1',
      url: 'https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/whisper-cli-1.8.2-x86_64-unknown-linux-gnu.zip',
      sha256: 'd51266bfd47aebbcfe61de981534ec86a6915427f2160e886b9a0df294678e3a',
      size: 1545240, archive: 'zip', binaryPath: 'whisper-cli',
    },
    ffmpeg: {
      status: 'supported', version: '7.0.2',
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-7.0.2-amd64-static.tar.xz',
      sha256: 'abda8d77ce8309141f83ab8edf0596834087c52467f6badf376a6a2a4c87cf67',
      size: 41888096, archive: 'tar.xz', binaryPath: 'ffmpeg-7.0.2-amd64-static/ffmpeg',
    },
  },
  'x86_64-pc-windows-msvc': {
    'whisper-cli': {
      status: 'supported', version: '1.8.2+runtime-binaries-v1',
      url: 'https://github.com/lab255/OpenBook/releases/download/runtime-binaries-v1/whisper-cli-1.8.2-x86_64-pc-windows-msvc.zip',
      sha256: '34cd1bbc8113299b72783a5c7b082e3226dcb40b66ba945de8f4cd10d0d4a3db',
      size: 940580, archive: 'zip', binaryPath: 'whisper-cli.exe',
    },
    ffmpeg: {
      status: 'supported', version: '8.1.2',
      url: 'https://www.gyan.dev/ffmpeg/builds/packages/ffmpeg-8.1.2-essentials_build.zip',
      sha256: 'db580001caa24ac104c8cb856cd113a87b0a443f7bdf47d8c12b1d740584a2ec',
      size: 109728040, archive: 'zip', binaryPath: 'ffmpeg-8.1.2-essentials_build/bin/ffmpeg.exe',
    },
  },
};

export const WHISPER_MODEL_PIN: ArtifactPin & {fileName: string} = {
  fileName: 'ggml-base.bin',
  version: '5359861c739e955e79d9a303bcbc70fb988958b1',
  url: 'https://huggingface.co/ggerganov/whisper.cpp/resolve/5359861c739e955e79d9a303bcbc70fb988958b1/ggml-base.bin',
  sha256: '60ed5bc3dd14eea856493d334349b405782ddcaf0028d4b5df4088345fba2efe',
  size: 147951465,
};
