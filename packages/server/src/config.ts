import dotenv from 'dotenv';

// Loads .env from the current working directory (repo root in dev / Docker).
dotenv.config();

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var ${name}`);
  }
  return value;
}

export const config = {
  port: Number(process.env.SERVER_PORT ?? 3030),
  host: process.env.SERVER_HOST ?? '0.0.0.0',
  publicUrl: process.env.PUBLIC_URL ?? 'http://localhost:3030',
  databaseUrl: required('DATABASE_URL', 'postgres://most:most@localhost:5432/most'),
  operator: {
    user: process.env.OPERATOR_USER ?? 'admin',
    password: process.env.OPERATOR_PASSWORD ?? 'change-me',
  },
  sessionSecret: process.env.SESSION_SECRET ?? 'change-me-too',
  agentSharedSecret: process.env.AGENT_SHARED_SECRET ?? 'change-me-agent',
  openRouter: {
    apiKey: process.env.OPENROUTER_API_KEY ?? '',
    model: process.env.OPENROUTER_MODEL ?? 'openai/gpt-4o-mini',
    baseUrl: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
  },
  dashboardDist: process.env.DASHBOARD_DIST ?? '',
};

export type AppConfig = typeof config;
