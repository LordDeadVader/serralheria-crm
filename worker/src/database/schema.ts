/**
 * Esquema do banco (Cloudflare D1 / SQLite) via Drizzle ORM.
 * Toda tabela de negócio possui company_id: o isolamento entre empresas é garantido
 * pelos repositórios, que SEMPRE filtram pelo company_id da sessão autenticada.
 */
import { sql } from 'drizzle-orm';
import { index, integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

const now = sql`(strftime('%Y-%m-%dT%H:%M:%fZ','now'))`;

export const companies = sqliteTable('companies', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  legalName: text('legal_name').notNull().default(''),
  cnpj: text('cnpj').notNull().default(''),
  address: text('address').notNull().default(''),
  phone: text('phone').notNull().default(''),
  whatsapp: text('whatsapp').notNull().default(''),
  email: text('email').notNull().default(''),
  logo: text('logo'),
  settings: text('settings').notNull().default('{}'),
  quoteSeq: integer('quote_seq').notNull().default(0),
  createdAt: text('created_at').notNull().default(now),
  updatedAt: text('updated_at').notNull().default(now),
});

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    role: text('role', { enum: ['owner', 'member'] }).notNull().default('owner'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [uniqueIndex('users_email_uq').on(t.email), index('users_company_idx').on(t.companyId)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(), // SHA-256 do token; o token em si nunca é armazenado
    userId: text('user_id').notNull().references(() => users.id),
    companyId: text('company_id').notNull().references(() => companies.id),
    expiresAt: text('expires_at').notNull(),
    createdAt: text('created_at').notNull().default(now),
    userAgent: text('user_agent').notNull().default(''),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const invites = sqliteTable('invites', {
  id: text('id').primaryKey(),
  codeHash: text('code_hash').notNull().unique(),
  note: text('note').notNull().default(''),
  expiresAt: text('expires_at').notNull(),
  usedAt: text('used_at'),
  usedByUserId: text('used_by_user_id'),
  createdAt: text('created_at').notNull().default(now),
});

export const loginAttempts = sqliteTable('login_attempts', {
  key: text('key').primaryKey(),
  count: integer('count').notNull().default(0),
  resetAt: integer('reset_at').notNull(),
});

export const clients = sqliteTable(
  'clients',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    personType: text('person_type', { enum: ['PF', 'PJ'] }).notNull().default('PF'),
    document: text('document').notNull().default(''),
    phone: text('phone').notNull().default(''),
    whatsapp: text('whatsapp').notNull().default(''),
    email: text('email').notNull().default(''),
    cep: text('cep').notNull().default(''),
    street: text('street').notNull().default(''),
    number: text('number').notNull().default(''),
    district: text('district').notNull().default(''),
    city: text('city').notNull().default(''),
    state: text('state').notNull().default(''),
    complement: text('complement').notNull().default(''),
    notes: text('notes').notNull().default(''),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('clients_company_idx').on(t.companyId, t.name)],
);

export const suppliers = sqliteTable(
  'suppliers',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    document: text('document').notNull().default(''),
    phone: text('phone').notNull().default(''),
    email: text('email').notNull().default(''),
    contact: text('contact').notNull().default(''),
    notes: text('notes').notNull().default(''),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('suppliers_company_idx').on(t.companyId)],
);

export const materials = sqliteTable(
  'materials',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    code: text('code').notNull().default(''),
    name: text('name').notNull(),
    category: text('category').notNull().default(''),
    description: text('description').notNull().default(''),
    purchaseUnit: text('purchase_unit').notNull(),
    packQty: real('pack_qty').notNull(),
    packUnit: text('pack_unit').notNull(),
    usageUnit: text('usage_unit').notNull(),
    purchasePrice: real('purchase_price').notNull(),
    supplierId: text('supplier_id').references(() => suppliers.id),
    lengthMm: real('length_mm'),
    widthMm: real('width_mm'),
    thicknessMm: real('thickness_mm'),
    weightKg: real('weight_kg'),
    status: text('status', { enum: ['ativo', 'inativo'] }).notNull().default('ativo'),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    priceUpdatedAt: text('price_updated_at').notNull().default(now),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('materials_company_idx').on(t.companyId, t.name)],
);

