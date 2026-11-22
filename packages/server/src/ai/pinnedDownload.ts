import {open, readFile, rename, stat, unlink, writeFile} from 'node:fs/promises';
import {downloadVerified, type DownloadProgress} from './download';
import type {ArtifactPin} from './runtimeManifest';

/** A receipt is written only after verification. Legacy files without a receipt
 * are re-downloaded. Compare the entire pin so hash/URL changes also invalidate.
 * Callers serialize writes to dest; extraction and runtime installs are separate. */
export async function downloadPinned(
  pin: ArtifactPin,
  dest: string,
  onProgress?: (progress: DownloadProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  signal?.throwIfAborted();
  const receipt = `${dest}.verified.json`;
  const identity = pinIdentity(pin);
  if (await isPinnedCurrent(pin, dest)) {
    onProgress?.({received: pin.size, total: pin.size});
    return;
  }
  // Invalidate first: an interrupted replacement must never inherit an old receipt.
  await unlink(receipt).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  try {
    await downloadVerified(pin.url, dest, pin, onProgress, signal);
    await writeFile(`${receipt}.part`, identity);
    const handle = await open(`${receipt}.part`, 'r+');
    try { await handle.sync(); } finally { await handle.close(); }
    signal?.throwIfAborted();
    await rename(`${receipt}.part`, receipt);
  } catch (error) {
    await unlink(`${receipt}.part`).catch(() => undefined);
    throw error;
  }
}

export function pinIdentity(pin: ArtifactPin): string {
  return JSON.stringify({version: pin.version, url: pin.url, sha256: pin.sha256, size: pin.size});
}

export async function isPinnedCurrent(pin: ArtifactPin, dest: string): Promise<boolean> {
  const [receipt, file] = await Promise.all([
    readFile(`${dest}.verified.json`, 'utf8').catch(() => null),
    stat(dest).catch(() => null),
  ]);
  return receipt === pinIdentity(pin) && Boolean(file?.isFile() && file.size === pin.size);
}
