import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const required = [
  'package.json',
  'docker-compose.yml',
  'README.md',
  'packages/shared/src/index.ts',
  'packages/server/src/index.ts',
  'packages/server/src/wsHub.ts',
  'packages/server/src/ingest/IdentityResolver.ts',
  'packages/server/src/webhooks/Dispatcher.ts',
  'packages/server/src/ai/OpenRouterService.ts',
  'packages/agent/src/index.ts',
  'packages/agent/src/AgentCore.ts',
  'packages/agent/src/VpsClient.ts',
  'packages/agent/src/watchers/TelegramWatcher.ts',
  'packages/agent/src/watchers/WhatsAppWatcher.ts',
  'packages/agent/src/watchers/VkWatcher.ts',
  'packages/agent/src/watchers/MaxWatcher.ts',
  'packages/agent/src/watchers/InstagramWatcher.ts',
  'packages/agent/src/watchers/AvitoWatcher.ts',
  'packages/dashboard/src/App.tsx',
  'deploy/nginx/most.conf',
  'deploy/windows/start-chrome-debug.ps1',
  'deploy/windows/start-agent.ps1',
  'deploy/windows/install-agent-autostart.ps1',
  'deploy/windows/open-messenger-tabs.ps1',
  'docs/SETUP.md',
  'docs/CURSOR-AGENT-PROMPT.md',
];

describe('Project structure (plan compliance)', () => {
  for (const rel of required) {
    it(`exists: ${rel}`, () => {
      const full = path.join(root, rel);
      assert.ok(fs.existsSync(full), `missing ${rel}`);
    });
  }

  it('npm workspaces include all 4 packages', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    assert.deepEqual(pkg.workspaces.sort(), [
      'packages/agent',
      'packages/dashboard',
      'packages/server',
      'packages/shared',
    ].sort());
  });
});
