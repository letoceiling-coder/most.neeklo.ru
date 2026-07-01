import type { MessageEvent } from './messages.js';
import type { MessengerSource } from './sources.js';

export type AccountStatusKind = 'online' | 'logged_out' | 'needs_qr' | 'error';

export interface AccountStatus {
  source: MessengerSource;
  accountId: string;
  status: AccountStatusKind;
  detail?: string;
  ts: string;
}

/** Messages sent PC agent -> VPS over the WebSocket channel. */
export type AgentToServer =
  | {
      t: 'hello';
      pcId: string;
      token: string;
      agentVersion: string;
      sources: MessengerSource[];
    }
  | { t: 'heartbeat'; pcId: string; ts: string }
  | { t: 'event.message'; event: MessageEvent }
  | { t: 'account.status'; status: AccountStatus }
  | { t: 'command.result'; commandId: string; ok: boolean; error?: string };

/** Commands sent VPS -> PC agent (control channel). */
export type AgentCommand =
  | {
      t: 'command.reply';
      commandId: string;
      source: MessengerSource;
      accountId: string;
      chatId: string;
      text: string;
    }
  | {
      t: 'command.refresh';
      commandId: string;
      source: MessengerSource;
      accountId: string;
    }
  | { t: 'command.set_sources'; commandId: string; sources: MessengerSource[] };

export type ServerToAgent =
  | { t: 'welcome'; pcId: string; serverTime: string }
  | { t: 'error'; message: string }
  | AgentCommand;

export function isAgentCommand(msg: ServerToAgent): msg is AgentCommand {
  return msg.t.startsWith('command.');
}
