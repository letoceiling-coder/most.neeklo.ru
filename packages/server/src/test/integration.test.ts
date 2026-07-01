import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { after, before, describe, it } from 'node:test';
import WebSocket from 'ws';

// Must be set before any server module loads (ESM hoists static imports).
process.env.OPERATOR_USER = 'admin';
process.env.OPERATOR_PASSWORD = 'test-pass';
process.env.SESSION_SECRET = 'test-session-secret';
process.env.AGENT_SHARED_SECRET = 'test-agent-secret';
process.env.PUBLIC_URL = 'http://localhost:30999';
process.env.LOG_LEVEL = 'error';

const { createMemPool } = await import('./memDb.js');
await createMemPool();

const { createApp } = await import('../httpServer.js');
const { pool } = await import('../db/pool.js');
const { hub } = await import('../wsHub.js');
const { deriveToken } = await import('../repositories/pcs.js');
const { dispatcher, flushWebhookDeliveries } = await import('../webhooks/Dispatcher.js');

let server: http.Server;
let baseUrl: string;
let operatorToken: string;

before(async () => {
  const app = createApp();
  server = http.createServer(app);
  hub.attach(server);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 30999;
  baseUrl = `http://127.0.0.1:${port}`;

  const loginRes = await fetch(`${baseUrl}/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@most.local', password: 'test-pass' }),
  });
  assert.equal(loginRes.status, 200, 'operator login must succeed in before()');
  const loginJson = (await loginRes.json()) as { token: string };
  operatorToken = loginJson.token;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  dispatcher.stop();
  await pool.end();
});

async function api(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${operatorToken}`,
    Connection: 'close',
    ...(opts.headers as Record<string, string>),
  };
  return fetch(`${baseUrl}${path}`, {
    ...opts,
    headers,
    signal: opts.signal ?? AbortSignal.timeout(10_000),
  });
}

async function resetUserPc(id: string, name: string): Promise<void> {
  const list = await api('/v1/pcs');
  const { pcs } = (await list.json()) as { pcs: Array<{ id: string }> };
  for (const p of pcs) {
    await api(`/v1/pcs/${p.id}`, { method: 'DELETE' });
  }
  const res = await api('/v1/pcs', {
    method: 'POST',
    body: JSON.stringify({ name, id }),
  });
  assert.equal(res.status, 200);
}

describe('Most server integration', () => {
  it('GET /health returns ok', async () => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ok: boolean; service: string };
    assert.equal(body.ok, true);
    assert.equal(body.service, 'most-server');
  });

  it('POST /v1/auth/login rejects bad password', async () => {
    const res = await fetch(`${baseUrl}/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@most.local', password: 'wrong' }),
    });
    assert.equal(res.status, 401);
  });

  it('POST /v1/pcs creates PC with deterministic token', async () => {
    await resetUserPc('pc-test-1', 'Test PC');
    const cred = await api('/v1/pcs/pc-test-1/credentials');
    assert.equal(cred.status, 200);
    const body = (await cred.json()) as { token: string };
    assert.equal(body.token, deriveToken('pc-test-1'));
  });

  it('POST /v1/pcs rejects second PC per user', async () => {
    const res = await api('/v1/pcs', {
      method: 'POST',
      body: JSON.stringify({ name: 'Second PC' }),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: string };
    assert.equal(body.error, 'one_pc_per_user');
  });

  it('Ingest pipeline deduplicates messages and tags contacts', async () => {
    const { ingestMessage } = await import('../ingest/IngestService.js');
    const pcId = 'pc-http-ingest';
    await resetUserPc(pcId, 'HTTP PC');

    const event = {
      id: 'msg-http-1',
      source: 'whatsapp' as const,
      accountId: 'whatsapp',
      pcId,
      chat: { id: 'wa1', title: 'Клиент' },
      sender: { name: 'Клиент', phone: '+79998887766' },
      text: 'Здравствуйте',
      attachments: [],
      direction: 'in' as const,
      ts: new Date().toISOString(),
    };

    const first = await ingestMessage(event);
    assert.equal(first.inserted, true);
    const second = await ingestMessage(event);
    assert.equal(second.inserted, false);
  });

  it('WS agent hello + message ingest + contact dedup', async () => {
    const pcId = 'pc-test-ws';
    const token = deriveToken(pcId);
    await resetUserPc(pcId, 'WS PC');

    const wsUrl = baseUrl.replace('http', 'ws') + '/agent';
    const ws = await new Promise<WebSocket>((resolve, reject) => {
      const sock = new WebSocket(wsUrl);
      sock.on('open', () => resolve(sock));
      sock.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('WS welcome timeout')), 5000);
      ws.once('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { t: string };
        if (msg.t === 'welcome') {
          clearTimeout(timer);
          resolve();
        }
      });
      ws.send(
        JSON.stringify({
          t: 'hello',
          pcId,
          token,
          agentVersion: 'test',
          sources: ['telegram'],
        }),
      );
    });

    const event = {
      id: 'msg-001',
      source: 'telegram',
      accountId: 'telegram',
      pcId,
      chat: { id: 'chat1', title: 'Иван', kind: 'private' as const },
      sender: { externalId: 'u123', name: 'Иван', username: 'ivan_test', phone: '+7 900 111-22-33' },
      text: 'Привет, нужна консультация',
      attachments: [],
      direction: 'in' as const,
      ts: new Date().toISOString(),
    };

    ws.send(JSON.stringify({ t: 'event.message', event }));
    await new Promise((r) => setTimeout(r, 400));
    await new Promise<void>((resolve) => {
      ws.once('close', () => resolve());
      ws.close();
    });

    const msgRes = await api('/v1/messages');
    assert.equal(msgRes.status, 200);
    const msgBody = (await msgRes.json()) as { messages: Array<{ text: string; source: string }> };
    assert.ok(Array.isArray(msgBody.messages));
    assert.ok(msgBody.messages.some((m) => m.text === event.text && m.source === 'telegram'));

    const contactRes = await api('/v1/contacts');
    assert.equal(contactRes.status, 200);
    const contactBody = (await contactRes.json()) as {
      contacts: Array<{ displayName: string; tags: string[] }>;
    };
    assert.ok(contactBody.contacts.length >= 1);
    assert.ok(contactBody.contacts[0].tags.includes('src:telegram'));
  });

  it('Webhooks: create, enqueue test delivery, HMAC signature', async () => {
    let receivedSig = '';
    let receivedBody = '';
    const hookServer = http.createServer((req, res) => {
      receivedSig = String(req.headers['x-most-signature'] ?? '');
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c));
      req.on('end', () => {
        receivedBody = Buffer.concat(chunks).toString('utf8');
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise<void>((resolve) => hookServer.listen(0, '127.0.0.1', () => resolve()));
    const hookPort = (hookServer.address() as { port: number }).port;
    const hookUrl = `http://127.0.0.1:${hookPort}/hook`;

    const createRes = await api('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({ name: 'test-hook', url: hookUrl }),
    });
    assert.equal(createRes.status, 200);
    const { webhook } = (await createRes.json()) as { webhook: { id: string; secret: string } };

    await api(`/v1/webhooks/${webhook.id}/test`, { method: 'POST' }).then((r) => r.json());

    await flushWebhookDeliveries();

    assert.ok(receivedBody.length > 0, 'webhook should have been called');
    const expected = crypto
      .createHmac('sha256', webhook.secret)
      .update(receivedBody)
      .digest('hex');
    assert.equal(receivedSig, `sha256=${expected}`);

    await new Promise<void>((resolve) => hookServer.close(() => resolve()));
  });

  it('GET /v1/pcs shows online agent after WS connect', async () => {
    const pcId = 'pc-online-check';
    const token = deriveToken(pcId);
    await resetUserPc(pcId, 'Online PC');
    const ws = new WebSocket(baseUrl.replace('http', 'ws') + '/agent');
    await new Promise<void>((resolve, reject) => {
      ws.on('open', () => {
        ws.send(
          JSON.stringify({
            t: 'hello',
            pcId,
            token,
            agentVersion: 'test',
            sources: ['vk'],
          }),
        );
      });
      ws.on('message', (raw) => {
        const msg = JSON.parse(raw.toString()) as { t: string };
        if (msg.t === 'welcome') resolve();
      });
      setTimeout(() => reject(new Error('timeout')), 5000);
    });

    const res = await api('/v1/pcs');
    const body = (await res.json()) as { pcs: Array<{ id: string; online: boolean }> };
    const pc = body.pcs.find((p) => p.id === pcId);
    assert.ok(pc?.online, 'PC should be online via WS');
    ws.close();
  });
});
