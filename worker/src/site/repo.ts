/**
 * Acesso ao conteúdo do site (D1). Sempre filtrado pela empresa dona do site.
 */
import { and, asc, desc, eq, ne } from 'drizzle-orm';
import {
  siteSettingsSchema,
  slugify,
  type SiteImage,
  type SiteProjectInput,
  type SiteServiceInput,
  type SiteSettings,
  type SiteTestimonialInput,
} from '../../../src/schemas/site';
import { companies, siteLeads, siteProjects, siteServices, siteSettings, siteTestimonials } from '../database/schema';
import { HttpError, nowIso, uid, type DB } from '../lib/context';
import { DEFAULT_SERVICES, DEMO_PROJECTS, defaultSiteSettings } from './defaults';

const parse = <T>(s: string | null | undefined, fallback: T): T => {
  if (!s) return fallback;
  try {
    return JSON.parse(s) as T;
  } catch {
    return fallback;
  }
};

export type SiteService = SiteServiceInput & { id: string; updatedAt: string };
export type SiteProject = SiteProjectInput & { id: string; isDemo: boolean; createdAt: string; updatedAt: string };
export type SiteTestimonial = SiteTestimonialInput & { id: string };

const serviceDto = (r: typeof siteServices.$inferSelect): SiteService => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  summary: r.summary,
  body: r.body,
  features: parse<string[]>(r.features, []),
  image: parse<SiteImage | null>(r.image, null),
  sort: r.sort,
  active: r.active,
  updatedAt: r.updatedAt,
});

const projectDto = (r: typeof siteProjects.$inferSelect): SiteProject => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  category: r.category,
  summary: r.summary,
  description: r.description,
  features: parse<string[]>(r.features, []),
  materials: r.materials,
  location: r.location,
  year: r.year,
  images: parse<SiteImage[]>(r.images, []),
  coverIndex: r.coverIndex,
  featured: r.featured,
  published: r.published,
  isDemo: r.isDemo,
  sort: r.sort,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

const testimonialDto = (r: typeof siteTestimonials.$inferSelect): SiteTestimonial => ({
  id: r.id,
  name: r.name,
  role: r.role,
  text: r.text,
  rating: r.rating,
  source: r.source,
  published: r.published,
  sort: r.sort,
});

export const cover = (p: Pick<SiteProject, 'images' | 'coverIndex'>): SiteImage | null => p.images[p.coverIndex] ?? p.images[0] ?? null;

/** Cria o conteúdo inicial do site da empresa (uma vez). */
export async function ensureSiteSeed(db: DB, companyId: string) {
  const existing = await db.select({ id: siteSettings.companyId }).from(siteSettings).where(eq(siteSettings.companyId, companyId)).get();
  if (existing) return;
  const company = await db.select({ name: companies.name }).from(companies).where(eq(companies.id, companyId)).get();
  if (!company) throw new HttpError(500, 'Empresa do site não encontrada (verifique SITE_COMPANY_ID).');
  const settings = defaultSiteSettings('WJR Serralheria');
  await db.batch([
    db.insert(siteSettings).values({ companyId, data: JSON.stringify(settings) }).onConflictDoNothing(),
    ...DEFAULT_SERVICES.map((s) =>
      db
        .insert(siteServices)
        .values({ ...serviceRow(s), id: uid(), companyId })
        .onConflictDoNothing(),
    ),
    ...DEMO_PROJECTS.map((p) =>
      db
        .insert(siteProjects)
        .values({ ...projectRow(p), id: uid(), companyId, isDemo: true })
        .onConflictDoNothing(),
    ),
  ]);
}

// ───────── Configurações ─────────
export async function getSettings(db: DB, companyId: string): Promise<SiteSettings> {
  await ensureSiteSeed(db, companyId);
  const row = await db.select().from(siteSettings).where(eq(siteSettings.companyId, companyId)).get();
  const r = siteSettingsSchema.safeParse(parse(row?.data, {}));
  return r.success ? r.data : defaultSiteSettings('WJR Serralheria');
}

export async function saveSettings(db: DB, companyId: string, data: SiteSettings) {
  await db
    .insert(siteSettings)
    .values({ companyId, data: JSON.stringify(data), updatedAt: nowIso() })
    .onConflictDoUpdate({ target: siteSettings.companyId, set: { data: JSON.stringify(data), updatedAt: nowIso() } });
}

// ───────── Serviços ─────────
const serviceRow = (s: SiteServiceInput) => ({
  slug: s.slug || slugify(s.title),
  title: s.title,
  summary: s.summary,
  body: s.body,
  features: JSON.stringify(s.features.filter(Boolean)),
  image: s.image ? JSON.stringify(s.image) : null,
  sort: s.sort,
  active: s.active,
});

export async function listServices(db: DB, companyId: string, onlyActive = false) {
  const rows = await db
    .select()
    .from(siteServices)
    .where(onlyActive ? and(eq(siteServices.companyId, companyId), eq(siteServices.active, true)) : eq(siteServices.companyId, companyId))
    .orderBy(asc(siteServices.sort), asc(siteServices.title));
  return rows.map(serviceDto);
}

