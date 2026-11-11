import { Hono } from 'hono';
import { stockItemSchema, stockMovementSchema } from '../../../src/schemas/entities';
import * as repo from '../repositories/stock';
import type { AppEnv } from '../lib/context';
import { body } from '../lib/validate';

export const stockRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listStock(c.var.db, c.var.auth.companyId, { q: c.req.query('q') ?? '', kind: c.req.query('kind') ?? '' })))
  .post('/', async (c) => c.json(await repo.createStockItem(c.var.db, c.var.auth.companyId, c.var.auth.userId, await body(c, stockItemSchema)), 201))
  .put('/:id', async (c) => c.json(await repo.updateStockItem(c.var.db, c.var.auth.companyId, c.req.param('id'), await body(c, stockItemSchema))))
  .delete('/:id', async (c) => c.json(await repo.deleteStockItem(c.var.db, c.var.auth.companyId, c.req.param('id'))))
  .get('/:id/movements', async (c) => c.json(await repo.listMovements(c.var.db, c.var.auth.companyId, c.req.param('id'))))
  .post('/:id/movements', async (c) =>
    c.json(await repo.addMovement(c.var.db, c.var.auth.companyId, c.var.auth.userId, c.req.param('id'), await body(c, stockMovementSchema)), 201),
  );
