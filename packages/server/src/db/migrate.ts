import { ensureSchema, pool, withRetry } from './pool.js';
import { createLogger } from '../logger.js';

const logger = createLogger('migrate');

async function main(): Promise<void> {
  await withRetry(() => ensureSchema());
  logger.info('Migration complete');
  await pool.end();
}

main().catch((err) => {
  logger.error('Migration failed', { error: (err as Error).message });
  process.exit(1);
});
