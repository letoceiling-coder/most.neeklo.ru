import crypto from 'node:crypto';
import { pool } from '../db/pool.js';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { UserRole } from '../auth/types.js';

/** Cannot be deleted or have enabled/role changed via admin UI/API. */
export const PROTECTED_USER_EMAIL = 'dsc-23@yandex.ru';

export function isProtectedUser(user: { email: string }): boolean {
  return user.email.toLowerCase() === PROTECTED_USER_EMAIL.toLowerCase();
}

export interface UserRow {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  enabled: boolean;
  created_at: Date;
}

export interface UserWithPassword extends UserRow {
  password_hash: string;
}

export async function findUserByEmail(email: string): Promise<UserWithPassword | null> {
  const res = await pool.query<UserWithPassword>(
    `SELECT id, email, password_hash, display_name, role, enabled, created_at
     FROM users WHERE LOWER(email) = LOWER($1) LIMIT 1`,
    [email.trim()],
  );
  return res.rows[0] ?? null;
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const res = await pool.query<UserRow>(
    `SELECT id, email, display_name, role, enabled, created_at FROM users WHERE id = $1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function listUsers(): Promise<UserRow[]> {
  const res = await pool.query<UserRow>(
    `SELECT id, email, display_name, role, enabled, created_at FROM users ORDER BY created_at DESC`,
  );
  return res.rows;
}

export async function createUser(input: {
  email: string;
  password: string;
  displayName: string;
  role?: UserRole;
}): Promise<UserRow> {
  const password_hash = await hashPassword(input.password);
  const res = await pool.query<UserRow>(
    `INSERT INTO users (id, email, password_hash, display_name, role)
     VALUES ($1, LOWER($2), $3, $4, $5)
     RETURNING id, email, display_name, role, enabled, created_at`,
    [
      crypto.randomUUID(),
      input.email.trim(),
      password_hash,
      input.displayName.trim(),
      input.role ?? 'user',
    ],
  );
  return res.rows[0];
}

export async function updateUser(
  id: string,
  patch: { displayName?: string; enabled?: boolean; password?: string; role?: UserRole },
): Promise<void> {
  const user = await findUserById(id);
  if (!user) throw new Error('user not found');

  if (patch.password) {
    const password_hash = await hashPassword(patch.password);
    await pool.query('UPDATE users SET password_hash = $2 WHERE id = $1', [id, password_hash]);
  }
  if (patch.displayName !== undefined) {
    await pool.query('UPDATE users SET display_name = $2 WHERE id = $1', [id, patch.displayName]);
  }
  if (patch.enabled !== undefined) {
    if (isProtectedUser(user)) throw new Error('protected_user');
    await pool.query('UPDATE users SET enabled = $2 WHERE id = $1', [id, patch.enabled]);
  }
  if (patch.role !== undefined) {
    if (isProtectedUser(user)) throw new Error('protected_user');
    await pool.query('UPDATE users SET role = $2 WHERE id = $1', [id, patch.role]);
  }
}

export async function deleteUser(id: string): Promise<void> {
  const user = await findUserById(id);
  if (!user) throw new Error('user not found');
  if (isProtectedUser(user)) throw new Error('protected_user');
  await pool.query('DELETE FROM users WHERE id = $1', [id]);
}

export async function authenticateUser(
  email: string,
  password: string,
): Promise<UserRow | null> {
  const user = await findUserByEmail(email);
  if (!user || !user.enabled) return null;
  const ok = await verifyPassword(password, user.password_hash);
  if (!ok) return null;
  return user;
}

export async function countUsers(): Promise<number> {
  const res = await pool.query<{ n: string }>('SELECT COUNT(*)::text AS n FROM users');
  return Number(res.rows[0]?.n ?? 0);
}
