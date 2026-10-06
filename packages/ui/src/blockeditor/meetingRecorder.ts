import type {AiTranscriptionResult} from '@book.dev/sdk';
import {assetBridge} from '@/lib/assetBridge';
import {getPageIdForDoc} from '@/lib/aiBridge';
import {t} from '@/i18n';
import {blockProp, setBlockProp, type BlockMap} from './model';
import type {BlockEditorController} from './useBlockEditor';

export interface MeetingAudio {assetId: string; durationMs: number; startedAtMs?: number}
export interface MeetingSegment {startMs: number; endMs: number; text: string}
export interface RecordingChunk {
  id: string;
  blob?: Blob;
  audio: MeetingAudio;
  phase: 'uploading' | 'uploadFailed' | 'transcribing' | 'untranscribed' | 'done';
  error?: string;
  busy?: boolean;
}
export const chunkKey = (audio: MeetingAudio): string => `${audio.startedAtMs ?? 0}:${audio.assetId}`;
export {meetingTime} from './meetingTime';

export function meetingSegments(result: AiTranscriptionResult, audio: MeetingAudio): MeetingSegment[] {
  const offset = audio.startedAtMs ?? 0;
  return result.segments?.length
    ? result.segments.map((s) => ({startMs: offset + s.start * 1000, endMs: offset + s.end * 1000, text: s.text}))
    : result.text ? [{startMs: offset, endMs: offset + result.durationMs, text: result.text}] : [];
}

export function transcriptionError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  const status = (error as {status?: number} | null)?.status;
  if (status === 400 || /\b400\b/.test(message)) return t('meetingBlock.unconfigured');
  if (status === 403 || /\b403\b/.test(message)) return t('meetingBlock.forbidden');
  if (status === 404 || /\b404\b/.test(message)) return t('meetingBlock.missing');
  return t('meetingBlock.transcriptionFailed');
}

/** One writer per live block. Failed blobs stay in this session across view remounts;
 * successful uploads release their bytes. Upload and transcription never gate capture. */
