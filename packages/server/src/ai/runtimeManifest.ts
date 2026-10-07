/** Pins verified by downloading and hashing the actual artifacts (WSP-1).
 * Unsupported is per tool: consumers must require BOTH tools for a ready runtime.
 * Windows whisper needs the DLLs alongside the executable from the same archive.
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
}) | {
  status: 'unsupported';
  reason: 'no-upstream-cli' | 'no-native-prebuilt';
  detail: string;
};

const noWhisperCli: RuntimeArtifact = {
  status: 'unsupported',
  reason: 'no-upstream-cli',
  detail: 'whisper.cpp v1.8.2 publishes Windows CLI archives and an Apple XCFramework, but no macOS/Linux whisper-cli prebuilt. Owner must select a trusted builder or publish builds.',
};

export const RUNTIME_MANIFEST: Record<ReleaseTarget, Record<RuntimeTool, RuntimeArtifact>> = {
  'aarch64-apple-darwin': {
    'whisper-cli': noWhisperCli,
    ffmpeg: {
      status: 'unsupported',
      reason: 'no-native-prebuilt',
      detail: 'The selected macOS provider (evermeet.cx) explicitly supplies Intel binaries only. A trusted native ARM provider is an owner decision; do not silently require Rosetta.',
    },
  },
  'x86_64-apple-darwin': {
    'whisper-cli': noWhisperCli,
    ffmpeg: {
      status: 'supported', version: '7.1.1',
      url: 'https://evermeet.cx/ffmpeg/ffmpeg-7.1.1.zip',
      sha256: '8d7917c1cebd7a29e68c0a0a6cc4ecc3fe05c7fffed958636c7018b319afdda4',
      size: 25458015, archive: 'zip', binaryPath: 'ffmpeg',
    },
  },
  'x86_64-unknown-linux-gnu': {
    'whisper-cli': noWhisperCli,
    ffmpeg: {
      status: 'supported', version: '7.0.2',
      url: 'https://johnvansickle.com/ffmpeg/releases/ffmpeg-7.0.2-amd64-static.tar.xz',
      sha256: 'abda8d77ce8309141f83ab8edf0596834087c52467f6badf376a6a2a4c87cf67',
      size: 41888096, archive: 'tar.xz', binaryPath: 'ffmpeg-7.0.2-amd64-static/ffmpeg',
    },
  },
  'x86_64-pc-windows-msvc': {
    'whisper-cli': {
      status: 'supported', version: '1.8.2',
      url: 'https://github.com/ggml-org/whisper.cpp/releases/download/v1.8.2/whisper-bin-x64.zip',
      sha256: 'b1514ebc099765e39fa37eb780b92a140a94c86bb0b3b3d98226b38825979732',
      size: 3832432, archive: 'zip', binaryPath: 'Release/whisper-cli.exe',
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
