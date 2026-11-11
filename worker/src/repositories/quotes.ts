/**
 * Repositório de orçamentos: numeração, versões imutáveis após envio, histórico (eventos) e CRM.
 * Totais são SEMPRE recalculados no servidor pelo mesmo motor financeiro do frontend.
 */
import { and, asc, desc, eq, sql } from 'drizzle-orm';
import { calculateDocument } from '../../../src/calculations/quote';
import type { QuoteDocument } from '../../../src/schemas/quote';
import { EDITABLE_STATUSES, STATUS_LABEL, type QuoteStatus } from '../../../src/types/domain';
import { clients, companies, quoteEvents, quotes, quoteVersions, users } from '../database/schema';
import { HttpError, nowIso, uid, type DB } from '../lib/context';
import { parseSettings } from '../routes/company';

const LOCKED_FOREVER: QuoteStatus[] = ['em_producao', 'concluido'];

function computeTotals(doc: QuoteDocument) {
  const totals = calculateDocument(doc);
  if (!totals.valid) throw new HttpError(422, totals.errors.join(' '), { errors: totals.errors });
  return totals;
}

async function assertClient(db: DB, companyId: string, clientId: string) {
  const c = await db.select({ id: clients.id }).from(clients).where(and(eq(clients.id, clientId), eq(clients.companyId, companyId))).get();
  if (!c) throw new HttpError(422, 'Cliente inválido.');
}

async function getQuoteRow(db: DB, companyId: string, id: string) {
  const q = await db.select().from(quotes).where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))).get();
  if (!q) throw new HttpError(404, 'Orçamento não encontrado.');
  return q;
}

const event = (companyId: string, quoteId: string, userId: string, type: string, message: string) => ({
  id: uid(),
  companyId,
  quoteId,
  userId,
  type,
  message,
});

export async function listQuotes(db: DB, companyId: string, opts: { status?: string; clientId?: string; q?: string }) {
  const conds = [eq(quotes.companyId, companyId)];
  if (opts.status) conds.push(eq(quotes.status, opts.status));
  if (opts.clientId) conds.push(eq(quotes.clientId, opts.clientId));
  if (opts.q) {
    const t = `%${opts.q.replace(/[%_]/g, '')}%`;
    conds.push(sql`(${quotes.title} like ${t} or ${quotes.code} like ${t} or ${clients.name} like ${t})`);
  }
  const rows = await db
    .select({ q: quotes, clientName: clients.name })
    .from(quotes)
    .innerJoin(clients, eq(clients.id, quotes.clientId))
    .where(and(...conds))
    .orderBy(desc(quotes.updatedAt))
    .limit(1000);
  return rows.map((r) => summary(r.q, r.clientName));
}

function summary(q: typeof quotes.$inferSelect, clientName: string) {
  return {
    id: q.id,
    number: q.number,
    code: q.code,
    title: q.title,
    status: q.status,
    clientId: q.clientId,
    clientName,
    currentVersion: q.currentVersion,
    total: q.total,
    totalCost: q.totalCost,
    responsible: q.responsible,
    lastContactAt: q.lastContactAt,
    nextFollowupAt: q.nextFollowupAt,
    lossReason: q.lossReason,
    crmNotes: q.crmNotes,
    createdAt: q.createdAt,
    updatedAt: q.updatedAt,
  };
}

function versionDto(v: typeof quoteVersions.$inferSelect, createdByName: string | null) {
  return {
    id: v.id,
    version: v.version,
    document: JSON.parse(v.document),
    totals: JSON.parse(v.totals),
    createdAt: v.createdAt,
    createdByName,
    locked: v.locked,
  };
}

