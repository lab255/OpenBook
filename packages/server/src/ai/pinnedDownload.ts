import {readFile, rename, stat, unlink, writeFile} from 'node:fs/promises';
import {downloadVerified, type DownloadProgress} from './download';
import type {ArtifactPin} from './runtimeManifest';

/** A receipt is written only after verification. Legacy files without a receipt
 * are re-downloaded. Compare the entire pin so hash/URL changes also invalidate.
 * Callers serialize writes to dest; extraction and runtime installs are separate. */
export async function downloadPinned(
  pin: ArtifactPin,
  dest: string,
  onProgress?: (progress: DownloadProgress) => void,
): Promise<void> {
  const receipt = `${dest}.verified.json`;
  const identity = JSON.stringify({version: pin.version, url: pin.url, sha256: pin.sha256, size: pin.size});
  const current = await readFile(receipt, 'utf8').catch(() => null);
  const file = await stat(dest).catch(() => null);
  if (current === identity && file?.isFile() && file.size === pin.size) {
    onProgress?.({received: pin.size, total: pin.size});
    return;
  }
  // Invalidate first: an interrupted replacement must never inherit an old receipt.
  await unlink(receipt).catch((error: NodeJS.ErrnoException) => {
    if (error.code !== 'ENOENT') throw error;
  });
  try {
    await downloadVerified(pin.url, dest, pin, onProgress);
    await writeFile(`${receipt}.part`, identity);
    await rename(`${receipt}.part`, receipt);
  } catch (error) {
    await unlink(`${receipt}.part`).catch(() => undefined);
    throw error;
  }
}
