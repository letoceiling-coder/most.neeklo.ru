import {
  type MessageEvent,
  EXCLUDE_CONTACT_TAG,
  normalizePhone,
  normalizeUsername,
} from '@most/shared';
import { contactHasTag, findExistingContactId } from '../repositories/contacts.js';
import { getExcludedFilters, type ExcludedFilters } from '../repositories/settings.js';

function matchesRules(event: MessageEvent, rules: ExcludedFilters): boolean {
  const phone = normalizePhone(event.sender.phone);
  const username = normalizeUsername(event.sender.username);
  if (phone && rules.phones.some((p) => phone.includes(p) || p.includes(phone))) return true;
  if (username && rules.usernames.includes(username)) return true;
  const chatId = event.chat.id;
  if (
    rules.chats.some((c) => c.source === event.source && c.chatId === chatId)
  ) {
    return true;
  }
  return false;
}

/** Returns true if the message must not be ingested (webhooks, AI, feed). */
export async function shouldSkipIngest(event: MessageEvent, userId: string): Promise<boolean> {
  const rules = await getExcludedFilters(userId);
  if (matchesRules(event, rules)) return true;

  const existingId = await findExistingContactId(event, userId);
  if (existingId && (await contactHasTag(existingId, EXCLUDE_CONTACT_TAG, userId))) {
    return true;
  }
  return false;
}

export async function isContactExcluded(contactId: string, userId: string): Promise<boolean> {
  return contactHasTag(contactId, EXCLUDE_CONTACT_TAG, userId);
}
