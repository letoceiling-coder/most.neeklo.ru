import type { AgentCommand, MessengerSource } from '@most/shared';
import type { AgentConfig } from './config.js';
import { ChromeController } from './ChromeController.js';
import { ChromeCdpLock } from './chromeCdpLock.js';
import { VpsClient } from './VpsClient.js';
import { createWatcher } from './watchers/index.js';
import type { BaseWatcher } from './watchers/BaseWatcher.js';
import { createLogger } from './logger.js';

const logger = createLogger('core');

export class AgentCore {
  private readonly chrome: ChromeController;
  private readonly vps: VpsClient;
  private readonly watchers = new Map<MessengerSource, BaseWatcher>();
  private lock: ChromeCdpLock | null = null;
  private reconnecting = false;

  constructor(private readonly config: AgentConfig) {
    this.chrome = new ChromeController(config);
    this.vps = new VpsClient(config);
  }

  async start(): Promise<void> {
    this.vps.setCommandHandler((cmd) => this.handleCommand(cmd));
    this.vps.start();

    if (this.config.useCdpLock) {
      this.lock = new ChromeCdpLock(new URL(this.config.chromeCdpEndpoint).port || '9222');
      await this.lock.acquire(300_000, 'most-agent');
    }

    await this.setupBrowser();
  }

  private async setupBrowser(): Promise<void> {
    try {
      await this.chrome.connect();
    } catch (err) {
      logger.error('Failed to connect to Chrome — is it running with --remote-debugging-port?', {
        error: (err as Error).message,
      });
      this.scheduleReconnect();
      return;
    }

    this.chrome.onDisconnected(() => {
      logger.warn('Chrome disconnected');
      this.watchers.clear();
      this.scheduleReconnect();
    });

    for (const source of this.config.sources) {
      await this.startWatcher(source);
    }
  }

  private async startWatcher(source: MessengerSource): Promise<void> {
    try {
      const page = await this.chrome.pageForSource(source);
      const watcher = createWatcher(source, page, this.config.pcId, {
        onMessage: (event) => this.vps.sendMessageEvent(event),
        onStatus: (status) => this.vps.sendAccountStatus(status),
      });
      await watcher.start();
      this.watchers.set(source, watcher);
    } catch (err) {
      logger.error('Failed to start watcher', { source, error: (err as Error).message });
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnecting) return;
    this.reconnecting = true;
    setTimeout(async () => {
      this.reconnecting = false;
      logger.info('Reconnecting to Chrome...');
      await this.setupBrowser();
    }, 5000);
  }

  private async handleCommand(cmd: AgentCommand): Promise<{ ok: boolean; error?: string }> {
    try {
      if (cmd.t === 'command.reply') {
        const watcher = this.watchers.get(cmd.source);
        if (!watcher) return { ok: false, error: `no watcher for ${cmd.source}` };
        await watcher.sendReply(cmd.chatId, cmd.text);
        return { ok: true };
      }
      if (cmd.t === 'command.refresh') {
        const watcher = this.watchers.get(cmd.source);
        if (!watcher) return { ok: false, error: `no watcher for ${cmd.source}` };
        await watcher.refresh();
        return { ok: true };
      }
      if (cmd.t === 'command.set_sources') {
        logger.info('set_sources received (restart agent to apply)', { sources: cmd.sources });
        return { ok: true };
      }
      return { ok: false, error: 'unknown command' };
    } catch (err) {
      return { ok: false, error: (err as Error).message };
    }
  }

  async stop(): Promise<void> {
    this.vps.stop();
    await this.chrome.close();
    this.lock?.release();
  }
}
