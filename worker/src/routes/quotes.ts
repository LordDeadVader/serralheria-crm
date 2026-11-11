import { Hono } from 'hono';
import { z } from 'zod';
import { quoteCrmSchema, quoteDocumentSchema, quoteSaveSchema, quoteStatusSchema } from '../../../src/schemas/quote';
import * as repo from '../repositories/quotes';
import type { AppEnv } from '../lib/context';
import { body } from '../lib/validate';

const newVersionSchema = z.object({ document: quoteDocumentSchema.optional() });

export const quoteRoutes = new Hono<AppEnv>()
  .get('/', async (c) =>
    c.json(
      await repo.listQuotes(c.var.db, c.var.auth.companyId, {
        status: c.req.query('status') || undefined,
        clientId: c.req.query('clientId') || undefined,
        q: c.req.query('q') || undefined,
      }),
    ),
  )
  .get('/:id', async (c) => {
    const v = c.req.query('version');
    return c.json(await repo.getQuoteDetail(c.var.db, c.var.auth.companyId, c.req.param('id'), v ? Number(v) : undefined));
  })
  .post('/', async (c) => {
    const data = await body(c, quoteSaveSchema);
    return c.json(await repo.createQuote(c.var.db, c.var.auth.companyId, c.var.auth.userId, data.document, data.status ?? 'rascunho'), 201);
  })
  .put('/:id', async (c) => {
    const data = await body(c, quoteSaveSchema);
    return c.json(await repo.saveQuote(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), data.document, data.status));
  })
  .post('/:id/versions', async (c) => {
    const data = await body(c, newVersionSchema);
    return c.json(await repo.newVersion(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), data.document), 201);
  })
  .post('/:id/duplicate', async (c) => c.json(await repo.duplicateQuote(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id')), 201))
  .post('/:id/status', async (c) => {
    const data = await body(c, quoteStatusSchema);
    return c.json(await repo.changeStatus(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), data.status, data.lossReason, data.note));
  })
  .put('/:id/crm', async (c) => {
    const data = await body(c, quoteCrmSchema);
    return c.json(await repo.updateCrm(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), data));
  })
  .delete('/:id', async (c) => {
    await repo.deleteQuote(c.var.db, c.var.auth.companyId, c.req.param('id'));
    return c.json({ ok: true });
  });

export const dashboardRoutes = new Hono<AppEnv>().get('/', async (c) => c.json(await repo.dashboard(c.var.db, c.var.auth.companyId)));
