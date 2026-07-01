/** Quick diagnostic for HTTP ingest path (run: node --import tsx scripts/smoke-ingest.mjs) */
process.env.OPERATOR_USER = 'admin';
process.env.OPERATOR_PASSWORD = 'test-pass';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.AGENT_SHARED_SECRET = 'test-agent-secret';
process.env.LOG_LEVEL = 'error';

const { createMemPool } = await import('../packages/server/src/test/memDb.ts');
await createMemPool();
const { createApp } = await import('../packages/server/src/httpServer.ts');
const { deriveToken } = await import('../packages/server/src/repositories/pcs.ts');
const { findUserByEmail } = await import('../packages/server/src/repositories/users.ts');
import http from 'node:http';

const app = createApp();
const server = http.createServer(app);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const admin = await findUserByEmail('admin@most.local');
if (!admin) throw new Error('admin user missing');

const pcId = 'pc-smoke';
const { createPc } = await import('../packages/server/src/repositories/pcs.ts');
await createPc({ id: pcId, name: 'Smoke', userId: admin.id });
const token = deriveToken(pcId);

console.log('1. createPc ok');

const event = {
  id: 'smoke-1',
  source: 'telegram',
  accountId: 'telegram',
  pcId,
  chat: { id: 'c1', title: 'T' },
  sender: { name: 'User' },
  text: 'hello smoke',
  attachments: [],
  direction: 'in',
  ts: new Date().toISOString(),
};

const res = await fetch(`${base}/v1/ingest/events`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Pc-Id': pcId,
    'X-Pc-Token': token,
  },
  body: JSON.stringify(event),
  signal: AbortSignal.timeout(5000),
});
console.log('2. ingest status', res.status, await res.text());

server.close();
console.log('done');
