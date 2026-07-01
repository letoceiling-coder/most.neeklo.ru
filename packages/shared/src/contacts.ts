import type { MessengerSource } from './sources.js';

export interface ContactIdentity {
  source: MessengerSource;
  externalId?: string;
  username?: string;
  phone?: string;
  name?: string;
  avatar?: string;
}

/** A person unified across one or more messenger identities. */
export interface Contact {
  contactId: string;
  displayName: string;
  identities: ContactIdentity[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Tag on contact — messages from this contact are not saved or forwarded. */
export const EXCLUDE_CONTACT_TAG = 'exclude';

/** Auto tag derived from a source, e.g. "src:telegram". */
export function sourceTag(source: MessengerSource): string {
  return `src:${source}`;
}

/** Normalize a phone to digits only (with leading country code if present). */
export function normalizePhone(phone?: string): string | undefined {
  if (!phone) return undefined;
  const digits = phone.replace(/[^\d]/g, '');
  return digits.length >= 7 ? digits : undefined;
}

/** Normalize a username for matching (lowercase, strip leading @). */
export function normalizeUsername(username?: string): string | undefined {
  if (!username) return undefined;
  const u = username.trim().replace(/^@/, '').toLowerCase();
  return u.length ? u : undefined;
}
