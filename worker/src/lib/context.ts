import type { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../database/schema';

export interface Env {
  DB: D1Database;
  ALLOWED_ORIGINS: string;
}

export interface AuthInfo {
  userId: string;
  companyId: string;
  userName: string;
  sessionId: string;
}

export const getDb = (env: Env) => drizzle(env.DB, { schema });
export type DB = ReturnType<typeof getDb>;

export type AppEnv = {
  Bindings: Env;
  Variables: { auth: AuthInfo; db: DB };
};

export type Ctx = Context<AppEnv>;

export const uid = () => crypto.randomUUID();
export const nowIso = () => new Date().toISOString();

export class HttpError extends Error {
  constructor(
    public status: 400 | 401 | 403 | 404 | 409 | 422 | 429 | 500,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
