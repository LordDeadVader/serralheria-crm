/**
 * Rotas de API do site:
 *  - /api/site/*        painel do site (exige login da empresa dona do site)
 *  - /api/public/leads  formulário público de orçamento (sem login, com proteção anti-spam)
 *  - /media/*           imagens públicas (Workers KV, com cache na borda)
 *
 * Integração futura com outros sistemas: se a variável CRM_WEBHOOK_URL estiver definida, cada
 * solicitação recebida também é enviada por POST (JSON) para esse endereço. Ver docs/SITE.md.
 */
import { and, desc, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { z } from 'zod';
import {
  LEAD_FILES,
  LEAD_FILE_TYPES,
  LEAD_STATUS,
  leadSchema,
  siteProjectSchema,
  siteServiceSchema,
  siteSettingsSchema,
  siteTestimonialSchema,
  type SiteImage,
} from '../../../src/schemas/site';
import { checkRateLimit, registerFailure, requireAuth } from '../authentication/session';
import { clients, siteLeads } from '../database/schema';
import { HttpError, uid, type AppEnv, type Env } from '../lib/context';
import { body } from '../lib/validate';
import {
  deleteProject,
  deleteService,
  deleteTestimonial,
  getSettings,
  leadDto,
  listProjects,
  listServices,
  listTestimonials,
  saveProject,
  saveService,
  saveSettings,
  saveTestimonial,
  type SiteLead,
} from './repo';

const IMAGE_TYPES = ['image/webp', 'image/jpeg', 'image/png', 'image/avif'];
const MAX_IMAGE = 4 * 1024 * 1024;

// ───────── Mídia (KV) ─────────
async function putMedia(env: Env, key: string, data: ArrayBuffer, type: string, name = '') {
  await env.MEDIA.put(key, data, { metadata: { type, name, size: data.byteLength } });
}

async function deleteImages(env: Env, imgs: (SiteImage | null | undefined)[]) {
  for (const i of imgs) {
    for (const src of [i?.src, i?.srcSm]) if (src?.startsWith('/media/img/')) await env.MEDIA.delete(src.slice(7));
  }
}

export const mediaRoutes = new Hono<AppEnv>();
mediaRoutes.get('/img/:file', async (c) => {
  const key = `img/${c.req.param('file')}`;
  if (!/^img\/[a-f0-9-]{36}(-sm)?\.(webp|jpg|png|avif)$/.test(key)) return c.notFound();
  const cache = (caches as unknown as { default: Cache }).default;
  const hit = await cache.match(c.req.raw);
  if (hit) return hit;
  const obj = await c.env.MEDIA.getWithMetadata<{ type: string }>(key, 'arrayBuffer');
  if (!obj.value) return c.notFound();
  const res = new Response(obj.value, {
    headers: {
      'Content-Type': obj.metadata?.type ?? 'image/webp',
      // Cada envio gera um nome novo: o arquivo nunca muda, pode ficar em cache por 1 ano.
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
  c.executionCtx.waitUntil(cache.put(c.req.raw, res.clone()));
  return res;
});

// ───────── Formulário público ─────────
export const publicRoutes = new Hono<AppEnv>();

publicRoutes.post('/leads', async (c) => {
  const env = c.env;
  const db = c.var.db;
  const companyId = env.SITE_COMPANY_ID;
  const ip = c.req.header('CF-Connecting-IP') ?? 'local';
  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    throw new HttpError(400, 'Envio inválido.');
  }
  const str = (k: string) => (typeof form.get(k) === 'string' ? (form.get(k) as string) : '');
  // Anti-spam: campo invisível preenchido ou envio rápido demais = robô. Responde "ok" sem gravar.
  const started = Number(str('_t'));
  if (str('empresa_site') || (started && Date.now() - started < 2500)) return c.json({ ok: true });

  const key = `lead:${ip}`;
  await checkRateLimit(db, key);

  const r = leadSchema.safeParse(Object.fromEntries(['name', 'phone', 'city', 'service', 'material', 'description', 'measures', 'reference'].map((k) => [k, str(k)])));
  if (!r.success) {
    const fields: Record<string, string> = {};
    for (const i of r.error.issues) fields[i.path.join('.')] ??= i.message;
    throw new HttpError(422, 'Confira os campos destacados.', { fields });
  }

  const files = form.getAll('files').filter((f): f is File => typeof f !== 'string' && f.size > 0);
  if (files.length > LEAD_FILES.max) throw new HttpError(422, `Envie no máximo ${LEAD_FILES.max} arquivos.`);
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (!LEAD_FILE_TYPES.includes(f.type)) throw new HttpError(422, `Formato não aceito: ${f.name}. Envie fotos (JPG, PNG, WEBP) ou PDF.`);
    if (f.size > LEAD_FILES.maxBytes) throw new HttpError(422, `Arquivo grande demais: ${f.name} (máx. 8 MB).`);
  }
  if (total > LEAD_FILES.totalBytes) throw new HttpError(422, 'Os arquivos somam mais de 20 MB. Envie menos fotos.');

  await registerFailure(db, key); // conta o envio no limite por IP (8 a cada 15 min)

  const id = uid();
  const stored = [];
  for (const [i, f] of files.entries()) {
    const fileKey = `lead/${id}/${i}`;
    await putMedia(env, fileKey, await f.arrayBuffer(), f.type, f.name.slice(0, 120));
    stored.push({ key: fileKey, name: f.name.slice(0, 120), type: f.type, size: f.size });
  }
  const [row] = await db
    .insert(siteLeads)
    .values({ id, companyId, ...r.data, files: JSON.stringify(stored) })
    .returning();

  if (env.CRM_WEBHOOK_URL) c.executionCtx.waitUntil(forwardLead(env, leadDto(row)));
  return c.json({ ok: true, id }, 201);
});

/** Encaminha a solicitação para um sistema externo (CRM, automação). Falhas ficam registradas. */
async function forwardLead(env: Env, lead: SiteLead) {
  const { getDb } = await import('../lib/context');
  const db = getDb(env);
  let status = '';
  try {
    const res = await fetch(env.CRM_WEBHOOK_URL!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(env.CRM_WEBHOOK_TOKEN ? { Authorization: `Bearer ${env.CRM_WEBHOOK_TOKEN}` } : {}) },
      body: JSON.stringify({
        type: 'site.lead.created',
        lead: { ...lead, files: lead.files.map((f) => ({ name: f.name, type: f.type, size: f.size })) },
      }),
    });
    status = res.ok ? 'enviado' : `erro ${res.status}`;
  } catch {
    status = 'erro de conexão';
  }
  await db.update(siteLeads).set({ forwardStatus: status }).where(eq(siteLeads.id, lead.id));
}

