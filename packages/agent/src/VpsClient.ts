import { WebSocket } from 'ws';
import type {
  AccountStatus,
  AgentCommand,
  AgentToServer,
  MessageEvent,
  ServerToAgent,
} from '@most/shared';
import { isAgentCommand } from '@most/shared';
import type { AgentConfig } from './config.js';
import { OutboundQueue } from './OutboundQueue.js';
import { createLogger } from './logger.js';

const logger = createLogger('vps');

export type CommandHandler = (command: AgentCommand) => Promise<{ ok: boolean; error?: string }>;

/**
 * Outbound persistent WebSocket to the VPS. Auto-reconnects with backoff,
 * sends heartbeats, replays the disk queue on reconnect, and dispatches
 * incoming commands to the registered handler.
 */
export class VpsClient {
  private ws: WebSocket | null = null;
  private readonly queue = new OutboundQueue();
  private reconnectDelay = 1000;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private closed = false;
  private onCommand: CommandHandler | null = null;

  constructor(private readonly config: AgentConfig) {}

  setCommandHandler(handler: CommandHandler): void {
    this.onCommand = handler;
  }

  start(): void {
    this.closed = false;
    this.connect();
  }

  stop(): void {
    this.closed = true;
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.ws?.close();
  }

  sendMessageEvent(event: MessageEvent): void {
    this.dispatch({ t: 'event.message', event });
  }

  sendAccountStatus(status: AccountStatus): void {
    this.dispatch({ t: 'account.status', status });
  }

  private dispatch(msg: AgentToServer): void {
    if (!this.rawSend(msg)) {
      this.queue.enqueue(msg);
    }
  }

  private rawSend(msg: AgentToServer): boolean {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify(msg));
        return true;
      } catch (err) {
        logger.warn('send failed', { error: (err as Error).message });
        return false;
      }
    }
    return false;
  }

  private connect(): void {
    if (this.closed) return;
    logger.info('Connecting to VPS', { url: this.config.vpsWsUrl });
    const ws = new WebSocket(this.config.vpsWsUrl);
    this.ws = ws;

    ws.on('open', () => {
      this.reconnectDelay = 1000;
      this.rawSend({
        t: 'hello',
        pcId: this.config.pcId,
        token: this.config.token,
        agentVersion: this.config.agentVersion,
        sources: this.config.sources,
      });
      void this.queue.drain((item) => this.rawSend(item));
      this.startHeartbeat();
      logger.info('Connected to VPS');
    });

    ws.on('message', (raw) => {
      let msg: ServerToAgent;
      try {
        msg = JSON.parse(raw.toString()) as ServerToAgent;
      } catch {
        return;
      }
      if (msg.t === 'welcome') {
        logger.info('Welcomed by VPS', { serverTime: msg.serverTime });
        return;
      }
      if (msg.t === 'error') {
        logger.warn('VPS error', { message: msg.message });
        return;
      }
      if (isAgentCommand(msg)) void this.handleCommand(msg);
    });

    ws.on('close', () => {
      if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
      if (this.closed) return;
      logger.warn(`Disconnected, reconnecting in ${this.reconnectDelay}ms`);
      setTimeout(() => this.connect(), this.reconnectDelay);
      this.reconnectDelay = Math.min(this.reconnectDelay * 2, 30_000);
    });

    ws.on('error', (err) => logger.warn('WS error', { error: err.message }));
  }

  private async handleCommand(command: AgentCommand): Promise<void> {
    if (!this.onCommand) return;
    try {
      const result = await this.onCommand(command);
      this.rawSend({
        t: 'command.result',
        commandId: command.commandId,
        ok: result.ok,
        error: result.error,
      });
    } catch (err) {
      this.rawSend({
        t: 'command.result',
        commandId: command.commandId,
        ok: false,
        error: (err as Error).message,
      });
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.rawSend({ t: 'heartbeat', pcId: this.config.pcId, ts: new Date().toISOString() });
    }, 45_000);
    this.heartbeatTimer.unref?.();
  }
}
