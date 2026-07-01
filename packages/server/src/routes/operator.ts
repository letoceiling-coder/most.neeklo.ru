import { Router, type Request, type Response } from 'express';
import type { MessengerSource } from '@most/shared';
import { EXCLUDE_CONTACT_TAG } from '@most/shared';
import { requireOperator, requireAdmin } from '../auth/auth.js';
import { getAuthUser } from '../auth/types.js';
import { config } from '../config.js';
import { hub } from '../wsHub.js';
import * as contacts from '../repositories/contacts.js';
import { listMessages, getMessageForReply } from '../repositories/messages.js';
import * as pcs from '../repositories/pcs.js';
import * as webhooks from '../repositories/webhooks.js';
import * as settings from '../repositories/settings.js';
import * as users from '../repositories/users.js';

function userErrorStatus(err: unknown): number {
  const msg = (err as Error).message;
  if (msg === 'protected_user') return 403;
  if (msg === 'user not found') return 404;
  return 400;
}

export const operatorRouter = Router();
operatorRouter.use(requireOperator);

// ----- Users (admin) -----
operatorRouter.get('/users', requireAdmin, async (_req: Request, res: Response) => {
  const rows = await users.listUsers();
  res.json({
    users: rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.display_name,
      role: u.role,
      enabled: u.enabled,
      createdAt: u.created_at,
      protected: users.isProtectedUser(u),
    })),
  });
});

operatorRouter.post('/users', requireAdmin, async (req: Request, res: Response) => {
  const email = String(req.body?.email ?? '').trim();
  const password = String(req.body?.password ?? '');
  const displayName = String(req.body?.displayName ?? req.body?.name ?? '').trim();
  if (!email || !password || !displayName) {
    res.status(400).json({ error: 'email, password, displayName required' });
    return;
  }
  try {
    const created = await users.createUser({
      email,
      password,
      displayName,
      role: req.body?.role === 'admin' ? 'admin' : 'user',
    });
    res.json({
      user: {
        id: created.id,
        email: created.email,
        displayName: created.display_name,
        role: created.role,
        enabled: created.enabled,
      },
    });
  } catch (err) {
    res.status(400).json({ error: (err as Error).message });
  }
});

operatorRouter.patch('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await users.updateUser(req.params.id, {
      displayName:
        req.body?.displayName !== undefined ? String(req.body.displayName) : undefined,
      enabled: req.body?.enabled !== undefined ? Boolean(req.body.enabled) : undefined,
      password: req.body?.password ? String(req.body.password) : undefined,
      role: req.body?.role === 'admin' || req.body?.role === 'user' ? req.body.role : undefined,
    });
    res.json({ ok: true });
  } catch (err) {
    res.status(userErrorStatus(err)).json({ error: (err as Error).message });
  }
});

operatorRouter.delete('/users/:id', requireAdmin, async (req: Request, res: Response) => {
  try {
    await users.deleteUser(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(userErrorStatus(err)).json({ error: (err as Error).message });
  }
});

// ----- Contacts -----
operatorRouter.get('/contacts', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const list = await contacts.listContacts({
    userId: user.id,
    search: req.query.search as string | undefined,
    tag: req.query.tag as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json({ contacts: list });
});

operatorRouter.get('/contacts/:id', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const contact = await contacts.getContact(req.params.id, user.id);
  if (!contact) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  res.json({ contact });
});

operatorRouter.post('/contacts/:id/tags', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const tag = String(req.body?.tag ?? '').trim();
  if (!tag) {
    res.status(400).json({ error: 'tag required' });
    return;
  }
  await contacts.addTag(req.params.id, tag, user.id);
  res.json({ ok: true });
});

operatorRouter.delete('/contacts/:id/tags/:tag', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  await contacts.removeTag(req.params.id, req.params.tag, user.id);
  res.json({ ok: true });
});

operatorRouter.post('/contacts/merge', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { targetId, sourceId } = req.body ?? {};
  if (!targetId || !sourceId || targetId === sourceId) {
    res.status(400).json({ error: 'targetId and sourceId required' });
    return;
  }
  await contacts.mergeContacts(targetId, sourceId, user.id);
  res.json({ ok: true });
});

