import type { MessageEvent } from '@most/shared';
import { createLogger } from '../logger.js';
import { resolveContact } from './IdentityResolver.js';
import { shouldSkipIngest, isContactExcluded } from './filters.js';
import { insertMessage, setMessageAi } from '../repositories/messages.js';
import { addTag } from '../repositories/contacts.js';
import { enqueueDelivery, getEnabledWebhooksForEvent } from '../repositories/webhooks.js';
import { openRouter } from '../ai/OpenRouterService.js';
import { getPcUserId } from '../repositories/pcs.js';

const logger = createLogger('ingest');

export interface IngestResult {
  messageId: string;
  contactId: string;
  inserted: boolean;
  skipped?: boolean;
}

/**
 * Single processing point for an inbound message:
 *  1. unify the sender into a contact (+ source tag)
 *  2. persist the message (dedup by pcId:source:id)
 *  3. fan out to webhooks (only for newly inserted messages)
 *  4. enrich with OpenRouter asynchronously (category/tags/draft reply)
 */
export async function ingestMessage(event: MessageEvent): Promise<IngestResult> {
  const userId = await getPcUserId(event.pcId);
  if (!userId) {
    throw new Error(`unknown pc: ${event.pcId}`);
  }

  if (await shouldSkipIngest(event, userId)) {
    return { messageId: '', contactId: '', inserted: false, skipped: true };
  }

  const contactId = await resolveContact(event, userId);
  if (await isContactExcluded(contactId, userId)) {
    return { messageId: '', contactId, inserted: false, skipped: true };
  }
  const stored = await insertMessage(event, contactId);

  if (stored.inserted && event.direction === 'in') {
    await fanOutWebhooks(stored.id, userId);
    void enrich(event, stored.id, contactId, userId);
  }

  return { messageId: stored.id, contactId, inserted: stored.inserted };
}

async function fanOutWebhooks(messageId: string, userId: string): Promise<void> {
  const hooks = await getEnabledWebhooksForEvent('message.in', userId);
  await Promise.all(
    hooks.map((h) => enqueueDelivery({ webhookId: h.id, messageId, event: 'message.in' })),
  );
}

async function enrich(
  event: MessageEvent,
  messageId: string,
  contactId: string,
  userId: string,
): Promise<void> {
  try {
    const analysis = await openRouter.analyze(event, userId);
    if (!analysis) return;
    await setMessageAi(messageId, analysis);
    for (const tag of analysis.tags) {
      await addTag(contactId, tag, userId);
    }
  } catch (err) {
    logger.warn('Enrichment failed', { error: (err as Error).message, messageId });
  }
}
