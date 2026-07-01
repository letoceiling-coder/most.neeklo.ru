import crypto from 'node:crypto';
import type pg from 'pg';
import {
  type MessageEvent,
  normalizePhone,
  normalizeUsername,
  sourceTag,
} from '@most/shared';
import { pool } from '../db/pool.js';

/**
 * Finds or creates the unified contact for a message's sender and guarantees
 * the source auto-tag (e.g. "src:telegram") is present. Matching priority:
 *   1. (source, externalId)  — strongest
 *   2. phone (across any source)
 *   3. (source, username)
 */
export async function resolveContact(event: MessageEvent, userId: string): Promise<string> {
  const { sender, source } = event;
  const phone = normalizePhone(sender.phone);
  const username = normalizeUsername(sender.username);
  const externalId = sender.externalId?.trim() || undefined;
  const displayName = sender.name?.trim() || username || phone || 'Без имени';

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    let contactId = await findContact(client, userId, source, externalId, phone, username);

    if (!contactId) {
      const created = await client.query<{ id: string }>(
        `INSERT INTO contacts (id, display_name, tags, user_id) VALUES ($1, $2, $3, $4) RETURNING id`,
        [crypto.randomUUID(), displayName, [sourceTag(source)], userId],
      );
      contactId = created.rows[0].id;
    } else {
      const cur = await client.query<{ tags: string[]; display_name: string }>(
        'SELECT tags, display_name FROM contacts WHERE id = $1',
        [contactId],
      );
      const row = cur.rows[0];
      const newName =
        !row.display_name || row.display_name === 'Без имени' ? displayName : row.display_name;
      const mergedTags = [...new Set([...(row.tags ?? []), sourceTag(source)])];
      await client.query(
        'UPDATE contacts SET display_name = $2, tags = $3, updated_at = now() WHERE id = $1',
        [contactId, newName, mergedTags],
      );
    }

    await upsertIdentity(client, contactId, {
      source,
      externalId,
      username,
      phone,
      name: sender.name,
      avatar: sender.avatar,
    });

    await client.query('COMMIT');
    return contactId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function findContact(
  client: pg.PoolClient,
  userId: string,
  source: string,
  externalId?: string,
  phone?: string,
  username?: string,
): Promise<string | null> {
  if (externalId) {
    const r = await client.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.source = $2 AND ci.external_id = $3 LIMIT 1`,
      [userId, source, externalId],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  if (phone) {
    const r = await client.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.phone = $2 LIMIT 1`,
      [userId, phone],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  if (username) {
    const r = await client.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.source = $2 AND ci.username = $3 LIMIT 1`,
      [userId, source, username],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  return null;
}

async function upsertIdentity(
  client: pg.PoolClient,
  contactId: string,
  identity: {
    source: string;
    externalId?: string;
    username?: string;
    phone?: string;
    name?: string;
    avatar?: string;
  },
): Promise<void> {
  // Try update existing identity row for this contact+source first.
  const existing = await client.query<{ id: string }>(
    `SELECT id FROM contact_identities
     WHERE contact_id = $1 AND source = $2
       AND (($3::text IS NOT NULL AND external_id = $3)
         OR ($3::text IS NULL AND external_id IS NULL))
     LIMIT 1`,
    [contactId, identity.source, identity.externalId ?? null],
  );

  if (existing.rows.length) {
    await client.query(
      `UPDATE contact_identities SET
         username = COALESCE($2, username),
         phone = COALESCE($3, phone),
         name = COALESCE($4, name),
         avatar = COALESCE($5, avatar)
       WHERE id = $1`,
      [
        existing.rows[0].id,
        identity.username ?? null,
        identity.phone ?? null,
        identity.name ?? null,
        identity.avatar ?? null,
      ],
    );
    return;
  }

  await client.query(
    `INSERT INTO contact_identities (id, contact_id, source, external_id, username, phone, name, avatar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT DO NOTHING`,
    [
      crypto.randomUUID(),
      contactId,
      identity.source,
      identity.externalId ?? null,
      identity.username ?? null,
      identity.phone ?? null,
      identity.name ?? null,
      identity.avatar ?? null,
    ],
  );
}
