import http from 'node:http';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { createApp } from './httpServer.js';
import { ensureSchema, pool, withRetry } from './db/pool.js';
import { hub } from './wsHub.js';
import { dispatcher } from './webhooks/Dispatcher.js';

const logger = createLogger('main');

async function main(): Promise<void> {
  await withRetry(() => ensureSchema());

  const app = createApp();
  const server = http.createServer(app);
  hub.attach(server);
  dispatcher.start();

  server.listen(config.port, config.host, () => {
    logger.info(`Most server on http://${config.host}:${config.port}`);
    logger.info(`WS agents: ws://${config.host}:${config.port}/agent`);
  });

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down');
    dispatcher.stop();
    server.close();
    await pool.end().catch(() => undefined);
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Fatal startup error', { error: (err as Error).message });
  process.exit(1);
});