export const materialPriceHistory = sqliteTable(
  'material_price_history',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    materialId: text('material_id').notNull().references(() => materials.id, { onDelete: 'cascade' }),
    price: real('price').notNull(),
    packQty: real('pack_qty').notNull(),
    packUnit: text('pack_unit').notNull(),
    userId: text('user_id'),
    changedAt: text('changed_at').notNull().default(now),
  },
  (t) => [index('mph_material_idx').on(t.materialId)],
);

export const services = sqliteTable(
  'services',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    description: text('description').notNull().default(''),
    category: text('category').notNull().default(''),
    mode: text('mode', { enum: ['hour', 'fixed'] }).notNull().default('hour'),
    unit: text('unit').notNull().default('h'),
    hourlyCost: real('hourly_cost').notNull().default(0),
    fixedPrice: real('fixed_price').notNull().default(0),
    estimatedHours: real('estimated_hours').notNull().default(0),
    status: text('status', { enum: ['ativo', 'inativo'] }).notNull().default('ativo'),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('services_company_idx').on(t.companyId)],
);

export const quotes = sqliteTable(
  'quotes',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    number: integer('number').notNull(),
    code: text('code').notNull(),
    clientId: text('client_id').notNull().references(() => clients.id),
    title: text('title').notNull(),
    status: text('status').notNull().default('rascunho'),
    currentVersion: integer('current_version').notNull().default(1),
    total: real('total').notNull().default(0),
    totalCost: real('total_cost').notNull().default(0),
    responsible: text('responsible').notNull().default(''),
    lastContactAt: text('last_contact_at'),
    nextFollowupAt: text('next_followup_at'),
    lossReason: text('loss_reason').notNull().default(''),
    crmNotes: text('crm_notes').notNull().default(''),
    createdBy: text('created_by'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [
    uniqueIndex('quotes_company_number_uq').on(t.companyId, t.number),
    index('quotes_company_status_idx').on(t.companyId, t.status),
    index('quotes_client_idx').on(t.clientId),
  ],
);

export const quoteVersions = sqliteTable(
  'quote_versions',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    quoteId: text('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    document: text('document').notNull(),
    totals: text('totals').notNull(),
    total: real('total').notNull().default(0),
    locked: integer('locked', { mode: 'boolean' }).notNull().default(false),
    createdBy: text('created_by'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('quote_versions_uq').on(t.quoteId, t.version)],
);

export const quoteEvents = sqliteTable(
  'quote_events',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    quoteId: text('quote_id').notNull().references(() => quotes.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    message: text('message').notNull(),
    userId: text('user_id'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('quote_events_quote_idx').on(t.quoteId)],
);

/* ------------------------------- Estoque ------------------------------- */

/** Itens de estoque: materiais, insumos (estanho, eletrodo, disco…), ferramentas, EPIs etc. */
export const stockItems = sqliteTable(
  'stock_items',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['material', 'insumo', 'ferramenta', 'epi', 'outro'] }).notNull().default('insumo'),
    category: text('category').notNull().default(''),
    unit: text('unit').notNull().default('un'),
    /** Saldo atual. Só muda por movimentação (entrada, saída ou ajuste). */
    quantity: real('quantity').notNull().default(0),
    minQuantity: real('min_quantity').notNull().default(0),
    location: text('location').notNull().default(''),
    materialId: text('material_id').references(() => materials.id, { onDelete: 'set null' }),
    notes: text('notes').notNull().default(''),
    archivedAt: text('archived_at'),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('stock_items_company_idx').on(t.companyId, t.name)],
);

