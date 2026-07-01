import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MESSENGER_SOURCES, type MessengerSource } from '@most/shared';

export interface AgentConfig {
  pcId: string;
  token: string;
  vpsWsUrl: string;
  vpsHttpUrl: string;
  chromeCdpEndpoint: string;
  agentVersion: string;
  useCdpLock: boolean;
  sources: MessengerSource[];
}

const here = path.dirname(fileURLToPath(import.meta.url));
// dist/ -> package root; src/ (tsx) -> package root
const packageRoot = path.resolve(here, '..');

function resolveConfigPath(): string {
  const override = process.env.MOST_AGENT_CONFIG;
  if (override) return override;
  return path.join(packageRoot, 'config', 'agent.json');
}

export function loadConfig(): AgentConfig {
  const file = resolveConfigPath();
  if (!fs.existsSync(file)) {
    throw new Error(
      `agent config not found at ${file}. Copy config/agent.json.example to config/agent.json and fill it in.`,
    );
  }
  const raw = JSON.parse(fs.readFileSync(file, 'utf-8')) as Partial<AgentConfig>;
  const sources = (raw.sources ?? [...MESSENGER_SOURCES]).filter((s): s is MessengerSource =>
    (MESSENGER_SOURCES as readonly string[]).includes(s),
  );
  if (!raw.pcId || !raw.token) {
    throw new Error('agent config must include pcId and token');
  }
  return {
    pcId: raw.pcId,
    token: raw.token,
    vpsWsUrl: raw.vpsWsUrl ?? 'ws://127.0.0.1:3030/agent',
    vpsHttpUrl: raw.vpsHttpUrl ?? 'http://127.0.0.1:3030',
    chromeCdpEndpoint: raw.chromeCdpEndpoint ?? 'http://127.0.0.1:9222',
    agentVersion: raw.agentVersion ?? '1.0.0',
    useCdpLock: raw.useCdpLock ?? false,
    sources,
  };
}

export const PACKAGE_ROOT = packageRoot;
