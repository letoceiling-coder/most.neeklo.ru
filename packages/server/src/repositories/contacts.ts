import type { Contact, ContactIdentity } from '@most/shared';
import { type MessageEvent, normalizePhone, normalizeUsername } from '@most/shared';
import { pool } from '../db/pool.js';

interface ContactRow {
  id: string;
  display_name: string;
  tags: string[];
  created_at: Date;
  updated_at: Date;
}

interface IdentityRow {
  source: string;
  external_id: string | null;
  username: string | null;
  phone: string | null;
  name: string | null;
  avatar: string | null;
}

function toContact(row: ContactRow, identities: IdentityRow[]): Contact {
  return {
    contactId: row.id,
    displayName: row.display_name,
    tags: row.tags,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    identities: identities.map(
      (i): ContactIdentity => ({
        source: i.source as ContactIdentity['source'],
        externalId: i.external_id ?? undefined,
        username: i.username ?? undefined,
        phone: i.phone ?? undefined,
        name: i.name ?? undefined,
        avatar: i.avatar ?? undefined,
      }),
    ),
  };
}

export async function listContacts(opts: {
  userId: string;
  search?: string;
  tag?: string;
  limit?: number;
  offset?: number;
}): Promise<Contact[]> {
  const limit = Math.min(opts.limit ?? 50, 200);
  const offset = opts.offset ?? 0;
  const params: unknown[] = [opts.userId];
  const where: string[] = ['c.user_id = $1'];

  if (opts.search) {
    params.push(`%${opts.search.toLowerCase()}%`);
    where.push(`(LOWER(c.display_name) LIKE $${params.length}
      OR EXISTS (SELECT 1 FROM contact_identities i WHERE i.contact_id = c.id
        AND (LOWER(COALESCE(i.username,'')) LIKE $${params.length}
          OR LOWER(COALESCE(i.name,'')) LIKE $${params.length}
          OR COALESCE(i.phone,'') LIKE $${params.length})))`);
  }
  if (opts.tag) {
    params.push(opts.tag);
    where.push(`$${params.length} = ANY(c.tags)`);
  }

  const whereSql = `WHERE ${where.join(' AND ')}`;
  params.push(limit, offset);
  const res = await pool.query<ContactRow>(
    `SELECT c.* FROM contacts c ${whereSql}
     ORDER BY c.updated_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`,
    params,
  );
  const ids = res.rows.map((r) => r.id);
  const idents = ids.length
    ? await pool.query<IdentityRow & { contact_id: string }>(
        `SELECT * FROM contact_identities WHERE contact_id = ANY($1)`,
        [ids],
      )
    : { rows: [] as Array<IdentityRow & { contact_id: string }> };
  return res.rows.map((row) =>
    toContact(
      row,
      idents.rows.filter((i) => i.contact_id === row.id),
    ),
  );
}

export async function getContact(id: string, userId: string): Promise<Contact | null> {
  const res = await pool.query<ContactRow>(
    'SELECT * FROM contacts WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  if (!res.rows.length) return null;
  const idents = await pool.query<IdentityRow>(
    'SELECT * FROM contact_identities WHERE contact_id = $1',
    [id],
  );
  return toContact(res.rows[0], idents.rows);
}

export async function contactHasTag(id: string, tag: string, userId: string): Promise<boolean> {
  const res = await pool.query<{ tags: string[] }>(
    'SELECT tags FROM contacts WHERE id = $1 AND user_id = $2',
    [id, userId],
  );
  return res.rows[0]?.tags?.includes(tag) ?? false;
}

/** Lookup existing contact without creating (for ingest filters). */
export async function findExistingContactId(
  event: MessageEvent,
  userId: string,
): Promise<string | null> {
  const phone = normalizePhone(event.sender.phone);
  const username = normalizeUsername(event.sender.username);
  const externalId = event.sender.externalId?.trim() || undefined;
  if (externalId) {
    const r = await pool.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.source = $2 AND ci.external_id = $3 LIMIT 1`,
      [userId, event.source, externalId],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  if (phone) {
    const r = await pool.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.phone = $2 LIMIT 1`,
      [userId, phone],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  if (username) {
    const r = await pool.query<{ contact_id: string }>(
      `SELECT ci.contact_id FROM contact_identities ci
       JOIN contacts c ON c.id = ci.contact_id
       WHERE c.user_id = $1 AND ci.source = $2 AND ci.username = $3 LIMIT 1`,
      [userId, event.source, username],
    );
    if (r.rows.length) return r.rows[0].contact_id;
  }
  return null;
}

export async function addTag(id: string, tag: string, userId?: string): Promise<void> {
  const cur = await pool.query<{ tags: string[] }>(
    userId
      ? 'SELECT tags FROM contacts WHERE id = $1 AND user_id = $2'
      : 'SELECT tags FROM contacts WHERE id = $1',
    userId ? [id, userId] : [id],
  );
  if (!cur.rows.length) return;
  const merged = [...new Set([...(cur.rows[0]?.tags ?? []), tag])];
  await pool.query('UPDATE contacts SET tags = $2, updated_at = now() WHERE id = $1', [id, merged]);
}

export async function removeTag(id: string, tag: string, userId: string): Promise<void> {
  await pool.query(
    `UPDATE contacts SET tags = array_remove(tags, $2), updated_at = now()
     WHERE id = $1 AND user_id = $3`,
    [id, tag, userId],
  );
}

/** Move all identities/messages/tags from source contact into target, delete source. */
export async function mergeContacts(
  targetId: string,
  sourceId: string,
  userId: string,
): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const owned = await client.query(
      'SELECT 1 FROM contacts WHERE id = ANY($1::uuid[]) AND user_id = $2',
      [[targetId, sourceId], userId],
    );
    if ((owned.rowCount ?? 0) < 2) throw new Error('contacts not found');
    await client.query('UPDATE contact_identities SET contact_id = $1 WHERE contact_id = $2', [
      targetId,
      sourceId,
    ]);
    await client.query('UPDATE messages SET contact_id = $1 WHERE contact_id = $2', [
      targetId,
      sourceId,
    ]);
    const tagsRes = await client.query<{ tags: string[] }>(
      'SELECT tags FROM contacts WHERE id = ANY($1::uuid[])',
      [[targetId, sourceId]],
    );
    const mergedTags = [
      ...new Set(tagsRes.rows.flatMap((r) => r.tags ?? [])),
    ];
    await client.query('UPDATE contacts SET tags = $2, updated_at = now() WHERE id = $1', [
      targetId,
      mergedTags,
    ]);
    await client.query('DELETE FROM contacts WHERE id = $1', [sourceId]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
