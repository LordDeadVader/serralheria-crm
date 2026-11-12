/**
 * Rotas públicas do site (HTML gerado no servidor), sitemap e robots.
 */
import { Hono } from 'hono';
import type { AppEnv } from '../lib/context';
import { type SiteCtx } from './layout';
import {
  aboutPage,
  contactPage,
  homePage,
  notFoundPage,
  projectDetailPage,
  projectsPage,
  quotePage,
  relatedTo,
  serviceDetailPage,
  servicesPage,
} from './pages';
import { cover, getSettings, listProjects, listServices, listTestimonials } from './repo';
import type { Context } from 'hono';

type C = Context<AppEnv>;

async function ctxFor(c: C): Promise<SiteCtx> {
  const db = c.var.db;
  const companyId = c.env.SITE_COMPANY_ID;
  const [s, services] = await Promise.all([getSettings(db, companyId), listServices(db, companyId, true)]);
  const url = new URL(c.req.url);
  const origin = (c.env.PUBLIC_URL || url.origin).replace(/\/$/, '');
  const hasDemoImages = [s.hero.image, s.about.image, s.about.image2, s.cta.image, ...services.map((x) => x.image)].some((i) => i?.demo);
  return { s, services, origin, path: url.pathname.replace(/\/$/, '') || '/', hasDemoImages };
}

const page = (c: C, body: Parameters<C['html']>[0], status: 200 | 404 = 200) =>
  c.html(body, status, { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=600' });

export const siteRoutes = new Hono<AppEnv>();

// Barra final opcional: /servicos/ → /servicos
siteRoutes.use('*', async (c, next) => {
  const p = new URL(c.req.url).pathname;
  if (p.length > 1 && p.endsWith('/') && !p.startsWith('/crm')) return c.redirect(p.replace(/\/+$/, '') + new URL(c.req.url).search, 301);
  await next();
});

siteRoutes.get('/', async (c) => {
  const ctx = await ctxFor(c);
  const id = c.env.SITE_COMPANY_ID;
  const [projects, testimonials] = await Promise.all([listProjects(c.var.db, id, true), listTestimonials(c.var.db, id, true)]);
  ctx.hasDemoImages ||= projects.some((p) => p.isDemo);
  return page(c, homePage(ctx, { projects, testimonials }));
});

siteRoutes.get('/servicos', async (c) => page(c, servicesPage(await ctxFor(c))));

siteRoutes.get('/servicos/:slug', async (c) => {
  const ctx = await ctxFor(c);
  const sv = ctx.services.find((x) => x.slug === c.req.param('slug'));
  if (!sv) return page(c, notFoundPage(ctx), 404);
  const projects = await listProjects(c.var.db, c.env.SITE_COMPANY_ID, true);
  return page(c, serviceDetailPage(ctx, sv, relatedTo(sv, projects)));
});

siteRoutes.get('/projetos', async (c) => {
  const ctx = await ctxFor(c);
  const projects = await listProjects(c.var.db, c.env.SITE_COMPANY_ID, true);
  ctx.hasDemoImages ||= projects.some((p) => p.isDemo);
  return page(c, projectsPage(ctx, projects, (c.req.query('categoria') ?? '').slice(0, 60)));
});

siteRoutes.get('/projetos/:slug', async (c) => {
  const ctx = await ctxFor(c);
  const projects = await listProjects(c.var.db, c.env.SITE_COMPANY_ID, true);
  const p = projects.find((x) => x.slug === c.req.param('slug'));
  if (!p) return page(c, notFoundPage(ctx), 404);
  ctx.hasDemoImages ||= p.isDemo;
  return page(c, projectDetailPage(ctx, p, projects));
});

siteRoutes.get('/sobre', async (c) => {
  const ctx = await ctxFor(c);
  return page(c, aboutPage(ctx, await listTestimonials(c.var.db, c.env.SITE_COMPANY_ID, true)));
});

siteRoutes.get('/contato', async (c) => page(c, contactPage(await ctxFor(c))));

siteRoutes.get('/orcamento', async (c) => {
  const ctx = await ctxFor(c);
  const refSlug = c.req.query('ref');
  const ref = refSlug ? (await listProjects(c.var.db, c.env.SITE_COMPANY_ID, true)).find((p) => p.slug === refSlug) : null;
  return c.html(quotePage(ctx, { service: c.req.query('servico'), category: c.req.query('categoria'), ref }), 200, { 'Cache-Control': 'no-store' });
});

siteRoutes.get('/robots.txt', async (c) => {
  const origin = (c.env.PUBLIC_URL || new URL(c.req.url).origin).replace(/\/$/, '');
  return c.text(`User-agent: *\nAllow: /\nDisallow: /crm/\nDisallow: /api/\n\nSitemap: ${origin}/sitemap.xml\n`);
});

siteRoutes.get('/sitemap.xml', async (c) => {
  const ctx = await ctxFor(c);
  const projects = await listProjects(c.var.db, c.env.SITE_COMPANY_ID, true);
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const urls: { loc: string; lastmod?: string; img?: string[] }[] = [
    { loc: '/' },
    { loc: '/servicos' },
    ...ctx.services.map((s) => ({ loc: `/servicos/${s.slug}`, lastmod: s.updatedAt, img: s.image ? [s.image.src] : [] })),
    { loc: '/projetos' },
    ...projects.map((p) => ({ loc: `/projetos/${p.slug}`, lastmod: p.updatedAt, img: p.images.map((i) => i.src) })),
    { loc: '/sobre' },
    { loc: '/contato' },
    { loc: '/orcamento' },
  ];
  const abs = (u: string) => (u.startsWith('/') ? `${ctx.origin}${u}` : u);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls
  .map(
    (u) =>
      `  <url><loc>${esc(abs(u.loc))}</loc>${u.lastmod ? `<lastmod>${u.lastmod.slice(0, 10)}</lastmod>` : ''}${(u.img ?? [])
        .filter(Boolean)
        .map((i) => `<image:image><image:loc>${esc(abs(i))}</image:loc></image:image>`)
        .join('')}</url>`,
  )
  .join('\n')}
</urlset>`;
  return c.body(xml, 200, { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' });
});

/** Fallback de páginas inexistentes do site. */
export async function siteNotFound(c: C) {
  return page(c, notFoundPage(await ctxFor(c)), 404);
}

export { cover };
