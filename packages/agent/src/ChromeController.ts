import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { SOURCE_WEB_URLS, type MessengerSource } from '@most/shared';
import type { AgentConfig } from './config.js';
import { createLogger } from './logger.js';

const logger = createLogger('chrome');

/**
 * Connects (over CDP) to the user's already-running, already-authorized Chrome.
 * The user must start Chrome with --remote-debugging-port=9222 (see
 * deploy/windows/start-chrome-debug.ps1). We never launch our own browser so
 * the real logged-in sessions (cookies, WhatsApp QR, etc.) are reused.
 */
export class ChromeController {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  constructor(private readonly config: AgentConfig) {}

  async connect(): Promise<void> {
    this.browser = await chromium.connectOverCDP(this.config.chromeCdpEndpoint);
    const contexts = this.browser.contexts();
    this.context = contexts.length ? contexts[0] : await this.browser.newContext();
    logger.info('Connected to Chrome over CDP', {
      endpoint: this.config.chromeCdpEndpoint,
      existingPages: this.context.pages().length,
    });
  }

  isConnected(): boolean {
    return Boolean(this.browser?.isConnected());
  }

  onDisconnected(cb: () => void): void {
    this.browser?.on('disconnected', cb);
  }

  /** Find an open tab already on the source, otherwise open a new one. */
  async pageForSource(source: MessengerSource): Promise<Page> {
    if (!this.context) throw new Error('Chrome not connected');
    const target = SOURCE_WEB_URLS[source];
    const host = new URL(target).host.replace(/^www\./, '');

    for (const page of this.context.pages()) {
      try {
        const url = page.url();
        if (url.includes(host)) {
          logger.info('Reusing existing tab', { source, url });
          return page;
        }
      } catch {
        /* page may be closing */
      }
    }

    const page = await this.context.newPage();
    await page.goto(target, { waitUntil: 'domcontentloaded' }).catch((err) => {
      logger.warn('Navigation issue', { source, error: (err as Error).message });
    });
    logger.info('Opened new tab', { source, url: target });
    return page;
  }

  async close(): Promise<void> {
    // Detach only; do NOT close the user's browser.
    await this.browser?.close().catch(() => undefined);
    this.browser = null;
    this.context = null;
  }
}
