import { newDb, type IMemoryDb } from 'pg-mem';
import pg from 'pg';
import { SCHEMA_SQL, SCHEMA_MIGRATION_SQL } from '../db/schema.js';
import { seedUsers } from '../db/seedUsers.js';
import { setPoolForTests } from '../db/pool.js';

/** In-memory PostgreSQL for integration tests (no Docker required). */
export async function createMemPool(): Promise<{ db: IMemoryDb; pool: pg.Pool }> {
  const db = newDb();
  let uuidSeq = 0;

  db.public.registerFunction({
    name: 'gen_random_uuid',
    returns: 'uuid' as never,
    // pg-mem can collide on DEFAULT gen_random_uuid(); use a monotonic unique id.
    implementation: () => {
      uuidSeq += 1;
      const hex = uuidSeq.toString(16).padStart(12, '0');
      return `${hex.slice(0, 8)}-0000-4000-8000-${hex.slice(0, 12)}`;
    },
  });

  const schema = SCHEMA_SQL.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";\s*/i, '');
  db.public.none(schema);

  const { Pool } = db.adapters.createPg();
  const pool = new Pool();
  setPoolForTests(pool);
  await pool.query(SCHEMA_MIGRATION_SQL);
  await seedUsers();
  return { db, pool };
}
