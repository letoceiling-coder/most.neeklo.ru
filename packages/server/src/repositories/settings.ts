import { pool } from '../db/pool.js';

import { config } from '../config.js';

import { MESSENGER_SOURCES, type MessengerSource } from '@most/shared';



function userKey(userId: string, key: string): string {

  return `u:${userId}:${key}`;

}



export async function getSetting<T>(userId: string, key: string, fallback: T): Promise<T> {

  const res = await pool.query<{ value: T }>('SELECT value FROM settings WHERE key = $1', [

    userKey(userId, key),

  ]);

  return res.rows.length ? res.rows[0].value : fallback;

}



export async function setSetting(userId: string, key: string, value: unknown): Promise<void> {

  const k = userKey(userId, key);

  await pool.query(

    `INSERT INTO settings (key, value) VALUES ($1, $2)

     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,

    [k, JSON.stringify(value)],

  );

}



export interface OpenRouterSettings {

  apiKey: string;

  model: string;

  enabled: boolean;

}



export async function getOpenRouterSettings(userId: string): Promise<OpenRouterSettings> {

  return getSetting<OpenRouterSettings>(userId, 'openrouter', {

    apiKey: config.openRouter.apiKey,

    model: config.openRouter.model,

    enabled: Boolean(config.openRouter.apiKey),

  });

}



export async function getEnabledSources(userId: string): Promise<MessengerSource[]> {
  return getSetting<MessengerSource[]>(userId, 'enabledSources', [...MESSENGER_SOURCES]);
}

export interface ExcludedFilters {
  phones: string[];
  usernames: string[];
  chats: Array<{ source: string; chatId: string }>;
}

const EMPTY_FILTERS: ExcludedFilters = { phones: [], usernames: [], chats: [] };

export async function getExcludedFilters(userId: string): Promise<ExcludedFilters> {
  return getSetting<ExcludedFilters>(userId, 'excludedFilters', EMPTY_FILTERS);
}

export async function setExcludedFilters(userId: string, value: ExcludedFilters): Promise<void> {
  await setSetting(userId, 'excludedFilters', {
    phones: value.phones.map((p) => p.replace(/[^\d]/g, '')).filter(Boolean),
    usernames: value.usernames.map((u) => u.trim().replace(/^@/, '').toLowerCase()).filter(Boolean),
    chats: value.chats.filter((c) => c.source && c.chatId),
  });
}

