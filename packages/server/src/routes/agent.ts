import { Router, type Request, type Response } from 'express';
import type { MessageEvent } from '@most/shared';
import { verifyToken } from '../repositories/pcs.js';
import { ingestMessage } from '../ingest/IngestService.js';

export const agentRouter = Router();

/** HTTP fallback ingest (the primary path is the WS hub). */
agentRouter.post('/ingest/events', async (req: Request, res: Response) => {
  try {
    const pcId = String(req.headers['x-pc-id'] ?? '');
    const token = String(req.headers['x-pc-token'] ?? '');
    if (!pcId || !verifyToken(pcId, token)) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }

    const events: MessageEvent[] = Array.isArray(req.body?.events)
      ? req.body.events
      : req.body
        ? [req.body]
        : [];
    if (!events.length) {
      res.status(400).json({ error: 'no events' });
      return;
    }

    const results = [];
    for (const event of events) {
      results.push(await ingestMessage({ ...event, pcId }));
    }
    res.json({ ok: true, results });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
