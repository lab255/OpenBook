import {spawn} from 'node:child_process';
import {constants} from 'node:fs';
import {access, mkdtemp, readFile, rm, stat, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import type {AiStatus, AiTranscriptionResult} from '@book.dev/sdk';
import type {TranscriptionEngine, TranscribeOptions} from './providers';
import {isPinnedCurrent} from './pinnedDownload';
import {ManagedRuntime} from './runtime';
import {type RuntimeTool, WHISPER_MODEL_PIN} from './runtimeManifest';

export const LOCAL_TRANSCRIPTION_MAX_JOBS = 2;

export class LocalTranscriptionBusyError extends Error {
  readonly retryAfterSeconds = 5;
  constructor() {
    super('Local transcription is busy. Please retry shortly.');
  }
}

export const WHISPER_MODEL = WHISPER_MODEL_PIN.fileName;
export const WHISPER_MODEL_URL = WHISPER_MODEL_PIN.url;

export async function executable(command: string, platform: string = process.platform, env: NodeJS.ProcessEnv = process.env): Promise<string | null> {
  const locations = path.isAbsolute(command) || command.includes(path.sep)
    ? [command] : (env.PATH ?? '').split(platform === 'win32' ? ';' : path.delimiter).map((dir) => path.join(dir, command));
  const extensions = platform === 'win32' && !path.extname(command)
    ? (env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';') : [];
  const candidates = locations.flatMap((candidate) => [candidate,
    ...extensions.flatMap((ext) => [candidate + ext.toLowerCase(), candidate + ext.toUpperCase()]),
  ]);
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      if ((await stat(candidate)).isFile()) return candidate;
    } catch { /* Optional system dependency. */ }
  }
  return null;
}

/** One child per operation: no listening port or native Node ABI dependency.
 * SIGKILL makes cancellation deterministic even inside a native inference call.
 * Wait for close before removing its private scratch directory. */
export async function runWhisperProcess(command: string, args: string[], signal: AbortSignal): Promise<void> {
  signal.throwIfAborted();
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {stdio: 'ignore', shell: false});
    const abort = () => { child.kill('SIGKILL'); };
    signal.addEventListener('abort', abort, {once: true});
    if (signal.aborted) abort();
    child.once('error', (error) => {
      signal.removeEventListener('abort', abort);
      reject(error);
    });
    child.once('close', (code) => {
      signal.removeEventListener('abort', abort);
      if (signal.aborted) reject(signal.reason);
      else if (code !== 0) reject(new Error('Local audio processing failed. Check the recording and Settings → AI.'));
      else resolve();
    });
  });
}

export function parseWhisperOutput(value: unknown): AiTranscriptionResult {
  const data = value as {transcription?: {offsets?: {from?: number; to?: number}; text?: string}[]};
  if (!data || !Array.isArray(data.transcription)) throw new Error('Invalid whisper output');
  let durationMs = 0;
  const segments = data.transcription.map((segment) => {
    const start = segment?.offsets?.from;
    const end = segment?.offsets?.to;
    if (typeof start !== 'number' || !Number.isFinite(start) || start < 0
      || typeof end !== 'number' || !Number.isFinite(end) || end < start || typeof segment.text !== 'string') {
      throw new Error('Invalid whisper segment');
    }
    durationMs = Math.max(durationMs, end);
    return {start: start / 1000, end: end / 1000, text: segment.text.trim()};
  });
  return {text: segments.map((s) => s.text).join(' ').trim(), segments, durationMs: Math.round(durationMs)};
}

/** Optional whisper.cpp + FFmpeg runtime. Models live beside chat models, but
 * inference runs only on demand, releasing model memory after each recording. */
export class LocalWhisper implements TranscriptionEngine {
  private readonly active = new Set<AbortController>();
  private readonly pending = new Set<Promise<AiTranscriptionResult>>();
  private disposed = false;
  private readonly provisionAbort = new AbortController();
  private pendingProvision?: Promise<void>;

  constructor(
    private readonly modelsDir: string,
    private readonly whisperCommand = process.env.OPENBOOK_WHISPER_BIN,
    private readonly ffmpegCommand = process.env.OPENBOOK_FFMPEG_BIN,
    private readonly runtime = new ManagedRuntime(path.join(path.dirname(modelsDir), 'bin')),
  ) {}

