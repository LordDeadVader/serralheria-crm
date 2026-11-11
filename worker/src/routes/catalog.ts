import { Hono } from 'hono';
import { clientSchema, materialSchema, serviceSchema, supplierSchema } from '../../../src/schemas/entities';
import * as repo from '../repositories/catalog';
import { listQuotes } from '../repositories/quotes';
import type { AppEnv } from '../lib/context';
import { body } from '../lib/validate';

export const clientRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listClients(c.var.db, c.var.auth.companyId, c.req.query('q') ?? '', c.req.query('archived') === '1')))
  .get('/:id', async (c) => {
    const { db, auth } = c.var;
    const client = await repo.getClient(db, auth.companyId, c.req.param('id'));
    const quotes = await listQuotes(db, auth.companyId, { clientId: client.id });
    return c.json({ ...client, quotes });
  })
  .post('/', async (c) => c.json(await repo.createClient(c.var.db, c.var.auth.companyId, await body(c, clientSchema)), 201))
  .put('/:id', async (c) => c.json(await repo.updateClient(c.var.db, c.var.auth.companyId, c.req.param('id'), await body(c, clientSchema))))
  .post('/:id/archive', async (c) => c.json(await repo.setClientArchived(c.var.db, c.var.auth.companyId, c.req.param('id'), true)))
  .post('/:id/unarchive', async (c) => c.json(await repo.setClientArchived(c.var.db, c.var.auth.companyId, c.req.param('id'), false)))
  .delete('/:id', async (c) => {
    await repo.deleteClient(c.var.db, c.var.auth.companyId, c.req.param('id'));
    return c.json({ ok: true });
  });

export const supplierRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listSuppliers(c.var.db, c.var.auth.companyId, c.req.query('q') ?? '')))
  .post('/', async (c) => c.json(await repo.createSupplier(c.var.db, c.var.auth.companyId, await body(c, supplierSchema)), 201))
  .put('/:id', async (c) => c.json(await repo.updateSupplier(c.var.db, c.var.auth.companyId, c.req.param('id'), await body(c, supplierSchema))))
  .delete('/:id', async (c) => c.json(await repo.deleteSupplier(c.var.db, c.var.auth.companyId, c.req.param('id'))));

export const materialRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listMaterials(c.var.db, c.var.auth.companyId, c.req.query('q') ?? '')))
  .get('/:id/history', async (c) => c.json(await repo.materialHistory(c.var.db, c.var.auth.companyId, c.req.param('id'))))
  .post('/', async (c) =>
    c.json(await repo.createMaterial(c.var.db, c.var.auth.companyId, c.var.auth.userId, await body(c, materialSchema)), 201),
  )
  .put('/:id', async (c) =>
    c.json(await repo.updateMaterial(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), await body(c, materialSchema))),
  )
  .delete('/:id', async (c) => {
    await repo.deleteMaterial(c.var.db, c.var.auth.companyId, c.req.param('id'));
    return c.json({ ok: true });
  });

export const serviceRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listServices(c.var.db, c.var.auth.companyId)))
  .post('/', async (c) => c.json(await repo.createService(c.var.db, c.var.auth.companyId, await body(c, serviceSchema)), 201))
  .put('/:id', async (c) => c.json(await repo.updateService(c.var.db, c.var.auth.companyId, c.req.param('id'), await body(c, serviceSchema))))
  .delete('/:id', async (c) => {
    await repo.deleteService(c.var.db, c.var.auth.companyId, c.req.param('id'));
    return c.json({ ok: true });
  });
