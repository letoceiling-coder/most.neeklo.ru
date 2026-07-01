import crypto from 'node:crypto';
import type { MessageEvent } from '@most/shared';
import { pool } from '../db/pool.js';

export interface StoredMessage {
  id: string;
  inserted: boolean;
}

export function dedupKey(event: MessageEvent): string {
  return `${event.pcId}:${event.source}:${event.id}`;
}

export async function insertMessage(
  event: MessageEvent,
  contactId: string | null,
): Promise<StoredMessage> {
  const key = dedupKey(event);
  const dup = await pool.query<{ id: string }>(
    'SELECT id FROM messages WHERE dedup_key = $1',
    [key],
  );
  if (dup.rows.length) {
    return { id: dup.rows[0].id, inserted: false };
  }

  const res = await pool.query<{ id: string }>(
    `INSERT INTO messages (
       id, dedup_key, pc_id, source, account_id, chat_id, chat_title, chat_kind,
       contact_id, sender_name, sender_username, sender_phone, sender_external,
       text, attachments, direction, ts, raw
     ) VALUES (
       $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18
     )
     ON CONFLICT (dedup_key) DO NOTHING
     RETURNING id`,
    [
      crypto.randomUUID(),
      key,
      event.pcId,
      event.source,
      event.accountId,
      event.chat.id,
      event.chat.title ?? null,
      event.chat.kind ?? null,
      contactId,
      event.sender.name ?? null,
      event.sender.username ?? null,
      event.sender.phone ?? null,
      event.sender.externalId ?? null,
      event.text,
      JSON.stringify(event.attachments ?? []),
      event.direction,
      event.ts,
      event.raw === undefined ? null : JSON.stringify(event.raw),
    ],
  );
  if (res.rows.length) {
    return { id: res.rows[0].id, inserted: true };
  }
  const existing = await pool.query<{ id: string }>(
    'SELECT id FROM messages WHERE dedup_key = $1',
    [key],
  );
  return { id: existing.rows[0]?.id ?? '', inserted: false };
}

export async function setMessageAi(id: string, ai: unknown): Promise<void> {
  await pool.query('UPDATE messages SET ai = $2 WHERE id = $1', [id, JSON.stringify(ai)]);
}

export interface MessageForReply {
  id: string;
  pc_id: string;
  source: string;
  account_id: string;
  chat_id: string;
}

export async function getMessageForReply(
  messageId: string,
  userId: string,
): Promise<MessageForReply | null> {
  const res = await pool.query<MessageForReply>(
    `SELECT m.id, m.pc_id, m.source, m.account_id, m.chat_id
     FROM messages m
     JOIN pcs p ON p.id = m.pc_id
     WHERE m.id = $1 AND p.user_id = $2`,
    [messageId, userId],
  );
  return res.rows[0] ?? null;
}

export async function listMessages(opts: {
  userId: string;
  source?: string;
  accountId?: string;
  contactId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}): Promise<unknown[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const params: unknown[] = [opts.userId];
  const where: string[] = ['p.user_id = $1'];

  if (opts.source) {
    params.push(opts.source);
    where.push(`m.source = $${params.length}`);
  }
  if (opts.accountId) {
    params.push(opts.accountId);
    where.push(`m.account_id = $${params.length}`);
  }
  if (opts.contactId) {
    params.push(opts.contactId);
    where.push(`m.contact_id = $${params.length}`);
  }
  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`LOWER(m.text) LIKE $${params.length}`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  params.push(limit, offset);
  const res = await pool.query(
    `SELECT m.id, m.source, m.account_id, m.pc_id, m.chat_id, m.chat_title, m.contact_id,
            m.sender_name, m.sender_username, m.text, m.attachments, m.direction, m.ts, m.ai, m.created_at
     FROM messages m
     JOIN pcs p ON p.id = m.pc_id
     ${whereSql}
     ORDER BY m.ts DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  return res.rows;
}
