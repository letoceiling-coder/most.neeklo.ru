import crypto from 'node:crypto';
import { pool } from '../db/pool.js';

export interface Webhook {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

export async function listWebhooks(userId: string): Promise<Webhook[]> {
  const res = await pool.query<Webhook>(
    `SELECT id, name, url, secret, events, enabled FROM webhooks
     WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  return res.rows;
}

export async function createWebhook(input: {
  userId: string;
  name?: string;
  url: string;
  events?: string[];
}): Promise<Webhook> {
  const secret = crypto.randomBytes(24).toString('hex');
  const res = await pool.query<Webhook>(
    `INSERT INTO webhooks (id, name, url, secret, events, user_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id, name, url, secret, events, enabled`,
    [
      crypto.randomUUID(),
      input.name ?? '',
      input.url,
      secret,
      input.events ?? ['message.in'],
      input.userId,
    ],
  );
  return res.rows[0];
}

export async function deleteWebhook(id: string, userId: string): Promise<void> {
  await pool.query('DELETE FROM webhooks WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function setWebhookEnabled(id: string, userId: string, enabled: boolean): Promise<void> {
  await pool.query('UPDATE webhooks SET enabled = $3 WHERE id = $1 AND user_id = $2', [
    id,
    userId,
    enabled,
  ]);
}

export async function getEnabledWebhooksForEvent(
  event: string,
  userId: string,
): Promise<Webhook[]> {
  const res = await pool.query<Webhook>(
    `SELECT id, name, url, secret, events, enabled FROM webhooks
     WHERE user_id = $2 AND enabled = TRUE AND $1 = ANY(events)`,
    [event, userId],
  );
  return res.rows;
}

export async function enqueueDelivery(input: {
  webhookId: string;
  messageId: string | null;
  event: string;
}): Promise<string> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO webhook_deliveries (id, webhook_id, message_id, event)
     VALUES ($1, $2, $3, $4) RETURNING id`,
    [crypto.randomUUID(), input.webhookId, input.messageId, input.event],
  );
  return res.rows[0].id;
}

export interface PendingDelivery {
  id: string;
  webhook_id: string;
  message_id: string | null;
  event: string;
  attempts: number;
  url: string;
  secret: string;
}

/** Claim a batch of due deliveries (single-worker safe). */
export async function claimPendingDeliveries(limit: number): Promise<PendingDelivery[]> {
  const picked = await pool.query<{ id: string }>(
    `SELECT id FROM webhook_deliveries
     WHERE status IN ('pending', 'retry') AND next_attempt_at <= now()
     ORDER BY next_attempt_at
     LIMIT $1`,
    [limit],
  );

  const out: PendingDelivery[] = [];
  for (const row of picked.rows) {
    const upd = await pool.query<{
      id: string;
      webhook_id: string;
      message_id: string | null;
      event: string;
      attempts: number;
    }>(
      `UPDATE webhook_deliveries SET status = 'sending', updated_at = now()
       WHERE id = $1 AND status IN ('pending', 'retry')
       RETURNING id, webhook_id, message_id, event, attempts`,
      [row.id],
    );
    const d = upd.rows[0];
    if (!d) continue;

    const wh = await pool.query<{ url: string; secret: string }>(
      'SELECT url, secret FROM webhooks WHERE id = $1',
      [d.webhook_id],
    );
    if (!wh.rows[0]) continue;

    out.push({
      ...d,
      url: wh.rows[0].url,
      secret: wh.rows[0].secret,
    });
  }
  return out;
}

export async function markDeliverySuccess(id: string, code: number): Promise<void> {
  await pool.query(
    `UPDATE webhook_deliveries SET status = 'delivered', response_code = $2,
       attempts = attempts + 1, last_error = NULL, updated_at = now() WHERE id = $1`,
    [id, code],
  );
}

export async function markDeliveryRetry(
  id: string,
  attempts: number,
  error: string,
  code: number | null,
): Promise<void> {
  const maxAttempts = 8;
  const status = attempts >= maxAttempts ? 'failed' : 'retry';
  // Exponential backoff capped at 1h.
  const delaySec = Math.min(3600, Math.round(2 ** attempts * 5));
  await pool.query(
    `UPDATE webhook_deliveries SET status = $2, attempts = $3, last_error = $4,
       response_code = $5, next_attempt_at = now() + ($6 || ' seconds')::interval,
       updated_at = now() WHERE id = $1`,
    [id, status, attempts, error.slice(0, 500), code, delaySec],
  );
}

export async function listRecentDeliveries(userId: string, limit = 50): Promise<unknown[]> {
  const res = await pool.query(
    `SELECT d.id, d.webhook_id, d.message_id, d.event, d.status, d.attempts,
            d.response_code, d.last_error, d.updated_at
     FROM webhook_deliveries d
     JOIN webhooks w ON w.id = d.webhook_id
     WHERE w.user_id = $1
     ORDER BY d.updated_at DESC LIMIT $2`,
    [userId, limit],
  );
  return res.rows;
}