/** Histórico de movimentações: quem, quando, quanto e o saldo resultante. */
export const stockMovements = sqliteTable(
  'stock_movements',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    itemId: text('item_id').notNull().references(() => stockItems.id, { onDelete: 'cascade' }),
    type: text('type', { enum: ['entrada', 'saida', 'ajuste'] }).notNull(),
    /** entrada/saída: quantidade movimentada; ajuste: diferença aplicada (contagem − saldo anterior). */
    qty: real('qty').notNull(),
    balanceAfter: real('balance_after').notNull(),
    reference: text('reference').notNull().default(''),
    note: text('note').notNull().default(''),
    userId: text('user_id'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('stock_mov_item_idx').on(t.itemId, t.createdAt)],
);

/* --------------------------- Modelos e kits --------------------------- */

/** Serviços predefinidos e kits de insumos. O conteúdo (linhas) fica em JSON validado por templateSchema. */
export const templates = sqliteTable(
  'templates',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    kind: text('kind', { enum: ['projeto', 'kit'] }).notNull().default('projeto'),
    data: text('data').notNull().default('{}'),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [index('templates_company_idx').on(t.companyId, t.kind, t.name)],
);

// ───────────── Site institucional ─────────────
// Conteúdo público do site da empresa (editado pelo painel do site, lido pelas páginas públicas).

export const siteSettings = sqliteTable('site_settings', {
  companyId: text('company_id').primaryKey().references(() => companies.id),
  data: text('data').notNull().default('{}'),
  updatedAt: text('updated_at').notNull().default(now),
});

export const siteServices = sqliteTable(
  'site_services',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    summary: text('summary').notNull().default(''),
    body: text('body').notNull().default(''),
    features: text('features').notNull().default('[]'),
    image: text('image'),
    sort: integer('sort').notNull().default(0),
    active: integer('active', { mode: 'boolean' }).notNull().default(true),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('site_services_slug_uq').on(t.companyId, t.slug)],
);

export const siteProjects = sqliteTable(
  'site_projects',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    slug: text('slug').notNull(),
    title: text('title').notNull(),
    category: text('category').notNull().default(''),
    summary: text('summary').notNull().default(''),
    description: text('description').notNull().default(''),
    features: text('features').notNull().default('[]'),
    materials: text('materials').notNull().default(''),
    location: text('location').notNull().default(''),
    year: text('year').notNull().default(''),
    images: text('images').notNull().default('[]'),
    coverIndex: integer('cover_index').notNull().default(0),
    featured: integer('featured', { mode: 'boolean' }).notNull().default(false),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    isDemo: integer('is_demo', { mode: 'boolean' }).notNull().default(false),
    sort: integer('sort').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
    updatedAt: text('updated_at').notNull().default(now),
  },
  (t) => [uniqueIndex('site_projects_slug_uq').on(t.companyId, t.slug), index('site_projects_pub_idx').on(t.companyId, t.published)],
);

export const siteTestimonials = sqliteTable(
  'site_testimonials',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    role: text('role').notNull().default(''),
    text: text('text').notNull(),
    rating: integer('rating'),
    source: text('source').notNull().default(''),
    published: integer('published', { mode: 'boolean' }).notNull().default(true),
    sort: integer('sort').notNull().default(0),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('site_testimonials_company_idx').on(t.companyId)],
);

export const siteLeads = sqliteTable(
  'site_leads',
  {
    id: text('id').primaryKey(),
    companyId: text('company_id').notNull().references(() => companies.id),
    name: text('name').notNull(),
    phone: text('phone').notNull(),
    city: text('city').notNull().default(''),
    service: text('service').notNull().default(''),
    material: text('material').notNull().default(''),
    description: text('description').notNull().default(''),
    measures: text('measures').notNull().default(''),
    reference: text('reference').notNull().default(''),
    files: text('files').notNull().default('[]'),
    status: text('status', { enum: ['novo', 'visto', 'respondido', 'arquivado'] }).notNull().default('novo'),
    forwardStatus: text('forward_status').notNull().default(''),
    clientId: text('client_id'),
    createdAt: text('created_at').notNull().default(now),
  },
  (t) => [index('site_leads_company_idx').on(t.companyId, t.createdAt)],
);
