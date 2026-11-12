import type { Context } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import * as schema from '../database/schema';

export interface Env {
  DB: D1Database;
  /** Imagens do site e anexos das solicitações. */
  MEDIA: KVNamespace;
  ALLOWED_ORIGINS: string;
  /** Empresa dona do site e do CRM (uso exclusivo). */
  SITE_COMPANY_ID: string;
  /** Endereço público do site (canonical, sitemap). Vazio = endereço da requisição. */
  PUBLIC_URL?: string;
  /** "true" reabre o cadastro por convite (desativado: sistema de uso exclusivo). */
  ALLOW_SIGNUP?: string;
  /** Integração futura: solicitações do site também são enviadas para este endereço (POST JSON). */
  CRM_WEBHOOK_URL?: string;
  CRM_WEBHOOK_TOKEN?: string;
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