export class MeetingRecorder {
  chunks: RecordingChunk[] = [];
  mode: 'idle' | 'requesting' | 'recording' | 'paused' | 'processing' | 'done' = 'idle';
  error = '';
  readOnly: boolean;
  private capturedMs?: number;
  private currentStarted?: number;
  private stream?: MediaStream;
  private recorder?: MediaRecorder;
  private timer?: ReturnType<typeof setTimeout>;
  private generation = 0;
  private revision = 0;
  private listeners = new Set<() => void>();
  private pending = 0;
  private finalizing = false;
  constructor(private editor: BlockEditorController, private block: BlockMap, private pageId: string) { this.readOnly = editor.readOnly; }
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  snapshot = (): number => this.revision;
  private protect = (event: BeforeUnloadEvent): void => { event.preventDefault(); event.returnValue = ''; };
  private changed(): void {
    // Retain the recovery guard even after navigating away from the block view.
    if (this.active || this.unsaved || this.finalizing) window.addEventListener('beforeunload', this.protect);
    else window.removeEventListener('beforeunload', this.protect);
    this.revision += 1; this.listeners.forEach((listener) => listener());
  }
  private write(props: Record<string, unknown>): void {
    this.editor.doc.transact(() => {
      for (const [key, value] of Object.entries(props)) setBlockProp(this.block, key, value);
    }, 'local');
    this.changed();
  }
  get active(): boolean { return ['requesting', 'recording', 'paused'].includes(this.mode); }
  get unsaved(): boolean { return this.chunks.some((chunk) => !!chunk.blob); }
  private closedDuration(): number {
    const saved = blockProp<MeetingAudio[]>(this.block, 'audioChunks') ?? [];
    return saved.reduce((total, audio) => total + audio.durationMs, 0)
      + this.chunks.reduce((total, chunk) => total + (chunk.blob ? chunk.audio.durationMs : 0), 0);
  }
  get elapsedMs(): number {
    const closed = this.active || this.mode === 'processing' ? this.capturedMs ?? this.closedDuration() : this.closedDuration();
    return closed + (this.mode === 'recording' && this.currentStarted != null ? Math.max(0, Date.now() - this.currentStarted) : 0);
  }
  private get persistedBusy(): boolean {
    return ['recording', 'processing'].includes(blockProp<string>(this.block, 'status') ?? 'idle');
  }
  get recordingElsewhere(): boolean {
    return this.persistedBusy && !this.active && this.mode !== 'processing';
  }
  async start(): Promise<void> {
    if (this.active || this.mode === 'processing' || this.readOnly || this.recordingElsewhere) return;
    this.pageId = getPageIdForDoc(this.editor.doc) ?? this.pageId;
    if (!this.pageId || !assetBridge.ready()) { this.error = t('meetingBlock.noStore'); this.changed(); return; }
    if (!globalThis.MediaRecorder || !navigator.mediaDevices?.getUserMedia) {
      this.error = t('meetingBlock.unsupported'); this.changed(); return;
    }
    this.mode = 'requesting'; this.error = ''; this.changed();
    const generation = ++this.generation;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({audio: true});
      if (generation !== this.generation) { stream.getTracks().forEach((track) => track.stop()); return; }
      // Another client may have begun recording while this permission prompt was open.
      if (this.readOnly || this.persistedBusy) {
        stream.getTracks().forEach((track) => track.stop()); this.mode = 'idle'; this.changed(); return;
      }
      this.capturedMs = this.closedDuration();
      this.stream = stream;
      if (blockProp<number>(this.block, 'startedAt') == null) this.write({startedAt: Date.now()});
      this.mode = 'recording';
      this.beginChunk();
      this.write({status: 'recording'});
    } catch {
      if (generation !== this.generation) return;
      this.release(); this.mode = 'idle'; this.error = t('meetingBlock.permission'); this.changed();
    }
  }
  private beginChunk(): void {
    const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/webm']
      .find((mime) => MediaRecorder.isTypeSupported(mime));
    const recorder = new MediaRecorder(this.stream!, {audioBitsPerSecond: 64000, ...(mimeType ? {mimeType} : {})});
    this.recorder = recorder;
    const started = Date.now();
    this.currentStarted = started;
    const offset = this.capturedMs ?? this.closedDuration();
    const parts: Blob[] = [];
    let duration: number | undefined;
    const closeDuration = (): void => {
      if (duration != null) return;
      duration = Math.max(0, Date.now() - started);
      this.capturedMs = offset + duration;
      this.currentStarted = undefined;
    };
    recorder.ondataavailable = (event) => { if (event.data.size) parts.push(event.data); };
    recorder.onerror = () => { this.error = t('meetingBlock.captureFailed'); this.stop(); };
    recorder.onstop = () => {
      closeDuration();
      this.finishCurrent = undefined;
      this.finalizing = false;
      this.recorder = undefined;
      const blob = new Blob(parts, {type: recorder.mimeType || mimeType || parts[0]?.type || 'audio/webm'});
      if (blob.size) {
        const chunk: RecordingChunk = {id: crypto.randomUUID(), blob, audio: {assetId: '', durationMs: duration!, startedAtMs: offset}, phase: 'uploading'};
        this.chunks.push(chunk);
        void this.upload(chunk);
      }
      if (this.mode === 'recording') {
        try { this.beginChunk(); } catch { this.error = t('meetingBlock.captureFailed'); this.stop(); }
      }
      this.settle(); this.changed();
    };
    // Restart, don't request timeslices: each file must have its own container header.
    recorder.start();
    this.timer = setTimeout(() => this.finishChunk(), 45000);
    this.finishCurrent = () => { closeDuration(); recorder.stop(); };
  }
  private finishCurrent?: () => void;
  private finishChunk(): void {
    clearTimeout(this.timer);
    if (this.recorder && this.recorder.state !== 'inactive' && !this.finalizing) {
      this.finalizing = true; this.finishCurrent?.();
    }
  }
  pause(): void {
    if (this.mode !== 'recording') return;
    this.mode = 'paused'; this.finishChunk();
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = false; });
    this.changed();
  }
  resume(): void {
    if (this.mode !== 'paused' || this.readOnly) return;
    this.stream?.getAudioTracks().forEach((track) => { track.enabled = true; });
    this.mode = 'recording';
    try { if (!this.finalizing) this.beginChunk(); } catch { this.error = t('meetingBlock.captureFailed'); this.stop(); }
    this.changed();
  }
  stop(): void {
    if (!this.active) return;
    this.generation += 1;
    this.mode = 'processing'; this.write({status: 'processing'});
    this.finishChunk(); this.release(); this.settle();
  }
  private release(): void {
    clearTimeout(this.timer);
    this.stream?.getTracks().forEach((track) => track.stop()); this.stream = undefined;
  }
  private settle(): void {
    if (this.mode === 'processing' && !this.pending && !this.finalizing) {
      const empty = !this.chunks.length && !(blockProp<MeetingAudio[]>(this.block, 'audioChunks') ?? []).length;
      this.mode = empty && blockProp<number>(this.block, 'startedAt') == null ? 'idle' : 'done';
      this.write({status: this.mode});
    }
  }
  private async backoff<T>(operation: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await operation(); } catch (error) {
        if (attempt >= 2 || /\b(400|403|404|413)\b/.test(String(error))) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * 2 ** attempt));
      }
    }
  }
  async upload(chunk: RecordingChunk): Promise<void> {
    if (chunk.busy || !chunk.blob) return;
    chunk.busy = true; chunk.phase = 'uploading'; chunk.error = undefined;
    this.pending += 1; this.changed();
    try {
      const blob = chunk.blob;
      if (blob.size > 10 * 1024 * 1024) throw new Error('413');
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const asset = await this.backoff(() => assetBridge.putAsset(bytes, blob.type.split(';')[0], this.pageId));
      chunk.audio = {...chunk.audio, assetId: asset.id};
      const existing = blockProp<MeetingAudio[]>(this.block, 'audioChunks') ?? [];
      this.write({audioChunks: [...existing, chunk.audio].sort((a, b) => (a.startedAtMs ?? 0) - (b.startedAtMs ?? 0))});
      chunk.blob = undefined; chunk.phase = 'untranscribed';
    } catch {
      chunk.phase = 'uploadFailed'; chunk.error = t('meetingBlock.uploadFailed');
    } finally {
      chunk.busy = false; this.pending -= 1;
    }
    if (chunk.audio.assetId && assetBridge.canTranscribe()) void this.transcribe(chunk);
    this.settle(); this.changed();
  }
  async transcribe(chunk: RecordingChunk): Promise<void> {
    if (chunk.busy || !chunk.audio.assetId || !assetBridge.canTranscribe()) return;
    this.pageId = getPageIdForDoc(this.editor.doc) ?? this.pageId;
    if (!this.pageId) { chunk.error = t('meetingBlock.noStore'); this.changed(); return; }
    const key = chunkKey(chunk.audio);
    if ((blockProp<string[]>(this.block, 'transcriptionCompleted') ?? []).includes(key)) { chunk.phase = 'done'; this.changed(); return; }
    chunk.busy = true; chunk.phase = 'transcribing'; chunk.error = undefined;
    this.pending += 1; this.changed();
    try {
      const result = await this.backoff(() => assetBridge.transcribeAsset(chunk.audio.assetId, this.pageId));
      const completed = blockProp<string[]>(this.block, 'transcriptionCompleted') ?? [];
      if (completed.includes(key)) { chunk.phase = 'done'; return; }
      const transcript = blockProp<MeetingSegment[]>(this.block, 'transcript') ?? [];
      // Both replacements are one synchronous transaction, read fresh after awaiting.
      this.write({
        transcript: [...transcript, ...meetingSegments(result, chunk.audio)].sort((a, b) => a.startMs - b.startMs || a.endMs - b.endMs),
        transcriptionCompleted: [...completed, key],
      });
      chunk.phase = 'done';
    } catch (error) {
      chunk.phase = 'untranscribed'; chunk.error = transcriptionError(error);
    } finally {
      chunk.busy = false; this.pending -= 1; this.settle(); this.changed();
    }
  }
  retry(audio: MeetingAudio): void {
    let chunk = this.chunks.find((item) => chunkKey(item.audio) === chunkKey(audio));
    if (!chunk) { chunk = {id: crypto.randomUUID(), audio, phase: 'untranscribed'}; this.chunks.push(chunk); }
    void this.transcribe(chunk);
  }
}

const sessions = new WeakMap<BlockMap, MeetingRecorder>();
export function meetingRecorder(editor: BlockEditorController, block: BlockMap, pageId: string): MeetingRecorder {
  let session = sessions.get(block);
  if (!session) { session = new MeetingRecorder(editor, block, pageId); sessions.set(block, session); }
  return session;
}