export async function getQuoteDetail(db: DB, companyId: string, id: string, version?: number) {
  const q = await getQuoteRow(db, companyId, id);
  const client = await db.select().from(clients).where(and(eq(clients.id, q.clientId), eq(clients.companyId, companyId))).get();
  const versions = await db
    .select({ v: quoteVersions, name: users.name })
    .from(quoteVersions)
    .leftJoin(users, eq(users.id, quoteVersions.createdBy))
    .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.companyId, companyId)))
    .orderBy(asc(quoteVersions.version));
  const target = version ?? q.currentVersion;
  const cur = versions.find((v) => v.v.version === target);
  if (!cur) throw new HttpError(404, 'Versão não encontrada.');
  const events = await db
    .select({ id: quoteEvents.id, type: quoteEvents.type, message: quoteEvents.message, createdAt: quoteEvents.createdAt, userName: users.name })
    .from(quoteEvents)
    .leftJoin(users, eq(users.id, quoteEvents.userId))
    .where(and(eq(quoteEvents.quoteId, id), eq(quoteEvents.companyId, companyId)))
    .orderBy(desc(quoteEvents.createdAt));
  return {
    ...summary(q, client?.name ?? ''),
    client: client ?? null,
    current: versionDto(cur.v, cur.name),
    versions: versions.map((v) => ({
      id: v.v.id,
      version: v.v.version,
      total: v.v.total,
      locked: v.v.locked,
      createdAt: v.v.createdAt,
      createdByName: v.name,
    })),
    events,
  };
}

export async function createQuote(db: DB, companyId: string, userId: string, doc: QuoteDocument, status: QuoteStatus = 'rascunho') {
  await assertClient(db, companyId, doc.clientId);
  const totals = computeTotals(doc);
  const [seq] = await db
    .update(companies)
    .set({ quoteSeq: sql`${companies.quoteSeq} + 1` })
    .where(eq(companies.id, companyId))
    .returning({ n: companies.quoteSeq, settings: companies.settings });
  const settings = parseSettings(seq.settings);
  const prefix = settings.quote.numberPrefix || 'ORC';
  const code = `${prefix}-${new Date().getFullYear()}-${String(seq.n).padStart(4, '0')}`;
  const id = uid();
  await db.batch([
    db.insert(quotes).values({
      id,
      companyId,
      number: seq.n,
      code,
      clientId: doc.clientId,
      title: doc.project.name,
      status,
      currentVersion: 1,
      total: totals.finalPrice,
      totalCost: totals.totalCost,
      responsible: doc.commercial.responsible,
      createdBy: userId,
    }),
    db.insert(quoteVersions).values({
      id: uid(),
      companyId,
      quoteId: id,
      version: 1,
      document: JSON.stringify(doc),
      totals: JSON.stringify(totals),
      total: totals.finalPrice,
      createdBy: userId,
    }),
    db.insert(quoteEvents).values(event(companyId, id, userId, 'created', `Orçamento ${code} criado (versão 1).`)),
  ]);
  return getQuoteDetail(db, companyId, id);
}

/** Salva a versão atual. Bloqueado se a versão já foi enviada/aprovada — exige nova versão. */
export async function saveQuote(db: DB, companyId: string, userId: string, id: string, doc: QuoteDocument, status?: QuoteStatus) {
  const q = await getQuoteRow(db, companyId, id);
  await assertClient(db, companyId, doc.clientId);
  const cur = await db
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.version, q.currentVersion), eq(quoteVersions.companyId, companyId)))
    .get();
  if (!cur) throw new HttpError(404, 'Versão não encontrada.');
  if (cur.locked) {
    throw new HttpError(409, 'Esta versão já foi enviada ao cliente e não pode ser sobrescrita. Gere uma nova versão.');
  }
  const totals = computeTotals(doc);
  const ts = nowIso();
  const nextStatus = status && EDITABLE_STATUSES.includes(q.status as QuoteStatus) ? status : q.status;
  await db.batch([
    db
      .update(quoteVersions)
      .set({ document: JSON.stringify(doc), totals: JSON.stringify(totals), total: totals.finalPrice, updatedAt: ts })
      .where(eq(quoteVersions.id, cur.id)),
    db
      .update(quotes)
      .set({ title: doc.project.name, clientId: doc.clientId, total: totals.finalPrice, totalCost: totals.totalCost, responsible: doc.commercial.responsible, status: nextStatus, updatedAt: ts })
      .where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))),
    db.insert(quoteEvents).values(event(companyId, id, userId, 'saved', `Versão ${q.currentVersion} salva. Total: R$ ${totals.finalPrice.toFixed(2).replace('.', ',')}.`)),
  ]);
  return getQuoteDetail(db, companyId, id);
}