// ----- Messages -----
operatorRouter.get('/messages', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const rows = await listMessages({
    userId: user.id,
    source: req.query.source as string | undefined,
    accountId: req.query.accountId as string | undefined,
    contactId: req.query.contactId as string | undefined,
    search: req.query.search as string | undefined,
    limit: req.query.limit ? Number(req.query.limit) : undefined,
    offset: req.query.offset ? Number(req.query.offset) : undefined,
  });
  res.json({ messages: rows });
});

operatorRouter.post('/messages/:id/reply', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const text = String(req.body?.text ?? '').trim();
  if (!text) {
    res.status(400).json({ error: 'text required' });
    return;
  }
  const msg = await getMessageForReply(req.params.id, user.id);
  if (!msg) {
    res.status(404).json({ error: 'message not found' });
    return;
  }
  const sent = hub.sendCommand(msg.pc_id, {
    t: 'command.reply',
    source: msg.source as MessengerSource,
    accountId: msg.account_id,
    chatId: msg.chat_id,
    text,
  });
  if (!sent) {
    res.status(503).json({ error: 'PC offline — агент не подключён' });
    return;
  }
  res.json({ ok: true });
});

operatorRouter.post('/contacts/:id/exclude', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const excluded = req.body?.excluded !== false;
  const contact = await contacts.getContact(req.params.id, user.id);
  if (!contact) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  if (excluded) {
    await contacts.addTag(req.params.id, EXCLUDE_CONTACT_TAG, user.id);
  } else {
    await contacts.removeTag(req.params.id, EXCLUDE_CONTACT_TAG, user.id);
  }
  res.json({ ok: true, excluded });
});

// ----- PCs / accounts -----
operatorRouter.get('/pcs', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  res.json({ pcs: await pcs.listPcs(user.id, hub.onlineIds()) });
});

operatorRouter.post('/pcs', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const name = String(req.body?.name ?? '').trim();
  if (!name) {
    res.status(400).json({ error: 'name required' });
    return;
  }
  const pcCount = await pcs.countPcsForUser(user.id);
  if (pcCount >= 1) {
    res.status(400).json({
      error: 'one_pc_per_user',
      message: 'У каждого аккаунта может быть только один ПК. Удалите текущий, чтобы создать новый.',
    });
    return;
  }
  const userSources = await settings.getEnabledSources(user.id);
  const created = await pcs.createPc({
    name,
    id: typeof req.body?.id === 'string' ? req.body.id : undefined,
    sources: req.body?.sources ?? userSources,
    userId: user.id,
  });
  res.json(buildPcSetupPayload(created.id, created.token, userSources));
});

function buildPcSetupPayload(
  pcId: string,
  token: string,
  sources: MessengerSource[],
): Record<string, unknown> {
  const host = new URL(config.publicUrl).host;
  const wsProto = config.publicUrl.startsWith('https') ? 'wss' : 'ws';
  const agentJson = {
    pcId,
    token,
    vpsWsUrl: `${wsProto}://${host}/agent`,
    vpsHttpUrl: config.publicUrl,
    chromeCdpEndpoint: 'http://127.0.0.1:9222',
    agentVersion: '1.0.0',
    useCdpLock: false,
    sources,
  };
  return { id: pcId, pcId, token, agentJson, publicUrl: config.publicUrl };
}

operatorRouter.get('/pcs/:id/credentials', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const row = await pcs.getPcCredentials(req.params.id, user.id);
  if (!row) {
    res.status(404).json({ error: 'pc not found' });
    return;
  }
  const sources =
    row.sources.length > 0 ? row.sources : await settings.getEnabledSources(user.id);
  res.json(buildPcSetupPayload(row.id, row.token, sources));
});

operatorRouter.delete('/pcs/:id', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  await pcs.deletePc(req.params.id, user.id);
  res.json({ ok: true });
});

