/**
 * Conteúdo do site institucional (compartilhado entre o Worker e o painel do site).
 * Tudo o que é informação da empresa fica aqui, editável pelo painel — nada espalhado no código.
 */
import { z } from 'zod';

const s = (max: number) => z.string().trim().max(max).default('');

/** Imagem: arquivo enviado pelo painel (/media/…) ou URL externa. `demo` = imagem ilustrativa, não é trabalho da empresa. */
export const siteImageSchema = z.object({
  src: z.string().trim().max(600),
  srcSm: s(600),
  alt: s(200),
  demo: z.boolean().default(false),
  credit: s(120),
});
export type SiteImage = z.infer<typeof siteImageSchema>;

const textItem = z.object({ title: s(80), text: s(400) });

export const siteSettingsSchema = z.object({
  company: z.object({
    name: s(80),
    legalName: s(120),
    cnpj: s(20),
    tagline: s(140),
    description: s(400),
    phone: s(30),
    whatsapp: s(30),
    email: s(120),
    address: s(200),
    city: s(80),
    state: s(2),
    region: s(200),
    hours: s(200),
    instagram: s(120),
    facebook: s(200),
    mapsUrl: s(400),
  }),
  hero: z.object({
    eyebrow: s(80),
    title: s(120),
    subtitle: s(300),
    image: siteImageSchema.nullable().default(null),
    videoUrl: s(400),
  }),
  intro: z.object({ title: s(200), text: s(800) }),
  differentials: z.object({ title: s(120), items: z.array(textItem).max(8).default([]) }),
  /** Números da empresa. Vazio = a faixa não aparece. Nunca preencher com valores inventados. */
  stats: z.array(z.object({ value: s(12), label: s(60) })).max(4).default([]),
  about: z.object({
    title: s(120),
    text: s(3000),
    image: siteImageSchema.nullable().default(null),
    image2: siteImageSchema.nullable().default(null),
    highlights: z.array(textItem).max(6).default([]),
  }),
  process: z.object({ title: s(120), steps: z.array(textItem).max(8).default([]) }),
  cta: z.object({ title: s(120), text: s(300), image: siteImageSchema.nullable().default(null) }),
  seo: z.object({ title: s(70), description: s(170) }),
  /** Categorias do portfólio (filtros). */
  projectCategories: z.array(z.string().trim().min(1).max(40)).max(16).default([]),
});
export type SiteSettings = z.infer<typeof siteSettingsSchema>;

const slug = z
  .string()
  .trim()
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use letras minúsculas, números e hífens.')
  .or(z.literal(''))
  .default('');

export const siteServiceSchema = z.object({
  slug,
  title: z.string().trim().min(2, 'Informe o nome.').max(80),
  summary: s(240),
  body: s(4000),
  features: z.array(z.string().trim().max(120)).max(12).default([]),
  image: siteImageSchema.nullable().default(null),
  sort: z.coerce.number().int().default(0),
  active: z.boolean().default(true),
});
export type SiteServiceInput = z.infer<typeof siteServiceSchema>;

export const siteProjectSchema = z.object({
  slug,
  title: z.string().trim().min(2, 'Informe o título.').max(120),
  category: s(40),
  summary: s(240),
  description: s(5000),
  features: z.array(z.string().trim().max(160)).max(16).default([]),
  materials: s(300),
  location: s(120),
  year: s(4),
  images: z.array(siteImageSchema).max(30).default([]),
  coverIndex: z.coerce.number().int().min(0).default(0),
  featured: z.boolean().default(false),
  published: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
});
export type SiteProjectInput = z.infer<typeof siteProjectSchema>;

export const siteTestimonialSchema = z.object({
  name: z.string().trim().min(2, 'Informe o nome.').max(80),
  role: s(80),
  text: z.string().trim().min(5, 'Escreva o depoimento.').max(800),
  rating: z.coerce.number().int().min(1).max(5).nullable().default(null),
  source: s(60),
  published: z.boolean().default(true),
  sort: z.coerce.number().int().default(0),
});
export type SiteTestimonialInput = z.infer<typeof siteTestimonialSchema>;

/** Solicitação de orçamento enviada pelo formulário público. */
export const leadSchema = z.object({
  name: z.string().trim().min(2, 'Informe seu nome.').max(80),
  phone: z
    .string()
    .trim()
    .max(30)
    .refine((v) => v.replace(/\D/g, '').length >= 10, 'Informe um telefone com DDD.'),
  city: z.string().trim().min(2, 'Informe a cidade.').max(80),
  service: s(80),
  material: s(80),
  description: z.string().trim().min(10, 'Descreva o projeto em poucas palavras.').max(3000),
  measures: s(300),
  reference: s(120),
});
export type LeadInput = z.infer<typeof leadSchema>;

export const LEAD_STATUS = ['novo', 'visto', 'respondido', 'arquivado'] as const;
export type LeadStatus = (typeof LEAD_STATUS)[number];

export const slugify = (v: string) =>
  v
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

/** Limites de envio (compartilhados entre formulário e servidor). */
export const LEAD_FILES = { max: 5, maxBytes: 8 * 1024 * 1024, totalBytes: 20 * 1024 * 1024 };
export const LEAD_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf'];
