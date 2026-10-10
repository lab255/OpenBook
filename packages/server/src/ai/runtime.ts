import {execFile} from 'node:child_process';
import {chmod, copyFile, cp, lstat, mkdir, mkdtemp, open, readFile, readdir, rename, rm, stat, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {promisify} from 'node:util';
import {downloadPinned, pinIdentity} from './pinnedDownload';
import {RUNTIME_MANIFEST, type ReleaseTarget, type RuntimeArtifact, type RuntimeTool} from './runtimeManifest';

const exec = promisify(execFile);
const tools: RuntimeTool[] = ['whisper-cli', 'ffmpeg'];
export function runtimeTarget(platform: string = process.platform, architecture: string = process.arch): string {
  const arch = architecture === 'arm64' ? 'aarch64' : architecture === 'x64' ? 'x86_64' : architecture;
  return `${arch}-${platform === 'darwin' ? 'apple-darwin' : platform === 'linux' ? 'unknown-linux-gnu' : platform === 'win32' ? 'pc-windows-msvc' : platform}`;
}
export interface ManagedToolStatus {
  status: 'provisioned' | 'unsupported' | 'missing' | 'provisioning' | 'failed';
  override?: 'OPENBOOK_WHISPER_BIN' | 'OPENBOOK_FFMPEG_BIN' | 'PATH';
  available?: boolean;
  version?: string;
  installedVersion?: string;
  reason?: string;
  detail?: string;
}
interface Receipt {identity: string; version: string; directory: string; binary: string; files: Record<string, number>}

/** Only verified pins are extracted. Publish a receipt last, pointing at a complete
 * immutable generation; interruption never replaces the previous installation. */
export class ManagedRuntime {
  readonly target: string;
  readonly pins: Record<RuntimeTool, RuntimeArtifact>;
  private pending?: Promise<void>;
  private readonly stages: Partial<Record<RuntimeTool, {status: 'provisioning' | 'failed'; detail?: string}>> = {};
  constructor(private readonly binDir: string, target = runtimeTarget(), pins?: Record<RuntimeTool, RuntimeArtifact>) {
    this.target = target;
    this.pins = pins ?? RUNTIME_MANIFEST[target as ReleaseTarget] ?? {
      'whisper-cli': {status: 'unsupported', reason: 'no-native-prebuilt', detail: `Unsupported target: ${target}`},
      ffmpeg: {status: 'unsupported', reason: 'no-native-prebuilt', detail: `Unsupported target: ${target}`},
    };
  }
  private async receipt(tool: RuntimeTool): Promise<Receipt | null> {
    try {
      const receipt: Receipt = JSON.parse(await readFile(path.join(this.binDir, tool, 'current.json'), 'utf8'));
      if (!receipt.directory.startsWith('install-') || path.basename(receipt.directory) !== receipt.directory
        || !receipt.files || !Object.hasOwn(receipt.files, receipt.binary)) return null;
      for (const [file, size] of Object.entries(receipt.files)) {
        if (path.isAbsolute(file) || file.split(/[\\/]/).includes('..')) return null;
        const info = await lstat(path.join(this.binDir, tool, receipt.directory, file));
        if (!info.isFile() || info.size !== size) return null;
      }
      return receipt;
    } catch { return null; }
  }
  async binary(tool: RuntimeTool): Promise<string | null> {
    const pin = this.pins[tool];
    const receipt = await this.receipt(tool);
    return pin.status === 'supported' && receipt?.identity === pinIdentity(pin)
      ? path.join(this.binDir, tool, receipt.directory, receipt.binary) : null;
  }
  async status(): Promise<{target: string; tools: Record<RuntimeTool, ManagedToolStatus>}> {
    const entries = await Promise.all(tools.map(async (tool) => {
      const pin = this.pins[tool];
      if (pin.status === 'unsupported') return [tool, {status: 'unsupported', reason: pin.reason, detail: pin.detail}] as const;
      const receipt = await this.receipt(tool);
      return [tool, {status: receipt?.identity === pinIdentity(pin) ? 'provisioned' : 'missing', version: pin.version, installedVersion: receipt?.version, ...this.stages[tool]}] as const;
    }));
    return {target: this.target, tools: Object.fromEntries(entries) as Record<RuntimeTool, ManagedToolStatus>};
  }
  provision(signal?: AbortSignal, skip: Set<RuntimeTool> = new Set()): Promise<void> {
    if (!this.pending) this.pending = this.install(signal, skip).finally(() => { this.pending = undefined; });
    return this.pending;
  }
  private async install(signal: AbortSignal | undefined, skip: Set<RuntimeTool>): Promise<void> {
    for (const tool of tools) {
      signal?.throwIfAborted();
      const pin = this.pins[tool];
      this.stages[tool] = {status: 'provisioning'};
      if (skip.has(tool) || pin.status === 'unsupported' || await this.binary(tool)) {
        delete this.stages[tool];
        continue;
      }
      try {
        await this.installTool(tool, pin, signal);
        delete this.stages[tool];
      } catch (error) {
        if (signal?.aborted) {
          delete this.stages[tool];
          throw error;
        }
        const root = error instanceof Error && error.cause instanceof Error ? error.cause : error;
        const detail = root instanceof Error ? root.message : String(root);
        this.stages[tool] = {status: 'failed', detail};
        throw new Error(`${tool}: ${detail}`, {cause: error});
      }
    }
  }
  private async installTool(tool: RuntimeTool, pin: Extract<RuntimeArtifact, {status: 'supported'}>, signal?: AbortSignal): Promise<void> {
    const root = path.join(this.binDir, tool);
    await mkdir(root, {recursive: true});
    const archive = path.join(root, `archive.${pin.archive}`);
    await downloadPinned(pin, archive, undefined, signal);
    const staging = await mkdtemp(path.join(root, '.extract-'));
    const install = await mkdtemp(path.join(root, 'install-'));
    let published = false;
    try {
      // Windows ships bsdtar (including ZIP support). Unix unzip handles ZIP;
      // Linux tar uses xz for the sole tar.xz pin. No shell or package dependency.
      if (pin.archive === 'zip' && process.platform !== 'win32') {
        await exec('unzip', ['-q', archive, '-d', staging], {signal});
      } else {
        const tar = process.platform === 'win32' ? path.join(process.env.SystemRoot ?? 'C:\\Windows', 'System32', 'tar.exe') : 'tar';
        await exec(tar, ['-xf', archive, '-C', staging], {signal});
      }
      if (pin.extractDir) await cp(path.join(staging, pin.extractDir), install, {recursive: true});
      else {
        if (!(await lstat(path.join(staging, pin.binaryPath))).isFile()) throw new Error('Runtime binary is not a regular file');
        await copyFile(path.join(staging, pin.binaryPath), path.join(install, path.basename(pin.binaryPath)));
      }
      const binary = pin.extractDir ? path.relative(pin.extractDir, pin.binaryPath) : path.basename(pin.binaryPath);
      if (!(await lstat(path.join(install, binary))).isFile()) throw new Error('Runtime binary is not a regular file');
      await chmod(path.join(install, binary), 0o755);
      if (process.platform === 'darwin') await exec('xattr', ['-dr', 'com.apple.quarantine', install], {signal}).catch(() => undefined);
      const files: Record<string, number> = {};
      async function syncFiles(directory: string): Promise<void> {
        for (const name of await readdir(directory)) {
          const file = path.join(directory, name);
          const info = await lstat(file);
          if (info.isDirectory()) await syncFiles(file);
          else {
            if (!info.isFile()) throw new Error('Runtime archive contains a non-regular file');
            files[path.relative(install, file)] = info.size;
            if (!(info.mode & 0o200)) await chmod(file, info.mode | 0o200);
            const handle = await open(file, 'r+');
            try { await handle.sync(); } finally { await handle.close(); }
          }
        }
      }
      await syncFiles(install);
      if (!(await stat(path.join(install, binary))).size) throw new Error('Runtime archive has an empty executable');
      const receipt: Receipt = {identity: pinIdentity(pin), version: pin.version, directory: path.basename(install), binary, files};
      const temporary = path.join(root, 'current.json.part');
      await writeFile(temporary, JSON.stringify(receipt));
      const handle = await open(temporary, 'r+');
      try { await handle.sync(); } finally { await handle.close(); }
      signal?.throwIfAborted();
      await rename(temporary, path.join(root, 'current.json'));
      published = true;
      try {
        for (const e of await readdir(root)) if ((e.startsWith('install-') && e !== path.basename(install)) || e.startsWith('.extract-')) await rm(path.join(root, e), {recursive: true, force: true}).catch(() => undefined);
        await rm(archive, {force: true});
        await rm(`${archive}.verified.json`, {force: true});
      } catch { /* Cleanup is best-effort after publication. */ }
    } catch (error) {
      throw new Error(`Failed to install ${tool}: ${error instanceof Error ? error.message : String(error)}`, {cause: error});
    } finally {
      await rm(staging, {recursive: true, force: true});
      if (!published) await rm(install, {recursive: true, force: true});
      await rm(path.join(root, 'current.json.part'), {force: true});
    }
  }
}