/** Gera nova versão a partir de um documento (ou copiando a versão atual). Versões anteriores ficam preservadas. */
export async function newVersion(db: DB, companyId: string, userId: string, id: string, doc?: QuoteDocument) {
  const q = await getQuoteRow(db, companyId, id);
  if (LOCKED_FOREVER.includes(q.status as QuoteStatus)) {
    throw new HttpError(409, `Orçamento ${STATUS_LABEL[q.status as QuoteStatus].toLowerCase()} não aceita novas versões.`);
  }
  const cur = await db
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.version, q.currentVersion), eq(quoteVersions.companyId, companyId)))
    .get();
  if (!cur) throw new HttpError(404, 'Versão não encontrada.');
  const document: QuoteDocument = doc ?? JSON.parse(cur.document);
  await assertClient(db, companyId, document.clientId);
  const totals = computeTotals(document);
  const version = q.currentVersion + 1;
  const ts = nowIso();
  // Ao abrir nova versão de um orçamento já enviado/aprovado, ele volta para negociação.
  const nextStatus: QuoteStatus = EDITABLE_STATUSES.includes(q.status as QuoteStatus) ? (q.status as QuoteStatus) : 'em_negociacao';
  await db.batch([
    db.update(quoteVersions).set({ locked: true }).where(eq(quoteVersions.id, cur.id)),
    db.insert(quoteVersions).values({
      id: uid(),
      companyId,
      quoteId: id,
      version,
      document: JSON.stringify(document),
      totals: JSON.stringify(totals),
      total: totals.finalPrice,
      createdBy: userId,
    }),
    db
      .update(quotes)
      .set({ currentVersion: version, title: document.project.name, clientId: document.clientId, total: totals.finalPrice, totalCost: totals.totalCost, status: nextStatus, updatedAt: ts })
      .where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))),
    db.insert(quoteEvents).values(
      event(companyId, id, userId, 'version', `Versão ${version} criada a partir da versão ${q.currentVersion}.${nextStatus !== q.status ? ` Status alterado para ${STATUS_LABEL[nextStatus]}.` : ''}`),
    ),
  ]);
  return getQuoteDetail(db, companyId, id);
}

export async function duplicateQuote(db: DB, companyId: string, userId: string, id: string) {
  const q = await getQuoteRow(db, companyId, id);
  const cur = await db
    .select()
    .from(quoteVersions)
    .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.version, q.currentVersion), eq(quoteVersions.companyId, companyId)))
    .get();
  if (!cur) throw new HttpError(404, 'Versão não encontrada.');
  const doc: QuoteDocument = JSON.parse(cur.document);
  doc.project.name = `${doc.project.name} (cópia)`.slice(0, 160);
  const created = await createQuote(db, companyId, userId, doc);
  await db.insert(quoteEvents).values(event(companyId, created.id, userId, 'duplicated', `Duplicado a partir de ${q.code}.`));
  return created;
}

export async function changeStatus(db: DB, companyId: string, userId: string, id: string, status: QuoteStatus, lossReason?: string, note?: string) {
  const q = await getQuoteRow(db, companyId, id);
  if (q.status === status) return getQuoteDetail(db, companyId, id);
  const ts = nowIso();
  const lock = !EDITABLE_STATUSES.includes(status);
  const ops = [
    db
      .update(quotes)
      .set({
        status,
        updatedAt: ts,
        ...(status === 'reprovado' || status === 'cancelado' ? { lossReason: lossReason ?? q.lossReason } : {}),
        ...(status === 'enviado' ? { lastContactAt: ts.slice(0, 10) } : {}),
      })
      .where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))),
    db.insert(quoteEvents).values(
      event(
        companyId,
        id,
        userId,
        'status',
        `Status: ${STATUS_LABEL[q.status as QuoteStatus] ?? q.status} → ${STATUS_LABEL[status]}.${lossReason ? ` Motivo: ${lossReason}.` : ''}${note ? ` ${note}` : ''}`,
      ),
    ),
  ];
  const all = lock
    ? [
        ...ops,
        db
          .update(quoteVersions)
          .set({ locked: true })
          .where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.version, q.currentVersion), eq(quoteVersions.companyId, companyId))),
      ]
    : ops;
  await db.batch(all as [(typeof all)[0], ...typeof all]);
  return getQuoteDetail(db, companyId, id);
}

