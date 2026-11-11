/**
 * API do Serralheria CRM — Cloudflare Worker + D1.
 * Todas as rotas (exceto /health, /auth/login e /auth/signup) exigem sessão válida.
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

const app = new Hono<AppEnv>();

app.use('*', secureHeaders());
app.use('*', async (c, next) => {
  const allowed = (c.env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
  return cors({
    origin: (origin) => (allowed.includes(origin) ? origin : null),
    allowHeaders: ['Content-Type', 'Authorization'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    maxAge: 86400,
  })(c, next);
});
app.use('*', async (c, next) => {
  c.set('db', getDb(c.env));
  await next();
});

app.get('/health', (c) => c.json({ ok: true, service: 'serralheria-crm-api', time: new Date().toISOString() }));

app.route('/auth', authRoutes);

const api = new Hono<AppEnv>();
api.use('*', requireAuth);
api.route('/company', companyRoutes);
api.route('/clients', clientRoutes);
api.route('/suppliers', supplierRoutes);
api.route('/materials', materialRoutes);
api.route('/services', serviceRoutes);
api.route('/quotes', quoteRoutes);
api.route('/dashboard', dashboardRoutes);
app.route('/', api);

app.notFound((c) => c.json({ error: 'Rota não encontrada.' }, 404));

app.onError((err, c) => {
  if (err instanceof HttpError) {
    return c.json({ error: err.message, details: err.details ?? null }, err.status);
  }
  console.error('Erro não tratado', err);
  return c.json({ error: 'Erro interno no servidor. Tente novamente.' }, 500);
});

export default app;