async function uniqueSlug(db: DB, table: typeof siteServices | typeof siteProjects, companyId: string, base: string, exceptId?: string) {
  let slug = base || 'item';
  for (let i = 2; i < 50; i++) {
    const clash = await db
      .select({ id: table.id })
      .from(table)
      .where(and(eq(table.companyId, companyId), eq(table.slug, slug), exceptId ? ne(table.id, exceptId) : undefined))
      .get();
    if (!clash) return slug;
    slug = `${base}-${i}`;
  }
  return `${base}-${Date.now()}`;
}

export async function saveService(db: DB, companyId: string, data: SiteServiceInput, id?: string) {
  const row = serviceRow(data);
  row.slug = await uniqueSlug(db, siteServices, companyId, row.slug, id);
  if (id) {
    const r = await db
      .update(siteServices)
      .set({ ...row, updatedAt: nowIso() })
      .where(and(eq(siteServices.id, id), eq(siteServices.companyId, companyId)))
      .returning();
    if (!r[0]) throw new HttpError(404, 'Serviço não encontrado.');
    return serviceDto(r[0]);
  }
  const r = await db.insert(siteServices).values({ ...row, id: uid(), companyId }).returning();
  return serviceDto(r[0]);
}

export async function deleteService(db: DB, companyId: string, id: string) {
  await db.delete(siteServices).where(and(eq(siteServices.id, id), eq(siteServices.companyId, companyId)));
}

// ───────── Projetos ─────────
const projectRow = (p: SiteProjectInput) => ({
  slug: p.slug || slugify(p.title),
  title: p.title,
  category: p.category,
  summary: p.summary,
  description: p.description,
  features: JSON.stringify(p.features.filter(Boolean)),
  materials: p.materials,
  location: p.location,
  year: p.year,
  images: JSON.stringify(p.images),
  coverIndex: Math.min(p.coverIndex, Math.max(0, p.images.length - 1)),
  featured: p.featured,
  published: p.published,
  sort: p.sort,
});

export async function listProjects(db: DB, companyId: string, onlyPublished = false) {
  const rows = await db
    .select()
    .from(siteProjects)
    .where(onlyPublished ? and(eq(siteProjects.companyId, companyId), eq(siteProjects.published, true)) : eq(siteProjects.companyId, companyId))
    .orderBy(asc(siteProjects.sort), desc(siteProjects.createdAt));
  return rows.map(projectDto);
}

export async function saveProject(db: DB, companyId: string, data: SiteProjectInput, id?: string) {
  const row = projectRow(data);
  row.slug = await uniqueSlug(db, siteProjects, companyId, row.slug, id);
  // Projeto com fotos reais deixa de ser "demonstração".
  const isDemo = data.images.length > 0 && data.images.every((i) => i.demo);
  if (id) {
    const r = await db
      .update(siteProjects)
      .set({ ...row, isDemo, updatedAt: nowIso() })
      .where(and(eq(siteProjects.id, id), eq(siteProjects.companyId, companyId)))
      .returning();
    if (!r[0]) throw new HttpError(404, 'Projeto não encontrado.');
    return projectDto(r[0]);
  }
  const r = await db.insert(siteProjects).values({ ...row, isDemo, id: uid(), companyId }).returning();
  return projectDto(r[0]);
}

export async function deleteProject(db: DB, companyId: string, id: string) {
  const row = await db.select().from(siteProjects).where(and(eq(siteProjects.id, id), eq(siteProjects.companyId, companyId))).get();
  if (!row) return null;
  await db.delete(siteProjects).where(eq(siteProjects.id, id));
  return projectDto(row);
}

// ───────── Depoimentos ─────────
export async function listTestimonials(db: DB, companyId: string, onlyPublished = false) {
  const rows = await db
    .select()
    .from(siteTestimonials)
    .where(onlyPublished ? and(eq(siteTestimonials.companyId, companyId), eq(siteTestimonials.published, true)) : eq(siteTestimonials.companyId, companyId))
    .orderBy(asc(siteTestimonials.sort), desc(siteTestimonials.createdAt));
  return rows.map(testimonialDto);
}

export async function saveTestimonial(db: DB, companyId: string, data: SiteTestimonialInput, id?: string) {
  if (id) {
    const r = await db
      .update(siteTestimonials)
      .set(data)
      .where(and(eq(siteTestimonials.id, id), eq(siteTestimonials.companyId, companyId)))
      .returning();
    if (!r[0]) throw new HttpError(404, 'Depoimento não encontrado.');
    return testimonialDto(r[0]);
  }
  const r = await db.insert(siteTestimonials).values({ ...data, id: uid(), companyId }).returning();
  return testimonialDto(r[0]);
}

export async function deleteTestimonial(db: DB, companyId: string, id: string) {
  await db.delete(siteTestimonials).where(and(eq(siteTestimonials.id, id), eq(siteTestimonials.companyId, companyId)));
}

// ───────── Solicitações ─────────
export type SiteLead = Omit<typeof siteLeads.$inferSelect, 'files'> & { files: LeadFile[] };
export interface LeadFile {
  key: string;
  name: string;
  type: string;
  size: number;
}

export const leadDto = (r: typeof siteLeads.$inferSelect): SiteLead => ({ ...r, files: parse<LeadFile[]>(r.files, []) });
