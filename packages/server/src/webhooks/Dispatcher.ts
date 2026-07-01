import crypto from 'node:crypto';
import { createLogger } from '../logger.js';
import {
  claimPendingDeliveries,
  markDeliveryRetry,
  markDeliverySuccess,
  type PendingDelivery,
} from '../repositories/webhooks.js';
import { pool } from '../db/pool.js';

const logger = createLogger('webhooks');

export function sign(secret: string, body: string): string {
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function buildPayload(delivery: PendingDelivery): Promise<unknown> {
  let message: unknown = null;
  if (delivery.message_id) {
    const res = await pool.query(
      `SELECT m.*, c.display_name AS contact_name, c.tags AS contact_tags
       FROM messages m LEFT JOIN contacts c ON c.id = m.contact_id
       WHERE m.id = $1`,
      [delivery.message_id],
    );
    message = res.rows[0] ?? null;
  }
  return {
    event: delivery.event,
    deliveryId: delivery.id,
    ts: new Date().toISOString(),
    data: message,
  };
}

async function deliverOne(delivery: PendingDelivery): Promise<void> {
  const payload = await buildPayload(delivery);
  const body = JSON.stringify(payload);
  const signature = sign(delivery.secret, body);
  const attempts = delivery.attempts + 1;

  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 15_000);
    const res = await fetch(delivery.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Most-Event': delivery.event,
        'X-Most-Signature': `sha256=${signature}`,
        'X-Most-Delivery': delivery.id,
      },
      body,
      signal: ctrl.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      await markDeliverySuccess(delivery.id, res.status);
    } else {
      await markDeliveryRetry(delivery.id, attempts, `HTTP ${res.status}`, res.status);
    }
  } catch (err) {
    await markDeliveryRetry(delivery.id, attempts, (err as Error).message, null);
  }
}

/** Process one batch of pending webhook deliveries (for tests and manual flush). */
export async function flushWebhookDeliveries(): Promise<void> {
  const batch = await claimPendingDeliveries(20);
  await Promise.all(batch.map((d) => deliverOne(d)));
}

/** Background loop: claims due deliveries and POSTs them with HMAC + retries. */
export class WebhookDispatcher {
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  start(intervalMs = 2000): void {
    if (this.timer) return;
    this.timer = setInterval(() => void this.runTick(), intervalMs);
    this.timer.unref?.();
    logger.info('Webhook dispatcher started');
  }

  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }

  private async runTick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      await flushWebhookDeliveries();
    } catch (err) {
      logger.warn('Dispatcher tick failed', { error: (err as Error).message });
    } finally {
      this.running = false;
    }
  }
}

export const dispatcher = new WebhookDispatcher();
