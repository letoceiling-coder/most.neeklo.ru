import { pool } from '../db/pool.js';
import { config } from '../config.js';
import { createUser, countUsers, findUserByEmail } from '../repositories/users.js';
import { createLogger } from '../logger.js';

const logger = createLogger('seed');

async function migrateLegacySettings(adminId: string): Promise<void> {
  const keys = ['openrouter', 'enabledSources'];
  for (const key of keys) {
    const legacy = await pool.query<{ value: unknown }>(
      'SELECT value FROM settings WHERE key = $1',
      [key],
    );
    if (!legacy.rows.length) continue;
    const userKey = `u:${adminId}:${key}`;
    const exists = await pool.query('SELECT 1 FROM settings WHERE key = $1', [userKey]);
    if (exists.rows.length) continue;
    await pool.query('INSERT INTO settings (key, value) VALUES ($1, $2)', [
      userKey,
      JSON.stringify(legacy.rows[0].value),
    ]);
  }
}

async function assignOrphanData(adminId: string): Promise<void> {
  await pool.query('UPDATE pcs SET user_id = $1 WHERE user_id IS NULL', [adminId]);
  await pool.query('UPDATE contacts SET user_id = $1 WHERE user_id IS NULL', [adminId]);
  await pool.query('UPDATE webhooks SET user_id = $1 WHERE user_id IS NULL', [adminId]);
}

/** Bootstrap admin + default users; migrate legacy single-tenant data. */
export async function seedUsers(): Promise<void> {
  const n = await countUsers();
  if (n === 0) {
    const adminEmail = config.operator.user.includes('@')
      ? config.operator.user
      : `${config.operator.user}@most.local`;
    await createUser({
      email: adminEmail,
      password: config.operator.password,
      displayName: 'Администратор',
      role: 'admin',
    });
    logger.info('Created admin user', { email: adminEmail });
  }

  let adminId: string | undefined;
  const byEnv = await findUserByEmail(config.operator.user);
  const byLocal = await findUserByEmail(`${config.operator.user}@most.local`);
  if (byEnv) adminId = byEnv.id;
  else if (byLocal) adminId = byLocal.id;
  else {
    const row = await pool.query<{ id: string }>(
      `SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1`,
    );
    adminId = row.rows[0]?.id;
  }

  if (adminId) {
    await assignOrphanData(adminId);
    await migrateLegacySettings(adminId);
  }

  const john = await findUserByEmail('dsc-23@yandex.ru');
  if (!john) {
    await createUser({
      email: 'dsc-23@yandex.ru',
      password: '123123123',
      displayName: 'Джон Уик',
      role: 'admin',
    });
    logger.info('Created admin user dsc-23@yandex.ru');
  } else if (john.role !== 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [john.id]);
    logger.info('Promoted dsc-23@yandex.ru to admin');
  }
}