// ───────── Painel do site ─────────
export const siteAdminRoutes = new Hono<AppEnv>();
siteAdminRoutes.use('*', requireAuth);
siteAdminRoutes.use('*', async (c, next) => {
  if (c.var.auth.companyId !== c.env.SITE_COMPANY_ID) throw new HttpError(403, 'O painel do site pertence a outra empresa.');
  await next();
});

const cid = (c: { env: Env }) => c.env.SITE_COMPANY_ID;

siteAdminRoutes.get('/overview', async (c) => {
  const db = c.var.db;
  const [settings, services, projects, testimonials, leads] = await Promise.all([
    getSettings(db, cid(c)),
    listServices(db, cid(c)),
    listProjects(db, cid(c)),
    listTestimonials(db, cid(c)),
    db.select({ status: siteLeads.status }).from(siteLeads).where(eq(siteLeads.companyId, cid(c))),
  ]);
  const co = settings.company;
  const pending = [
    !co.whatsapp && 'WhatsApp (necessário para o envio pelo WhatsApp)',
    !co.phone && 'Telefone',
    !co.email && 'E-mail',
    !co.city && 'Cidade (usada no SEO local)',
    !co.address && 'Endereço',
    !co.hours && 'Horário de funcionamento',
    !co.instagram && 'Instagram',
    settings.about.text.startsWith('Escreva aqui') && 'Texto "Sobre a empresa"',
    projects.some((p) => p.isDemo) && 'Projetos de demonstração: substituir por trabalhos reais',
    [settings.hero.image, settings.about.image, settings.about.image2, settings.cta.image, ...services.map((s) => s.image)].some((i) => i?.demo) &&
      'Imagens ilustrativas em destaque, sobre, chamada final e serviços',
  ].filter(Boolean);
  return c.json({
    pending,
    counts: {
      services: services.filter((s) => s.active).length,
      projects: projects.filter((p) => p.published).length,
      demoProjects: projects.filter((p) => p.isDemo).length,
      testimonials: testimonials.filter((t) => t.published).length,
      newLeads: leads.filter((l) => l.status === 'novo').length,
      leads: leads.length,
    },
  });
});

