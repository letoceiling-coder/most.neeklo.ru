const TOKEN_KEY = 'most_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}
export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function req<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...opts, headers });
  if (res.status === 401) {
    clearToken();
    location.reload();
    throw new Error('unauthorized');
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new Error((json.message as string) ?? (json.error as string) ?? res.statusText);
  return json as T;
}

export interface PcRow {
  id: string;
  name: string;
  online: boolean;
  enabled: boolean;
  sources: string[];
  agent_version?: string;
  last_seen?: string;
  accounts: Array<{ source: string; account_id: string; status: string; detail?: string }>;
}

export interface MessageRow {
  id: string;
  source: string;
  account_id: string;
  pc_id: string;
  chat_id: string;
  contact_id?: string;
  chat_title?: string;
  sender_name?: string;
  sender_username?: string;
  text: string;
  direction: string;
  ts: string;
  ai?: { category?: string; tags?: string[]; summary?: string; draftReply?: string };
}

export interface ContactRow {
  contactId: string;
  displayName: string;
  tags: string[];
  identities: Array<{
    source: string;
    username?: string;
    phone?: string;
    name?: string;
  }>;
  updatedAt: string;
}

export interface WebhookRow {
  id: string;
  name: string;
  url: string;
  secret: string;
  events: string[];
  enabled: boolean;
}

export interface UserRow {
  id: string;
  email: string;
  displayName: string;
  role: string;
  enabled: boolean;
  protected?: boolean;
  createdAt?: string;
}

export interface ExcludedFilters {
  phones: string[];
  usernames: string[];
  chats: Array<{ source: string; chatId: string }>;
}

export const api = {
  me: () =>
    req<{ user: { id: string; email: string; displayName: string; role: string } }>('/v1/auth/me'),

  login: (email: string, password: string) =>
    req<{ token: string }>('/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),

  pcs: () => req<{ pcs: PcRow[] }>('/v1/pcs'),
  createPc: (name: string) =>
    req<{
      id: string;
      pcId: string;
      token: string;
      agentJson: Record<string, unknown>;
      publicUrl: string;
    }>('/v1/pcs', {
      method: 'POST',
      body: JSON.stringify({ name }),
    }),
  pcCredentials: (id: string) =>
    req<{
      id: string;
      pcId: string;
      token: string;
      agentJson: Record<string, unknown>;
      publicUrl: string;
    }>(`/v1/pcs/${encodeURIComponent(id)}/credentials`),
  deletePc: (id: string) => req(`/v1/pcs/${id}`, { method: 'DELETE' }),
  accounts: () => req<{ accounts: unknown[] }>('/v1/accounts'),

  messages: (params: Record<string, string>) =>
    req<{ messages: MessageRow[] }>(`/v1/messages?${new URLSearchParams(params)}`),

  contacts: (params: Record<string, string>) =>
    req<{ contacts: ContactRow[] }>(`/v1/contacts?${new URLSearchParams(params)}`),
  addTag: (id: string, tag: string) =>
    req(`/v1/contacts/${id}/tags`, { method: 'POST', body: JSON.stringify({ tag }) }),
  removeTag: (id: string, tag: string) =>
    req(`/v1/contacts/${id}/tags/${encodeURIComponent(tag)}`, { method: 'DELETE' }),

  webhooks: () => req<{ webhooks: WebhookRow[] }>('/v1/webhooks'),
  createWebhook: (url: string, name: string) =>
    req<{ webhook: WebhookRow }>('/v1/webhooks', {
      method: 'POST',
      body: JSON.stringify({ url, name }),
    }),
  toggleWebhook: (id: string, enabled: boolean) =>
    req(`/v1/webhooks/${id}`, { method: 'PATCH', body: JSON.stringify({ enabled }) }),
  deleteWebhook: (id: string) => req(`/v1/webhooks/${id}`, { method: 'DELETE' }),
  testWebhook: (id: string) => req(`/v1/webhooks/${id}/test`, { method: 'POST' }),
  deliveries: () => req<{ deliveries: unknown[] }>('/v1/webhooks/deliveries/recent'),

  settings: () =>
    req<{
      openrouter: { model: string; enabled: boolean; hasKey: boolean };
      sources: string[];
      excludedFilters: ExcludedFilters;
    }>('/v1/settings'),
  saveOpenRouter: (body: { apiKey?: string; model?: string; enabled?: boolean }) =>
    req('/v1/settings/openrouter', { method: 'PUT', body: JSON.stringify(body) }),
  saveSources: (sources: string[]) =>
    req('/v1/settings/sources', { method: 'PUT', body: JSON.stringify({ sources }) }),
  saveExclusions: (excludedFilters: ExcludedFilters) =>
    req('/v1/settings/exclusions', { method: 'PUT', body: JSON.stringify(excludedFilters) }),

  replyToMessage: (messageId: string, text: string) =>
    req<{ ok: boolean }>(`/v1/messages/${encodeURIComponent(messageId)}/reply`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  setContactExcluded: (contactId: string, excluded: boolean) =>
    req(`/v1/contacts/${encodeURIComponent(contactId)}/exclude`, {
      method: 'POST',
      body: JSON.stringify({ excluded }),
    }),

  users: () => req<{ users: UserRow[] }>('/v1/users'),
  createUser: (body: { email: string; password: string; displayName: string }) =>
    req('/v1/users', { method: 'POST', body: JSON.stringify(body) }),
  updateUser: (id: string, body: { enabled?: boolean; password?: string; displayName?: string }) =>
    req(`/v1/users/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteUser: (id: string) => req(`/v1/users/${id}`, { method: 'DELETE' }),
};
