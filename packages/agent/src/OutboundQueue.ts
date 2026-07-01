import fs from 'node:fs';
import path from 'node:path';
import type { AgentToServer } from '@most/shared';
import { PACKAGE_ROOT } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('queue');

/**
 * Disk-backed buffer of messages that must reach the VPS. Events are appended
 * while the WS link is down and replayed (in order) on reconnect, so inbound
 * messages are never lost across restarts or network blips.
 */
export class OutboundQueue {
  private readonly file: string;
  private items: AgentToServer[] = [];

  constructor(maxItems = 5000) {
    const dir = path.join(PACKAGE_ROOT, '.queue');
    fs.mkdirSync(dir, { recursive: true });
    this.file = path.join(dir, 'outbound.json');
    this.maxItems = maxItems;
    this.load();
  }

  private maxItems: number;

  private load(): void {
    try {
      if (fs.existsSync(this.file)) {
        this.items = JSON.parse(fs.readFileSync(this.file, 'utf-8')) as AgentToServer[];
      }
    } catch (err) {
      logger.warn('Failed to load queue, starting empty', { error: (err as Error).message });
      this.items = [];
    }
  }

  private persist(): void {
    try {
      fs.writeFileSync(this.file, JSON.stringify(this.items));
    } catch (err) {
      logger.warn('Failed to persist queue', { error: (err as Error).message });
    }
  }

  get size(): number {
    return this.items.length;
  }

  enqueue(item: AgentToServer): void {
    this.items.push(item);
    if (this.items.length > this.maxItems) {
      this.items.splice(0, this.items.length - this.maxItems);
    }
    this.persist();
  }

  /** Replay queued items via `send`; stops at the first failure to preserve order. */
  async drain(send: (item: AgentToServer) => boolean): Promise<void> {
    if (!this.items.length) return;
    let sent = 0;
    for (const item of this.items) {
      if (!send(item)) break;
      sent += 1;
    }
    if (sent > 0) {
      this.items.splice(0, sent);
      this.persist();
      logger.info(`Flushed ${sent} queued message(s)`, { remaining: this.items.length });
    }
  }
}
