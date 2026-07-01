import pg from 'pg';
import { config } from '../config.js';
import { createLogger } from '../logger.js';
import { SCHEMA_SQL, SCHEMA_MIGRATION_SQL } from './schema.js';
import { seedUsers } from './seedUsers.js';

const logger = createLogger('db');

let internalPool: pg.Pool | undefined;

function createDefaultPool(): pg.Pool {
  const p = new pg.Pool({ connectionString: config.databaseUrl });
  p.on('error', (err) => {
    logger.error('Unexpected pool error', { error: err.message });
  });
  return p;
}

function getPool(): pg.Pool {
  if (!internalPool) internalPool = createDefaultPool();
  return internalPool;
}

/** Swap the DB pool (used by integration tests with pg-mem). Call before other server imports. */
export function setPoolForTests(p: pg.Pool): void {
  internalPool = p;
}

export const pool: pg.Pool = new Proxy({} as pg.Pool, {
  get(_target, prop) {
    const p = getPool();
    const val = Reflect.get(p, prop, p) as unknown;
    return typeof val === 'function' ? (val as (...a: unknown[]) => unknown).bind(p) : val;
  },
});

export async function ensureSchema(): Promise<void> {
  await pool.query(SCHEMA_SQL);
  await pool.query(SCHEMA_MIGRATION_SQL);
  await seedUsers();
  logger.info('Schema ensured');
}

export async function withRetry<T>(fn: () => Promise<T>, attempts = 10, delayMs = 2000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      logger.warn(`DB not ready (attempt ${i + 1}/${attempts})`, {
        error: (err as Error).message,
      });
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
