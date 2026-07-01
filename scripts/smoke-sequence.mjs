/** Simulates integration test 4 then 5 sequence */
process.env.OPERATOR_USER = 'admin';
process.env.OPERATOR_PASSWORD = 'test-pass';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.AGENT_SHARED_SECRET = 'test-agent-secret';
process.env.LOG_LEVEL = 'error';

import http from 'node:http';
import WebSocket from 'ws';

const { createMemPool } = await import('../packages/server/src/test/memDb.ts');
await createMemPool();
const { createApp } = await import('../packages/server/src/httpServer.ts');
const { hub } = await import('../packages/server/src/wsHub.ts');
const { deriveToken } = await import('../packages/server/src/repositories/pcs.ts');

const app = createApp();
const server = http.createServer(app);
hub.attach(server);
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;
const base = `http://127.0.0.1:${port}`;

const login = await fetch(`${base}/v1/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'admin@most.local', password: 'test-pass' }),
});
const { token: opToken } = await login.json();

// Test 4-like WS flow
const pcId = 'pc-test-ws';
await fetch(`${base}/v1/pcs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
  body: JSON.stringify({ id: pcId, name: 'WS PC' }),
});
const ws = new WebSocket(`ws://127.0.0.1:${port}/agent`);
await new Promise((resolve, reject) => {
  ws.on('open', () => {
    ws.send(JSON.stringify({ t: 'hello', pcId, token: deriveToken(pcId), agentVersion: 't', sources: ['telegram'] }));
  });
  ws.on('message', (raw) => {
    if (JSON.parse(raw.toString()).t === 'welcome') resolve(undefined);
  });
  ws.on('error', reject);
  setTimeout(() => reject(new Error('ws timeout')), 5000);
});
ws.send(JSON.stringify({ t: 'event.message', event: {
  id: 'm1', source: 'telegram', accountId: 'telegram', pcId,
  chat: { id: 'c1' }, sender: { name: 'A' }, text: 'hi', attachments: [], direction: 'in', ts: new Date().toISOString(),
}}));
await new Promise((r) => setTimeout(r, 300));
await new Promise((resolve) => { ws.once('close', () => resolve()); ws.close(); });
console.log('ws phase ok');

// Test 5-like HTTP ingest
const pc2 = 'pc-http-ingest';
const pcRes = await fetch(`${base}/v1/pcs`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${opToken}` },
  body: JSON.stringify({ id: pc2, name: 'HTTP PC' }),
  signal: AbortSignal.timeout(5000),
});
console.log('create pc status', pcRes.status, await pcRes.text());

const ingest = await fetch(`${base}/v1/ingest/events`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'X-Pc-Id': pc2, 'X-Pc-Token': deriveToken(pc2) },
  body: JSON.stringify({ id: 'm2', source: 'whatsapp', accountId: 'whatsapp', pcId: pc2, chat: { id: 'w1' }, sender: { name: 'B' }, text: 'hey', attachments: [], direction: 'in', ts: new Date().toISOString() }),
  signal: AbortSignal.timeout(5000),
});
console.log('ingest status', ingest.status, await ingest.text());

server.close();
console.log('done');
