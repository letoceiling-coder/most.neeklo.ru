import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { PACKAGE_ROOT } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('cdp-lock');

/**
 * Advisory cross-process lock for the shared automation Chrome (one CDP port).
 * Ported and trimmed from parser-COMP so the Most agent never fights another
 * tool for the same browser session. Optional (config.useCdpLock).
 */
interface LockData {
  pid: number;
  host: string;
  startedAt: string;
  heartbeatAt: string;
  label?: string;
}

const HEARTBEAT_MS = 5000;
const STALE_AFTER_MS = 20_000;

function isProcessAlive(pid: number): boolean {
  if (pid === process.pid) return true;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code === 'EPERM';
  }
}

export class ChromeCdpLock {
  private readonly lockFile: string;
  private heartbeat: NodeJS.Timeout | null = null;
  private held = false;

  constructor(key = '9222') {
    const safeKey = key.replace(/[^a-z0-9_-]+/gi, '_') || 'default';
    const dir = path.join(PACKAGE_ROOT, '.queue', 'locks');
    fs.mkdirSync(dir, { recursive: true });
    this.lockFile = path.join(dir, `chrome-cdp-${safeKey}.lock`);
  }

  private readLock(): LockData | null {
    try {
      return JSON.parse(fs.readFileSync(this.lockFile, 'utf-8')) as LockData;
    } catch {
      return null;
    }
  }

  private isStale(data: LockData): boolean {
    if (!isProcessAlive(data.pid)) return true;
    const age = Date.now() - Date.parse(data.heartbeatAt);
    return Number.isFinite(age) && age > STALE_AFTER_MS;
  }

  private tryWrite(label?: string): boolean {
    const data: LockData = {
      pid: process.pid,
      host: os.hostname(),
      startedAt: new Date().toISOString(),
      heartbeatAt: new Date().toISOString(),
      label,
    };
    try {
      const fd = fs.openSync(this.lockFile, 'wx');
      fs.writeSync(fd, JSON.stringify(data));
      fs.closeSync(fd);
      return true;
    } catch {
      return false;
    }
  }

  async acquire(timeoutMs = 300_000, label?: string): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.tryWrite(label)) {
        this.held = true;
        this.startHeartbeat();
        return;
      }
      const existing = this.readLock();
      if (existing && this.isStale(existing)) {
        logger.warn('Taking over stale CDP lock', { stalePid: existing.pid });
        try {
          fs.rmSync(this.lockFile, { force: true });
        } catch {
          /* retry */
        }
        continue;
      }
      await new Promise((r) => setTimeout(r, 750));
    }
    throw new Error(`Could not acquire Chrome CDP lock within ${timeoutMs}ms`);
  }

  private startHeartbeat(): void {
    this.heartbeat = setInterval(() => {
      const data = this.readLock();
      if (!data || data.pid !== process.pid) return;
      data.heartbeatAt = new Date().toISOString();
      try {
        fs.writeFileSync(this.lockFile, JSON.stringify(data));
      } catch {
        /* best-effort */
      }
    }, HEARTBEAT_MS);
    this.heartbeat.unref?.();
  }

  release(): void {
    if (!this.held) return;
    this.held = false;
    if (this.heartbeat) clearInterval(this.heartbeat);
    const data = this.readLock();
    if (data && data.pid === process.pid) {
      try {
        fs.rmSync(this.lockFile, { force: true });
      } catch {
        /* best-effort */
      }
    }
  }
}
