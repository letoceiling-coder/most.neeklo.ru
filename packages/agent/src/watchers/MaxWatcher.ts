import type { MessengerSource } from '@most/shared';
import { BaseWatcher, type RawInbound } from './BaseWatcher.js';
import type { DomSelectors } from './domObserver.js';

/**
 * MAX (web.max.ru) drives its UI over a JSON WebSocket (oneme). We capture
 * frames (same pattern as parser-COMP MaxWsCapture) and walk the payload for
 * message-like objects. Outgoing messages are skipped via mine/outgoing flags.
 */
export class MaxWatcher extends BaseWatcher {
  readonly source: MessengerSource = 'max';

  protected domSelectors(): DomSelectors | null {
    return null; // WS-driven
  }

  protected parseWsFrame(raw: string): RawInbound[] {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      return [];
    }
    const out: RawInbound[] = [];
    this.walk(json, out, 0);
    return out;
  }

  private walk(node: unknown, out: RawInbound[], depth: number): void {
    if (!node || typeof node !== 'object' || depth > 12) return;
    if (Array.isArray(node)) {
      for (const row of node) this.walk(row, out, depth + 1);
      return;
    }
    const r = node as Record<string, unknown>;
    const text = typeof r.text === 'string' ? r.text : undefined;
    const hasSender = r.sender || r.from || r.senderId || r.userId;
    if (text && hasSender) {
      const mine =
        r.mine === true || r.outgoing === true || r.isMine === true || r.direction === 'out';
      const sender = (r.sender ?? r.from) as Record<string, unknown> | undefined;
      out.push({
        id: r.id != null ? `max_${String(r.id)}` : undefined,
        chatId: r.chatId != null ? String(r.chatId) : r.dialogId != null ? String(r.dialogId) : undefined,
        chatTitle: typeof r.chatTitle === 'string' ? r.chatTitle : undefined,
        senderName:
          (sender && (sender.name as string)) ||
          (typeof r.senderName === 'string' ? r.senderName : undefined),
        senderExternalId:
          r.senderId != null ? String(r.senderId) : r.userId != null ? String(r.userId) : undefined,
        text,
        ts:
          typeof r.time === 'number'
            ? new Date(r.time).toISOString()
            : typeof r.timestamp === 'number'
              ? new Date(r.timestamp).toISOString()
              : new Date().toISOString(),
        direction: mine ? 'out' : 'in',
      });
    }
    for (const v of Object.values(r)) {
      if (v && typeof v === 'object') this.walk(v, out, depth + 1);
    }
  }
}