siteAdminRoutes.get('/settings', async (c) => c.json(await getSettings(c.var.db, cid(c))));
siteAdminRoutes.put('/settings', async (c) => {
  const data = await body(c, siteSettingsSchema);
  await saveSettings(c.var.db, cid(c), data);
  return c.json(data);
});

siteAdminRoutes.get('/services', async (c) => c.json(await listServices(c.var.db, cid(c))));
siteAdminRoutes.post('/services', async (c) => c.json(await saveService(c.var.db, cid(c), await body(c, siteServiceSchema)), 201));
siteAdminRoutes.put('/services/:id', async (c) => c.json(await saveService(c.var.db, cid(c), await body(c, siteServiceSchema), c.req.param('id'))));
siteAdminRoutes.delete('/services/:id', async (c) => {
  await deleteService(c.var.db, cid(c), c.req.param('id'));
  return c.json({ ok: true });
});

siteAdminRoutes.get('/projects', async (c) => c.json(await listProjects(c.var.db, cid(c))));
siteAdminRoutes.post('/projects', async (c) => c.json(await saveProject(c.var.db, cid(c), await body(c, siteProjectSchema)), 201));
siteAdminRoutes.put('/projects/:id', async (c) => c.json(await saveProject(c.var.db, cid(c), await body(c, siteProjectSchema), c.req.param('id'))));
siteAdminRoutes.delete('/projects/:id', async (c) => {
  const removed = await deleteProject(c.var.db, cid(c), c.req.param('id'));
  if (removed) c.executionCtx.waitUntil(deleteImages(c.env, removed.images));
  return c.json({ ok: true });
});

siteAdminRoutes.get('/testimonials', async (c) => c.json(await listTestimonials(c.var.db, cid(c))));
siteAdminRoutes.post('/testimonials', async (c) => c.json(await saveTestimonial(c.var.db, cid(c), await body(c, siteTestimonialSchema)), 201));
siteAdminRoutes.put('/testimonials/:id', async (c) =>
  c.json(await saveTestimonial(c.var.db, cid(c), await body(c, siteTestimonialSchema), c.req.param('id'))),
);
siteAdminRoutes.delete('/testimonials/:id', async (c) => {
  await deleteTestimonial(c.var.db, cid(c), c.req.param('id'));
  return c.json({ ok: true });
});

/** Envio de imagem já otimizada no navegador (WebP). Corpo = bytes da imagem. */
siteAdminRoutes.post('/media', async (c) => {
  const type = (c.req.header('Content-Type') ?? '').split(';')[0].trim();
  if (!IMAGE_TYPES.includes(type)) throw new HttpError(422, 'Envie uma imagem JPG, PNG, WEBP ou AVIF.');
  const data = await c.req.arrayBuffer();
  if (!data.byteLength) throw new HttpError(422, 'Arquivo vazio.');
  if (data.byteLength > MAX_IMAGE) throw new HttpError(422, 'Imagem acima de 4 MB após a otimização.');
  const ext = type.split('/')[1].replace('jpeg', 'jpg');
  const base = c.req.query('id') && /^[a-f0-9-]{36}$/.test(c.req.query('id')!) ? c.req.query('id')! : uid();
  const variant = c.req.query('variant') === 'sm' ? '-sm' : '';
  const key = `img/${base}${variant}.${ext}`;
  await putMedia(c.env, key, data, type);
  return c.json({ id: base, src: `/media/${key}` }, 201);
});

