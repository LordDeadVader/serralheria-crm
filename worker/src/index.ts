/**
 * WJR Serralheria — Cloudflare Worker + D1 + KV.
 *   /            site institucional (HTML gerado no servidor)
 *   /crm/        CRM (aplicativo React, arquivos estáticos) — acesso só com login
 *   /api/*       API do CRM e do painel do site (exige sessão), exceto /api/auth/login e /api/public/*
 *   /media/*     imagens enviadas pelo painel do site
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { secureHeaders } from 'hono/secure-headers';
import { requireAuth } from './authentication/session';
import { getDb, HttpError, type AppEnv } from './lib/context';
import { authRoutes } from './routes/auth';
import { clientRoutes, materialRoutes, serviceRoutes, supplierRoutes } from './routes/catalog';
import { companyRoutes } from './routes/company';
import { dashboardRoutes, quoteRoutes } from './routes/quotes';
import { stockRoutes } from './routes/stock';
import { presetRoutes, templateRoutes } from './routes/templates';
import { mediaRoutes, publicRoutes, siteAdminRoutes } from './site/api';
import { siteNotFound, siteRoutes } from './site/routes';

const app = new Hono<AppEnv>();

app.use('*', secureHeaders({ referrerPolicy: 'strict-origin-when-cross-origin', crossOriginResourcePolicy: false }));
app.use('*', async (c, next) => {
  c.set('db', getDb(c.env));
  await next();
});

// ───────── API (/api) ─────────
const api = new Hono<AppEnv>();
api.use('*', async (c, next) => {
  // O CRM é servido no mesmo endereço; CORS só é necessário no desenvolvimento local (Vite).
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});
api.get('/health', (c) => c.json({ ok: true, service: 'wj-serralheria', time: new Date().toISOString() }));
api.route('/auth', authRoutes);
api.route('/public', publicRoutes);
api.route('/site', siteAdminRoutes);

const crm = new Hono<AppEnv>();
crm.use('*', requireAuth);
crm.route('/company', companyRoutes);
crm.route('/clients', clientRoutes);
crm.route('/suppliers', supplierRoutes);
crm.route('/materials', materialRoutes);
crm.route('/services', serviceRoutes);
crm.route('/quotes', quoteRoutes);
crm.route('/dashboard', dashboardRoutes);
crm.route('/stock', stockRoutes);
crm.route('/templates', templateRoutes);
crm.route('/presets', presetRoutes);
api.route('/', crm);
app.route('/api', api);

// ───────── Imagens públicas, CRM e site ─────────
app.route('/media', mediaRoutes);
app.get('/crm', (c) => c.redirect('/crm/', 301));
app.route('/', siteRoutes);

const isApi = (path: string) => path.startsWith('/api/') || path === '/api';

app.notFound((c) => (isApi(new URL(c.req.url).pathname) ? c.json({ error: 'Rota não encontrada.' }, 404) : siteNotFound(c)));

app.onError((err, c) => {
  const path = new URL(c.req.url).pathname;
  if (err instanceof HttpError) {
    if (isApi(path)) return c.json({ error: err.message, details: err.details ?? null }, err.status);
    return c.text(err.message, err.status);
  }
  console.error('Erro não tratado', err);
  if (isApi(path)) return c.json({ error: 'Erro interno no servidor. Tente novamente.' }, 500);
  return c.html('<!doctype html><meta charset="utf-8"><title>Erro</title><p style="font-family:sans-serif;padding:40px">Não foi possível carregar a página agora. Tente novamente em instantes.</p>', 500);
});

export default app;
