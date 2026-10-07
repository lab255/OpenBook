import {createHash} from 'node:crypto';
import {createWriteStream} from 'node:fs';
import {open, rename, unlink} from 'node:fs/promises';
import {Readable} from 'node:stream';
import {pipeline} from 'node:stream/promises';

export interface DownloadProgress {
  received: number;
  total: number | null;
}

export interface DownloadIntegrity {
  sha256: string;
  size: number;
}

/** Shared streamer for arbitrary llama URLs and pinned, verified artifacts.
 * The caller owns serialization of downloads to the same destination. */
export async function downloadFile(
  url: string,
  dest: string,
  onProgress?: (progress: DownloadProgress) => void,
  integrity?: DownloadIntegrity,
): Promise<void> {
  const partial = `${dest}.part`;
  try {
    const res = await fetch(url, {redirect: 'follow'});
    if (!res.ok || !res.body) {
      await res.body?.cancel();
      throw new Error(`HTTP ${res.status}`);
    }
    const total = integrity?.size ?? (Number(res.headers.get('content-length')) || null);
    const hash = integrity ? createHash('sha256') : null;
    let received = 0;
    onProgress?.({received, total});
    const reader = res.body.getReader();
    async function* chunks() {
      try {
        for (;;) {
          const {done, value} = await reader.read();
          if (done) break;
          received += value.byteLength;
          if (integrity && received > integrity.size) throw new Error(`Download size mismatch: expected ${integrity.size} bytes, received at least ${received}`);
          hash?.update(value);
          onProgress?.({received, total});
          yield value;
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    }
    // pipeline propagates disk/read errors and closes the file before cleanup or rename.
    await pipeline(Readable.from(chunks()), createWriteStream(partial));
    if (integrity) {
      if (received !== integrity.size) throw new Error(`Download size mismatch: expected ${integrity.size} bytes, received ${received}`);
      if (hash!.digest('hex') !== integrity.sha256) throw new Error('Download SHA-256 mismatch');
    }
    const fh = await open(partial, 'r+');
    await fh.sync();
    await fh.close();
    await rename(partial, dest);
  } catch (error) {
    await unlink(partial).catch(() => undefined);
    throw error;
  }
}

/** Stream → verify size and SHA-256 → atomically replace the destination. */
export async function downloadVerified(
  url: string,
  dest: string,
  integrity: DownloadIntegrity,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  await downloadFile(url, dest, onProgress, integrity);
}
