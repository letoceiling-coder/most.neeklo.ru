import path from 'node:path';
import fs from 'node:fs';
import express, { type NextFunction, type Request, type Response } from 'express';
import { config } from './config.js';
import { createLogger } from './logger.js';
import { login, requireOperator } from './auth/auth.js';
import { agentRouter } from './routes/agent.js';
import { operatorRouter } from './routes/operator.js';

const logger = createLogger('http');

export function createApp(): express.Express {
  const app = express();
  app.set('trust proxy', true);
  app.use(express.json({ limit: process.env.JSON_LIMIT ?? '32mb' }));

  app.use((req, _res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      _res.header('Access-Control-Allow-Origin', origin);
      _res.header('Access-Control-Allow-Credentials', 'true');
      _res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Pc-Id, X-Pc-Token');
      _res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      if (req.method === 'OPTIONS') {
        _res.sendStatus(204);
        return;
      }
    }
    next();
  });

  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'most-server', ts: new Date().toISOString() });
  });

  app.post('/v1/auth/login', async (req: Request, res: Response) => {
    const loginId = String(req.body?.user ?? req.body?.email ?? '');
    const password = String(req.body?.password ?? '');
    const token = await login(loginId, password);
    if (!token) {
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    res.json({ token });
  });

  app.get('/v1/auth/me', requireOperator, (req: Request, res: Response) => {
    res.json({ user: req.authUser });
  });

  app.use('/v1', agentRouter);
  app.use('/v1', operatorRouter);

  // Optionally serve the built dashboard (SPA).
  if (config.dashboardDist && fs.existsSync(config.dashboardDist)) {
    app.use(express.static(config.dashboardDist));
    app.get(/^(?!\/(v1|health|agent)).*/, (_req, res) => {
      res.sendFile(path.join(config.dashboardDist, 'index.html'));
    });
    logger.info('Serving dashboard', { dir: config.dashboardDist });
  }

  app.use((_req, res) => res.status(404).json({ error: 'not found' }));
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    logger.error('Unhandled error', { error: err.message });
    res.status(500).json({ error: err.message });
  });

  return app;
}
