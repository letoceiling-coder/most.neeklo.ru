import type { Request } from 'express';

export type UserRole = 'admin' | 'user';

export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
}

export interface TokenPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  exp: number;
}

export function getAuthUser(req: Request): AuthUser {
  const u = req.authUser;
  if (!u) throw new Error('missing auth user');
  return u;
}

export function isAdmin(req: Request): boolean {
  return req.authUser?.role === 'admin';
}