export async function updateCrm(
  db: DB,
  companyId: string,
  userId: string,
  id: string,
  data: { responsible: string; lastContactAt: string | null; nextFollowupAt: string | null; crmNotes: string; lossReason: string },
) {
  await getQuoteRow(db, companyId, id);
  await db.batch([
    db.update(quotes).set({ ...data, updatedAt: nowIso() }).where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))),
    db.insert(quoteEvents).values(event(companyId, id, userId, 'crm', 'Informações de acompanhamento atualizadas.')),
  ]);
  return getQuoteDetail(db, companyId, id);
}

export async function deleteQuote(db: DB, companyId: string, id: string) {
  const q = await getQuoteRow(db, companyId, id);
  if (!['rascunho', 'em_elaboracao', 'cancelado'].includes(q.status)) {
    throw new HttpError(409, 'Somente rascunhos, orçamentos em elaboração ou cancelados podem ser excluídos.');
  }
  await db.batch([
    db.delete(quoteEvents).where(and(eq(quoteEvents.quoteId, id), eq(quoteEvents.companyId, companyId))),
    db.delete(quoteVersions).where(and(eq(quoteVersions.quoteId, id), eq(quoteVersions.companyId, companyId))),
    db.delete(quotes).where(and(eq(quotes.id, id), eq(quotes.companyId, companyId))),
  ]);
}

export async function dashboard(db: DB, companyId: string) {
  const byStatus = await db
    .select({ status: quotes.status, n: sql<number>`count(*)`, total: sql<number>`coalesce(sum(${quotes.total}),0)` })
    .from(quotes)
    .where(eq(quotes.companyId, companyId))
    .groupBy(quotes.status);
  const counts = await db
    .select({
      clients: sql<number>`(select count(*) from clients where company_id = ${companyId} and archived_at is null)`,
      materials: sql<number>`(select count(*) from materials where company_id = ${companyId} and status = 'ativo')`,
      services: sql<number>`(select count(*) from services where company_id = ${companyId} and status = 'ativo')`,
    })
    .from(companies)
    .where(eq(companies.id, companyId))
    .get();
  const recent = await listQuotes(db, companyId, {});
  const today = new Date().toISOString().slice(0, 10);
  const followups = recent
    .filter((q) => q.nextFollowupAt && q.nextFollowupAt <= addDays(today, 7) && !['aprovado', 'reprovado', 'cancelado', 'concluido', 'em_producao'].includes(q.status))
    .sort((a, b) => (a.nextFollowupAt ?? '').localeCompare(b.nextFollowupAt ?? ''))
    .slice(0, 8);
  const monthly = await db
    .select({
      month: sql<string>`substr(${quotes.createdAt},1,7)`,
      created: sql<number>`count(*)`,
      approved: sql<number>`sum(case when ${quotes.status} in ('aprovado','em_producao','concluido') then 1 else 0 end)`,
      approvedTotal: sql<number>`coalesce(sum(case when ${quotes.status} in ('aprovado','em_producao','concluido') then ${quotes.total} else 0 end),0)`,
      approvedCost: sql<number>`coalesce(sum(case when ${quotes.status} in ('aprovado','em_producao','concluido') then ${quotes.totalCost} else 0 end),0)`,
      quotedTotal: sql<number>`coalesce(sum(${quotes.total}),0)`,
    })
    .from(quotes)
    .where(eq(quotes.companyId, companyId))
    .groupBy(sql`substr(${quotes.createdAt},1,7)`)
    .orderBy(desc(sql`substr(${quotes.createdAt},1,7)`))
    .limit(12);
  return { byStatus, counts, recent: recent.slice(0, 8), followups, monthly };
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
