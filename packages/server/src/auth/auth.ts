import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { authenticateUser, findUserById } from '../repositories/users.js';
import type { AuthUser, TokenPayload } from './types.js';

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function signPayload(payload: TokenPayload): string {
  const body = b64url(JSON.stringify(payload));
  const sig = b64url(crypto.createHmac('sha256', config.sessionSecret).update(body).digest());
  return `${body}.${sig}`;
}

export function issueToken(user: AuthUser, ttlSec = 60 * 60 * 24 * 7): string {
  return signPayload({
    sub: user.id,
    email: user.email,
    name: user.displayName,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + ttlSec,
  });
}

export function verifyOperatorToken(token: string): TokenPayload | null {
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = b64url(
    crypto.createHmac('sha256', config.sessionSecret).update(body).digest(),
  );
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64').toString('utf8')) as TokenPayload;
    if (payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (!payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function login(email: string, password: string): Promise<string | null> {
  const user = await authenticateUser(email, password);
  if (!user) return null;
  return issueToken({
    id: user.id,
    email: user.email,
    displayName: user.display_name,
    role: user.role,
  });
}

export function requireOperator(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  const payload = verifyOperatorToken(token);
  if (!payload) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  void (async () => {
    const row = await findUserById(payload.sub);
    if (!row || !row.enabled) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    req.authUser = {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    };
    next();
  })().catch(() => {
    res.status(401).json({ error: 'unauthorized' });
  });
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (req.authUser?.role !== 'admin') {
    res.status(403).json({ error: 'admin only' });
    return;
  }
  next();
}
