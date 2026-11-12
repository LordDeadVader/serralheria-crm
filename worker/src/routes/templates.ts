import { Hono } from 'hono';
import { templateSchema } from '../../../src/schemas/templates';
import * as repo from '../repositories/templates';
import { importPresets } from '../database/seed';
import type { AppEnv } from '../lib/context';
import { body } from '../lib/validate';

export const templateRoutes = new Hono<AppEnv>()
  .get('/', async (c) => c.json(await repo.listTemplates(c.var.db, c.var.auth.companyId)))
  .post('/', async (c) => c.json(await repo.createTemplate(c.var.db, c.var.auth.companyId, await body(c, templateSchema)), 201))
  .put('/:id', async (c) => c.json(await repo.updateTemplate(c.var.db, c.var.auth.companyId, c.req.param('id'), await body(c, templateSchema))))
  .delete('/:id', async (c) => c.json(await repo.deleteTemplate(c.var.db, c.var.auth.companyId, c.req.param('id'))));

/** Importa a lista padrão de materiais, serviços e modelos (só o que ainda não existe). */
export const presetRoutes = new Hono<AppEnv>().post('/import', async (c) => c.json(await importPresets(c.var.db, c.var.auth.companyId)));