  provision(signal?: AbortSignal): Promise<void> {
    const combined = signal ? AbortSignal.any([signal, this.provisionAbort.signal]) : this.provisionAbort.signal;
    const skip = new Set<RuntimeTool>();
    if (this.whisperCommand) skip.add('whisper-cli');
    if (this.ffmpegCommand) skip.add('ffmpeg');
    this.pendingProvision = this.runtime.provision(combined, skip);
    return this.pendingProvision;
  }

  private async commands(): Promise<[string | null, string | null]> {
    return Promise.all(([['whisper-cli', this.whisperCommand], ['ffmpeg', this.ffmpegCommand]] as const).map(async ([tool, override]) =>
      override ? executable(override) : await this.runtime.binary(tool).then((file) => file ? executable(file) : null) ?? executable(tool),
    )) as Promise<[string | null, string | null]>;
  }

  async status(): Promise<NonNullable<AiStatus['transcription']>> {
    const [[whisper, ffmpeg], modelPresent, runtime] = await Promise.all([
      this.commands(),
      isPinnedCurrent(WHISPER_MODEL_PIN, path.join(this.modelsDir, WHISPER_MODEL)),
      this.runtime.status(),
    ]);
    const runtimeAvailable = Boolean(whisper && ffmpeg);
    return {
      model: WHISPER_MODEL, modelPresent, runtimeAvailable, ready: modelPresent && runtimeAvailable && !this.disposed,
      downloadUrl: WHISPER_MODEL_URL, runtime,
      detail: !runtimeAvailable ? 'Install whisper.cpp (whisper-cli) and FFmpeg on the server, then return to Settings → AI.'
        : !modelPresent ? 'Download Whisper base in Settings → AI to enable local transcription.' : undefined,
    };
  }

  async resolve(): Promise<TranscriptionEngine | null> {
    return (await this.status()).ready ? this : null;
  }

  transcribe(bytes: Uint8Array, opts: TranscribeOptions = {}): Promise<AiTranscriptionResult> {
    if (opts.signal?.aborted) return Promise.reject(opts.signal.reason);
    // This set is a non-queuing semaphore shared by all requests to this server.
    // Reserve synchronously, before any await or temporary-file/process creation;
    // keep the permit until perform's finally has removed the scratch directory.
    if (this.active.size >= LOCAL_TRANSCRIPTION_MAX_JOBS) return Promise.reject(new LocalTranscriptionBusyError());
    const controller = new AbortController();
    const signal = opts.signal ? AbortSignal.any([opts.signal, controller.signal]) : controller.signal;
    this.active.add(controller);
    const operation = this.perform(bytes, signal).finally(() => {
      this.active.delete(controller);
      this.pending.delete(operation);
    });
    this.pending.add(operation);
    return operation;
  }

  private async perform(bytes: Uint8Array, signal: AbortSignal): Promise<AiTranscriptionResult> {
    signal.throwIfAborted();
    if (this.disposed) throw new Error('Local transcription has stopped.');
    const [whisper, ffmpeg] = await this.commands();
    if (!whisper || !ffmpeg) throw new Error('Local transcription runtime is unavailable.');
    const dir = await mkdtemp(path.join(tmpdir(), 'openbook-whisper-'));
    try {
      const input = path.join(dir, 'input');
      const wav = path.join(dir, 'audio.wav');
      const output = path.join(dir, 'result');
      await writeFile(input, bytes, {signal});
      // Probe by content, never by an untrusted filename; accept browser WebM,
      // MP4, Ogg and WAV alike. Restrict nested input protocols to local files.
      await runWhisperProcess(ffmpeg, ['-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', input, '-vn', '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav], signal);
      await runWhisperProcess(whisper, ['-m', path.join(this.modelsDir, WHISPER_MODEL), '-f', wav, '-l', 'auto', '-oj', '-of', output], signal);
      signal.throwIfAborted();
      return parseWhisperOutput(JSON.parse(await readFile(`${output}.json`, 'utf8')));
    } finally {
      await rm(dir, {recursive: true, force: true});
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    this.provisionAbort.abort();
    for (const controller of this.active) controller.abort();
    await Promise.allSettled([...this.pending, this.pendingProvision]);
  }
}
