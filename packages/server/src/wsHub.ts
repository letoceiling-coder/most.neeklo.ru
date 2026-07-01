import crypto from 'node:crypto';
import type { Server } from 'node:http';
import { WebSocket, WebSocketServer } from 'ws';
import type {
  AgentCommand,
  AgentToServer,
  MessengerSource,
  ServerToAgent,
} from '@most/shared';
import { createLogger } from './logger.js';
import { ingestMessage } from './ingest/IngestService.js';
import {
  registerHello,
  touchPc,
  upsertAccountStatus,
  verifyToken,
} from './repositories/pcs.js';

const logger = createLogger('wshub');

interface AgentConn {
  pcId: string;
  ws: WebSocket;
  lastSeen: number;
}

/** Distributive Omit so union-specific fields (source, chatId, ...) survive. */
type CommandDraft = AgentCommand extends infer T
  ? T extends AgentCommand
    ? Omit<T, 'commandId'>
    : never
  : never;

/**
 * Maintains the live set of connected PC agents and relays:
 *   agent -> server: messages / account status / heartbeats
 *   server -> agent: commands (reply / refresh / set sources)
 */
export class WsHub {
  private readonly agents = new Map<string, AgentConn>();
  private wss: WebSocketServer | null = null;

  attach(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/agent' });
    this.wss.on('connection', (ws) => this.onConnection(ws));
    setInterval(() => this.reapStale(), 30_000).unref?.();
    logger.info('WS hub attached at /agent');
  }

  onlineIds(): Set<string> {
    return new Set(this.agents.keys());
  }

  isOnline(pcId: string): boolean {
    return this.agents.has(pcId);
  }

  /** Send a command to a connected agent. Returns false if the PC is offline. */
  sendCommand(pcId: string, command: CommandDraft): boolean {
    const conn = this.agents.get(pcId);
    if (!conn) return false;
    const full = { ...command, commandId: crypto.randomUUID() } as AgentCommand;
    this.send(conn.ws, full);
    return true;
  }

  private onConnection(ws: WebSocket): void {
    let pcId: string | null = null;

    ws.on('message', async (raw) => {
      let msg: AgentToServer;
      try {
        msg = JSON.parse(raw.toString()) as AgentToServer;
      } catch {
        this.send(ws, { t: 'error', message: 'invalid json' });
        return;
      }

      try {
        if (msg.t === 'hello') {
          if (!verifyToken(msg.pcId, msg.token)) {
            this.send(ws, { t: 'error', message: 'bad token' });
            ws.close();
            return;
          }
          const id = msg.pcId;
          const registered = await registerHello(id, msg.agentVersion, msg.sources as MessengerSource[]);
          if (!registered) {
            this.send(ws, {
              t: 'error',
              message: 'PC not registered — create it in the dashboard first',
            });
            ws.close();
            return;
          }
          pcId = id;
          this.agents.set(id, { pcId: id, ws, lastSeen: Date.now() });
          this.send(ws, { t: 'welcome', pcId: id, serverTime: new Date().toISOString() });
          logger.info('Agent connected', { pcId: id, sources: msg.sources });
          return;
        }

        if (!pcId) {
          this.send(ws, { t: 'error', message: 'send hello first' });
          return;
        }
        this.markSeen(pcId);

        switch (msg.t) {
          case 'heartbeat':
            await touchPc(pcId);
            break;
          case 'event.message':
            await ingestMessage(msg.event);
            break;
          case 'account.status':
            await upsertAccountStatus(pcId, msg.status);
            break;
          case 'command.result':
            if (!msg.ok) logger.warn('Command failed on agent', { pcId, error: msg.error });
            break;
        }
      } catch (err) {
        logger.error('WS message handling failed', { error: (err as Error).message });
      }
    });

    ws.on('close', () => {
      if (pcId && this.agents.get(pcId)?.ws === ws) {
        this.agents.delete(pcId);
        logger.info('Agent disconnected', { pcId });
      }
    });

    ws.on('error', (err) => logger.warn('WS error', { error: err.message }));
  }

  private markSeen(pcId: string): void {
    const conn = this.agents.get(pcId);
    if (conn) conn.lastSeen = Date.now();
  }

  private send(ws: WebSocket, msg: ServerToAgent): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  private reapStale(): void {
    const cutoff = Date.now() - 120_000;
    for (const [pcId, conn] of this.agents) {
      if (conn.lastSeen < cutoff) {
        try {
          conn.ws.terminate();
        } catch {
          /* ignore */
        }
        this.agents.delete(pcId);
        logger.info('Reaped stale agent', { pcId });
      }
    }
  }
}

export const hub = new WsHub();