operatorRouter.post('/pcs/:id/command', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const { type } = req.body ?? {};
  const pcId = req.params.id;
  if (!(await pcs.pcBelongsToUser(pcId, user.id))) {
    res.status(404).json({ error: 'pc not found' });
    return;
  }
  let sent = false;
  if (type === 'reply') {
    sent = hub.sendCommand(pcId, {
      t: 'command.reply',
      source: req.body.source,
      accountId: req.body.accountId,
      chatId: req.body.chatId,
      text: req.body.text,
    });
  } else if (type === 'refresh') {
    sent = hub.sendCommand(pcId, {
      t: 'command.refresh',
      source: req.body.source,
      accountId: req.body.accountId,
    });
  } else if (type === 'set_sources') {
    sent = hub.sendCommand(pcId, {
      t: 'command.set_sources',
      sources: req.body.sources as MessengerSource[],
    });
  } else {
    res.status(400).json({ error: 'unknown command type' });
    return;
  }
  res.json({ ok: sent, online: sent });
});

operatorRouter.get('/accounts', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  res.json({ accounts: await pcs.listAccounts(user.id) });
});

// ----- Webhooks -----
operatorRouter.get('/webhooks', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  res.json({ webhooks: await webhooks.listWebhooks(user.id) });
});

operatorRouter.post('/webhooks', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const url = String(req.body?.url ?? '').trim();
  if (!url) {
    res.status(400).json({ error: 'url required' });
    return;
  }
  const created = await webhooks.createWebhook({
    userId: user.id,
    name: req.body?.name,
    url,
    events: req.body?.events,
  });
  res.json({ webhook: created });
});

operatorRouter.patch('/webhooks/:id', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  await webhooks.setWebhookEnabled(req.params.id, user.id, Boolean(req.body?.enabled));
  res.json({ ok: true });
});

operatorRouter.delete('/webhooks/:id', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  await webhooks.deleteWebhook(req.params.id, user.id);
  res.json({ ok: true });
});

operatorRouter.post('/webhooks/:id/test', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const list = await webhooks.listWebhooks(user.id);
  if (!list.some((w) => w.id === req.params.id)) {
    res.status(404).json({ error: 'not found' });
    return;
  }
  await webhooks.enqueueDelivery({
    webhookId: req.params.id,
    messageId: null,
    event: 'test',
  });
  res.json({ ok: true });
});

operatorRouter.get('/webhooks/deliveries/recent', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  res.json({ deliveries: await webhooks.listRecentDeliveries(user.id) });
});

// ----- Settings -----
operatorRouter.get('/settings', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const openrouter = await settings.getOpenRouterSettings(user.id);
  const sources = await settings.getEnabledSources(user.id);
  const excludedFilters = await settings.getExcludedFilters(user.id);
  res.json({
    openrouter: { model: openrouter.model, enabled: openrouter.enabled, hasKey: Boolean(openrouter.apiKey) },
    sources,
    excludedFilters,
  });
});

operatorRouter.put('/settings/openrouter', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const current = await settings.getOpenRouterSettings(user.id);
  await settings.setSetting(user.id, 'openrouter', {
    apiKey: req.body?.apiKey ? String(req.body.apiKey) : current.apiKey,
    model: req.body?.model ? String(req.body.model) : current.model,
    enabled: req.body?.enabled !== undefined ? Boolean(req.body.enabled) : current.enabled,
  });
  res.json({ ok: true });
});

operatorRouter.put('/settings/sources', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const src = Array.isArray(req.body?.sources) ? req.body.sources : [];
  await settings.setSetting(user.id, 'enabledSources', src);
  res.json({ ok: true });
});

operatorRouter.put('/settings/exclusions', async (req: Request, res: Response) => {
  const user = getAuthUser(req);
  const body = req.body ?? {};
  await settings.setExcludedFilters(user.id, {
    phones: Array.isArray(body.phones) ? body.phones.map(String) : [],
    usernames: Array.isArray(body.usernames) ? body.usernames.map(String) : [],
    chats: Array.isArray(body.chats)
      ? body.chats.map((c: { source?: string; chatId?: string }) => ({
          source: String(c.source ?? ''),
          chatId: String(c.chatId ?? ''),
        }))
      : [],
  });
  res.json({ ok: true });
});