siteAdminRoutes.post('/media/delete', async (c) => {
  const { images } = await body(c, z.object({ images: z.array(z.object({ src: z.string(), srcSm: z.string().default('') })).max(60) }));
  await deleteImages(c.env, images as SiteImage[]);
  return c.json({ ok: true });
});

siteAdminRoutes.get('/leads', async (c) => {
  const rows = await c.var.db.select().from(siteLeads).where(eq(siteLeads.companyId, cid(c))).orderBy(desc(siteLeads.createdAt)).limit(500);
  return c.json(rows.map(leadDto));
});

async function getLead(c: { var: AppEnv['Variables']; env: Env }, id: string) {
  const row = await c.var.db.select().from(siteLeads).where(and(eq(siteLeads.id, id), eq(siteLeads.companyId, cid(c)))).get();
  if (!row) throw new HttpError(404, 'Solicitação não encontrada.');
  return leadDto(row);
}

siteAdminRoutes.put('/leads/:id', async (c) => {
  const { status } = await body(c, z.object({ status: z.enum(LEAD_STATUS) }));
  await getLead(c, c.req.param('id'));
  await c.var.db.update(siteLeads).set({ status }).where(eq(siteLeads.id, c.req.param('id')));
  return c.json({ ok: true });
});

siteAdminRoutes.get('/leads/:id/files/:n', async (c) => {
  const lead = await getLead(c, c.req.param('id'));
  const f = lead.files[Number(c.req.param('n'))];
  if (!f) throw new HttpError(404, 'Arquivo não encontrado.');
  const data = await c.env.MEDIA.get(f.key, 'arrayBuffer');
  if (!data) throw new HttpError(404, 'Arquivo não encontrado.');
  return new Response(data, {
    headers: {
      'Content-Type': f.type,
      'Content-Disposition': `inline; filename="${encodeURIComponent(f.name)}"`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});

siteAdminRoutes.delete('/leads/:id', async (c) => {
  const lead = await getLead(c, c.req.param('id'));
  for (const f of lead.files) await c.env.MEDIA.delete(f.key);
  await c.var.db.delete(siteLeads).where(eq(siteLeads.id, lead.id));
  return c.json({ ok: true });
});

/** Integração com o CRM: cadastra quem pediu orçamento como cliente (sem duplicar quando já cadastrado). */
siteAdminRoutes.post('/leads/:id/client', async (c) => {
  const lead = await getLead(c, c.req.param('id'));
  if (lead.clientId) return c.json({ clientId: lead.clientId, created: false });
  const clientId = uid();
  const notes = [
    'Cadastrado a partir de uma solicitação do site.',
    lead.service && `Serviço: ${lead.service}`,
    lead.material && `Material: ${lead.material}`,
    lead.measures && `Medidas: ${lead.measures}`,
    `Descrição: ${lead.description}`,
  ]
    .filter(Boolean)
    .join('\n');
  await c.var.db.batch([
    c.var.db.insert(clients).values({ id: clientId, companyId: cid(c), name: lead.name, phone: lead.phone, whatsapp: lead.phone, city: lead.city, notes: notes.slice(0, 2000) }),
    c.var.db.update(siteLeads).set({ clientId, status: lead.status === 'novo' ? 'visto' : lead.status }).where(eq(siteLeads.id, lead.id)),
  ]);
  return c.json({ clientId, created: true }, 201);
});
