import crypto from 'node:crypto';
import type { AccountStatus, MessengerSource } from '@most/shared';
import { pool } from '../db/pool.js';
import { config } from '../config.js';

/** Per-PC token = HMAC(sharedSecret, pcId). Deterministic so re-pairing is easy. */
export function deriveToken(pcId: string): string {
  return crypto.createHmac('sha256', config.agentSharedSecret).update(pcId).digest('hex');
}

export function verifyToken(pcId: string, token: string): boolean {
  const expected = deriveToken(pcId);
  const a = Buffer.from(expected);
  const b = Buffer.from(token ?? '');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export interface PcInput {
  id?: string;
  name: string;
  sources?: MessengerSource[];
  userId: string;
}

export async function getPcUserId(pcId: string): Promise<string | null> {
  const res = await pool.query<{ user_id: string }>(
    'SELECT user_id FROM pcs WHERE id = $1',
    [pcId],
  );
  return res.rows[0]?.user_id ?? null;
}

export async function pcBelongsToUser(pcId: string, userId: string): Promise<boolean> {
  const res = await pool.query('SELECT 1 FROM pcs WHERE id = $1 AND user_id = $2', [pcId, userId]);
  return res.rows.length > 0;
}

/** Each user account is limited to one PC. */
export async function countPcsForUser(userId: string): Promise<number> {
  const res = await pool.query<{ n: string }>(
    'SELECT COUNT(*)::text AS n FROM pcs WHERE user_id = $1',
    [userId],
  );
  return Number(res.rows[0]?.n ?? 0);
}

export async function getPcCredentials(
  pcId: string,
  userId: string,
): Promise<{ id: string; name: string; token: string; sources: MessengerSource[] } | null> {
  if (!(await pcBelongsToUser(pcId, userId))) return null;
  const res = await pool.query<{ name: string; sources: MessengerSource[] }>(
    'SELECT name, sources FROM pcs WHERE id = $1 AND user_id = $2',
    [pcId, userId],
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    id: pcId,
    name: row.name,
    token: deriveToken(pcId),
    sources: row.sources ?? [],
  };
}

export async function createPc(input: PcInput): Promise<{ id: string; token: string }> {
  const id = input.id?.trim() || `pc-${crypto.randomBytes(4).toString('hex')}`;
  const token = deriveToken(id);
  await pool.query(
    `INSERT INTO pcs (id, name, token_hash, sources, user_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, user_id = EXCLUDED.user_id`,
    [id, input.name, token, JSON.stringify(input.sources ?? []), input.userId],
  );
  return { id, token };
}

export async function registerHello(
  pcId: string,
  agentVersion: string,
  sources: MessengerSource[],
): Promise<boolean> {
  const exists = await pool.query<{ user_id: string | null }>(
    'SELECT user_id FROM pcs WHERE id = $1',
    [pcId],
  );
  if (!exists.rows.length || !exists.rows[0].user_id) return false;

  await pool.query(
    `UPDATE pcs SET agent_version = $2, sources = $3, last_seen = now() WHERE id = $1`,
    [pcId, agentVersion, JSON.stringify(sources)],
  );
  return true;
}

export async function touchPc(pcId: string): Promise<void> {
  await pool.query('UPDATE pcs SET last_seen = now() WHERE id = $1', [pcId]);
}

export async function listPcs(userId: string, onlineIds: Set<string>): Promise<unknown[]> {
  const res = await pool.query(
    `SELECT id, name, enabled, sources, agent_version, last_seen, created_at
     FROM pcs WHERE user_id = $1 ORDER BY created_at`,
    [userId],
  );
  const pcIds = res.rows.map((pc: { id: string }) => pc.id);
  const accounts =
    pcIds.length > 0
      ? await pool.query(
          `SELECT pc_id, source, account_id, status, detail, last_seen FROM accounts
           WHERE pc_id = ANY($1)`,
          [pcIds],
        )
      : { rows: [] as Array<Record<string, unknown>> };
  return res.rows.map((pc: Record<string, unknown>) => ({
    ...pc,
    online: onlineIds.has(pc.id as string),
    accounts: accounts.rows.filter((a: Record<string, unknown>) => a.pc_id === pc.id),
  }));
}

export async function deletePc(id: string, userId: string): Promise<void> {
  await pool.query('DELETE FROM pcs WHERE id = $1 AND user_id = $2', [id, userId]);
}

export async function upsertAccountStatus(pcId: string, status: AccountStatus): Promise<void> {
  const id = `${pcId}:${status.source}:${status.accountId}`;
  await pool.query(
    `INSERT INTO accounts (id, pc_id, source, account_id, status, detail, last_seen)
     VALUES ($1, $2, $3, $4, $5, $6, now())
     ON CONFLICT (pc_id, source, account_id) DO UPDATE SET
       status = EXCLUDED.status, detail = EXCLUDED.detail, last_seen = now()`,
    [id, pcId, status.source, status.accountId, status.status, status.detail ?? null],
  );
}

export async function listAccounts(userId: string): Promise<unknown[]> {
  const res = await pool.query(
    `SELECT a.pc_id, a.source, a.account_id, a.status, a.detail, a.last_seen
     FROM accounts a
     JOIN pcs p ON p.id = a.pc_id
     WHERE p.user_id = $1
     ORDER BY a.last_seen DESC`,
    [userId],
  );
  return res.rows;
}
