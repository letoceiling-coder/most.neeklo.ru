import { loadConfig } from './config.js';
import { AgentCore } from './AgentCore.js';
import { createLogger } from './logger.js';

const logger = createLogger('agent');

async function main(): Promise<void> {
  const config = loadConfig();
  logger.info('Starting Most agent', {
    pcId: config.pcId,
    sources: config.sources,
    vps: config.vpsWsUrl,
  });

  const core = new AgentCore(config);
  await core.start();

  const shutdown = async (): Promise<void> => {
    logger.info('Shutting down agent');
    await core.stop();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.error('Fatal agent error', { error: (err as Error).message });
  process.exit(1);
});
