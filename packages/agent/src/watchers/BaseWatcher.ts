import crypto from 'node:crypto';
import type { Page } from 'playwright';
import type {
  AccountStatus,
  AccountStatusKind,
  MessageAttachment,
  MessageEvent,
  MessengerSource,
} from '@most/shared';
import { createLogger } from '../logger.js';
import { domObserverFn, type DomSelectors } from './domObserver.js';

/** Loose shape emitted by an in-page DOM observer or WS parser. */
export interface RawInbound {
  id?: string;
  chatId?: string;
  chatTitle?: string;
  chatKind?: 'private' | 'group' | 'channel';
  senderName?: string;
  senderUsername?: string;
  senderPhone?: string;
  senderExternalId?: string;
  text?: string;
  ts?: string;
  direction?: 'in' | 'out';
  attachments?: MessageAttachment[];
}

export interface WatcherCallbacks {
  onMessage: (event: MessageEvent) => void;
  onStatus: (status: AccountStatus) => void;
}

const BINDING = '__mostEmit';

/**
 * Base for all messenger watchers. Subclasses provide:
 *  - DOM selectors (most reliable for "new incoming bubble"), and/or
 *  - a WS frame parser (for apps with a readable JSON socket, like MAX/VK).
 * The base handles dedup, MessageEvent construction and re-injection on reload.
 */
export abstract class BaseWatcher {
  abstract readonly source: MessengerSource;
  protected readonly log = createLogger('watcher');
  protected accountId = 'default';
  private readonly seen = new Set<string>();
  private started = false;

  constructor(
    protected readonly page: Page,
    protected readonly pcId: string,
    protected readonly cb: WatcherCallbacks,
  ) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    this.accountId = `${this.source}`;

    await this.installDomObserver();
    this.installWsCapture();

    this.page.on('load', () => {
      void this.installDomObserver().catch(() => undefined);
      void this.detectStatus();
    });

    void this.detectStatus();
    this.log.info('Watcher started', { source: this.source });
  }

  /** Subclasses return DOM selectors for the generic observer (or null). */
  protected abstract domSelectors(): DomSelectors | null;

  /** Subclasses parse a raw WS frame payload into inbound items (optional). */
  protected parseWsFrame(_raw: string): RawInbound[] {
    return [];
  }

  /** Subclasses may detect logged-in/out state from the DOM (optional). */
  protected async detectStatus(): Promise<void> {
    await this.reportStatus('online');
  }

  /** Subclasses implement outbound reply (optional). */
  async sendReply(_chatId: string, _text: string): Promise<void> {
    throw new Error(`reply not supported for ${this.source}`);
  }

  async refresh(): Promise<void> {
    await this.page.reload({ waitUntil: 'domcontentloaded' }).catch(() => undefined);
  }

  private async installDomObserver(): Promise<void> {
    const selectors = this.domSelectors();
    if (!selectors) return;
    try {
      await this.page.exposeBinding(BINDING, (_src, raw: RawInbound) => this.handleRaw(raw));
    } catch {
      // already exposed for this page
    }
    const arg = { binding: BINDING, selectors };
    await this.page.addInitScript(domObserverFn, arg).catch(() => undefined);
    await this.page.evaluate(domObserverFn, arg).catch((err) => {
      this.log.warn('DOM observer injection failed', {
        source: this.source,
        error: (err as Error).message,
      });
    });
  }

  private installWsCapture(): void {
    this.page.on('websocket', (ws) => {
      ws.on('framereceived', (frame) => {
        const raw =
          typeof frame.payload === 'string' ? frame.payload : frame.payload.toString('utf8');
        let items: RawInbound[] = [];
        try {
          items = this.parseWsFrame(raw);
        } catch {
          return;
        }
        for (const item of items) this.handleRaw(item);
      });
    });
  }

  protected handleRaw(raw: RawInbound): void {
    if (raw.direction === 'out') return;
    const text = (raw.text ?? '').trim();
    if (!text && !(raw.attachments && raw.attachments.length)) return;

    const id = raw.id ?? this.fingerprint(raw);
    if (this.seen.has(id)) return;
    this.seen.add(id);
    if (this.seen.size > 5000) {
      const first = this.seen.values().next().value;
      if (first) this.seen.delete(first);
    }

    const event: MessageEvent = {
      id,
      source: this.source,
      accountId: this.accountId,
      pcId: this.pcId,
      chat: {
        id: raw.chatId ?? raw.senderUsername ?? raw.senderName ?? 'unknown',
        title: raw.chatTitle,
        kind: raw.chatKind ?? 'private',
      },
      sender: {
        externalId: raw.senderExternalId,
        name: raw.senderName,
        username: raw.senderUsername,
        phone: raw.senderPhone,
      },
      text,
      attachments: raw.attachments ?? [],
      direction: 'in',
      ts: raw.ts ?? new Date().toISOString(),
    };
    this.cb.onMessage(event);
  }

  private fingerprint(raw: RawInbound): string {
    const basis = `${this.source}|${raw.chatId ?? ''}|${raw.senderName ?? ''}|${raw.text ?? ''}|${raw.ts ?? ''}`;
    return crypto.createHash('sha1').update(basis).digest('hex');
  }

  protected async reportStatus(status: AccountStatusKind, detail?: string): Promise<void> {
    this.cb.onStatus({
      source: this.source,
      accountId: this.accountId,
      status,
      detail,
      ts: new Date().toISOString(),
    });
  }
}
